<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
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
import {
  AccountType,
  createTransactionSchema,
  TransactionType,
  type TransactionDTO,
} from '@home-ledger/shared';
import { Coffee, CreditCard, HeartPulse, ShieldCheck } from 'lucide-vue-next';
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
const activePresetKey = ref<string | null>(null);

const form = reactive({
  type: TransactionType.EXPENSE as TransactionType,
  amount: '',
  accountId: null as string | null,
  toAccountId: null as string | null,
  categoryId: null as string | null,
  occurredAtMs: Date.now(),
  note: '',
});

const typeHintText = computed(() => {
  if (form.type === TransactionType.INCOME) {
    return '真正赚进口袋的钱：发工资、奖金、报销到账、理财收益、收红包都选「收入」。';
  }
  if (form.type === TransactionType.TRANSFER) {
    return '钱只是在自己兜里挪位置，不算花钱：还信用卡、微信提现、转余额宝、交储蓄险都选「转账」。';
  }
  return '真金白银花出去了：吃饭、购物、房租、买车险/医疗险、刷医保买药都选「支出」。';
});

const scenePresets = [
  { key: 'daily', label: '日常花销', icon: Coffee },
  { key: 'repay-card', label: '还信用卡', icon: CreditCard },
  { key: 'medical', label: '刷医保买药', icon: HeartPulse },
  { key: 'insurance', label: '交车险 / 保费', icon: ShieldCheck },
] as const;

type ScenePresetKey = (typeof scenePresets)[number]['key'];

function findAccountByTypes(types: AccountType[], excludeId?: string | null): string | null {
  const active = ledgerStore.accounts().filter((a) => !a.isArchived && a.id !== excludeId);
  for (const t of types) {
    const found = active.find((a) => a.type === t);
    if (found) return found.id;
  }
  return active[0]?.id ?? null;
}

function findCategoryByKeywords(type: TransactionType, keywords: string[]): string | null {
  const cats = ledgerStore.categories.filter((c) => c.type === type);
  for (const kw of keywords) {
    const found = cats.find((c) => c.name.includes(kw));
    if (found) return found.id;
  }
  return cats[0]?.id ?? null;
}

async function applyScenePreset(key: ScenePresetKey): Promise<void> {
  activePresetKey.value = key;

  if (key === 'daily') {
    form.type = TransactionType.EXPENSE;
    await nextTick();
    form.accountId = findAccountByTypes([
      AccountType.WECHAT,
      AccountType.ALIPAY,
      AccountType.BANK_CARD,
      AccountType.CASH,
    ]);
    form.categoryId = findCategoryByKeywords(TransactionType.EXPENSE, [
      '餐饮',
      '美食',
      '买菜',
      '购物',
      '日用',
    ]);
    form.note = '';
    return;
  }

  if (key === 'repay-card') {
    form.type = TransactionType.TRANSFER;
    await nextTick();
    const outId = findAccountByTypes([
      AccountType.BANK_CARD,
      AccountType.WECHAT,
      AccountType.ALIPAY,
    ]);
    const creditCard = ledgerStore
      .accounts()
      .find((a) => !a.isArchived && a.type === AccountType.CREDIT_CARD && a.id !== outId);
    form.accountId = outId;
    form.toAccountId =
      creditCard?.id ?? findAccountByTypes([AccountType.BANK_CARD, AccountType.OTHER], outId);
    form.note = '还信用卡';
    if (!creditCard) {
      message.info('当前还没有信用卡账户，可先在「资金账户」新建一张，或手动选择转入账户');
    }
    return;
  }

  if (key === 'medical') {
    form.type = TransactionType.EXPENSE;
    await nextTick();
    const medAcc = ledgerStore
      .accounts()
      .find((a) => !a.isArchived && a.type === AccountType.MEDICAL_INSURANCE);
    form.accountId =
      medAcc?.id ??
      findAccountByTypes([AccountType.WECHAT, AccountType.ALIPAY, AccountType.BANK_CARD]);
    form.categoryId = findCategoryByKeywords(TransactionType.EXPENSE, [
      '医疗',
      '健康',
      '医药',
      '买药',
    ]);
    form.note = '医保看病/买药';
    if (!medAcc) {
      message.info('未找到医保账户，可先在「资金账户」新建「医保个人账户」，本次先使用默认账户');
    }
    return;
  }

  form.type = TransactionType.EXPENSE;
  await nextTick();
  form.accountId = findAccountByTypes([
    AccountType.BANK_CARD,
    AccountType.WECHAT,
    AccountType.ALIPAY,
  ]);
  form.categoryId = findCategoryByKeywords(TransactionType.EXPENSE, [
    '保险',
    '汽车',
    '交通',
    '出行',
    '其他',
  ]);
  form.note = '缴纳保费';
}

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
  activePresetKey.value = null;

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
      <div v-if="!editing" class="mb-4">
        <div class="mb-2 text-xs font-medium text-[var(--text-secondary)]">
          常用生活场景（点一下自动选好类型与账户）
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="preset in scenePresets"
            :key="preset.key"
            type="button"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              activePresetKey === preset.key
                ? 'border-[var(--accent)] bg-[var(--accent-tonal)] text-[var(--accent-text)]'
                : 'border-[var(--hairline)] bg-[var(--surface-high)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]'
            "
            @click="applyScenePreset(preset.key)"
          >
            <component :is="preset.icon" class="h-3.5 w-3.5 shrink-0" />
            <span>{{ preset.label }}</span>
          </button>
        </div>
      </div>

      <NFormItem label="交易类型">
        <div class="w-full">
          <NRadioGroup v-model:value="form.type" class="w-full">
            <NRadioButton :value="TransactionType.EXPENSE" class="w-1/3 text-center">
              支出
            </NRadioButton>
            <NRadioButton :value="TransactionType.INCOME" class="w-1/3 text-center">
              收入
            </NRadioButton>
            <NRadioButton :value="TransactionType.TRANSFER" class="w-1/3 text-center">
              转账
            </NRadioButton>
          </NRadioGroup>
          <p class="mt-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
            {{ typeHintText }}
          </p>
        </div>
      </NFormItem>

      <NFormItem label="金额（元）" required>
        <NInput
          v-model:value="form.amount"
          placeholder="0.00"
          size="large"
          clearable
          class="font-semibold tabular-nums"
        >
          <template #prefix>
            <span class="brand-text font-bold">¥</span>
          </template>
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
        <div class="w-full">
          <NDatePicker v-model:value="form.occurredAtMs" type="datetime" />
        </div>
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
