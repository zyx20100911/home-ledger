<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  NButton,
  NDatePicker,
  NEmpty,
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
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_TYPE_GROUP_MAP,
  ACCOUNT_TYPE_LABELS,
  AccountType,
  createAccountSchema,
  formatMoney,
  type AccountDTO,
  type AccountGroupKey,
  type AccountSummaryDTO,
} from '@home-ledger/shared';
import {
  AlertTriangle,
  Archive,
  Banknote,
  Building2,
  CircleDollarSign,
  CreditCard,
  Download,
  HeartPulse,
  Landmark,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-vue-next';
import { createAccount, exportAccountsCsv, fetchAccountSummary, updateAccount } from '@/api/accounts';
import HelpTip from '@/components/HelpTip.vue';
import ImportAccountModal from '@/components/ImportAccountModal.vue';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';

const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();

const loading = ref(false);
const exporting = ref(false);
const showArchived = ref(false);
const summary = ref<AccountSummaryDTO | null>(null);
const showModal = ref(false);
const showImportModal = ref(false);
const submitting = ref(false);
const editingAccount = ref<AccountDTO | null>(null);
const activeTemplateKey = ref<string | null>(null);

const form = reactive({
  name: '',
  type: AccountType.BANK_CARD as AccountType,
  balance: '0.00',
  includeInNetWorth: true,
  institution: '',
  coverageAmount: '',
  renewalDateMs: null as number | null,
  note: '',
});

const accountTemplates = [
  {
    key: 'bank',
    label: '工资储蓄卡',
    name: '工资储蓄卡',
    type: AccountType.BANK_CARD,
    balance: '0.00',
    includeInNetWorth: true,
    note: '',
  },
  {
    key: 'ewallet',
    label: '微信 / 支付宝',
    name: '微信零钱',
    type: AccountType.WECHAT,
    balance: '0.00',
    includeInNetWorth: true,
    note: '',
  },
  {
    key: 'credit',
    label: '信用卡',
    name: '日常信用卡',
    type: AccountType.CREDIT_CARD,
    balance: '0.00',
    includeInNetWorth: true,
    note: '当前欠款请填负数，如 -2000',
  },
  {
    key: 'medical',
    label: '医保个人账户',
    name: '个人医保账户',
    type: AccountType.MEDICAL_INSURANCE,
    balance: '0.00',
    includeInNetWorth: true,
    note: '看病买药可直接从这里记支出',
  },
  {
    key: 'social',
    label: '住房公积金',
    name: '住房公积金',
    type: AccountType.SOCIAL_SECURITY,
    balance: '0.00',
    includeInNetWorth: true,
    note: '',
  },
  {
    key: 'protection-ins',
    label: '车险 / 百万医疗',
    name: '百万医疗险',
    type: AccountType.INSURANCE,
    balance: '0.00',
    includeInNetWorth: false,
    note: '消费型保障，保费记作日常支出',
  },
  {
    key: 'saving-ins',
    label: '增额寿 / 年金险',
    name: '增额终身寿险',
    type: AccountType.INSURANCE,
    balance: '0.00',
    includeInNetWorth: true,
    note: '储蓄型保单，余额填当前现金价值',
  },
] as const;

function applyAccountTemplate(tpl: (typeof accountTemplates)[number]): void {
  activeTemplateKey.value = tpl.key;
  form.name = tpl.name;
  form.type = tpl.type;
  form.balance = tpl.balance;
  form.includeInNetWorth = tpl.includeInNetWorth;
  form.institution = '';
  form.coverageAmount = '';
  form.renewalDateMs = null;
  form.note = tpl.note;
}

const isLiabilityType = computed(
  () => form.type === AccountType.CREDIT_CARD || form.type === AccountType.DEBT,
);

const liabilityPositiveHint = computed(() => {
  if (!isLiabilityType.value) return null;
  const num = Number(form.balance);
  if (Number.isFinite(num) && num > 0) {
    return Math.abs(num).toFixed(2);
  }
  return null;
});

const accountTypeOptions = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  label,
  value: value as AccountType,
}));

const GROUP_ORDER: AccountGroupKey[] = ['liquid', 'investment', 'protection', 'liability'];

const ACCOUNT_ICON_MAP: Record<AccountType, typeof Wallet> = {
  [AccountType.CASH]: Banknote,
  [AccountType.BANK_CARD]: Landmark,
  [AccountType.ALIPAY]: Smartphone,
  [AccountType.WECHAT]: MessageCircle,
  [AccountType.CREDIT_CARD]: CreditCard,
  [AccountType.INVESTMENT]: TrendingUp,
  [AccountType.MEDICAL_INSURANCE]: HeartPulse,
  [AccountType.SOCIAL_SECURITY]: Building2,
  [AccountType.INSURANCE]: ShieldCheck,
  [AccountType.DEBT]: Receipt,
  [AccountType.OTHER]: CircleDollarSign,
};

function getAccountIcon(type: AccountType): typeof Wallet {
  return ACCOUNT_ICON_MAP[type] ?? CircleDollarSign;
}

const isProtectionType = computed(
  () =>
    form.type === AccountType.INSURANCE ||
    form.type === AccountType.MEDICAL_INSURANCE ||
    form.type === AccountType.SOCIAL_SECURITY,
);

const totalCoverage = computed(() => {
  let sum = 0;
  for (const acc of summary.value?.accounts ?? []) {
    if (!acc.isArchived && acc.coverageAmount) {
      sum += Number(acc.coverageAmount);
    }
  }
  return sum > 0 ? sum.toFixed(2) : null;
});

const groupedAccounts = computed(() => {
  const accounts = summary.value?.accounts ?? [];
  return GROUP_ORDER.map((groupKey) => {
    const items = accounts.filter((acc) => ACCOUNT_TYPE_GROUP_MAP[acc.type] === groupKey);
    const subtotal = items
      .filter((a) => !a.isArchived)
      .reduce((sum, a) => sum + Number(a.balance), 0)
      .toFixed(2);
    return {
      key: groupKey,
      label: ACCOUNT_GROUP_LABELS[groupKey],
      subtotal,
      items,
    };
  }).filter((g) => g.items.length > 0);
});

function getRenewalStatus(iso?: string | null): {
  label: string;
  tone: 'expired' | 'soon' | 'normal';
} | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const dateText = iso.slice(0, 10);

  if (diffDays < 0) {
    return { label: `${dateText} · 已到期`, tone: 'expired' };
  }
  if (diffDays <= 30) {
    return { label: `${dateText} · ${diffDays} 天后续保`, tone: 'soon' };
  }
  return { label: `续保 ${dateText}`, tone: 'normal' };
}

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

function handleTypeChange(nextType: AccountType): void {
  if (!editingAccount.value) {
    // 商业保险默认按消费型处理（不计净资产），储蓄型保单用户可手动开启
    form.includeInNetWorth = nextType !== AccountType.INSURANCE;
  }
}

function openCreate(): void {
  editingAccount.value = null;
  activeTemplateKey.value = null;
  form.name = '';
  form.type = AccountType.BANK_CARD;
  form.balance = '0.00';
  form.includeInNetWorth = true;
  form.institution = '';
  form.coverageAmount = '';
  form.renewalDateMs = null;
  form.note = '';
  showModal.value = true;
}

function openEdit(account: AccountDTO): void {
  editingAccount.value = account;
  form.name = account.name;
  form.type = account.type;
  form.balance = account.balance;
  form.includeInNetWorth = account.includeInNetWorth;
  form.institution = account.institution ?? '';
  form.coverageAmount = account.coverageAmount ?? '';
  form.renewalDateMs = account.renewalDate ? new Date(account.renewalDate).getTime() : null;
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
    institution: form.institution.trim() || null,
    coverageAmount: form.coverageAmount.trim() || null,
    renewalDate: form.renewalDateMs ? new Date(form.renewalDateMs).toISOString() : null,
    note: form.note.trim() || null,
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
        institution: parsed.data.institution ?? null,
        coverageAmount: parsed.data.coverageAmount ?? null,
        renewalDate: parsed.data.renewalDate ?? null,
        note: parsed.data.note ?? null,
      });
      message.success('账户已更新');
    } else {
      await createAccount(familyId, {
        ...parsed.data,
        institution: parsed.data.institution ?? null,
        coverageAmount: parsed.data.coverageAmount ?? null,
        renewalDate: parsed.data.renewalDate ?? null,
        note: parsed.data.note ?? null,
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

async function handleExport(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  exporting.value = true;
  try {
    await exportAccountsCsv(familyId, showArchived.value);
    message.success('资金账户清单导出成功');
  } catch (err) {
    message.error(err instanceof Error ? err.message : '导出失败');
  } finally {
    exporting.value = false;
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
      <!-- Tonal 净资产汇总条 -->
      <section class="tonal-surface p-6">
        <div
          class="grid grid-cols-1 gap-6"
          :class="totalCoverage ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'"
        >
          <div>
            <div class="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <span>家庭净资产</span>
              <HelpTip
                text="手里所有计入净资产的钱，减去全部欠款后真正属于家庭的净值。"
                formula="净资产 = 总资产 − 总负债"
              />
            </div>
            <div
              class="mt-2 text-3xl font-semibold tracking-[-0.02em] tabular-nums text-[var(--text-primary)]"
            >
              {{ formatMoney(summary?.netWorth ?? '0') }}
            </div>
          </div>

          <div class="sm:border-l sm:border-[var(--hairline)] sm:pl-6">
            <div class="text-xs font-medium text-[var(--text-muted)]">总资产（正余额合计）</div>
            <div
              class="mt-2 text-2xl font-semibold tracking-tight tabular-nums"
              style="color: var(--positive)"
            >
              {{ formatMoney(summary?.totalAssets ?? '0') }}
            </div>
          </div>

          <div class="sm:border-l sm:border-[var(--hairline)] sm:pl-6">
            <div class="text-xs font-medium text-[var(--text-muted)]">总负债（欠款合计）</div>
            <div
              class="mt-2 text-2xl font-semibold tracking-tight tabular-nums"
              style="color: var(--negative)"
            >
              {{ formatMoney(summary?.totalLiabilities ?? '0') }}
            </div>
          </div>

          <div v-if="totalCoverage" class="lg:border-l lg:border-[var(--hairline)] lg:pl-6">
            <div class="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <span>家庭保障总保额</span>
              <HelpTip
                text="把所有在保商业险的保额加起来（比如百万医疗、重疾、车险三者险），代表遇到大风险时保险公司最高能帮你兜底的额度，不计入日常存款。"
              />
            </div>
            <div
              class="mt-2 text-2xl font-semibold tracking-tight tabular-nums"
              style="color: var(--accent-text)"
            >
              {{ formatMoney(totalCoverage) }}
            </div>
          </div>
        </div>
      </section>

      <!-- 操作栏 -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
          <NSwitch v-model:value="showArchived" size="small" />
          <span>显示已归档账户</span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <NButton size="small" @click="showImportModal = true">
            <template #icon><Upload class="h-3.5 w-3.5" /></template>
            导入
          </NButton>
          <NButton size="small" :loading="exporting" @click="handleExport">
            <template #icon><Download class="h-3.5 w-3.5" /></template>
            导出
          </NButton>
          <NButton type="primary" size="small" @click="openCreate">
            <template #icon><Plus class="h-4 w-4" /></template>
            新增账户
          </NButton>
        </div>
      </div>

      <!-- 分组账户列表 -->
      <div v-if="!summary?.accounts.length && !loading" class="tonal-surface py-14">
        <NEmpty description="暂无资金账户，点击右上角「新增账户」或「导入」开始添加" />
      </div>

      <div v-else class="space-y-6">
        <section v-for="group in groupedAccounts" :key="group.key" class="space-y-3">
          <div class="flex items-center justify-between px-1">
            <h2 class="text-xs font-semibold text-[var(--text-secondary)]">
              {{ group.label }}
              <span class="ml-1.5 font-normal text-[var(--text-muted)]">({{ group.items.length }})</span>
            </h2>
            <span class="text-xs font-medium tabular-nums text-[var(--text-muted)]">
              小计 {{ formatMoney(group.subtotal) }}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="acc in group.items"
              :key="acc.id"
              class="tonal-surface flex flex-col justify-between p-5 transition-colors hover:bg-[var(--surface-high)]/60"
              :class="{ 'opacity-55': acc.isArchived }"
            >
              <div>
                <div class="flex items-start justify-between gap-3">
                  <div class="flex min-w-0 items-start gap-3">
                    <div
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      :style="{
                        backgroundColor:
                          Number(acc.balance) < 0
                            ? 'var(--negative-tonal)'
                            : acc.type === AccountType.INSURANCE
                              ? 'var(--accent-tonal)'
                              : 'var(--surface-high)',
                        color:
                          Number(acc.balance) < 0
                            ? 'var(--negative)'
                            : acc.type === AccountType.INSURANCE
                              ? 'var(--accent-text)'
                              : 'var(--text-secondary)',
                      }"
                    >
                      <component :is="getAccountIcon(acc.type)" class="h-4 w-4" />
                    </div>

                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <h3 class="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {{ acc.name }}
                        </h3>
                        <NTag size="tiny" :bordered="false" type="default">
                          {{ ACCOUNT_TYPE_LABELS[acc.type] }}
                        </NTag>
                        <NTag v-if="acc.isArchived" size="tiny" type="warning">已归档</NTag>
                      </div>
                      <p
                        v-if="acc.institution || acc.note"
                        class="mt-1 truncate text-xs text-[var(--text-muted)]"
                      >
                        {{ [acc.institution, acc.note].filter(Boolean).join(' · ') }}
                      </p>
                    </div>
                  </div>

                  <div class="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      class="cursor-pointer rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-high)] hover:text-[var(--text-primary)]"
                      title="编辑 / 校准余额"
                      @click="openEdit(acc)"
                    >
                      <Pencil class="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      class="cursor-pointer rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-high)] hover:text-[var(--warning)]"
                      :title="acc.isArchived ? '取消归档' : '归档账户'"
                      @click="toggleArchive(acc)"
                    >
                      <Archive class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <!-- 商业保险 / 保障信息徽标行 -->
                <div
                  v-if="acc.coverageAmount || acc.renewalDate"
                  class="mt-3.5 flex flex-wrap items-center gap-2 text-[11px]"
                >
                  <span
                    v-if="acc.coverageAmount"
                    class="rounded-full bg-[var(--surface-high)] px-2.5 py-0.5 font-medium tabular-nums text-[var(--text-secondary)]"
                  >
                    保额 {{ formatMoney(acc.coverageAmount) }}
                  </span>
                  <span
                    v-if="getRenewalStatus(acc.renewalDate)"
                    class="rounded-full px-2.5 py-0.5 font-medium tabular-nums"
                    :style="{
                      backgroundColor:
                        getRenewalStatus(acc.renewalDate)?.tone === 'expired'
                          ? 'var(--negative-tonal)'
                          : getRenewalStatus(acc.renewalDate)?.tone === 'soon'
                            ? 'rgba(245, 158, 11, 0.14)'
                            : 'var(--surface-high)',
                      color:
                        getRenewalStatus(acc.renewalDate)?.tone === 'expired'
                          ? 'var(--negative)'
                          : getRenewalStatus(acc.renewalDate)?.tone === 'soon'
                            ? 'var(--warning)'
                            : 'var(--text-muted)',
                    }"
                  >
                    {{ getRenewalStatus(acc.renewalDate)?.label }}
                  </span>
                </div>
              </div>

              <div
                class="mt-4 flex items-end justify-between border-t border-[var(--hairline)] pt-3.5"
              >
                <div
                  v-if="
                    acc.type === AccountType.INSURANCE &&
                    !acc.includeInNetWorth &&
                    Number(acc.balance) === 0
                  "
                  class="text-xs font-medium text-[var(--text-secondary)]"
                >
                  纯保障型保单
                </div>
                <div
                  v-else
                  class="text-xl font-semibold tracking-tight tabular-nums"
                  :style="{
                    color: Number(acc.balance) < 0 ? 'var(--negative)' : 'var(--text-primary)',
                  }"
                >
                  {{ formatMoney(acc.balance) }}
                </div>

                <span class="text-[11px] text-[var(--text-muted)]">
                  {{ acc.includeInNetWorth ? '计入净资产' : '不计入净资产' }}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <NModal
      v-model:show="showModal"
      preset="card"
      :title="editingAccount ? '编辑资金账户' : '新增资金账户'"
      class="max-w-lg"
    >
      <NForm label-placement="top" :disabled="submitting">
        <div v-if="!editingAccount" class="mb-4">
          <div class="mb-2 text-xs font-medium text-[var(--text-secondary)]">
            不知道选哪种类型？点一下常见账户自动填好
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="tpl in accountTemplates"
              :key="tpl.key"
              type="button"
              class="cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
              :class="
                activeTemplateKey === tpl.key
                  ? 'border-[var(--accent)] bg-[var(--accent-tonal)] text-[var(--accent-text)]'
                  : 'border-[var(--hairline)] bg-[var(--surface-high)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]'
              "
              @click="applyAccountTemplate(tpl)"
            >
              {{ tpl.label }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <NFormItem label="账户名称" required>
            <NInput
              v-model:value="form.name"
              placeholder="例如：招行储蓄卡 / 家庭车险 / 个人医保"
            />
          </NFormItem>
          <NFormItem label="账户类型" required>
            <NSelect
              v-model:value="form.type"
              :options="accountTypeOptions"
              @update:value="handleTypeChange"
            />
          </NFormItem>
        </div>

        <div
          v-if="form.type === AccountType.INSURANCE"
          class="mb-4 rounded-xl bg-[var(--accent-tonal)] px-3.5 py-2.5 text-xs text-[var(--accent-text)]"
        >
          消费型险种（车险/财险/百万医疗）现金价值为 0，默认不计入净资产；若为储蓄型保单（增额寿/年金险），可填写当前现金价值并开启「计入家庭净资产」。
        </div>

        <div class="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <NFormItem
            :label="
              form.type === AccountType.INSURANCE
                ? '保单现金价值（元，消费型填 0）'
                : editingAccount
                  ? '当前余额（元，可校准）'
                  : '初始余额（元，欠款填负数）'
            "
          >
            <div class="w-full">
              <NInput v-model:value="form.balance" placeholder="0.00">
                <template #prefix>¥</template>
              </NInput>
              <div
                v-if="liabilityPositiveHint"
                class="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--negative-tonal)] px-3 py-2 text-[11px] text-[var(--negative)]"
              >
                <span class="inline-flex items-center gap-1.5">
                  <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
                  <span>
                    如果你目前欠款 ¥{{ liabilityPositiveHint }}，请填负数 -{{ liabilityPositiveHint }}（正数表示多存的溢缴款）
                  </span>
                </span>
                <button
                  type="button"
                  class="cursor-pointer font-semibold underline"
                  @click="form.balance = `-${liabilityPositiveHint}`"
                >
                  一键改为负数
                </button>
              </div>
            </div>
          </NFormItem>

          <NFormItem>
            <template #label>
              <span class="inline-flex items-center gap-1">
                <span>计入家庭净资产</span>
                <HelpTip
                  text="开启后，这个账户的余额会算进首页的「家庭净资产」。日常储蓄卡、微信、信用卡、医保建议开启；车险/百万医疗等纯消费型保单建议关闭。"
                />
              </span>
            </template>
            <div class="flex h-8 items-center gap-2.5">
              <NSwitch v-model:value="form.includeInNetWorth" />
              <span class="text-xs text-[var(--text-muted)]">
                {{ form.includeInNetWorth ? '计入净资产汇总' : '仅作专户/保障台账展示' }}
              </span>
            </div>
          </NFormItem>
        </div>

        <!-- 保险 / 医保 / 社保扩展字段 -->
        <div v-if="isProtectionType" class="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <NFormItem :label="form.type === AccountType.INSURANCE ? '承保保险公司（选填）' : '所属机构 / 城市（选填）'">
            <NInput
              v-model:value="form.institution"
              :placeholder="form.type === AccountType.INSURANCE ? '例如：中国平安 / 友邦' : '例如：上海市医保局'"
            />
          </NFormItem>

          <NFormItem v-if="form.type === AccountType.INSURANCE" label="保障保额（元，选填）">
            <NInput v-model:value="form.coverageAmount" placeholder="例如：4000000.00">
              <template #prefix>¥</template>
            </NInput>
          </NFormItem>

          <NFormItem v-if="form.type === AccountType.INSURANCE" label="续保 / 到期日（选填）">
            <div class="w-full">
              <NDatePicker
                v-model:value="form.renewalDateMs"
                type="date"
                clearable
                placeholder="选择续保到期日"
              />
            </div>
          </NFormItem>
        </div>

        <NFormItem label="备注">
          <NInput v-model:value="form.note" placeholder="选填，如卡尾号、保单号或保障范围说明" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSave">保存</NButton>
        </div>
      </template>
    </NModal>

    <ImportAccountModal v-model:show="showImportModal" />
  </NSpin>
</template>
