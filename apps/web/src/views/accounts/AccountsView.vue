<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NSwitch,
  NTag,
  useMessage,
} from 'naive-ui';
import {
  ACCOUNT_TYPE_LABELS,
  AccountType,
  createAccountSchema,
  formatMoney,
  type AccountDTO,
  type AccountSummaryDTO,
} from '@home-ledger/shared';
import { Archive, Pencil, Plus } from 'lucide-vue-next';
import { createAccount, fetchAccountSummary, updateAccount } from '@/api/accounts';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';

const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();

const loading = ref(false);
const showArchived = ref(false);
const summary = ref<AccountSummaryDTO | null>(null);
const showModal = ref(false);
const submitting = ref(false);
const editingAccount = ref<AccountDTO | null>(null);

const form = reactive({
  name: '',
  type: AccountType.BANK_CARD as AccountType,
  balance: '0.00',
  includeInNetWorth: true,
  note: '',
});

const accountTypeOptions = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  label,
  value: value as AccountType,
}));

async function loadAccounts(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  loading.value = true;
  try {
    summary.value = await fetchAccountSummary(familyId, showArchived.value);
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载资金账户失败');
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editingAccount.value = null;
  form.name = '';
  form.type = AccountType.BANK_CARD;
  form.balance = '0.00';
  form.includeInNetWorth = true;
  form.note = '';
  showModal.value = true;
}

function openEdit(account: AccountDTO): void {
  editingAccount.value = account;
  form.name = account.name;
  form.type = account.type;
  form.balance = account.balance;
  form.includeInNetWorth = account.includeInNetWorth;
  form.note = account.note ?? '';
  showModal.value = true;
}

async function handleSave(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  const parsed = createAccountSchema.safeParse({
    name: form.name,
    type: form.type,
    balance: form.balance,
    includeInNetWorth: form.includeInNetWorth,
    note: form.note.trim() || undefined,
  });
  if (!parsed.success) {
    message.warning(parsed.error.issues[0]?.message || '请检查账户信息');
    return;
  }

  submitting.value = true;
  try {
    if (editingAccount.value) {
      await updateAccount(familyId, editingAccount.value.id, {
        ...parsed.data,
        note: parsed.data.note ?? null,
      });
      message.success('账户已更新');
    } else {
      await createAccount(familyId, {
        ...parsed.data,
        note: parsed.data.note ?? undefined,
      });
      message.success('账户创建成功');
    }
    showModal.value = false;
    await ledgerStore.loadFamilyMetadata(familyId);
    ledgerStore.bumpVersion();
    await loadAccounts();
  } catch (err) {
    message.error(err instanceof Error ? err.message : '保存账户失败');
  } finally {
    submitting.value = false;
  }
}

async function toggleArchive(account: AccountDTO): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  try {
    await updateAccount(familyId, account.id, { isArchived: !account.isArchived });
    message.success(account.isArchived ? '账户已恢复启用' : '账户已归档');
    await ledgerStore.loadFamilyMetadata(familyId);
    ledgerStore.bumpVersion();
    await loadAccounts();
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败');
  }
}

watch(
  [() => authStore.currentFamilyId, showArchived, () => ledgerStore.dataVersion],
  () => {
    void loadAccounts();
  },
  { immediate: true },
);
</script>

<template>
  <NSpin :show="loading">
    <div class="space-y-6">
      <!-- 净资产汇总 -->
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div class="text-xs font-medium text-slate-500">家庭净资产</div>
          <div class="mt-2 text-2xl font-bold text-slate-900">
            {{ formatMoney(summary?.netWorth ?? '0') }}
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div class="text-xs font-medium text-slate-500">总资产（正余额合计）</div>
          <div class="mt-2 text-2xl font-bold text-emerald-600">
            {{ formatMoney(summary?.totalAssets ?? '0') }}
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div class="text-xs font-medium text-slate-500">总负债（欠款合计）</div>
          <div class="mt-2 text-2xl font-bold text-rose-600">
            {{ formatMoney(summary?.totalLiabilities ?? '0') }}
          </div>
        </div>
      </section>

      <!-- 操作栏 -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-xs text-slate-600">
          <NSwitch v-model:value="showArchived" size="small" />
          <span>显示已归档账户</span>
        </div>
        <NButton type="primary" size="small" @click="openCreate">
          <template #icon><Plus class="h-4 w-4" /></template>
          新增账户
        </NButton>
      </div>

      <!-- 账户卡片列表 -->
      <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="acc in summary?.accounts ?? []"
          :key="acc.id"
          class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs transition-shadow hover:shadow-xs"
          :class="{ 'opacity-60': acc.isArchived }"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-slate-900">{{ acc.name }}</h3>
                <NTag size="tiny" :bordered="false" type="default">
                  {{ ACCOUNT_TYPE_LABELS[acc.type] }}
                </NTag>
                <NTag v-if="acc.isArchived" size="tiny" type="warning">已归档</NTag>
              </div>
              <p v-if="acc.note" class="mt-1 text-xs text-slate-400">{{ acc.note }}</p>
            </div>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="编辑 / 校准余额"
                @click="openEdit(acc)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600"
                :title="acc.isArchived ? '取消归档' : '归档账户'"
                @click="toggleArchive(acc)"
              >
                <Archive class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div class="mt-4 flex items-end justify-between">
            <div
              class="text-xl font-bold tabular-nums"
              :class="Number(acc.balance) < 0 ? 'text-rose-600' : 'text-slate-900'"
            >
              {{ formatMoney(acc.balance) }}
            </div>
            <span class="text-[11px] text-slate-400">
              {{ acc.includeInNetWorth ? '计入净资产' : '不计入净资产' }}
            </span>
          </div>
        </div>
      </section>
    </div>

    <NModal
      v-model:show="showModal"
      preset="card"
      :title="editingAccount ? '编辑资金账户' : '新增资金账户'"
      class="max-w-md"
    >
      <NForm label-placement="top" :disabled="submitting">
        <NFormItem label="账户名称" required>
          <NInput v-model:value="form.name" placeholder="例如：招商银行储蓄卡 / 支付宝" />
        </NFormItem>
        <NFormItem label="账户类型" required>
          <NSelect v-model:value="form.type" :options="accountTypeOptions" />
        </NFormItem>
        <NFormItem
          :label="editingAccount ? '当前余额（元，可校准）' : '初始余额（元，信用卡欠款填负数）'"
        >
          <NInput v-model:value="form.balance" placeholder="0.00">
            <template #prefix>¥</template>
          </NInput>
        </NFormItem>
        <NFormItem label="计入家庭净资产">
          <NSwitch v-model:value="form.includeInNetWorth" />
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="form.note" placeholder="选填，如卡尾号或用途说明" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSave">保存</NButton>
        </div>
      </template>
    </NModal>
  </NSpin>
</template>
