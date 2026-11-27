<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  NButton,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSelect,
  useMessage,
} from 'naive-ui';
import { createTransactionSchema, TransactionType, type TransactionDTO } from '@home-ledger/shared';
import { createTransaction, updateTransaction } from '@/api/transactions';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';

const props = defineProps<{
  show: boolean;
  editing?: TransactionDTO | null;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  saved: [];
}>();

const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();

const submitting = ref(false);

const form = reactive({
  type: TransactionType.EXPENSE as TransactionType,
  amount: '',
  accountId: null as string | null,
  toAccountId: null as string | null,
  categoryId: null as string | null,
  occurredAtMs: Date.now(),
  note: '',
});

const accountOptions = computed(() =>
  ledgerStore
    .accounts()
    .filter((a) => !a.isArchived)
    .map((a) => ({
      label: `${a.name} (余额 ¥${a.balance})`,
      value: a.id,
    })),
);

const filteredCategoryOptions = computed(() => {
  if (form.type === TransactionType.TRANSFER) return [];
  return ledgerStore.categories
    .filter((c) => c.type === form.type)
    .map((c) => ({
      label: c.name,
      value: c.id,
    }));
});

function initForm(): void {
  if (props.editing) {
    form.type = props.editing.type;
    form.amount = props.editing.amount;
    form.accountId = props.editing.accountId;
    form.toAccountId = props.editing.toAccountId ?? null;
    form.categoryId = props.editing.categoryId ?? null;
    form.occurredAtMs = new Date(props.editing.occurredAt).getTime();
    form.note = props.editing.note ?? '';
    return;
  }

  form.type = TransactionType.EXPENSE;
  form.amount = '';
  form.accountId = accountOptions.value[0]?.value ?? null;
  form.toAccountId = accountOptions.value[1]?.value ?? null;
  form.categoryId =
    ledgerStore.categories.find((c) => c.type === TransactionType.EXPENSE)?.id ?? null;
  form.occurredAtMs = Date.now();
  form.note = '';
}

watch(
  () => props.show,
  (visible) => {
    if (visible) initForm();
  },
);

watch(
  () => form.type,
  (nextType) => {
    if (nextType === TransactionType.TRANSFER) {
      form.categoryId = null;
      if (!form.toAccountId || form.toAccountId === form.accountId) {
        form.toAccountId =
          accountOptions.value.find((a) => a.value !== form.accountId)?.value ?? null;
      }
    } else {
      const valid = ledgerStore.categories.some(
        (c) => c.id === form.categoryId && c.type === nextType,
      );
      if (!valid) {
        form.categoryId = ledgerStore.categories.find((c) => c.type === nextType)?.id ?? null;
      }
    }
  },
);

async function handleSubmit(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  const payload = {
    type: form.type,
    amount: form.amount.trim(),
    accountId: form.accountId ?? '',
    toAccountId: form.type === TransactionType.TRANSFER ? form.toAccountId : null,
    categoryId: form.type === TransactionType.TRANSFER ? null : form.categoryId,
    occurredAt: new Date(form.occurredAtMs).toISOString(),
    note: form.note.trim() || null,
    tags: [],
  };

  const parsed = createTransactionSchema.safeParse(payload);
  if (!parsed.success) {
    message.warning(parsed.error.issues[0]?.message || '请检查表单输入');
    return;
  }

  submitting.value = true;
  try {
    if (props.editing) {
      await updateTransaction(familyId, props.editing.id, parsed.data);
      message.success('交易流水已更新，账户余额已同步');
    } else {
      await createTransaction(familyId, parsed.data);
      message.success('记账成功，账户余额已更新');
    }
    await ledgerStore.loadFamilyMetadata(familyId);
    ledgerStore.bumpVersion();
    emit('saved');
    emit('update:show', false);
  } catch (err) {
    message.error(err instanceof Error ? err.message : '保存失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="editing ? '编辑交易流水' : '记一笔'"
    class="max-w-lg"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="top" :disabled="submitting">
      <NFormItem label="交易类型">
        <NRadioGroup v-model:value="form.type" class="w-full">
          <NRadioButton :value="TransactionType.EXPENSE" class="w-1/3 text-center"
            >支出</NRadioButton
          >
          <NRadioButton :value="TransactionType.INCOME" class="w-1/3 text-center"
            >收入</NRadioButton
          >
          <NRadioButton :value="TransactionType.TRANSFER" class="w-1/3 text-center">
            转账
          </NRadioButton>
        </NRadioGroup>
      </NFormItem>

      <NFormItem label="金额（元）" required>
        <NInput v-model:value="form.amount" placeholder="例如 68.50" size="large" clearable>
          <template #prefix>¥</template>
        </NInput>
      </NFormItem>

      <div class="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <NFormItem
          :label="form.type === TransactionType.TRANSFER ? '转出账户' : '资金账户'"
          required
        >
          <NSelect
            v-model:value="form.accountId"
            :options="accountOptions"
            placeholder="请选择账户"
          />
        </NFormItem>

        <NFormItem v-if="form.type === TransactionType.TRANSFER" label="转入账户" required>
          <NSelect
            v-model:value="form.toAccountId"
            :options="accountOptions"
            placeholder="请选择转入账户"
          />
        </NFormItem>

        <NFormItem v-else label="收支分类" required>
          <NSelect
            v-model:value="form.categoryId"
            :options="filteredCategoryOptions"
            filterable
            placeholder="请选择分类"
          />
        </NFormItem>
      </div>

      <NFormItem label="发生时间" required>
        <NDatePicker v-model:value="form.occurredAtMs" type="datetime" class="w-full" />
      </NFormItem>

      <NFormItem label="备注">
        <NInput
          v-model:value="form.note"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 3 }"
          placeholder="记录消费明细或用途（选填）"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="flex justify-end gap-2">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="handleSubmit">
          {{ editing ? '保存修改' : '确认记账' }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>
