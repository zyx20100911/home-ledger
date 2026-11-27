<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  NButton,
  NCheckbox,
  NDatePicker,
  NEmpty,
  NInput,
  NModal,
  NPagination,
  NPopconfirm,
  NSelect,
  NSpin,
  NTag,
  useMessage,
} from 'naive-ui';
import {
  formatMoney,
  TRANSACTION_TYPE_LABELS,
  TransactionType,
  type TransactionDTO,
} from '@home-ledger/shared';
import {
  ArrowRight,
  Download,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-vue-next';
import {
  batchDeleteTransactions,
  batchUpdateTransactions,
  deleteTransaction,
  exportTransactionsCsv,
  fetchTransactions,
} from '@/api/transactions';
import ImportTransactionModal from '@/components/ImportTransactionModal.vue';
import TransactionModal from '@/components/TransactionModal.vue';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';

const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();

const loading = ref(false);
const exporting = ref(false);
const batchBusy = ref(false);
const items = ref<TransactionDTO[]>([]);
const total = ref(0);
const showModal = ref(false);
const showImportModal = ref(false);
const editingItem = ref<TransactionDTO | null>(null);

const selectedIds = ref<string[]>([]);
const showBatchCategoryModal = ref(false);
const showBatchAccountModal = ref(false);
const batchCategoryId = ref<string | null>(null);
const batchAccountId = ref<string | null>(null);

const filters = reactive({
  monthMs: Date.now() as number | null,
  type: null as TransactionType | null,
  accountId: null as string | null,
  categoryId: null as string | null,
  keyword: '',
  page: 1,
  pageSize: 15,
});

const typeOptions = [
  { label: '支出', value: TransactionType.EXPENSE },
  { label: '收入', value: TransactionType.INCOME },
  { label: '转账', value: TransactionType.TRANSFER },
];

const accountOptions = computed(() =>
  ledgerStore.accounts().map((a) => ({ label: a.name, value: a.id })),
);

const activeAccountOptions = computed(() =>
  ledgerStore
    .accounts()
    .filter((a) => !a.isArchived)
    .map((a) => ({ label: a.name, value: a.id })),
);

const categoryOptions = computed(() =>
  ledgerStore.categories.map((c) => ({
    label: `${c.type === 'EXPENSE' ? '[支]' : '[收]'} ${c.name}`,
    value: c.id,
  })),
);

const selectedSet = computed(() => new Set(selectedIds.value));

const selectedItems = computed(() => items.value.filter((i) => selectedSet.value.has(i.id)));

const allSelected = computed(
  () => items.value.length > 0 && selectedItems.value.length === items.value.length,
);

const indeterminate = computed(
  () => selectedItems.value.length > 0 && selectedItems.value.length < items.value.length,
);

const selectedSummary = computed(() => {
  let income = 0;
  let expense = 0;
  for (const item of selectedItems.value) {
    const val = Number(item.amount);
    if (item.type === TransactionType.INCOME) income += val;
    else if (item.type === TransactionType.EXPENSE) expense += val;
  }
  return { income: income.toFixed(2), expense: expense.toFixed(2) };
});

const batchTargetType = computed<TransactionType | null>(() => {
  if (!selectedItems.value.length) return null;
  const firstType = selectedItems.value[0]!.type;
  return selectedItems.value.every((i) => i.type === firstType) ? firstType : null;
});

const batchCategoryOptions = computed(() => {
  if (!batchTargetType.value || batchTargetType.value === TransactionType.TRANSFER) return [];
  return ledgerStore.categories
    .filter((c) => c.type === (batchTargetType.value as string))
    .map((c) => ({ label: c.name, value: c.id }));
});

function buildDateRange(): { startDate?: string; endDate?: string } {
  if (!filters.monthMs) return {};
  const d = new Date(filters.monthMs);
  return {
    startDate: new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0).toISOString(),
    endDate: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
  };
}

async function loadTransactions(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  const { startDate, endDate } = buildDateRange();

  loading.value = true;
  try {
    const res = await fetchTransactions(familyId, {
      page: filters.page,
      pageSize: filters.pageSize,
      type: filters.type ?? undefined,
      accountId: filters.accountId ?? undefined,
      categoryId: filters.categoryId ?? undefined,
      startDate,
      endDate,
      keyword: filters.keyword.trim() || undefined,
    });
    items.value = res.items;
    total.value = res.total;
    selectedIds.value = [];
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载流水失败');
  } finally {
    loading.value = false;
  }
}

function toggleSelectAll(checked: boolean): void {
  selectedIds.value = checked ? items.value.map((i) => i.id) : [];
}

function toggleRowSelection(id: string, checked: boolean): void {
  if (checked) {
    if (!selectedSet.value.has(id)) {
      selectedIds.value = [...selectedIds.value, id];
    }
  } else {
    selectedIds.value = selectedIds.value.filter((item) => item !== id);
  }
}

function openCreate(): void {
  editingItem.value = null;
  showModal.value = true;
}

function openEdit(item: TransactionDTO): void {
  editingItem.value = item;
  showModal.value = true;
}

async function handleDelete(item: TransactionDTO): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  try {
    await deleteTransaction(familyId, item.id);
    message.success('流水已删除，对应账户余额已回滚');
    await ledgerStore.loadFamilyMetadata(familyId);
    ledgerStore.bumpVersion();
  } catch (err) {
    message.error(err instanceof Error ? err.message : '删除失败');
  }
}

async function handleExport(onlySelected = false): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  const { startDate, endDate } = buildDateRange();
  exporting.value = true;
  try {
    await exportTransactionsCsv(
      familyId,
      onlySelected
        ? { ids: selectedIds.value }
        : {
            type: filters.type ?? undefined,
            accountId: filters.accountId ?? undefined,
            categoryId: filters.categoryId ?? undefined,
            startDate,
            endDate,
            keyword: filters.keyword.trim() || undefined,
          },
    );
    message.success(onlySelected ? `已导出选中的 ${selectedIds.value.length} 笔流水` : '流水导出成功');
  } catch (err) {
    message.error(err instanceof Error ? err.message : '导出失败');
  } finally {
    exporting.value = false;
  }
}

async function handleBatchDelete(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId || !selectedIds.value.length) return;

  batchBusy.value = true;
  try {
    const res = await batchDeleteTransactions(familyId, selectedIds.value);
    message.success(`已批量删除 ${res.deletedCount} 笔流水，相关账户余额已回滚`);
    selectedIds.value = [];
    await ledgerStore.loadFamilyMetadata(familyId);
    ledgerStore.bumpVersion();
  } catch (err) {
    message.error(err instanceof Error ? err.message : '批量删除失败');
  } finally {
    batchBusy.value = false;
  }
}

function openBatchCategoryModal(): void {
  if (!selectedItems.value.length) return;
  if (selectedItems.value.some((i) => i.type === TransactionType.TRANSFER)) {
    message.warning('勾选记录中包含「转账」流水，转账不支持设置分类，请取消勾选后再试');
    return;
  }
  if (!batchTargetType.value) {
    message.warning('不可同时混选「支出」和「收入」修改同一分类，请分开勾选');
    return;
  }
  batchCategoryId.value = batchCategoryOptions.value[0]?.value ?? null;
  showBatchCategoryModal.value = true;
}

function openBatchAccountModal(): void {
  if (!selectedItems.value.length) return;
  batchAccountId.value = activeAccountOptions.value[0]?.value ?? null;
  showBatchAccountModal.value = true;
}

async function submitBatchCategory(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId || !batchCategoryId.value) return;

  batchBusy.value = true;
  try {
    const res = await batchUpdateTransactions(familyId, {
      ids: selectedIds.value,
      categoryId: batchCategoryId.value,
    });
    message.success(`已将 ${res.updatedCount} 笔流水的分类更新`);
    showBatchCategoryModal.value = false;
    selectedIds.value = [];
    ledgerStore.bumpVersion();
  } catch (err) {
    message.error(err instanceof Error ? err.message : '批量修改分类失败');
  } finally {
    batchBusy.value = false;
  }
}

async function submitBatchAccount(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId || !batchAccountId.value) return;

  batchBusy.value = true;
  try {
    const res = await batchUpdateTransactions(familyId, {
      ids: selectedIds.value,
      accountId: batchAccountId.value,
    });
    message.success(`已将 ${res.updatedCount} 笔流水迁移至目标账户，余额已自动重算`);
    showBatchAccountModal.value = false;
    selectedIds.value = [];
    await ledgerStore.loadFamilyMetadata(familyId);
    ledgerStore.bumpVersion();
  } catch (err) {
    message.error(err instanceof Error ? err.message : '批量修改账户失败');
  } finally {
    batchBusy.value = false;
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resetFilters(): void {
  filters.monthMs = Date.now();
  filters.type = null;
  filters.accountId = null;
  filters.categoryId = null;
  filters.keyword = '';
  filters.page = 1;
}

watch(
  [
    () => authStore.currentFamilyId,
    () => filters.monthMs,
    () => filters.type,
    () => filters.accountId,
    () => filters.categoryId,
    () => filters.page,
    () => ledgerStore.dataVersion,
  ],
  () => {
    void loadTransactions();
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-4">
    <!-- 筛选与导入导出操作栏 -->
    <div class="tonal-surface p-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-36 shrink-0">
          <NDatePicker
            v-model:value="filters.monthMs"
            type="month"
            clearable
            placeholder="全部月份"
          />
        </div>
        <div class="w-28 shrink-0">
          <NSelect
            v-model:value="filters.type"
            :options="typeOptions"
            clearable
            placeholder="交易类型"
          />
        </div>
        <div class="w-36 shrink-0">
          <NSelect
            v-model:value="filters.accountId"
            :options="accountOptions"
            clearable
            placeholder="资金账户"
          />
        </div>
        <div class="w-44 shrink-0">
          <NSelect
            v-model:value="filters.categoryId"
            :options="categoryOptions"
            clearable
            filterable
            placeholder="收支分类"
          />
        </div>
        <div class="w-48 shrink-0">
          <NInput
            v-model:value="filters.keyword"
            placeholder="搜索备注关键词..."
            clearable
            @keyup.enter="
              filters.page = 1;
              loadTransactions();
            "
          >
            <template #prefix>
              <Search class="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </template>
          </NInput>
        </div>

        <div class="flex items-center gap-1.5">
          <NButton
            size="medium"
            @click="
              filters.page = 1;
              loadTransactions();
            "
          >
            搜索
          </NButton>
          <NButton size="medium" quaternary @click="resetFilters">重置</NButton>
        </div>

        <div class="ml-auto flex flex-wrap items-center gap-2">
          <NButton size="medium" @click="showImportModal = true">
            <template #icon><Upload class="h-4 w-4" /></template>
            导入
          </NButton>
          <NButton size="medium" :loading="exporting" @click="handleExport(false)">
            <template #icon><Download class="h-4 w-4" /></template>
            导出
          </NButton>
          <NButton type="primary" size="medium" @click="openCreate">
            <template #icon><Plus class="h-4 w-4" /></template>
            记一笔
          </NButton>
        </div>
      </div>
    </div>

    <!-- 批量操作栏（勾选至少一条后出现） -->
    <div
      v-if="selectedIds.length > 0"
      class="tonal-surface flex flex-wrap items-center justify-between gap-3 px-5 py-3"
      style="background-color: var(--accent-tonal)"
    >
      <div class="flex flex-wrap items-center gap-3 text-xs">
        <span class="font-semibold text-[var(--accent-text)]">
          已选 {{ selectedIds.length }} 笔流水
        </span>
        <span class="text-[var(--text-secondary)] tabular-nums">
          收入 +{{ formatMoney(selectedSummary.income) }} · 支出 -{{ formatMoney(selectedSummary.expense) }}
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <NButton size="small" :disabled="batchBusy" @click="openBatchCategoryModal">
          <template #icon><Tags class="h-3.5 w-3.5" /></template>
          改分类
        </NButton>
        <NButton size="small" :disabled="batchBusy" @click="openBatchAccountModal">
          <template #icon><Wallet class="h-3.5 w-3.5" /></template>
          改账户
        </NButton>
        <NButton size="small" :loading="exporting" :disabled="batchBusy" @click="handleExport(true)">
          <template #icon><Download class="h-3.5 w-3.5" /></template>
          导出选中
        </NButton>
        <NPopconfirm @positive-click="handleBatchDelete">
          <template #trigger>
            <NButton size="small" type="error" secondary :loading="batchBusy">
              <template #icon><Trash2 class="h-3.5 w-3.5" /></template>
              批量删除
            </NButton>
          </template>
          确认批量删除这 {{ selectedIds.length }} 笔流水？删除后将自动回滚所有关联账户余额。
        </NPopconfirm>
        <NButton size="small" quaternary @click="selectedIds = []">取消选择</NButton>
      </div>
    </div>

    <!-- 流水列表 -->
    <NSpin :show="loading">
      <div class="tonal-surface overflow-hidden">
        <div v-if="!items.length && !loading" class="py-16">
          <NEmpty description="暂无符合条件的交易流水，点击右上角「记一笔」或「导入」开始记账" />
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-[var(--hairline)] text-xs text-[var(--text-muted)]">
              <tr>
                <th class="w-11 py-3.5 pl-5 pr-2">
                  <NCheckbox
                    :checked="allSelected"
                    :indeterminate="indeterminate"
                    @update:checked="toggleSelectAll"
                  />
                </th>
                <th class="px-4 py-3.5 font-medium">时间</th>
                <th class="px-4 py-3.5 font-medium">类型 / 分类</th>
                <th class="px-4 py-3.5 font-medium">资金账户</th>
                <th class="px-4 py-3.5 font-medium">备注</th>
                <th class="px-4 py-3.5 font-medium">记账人</th>
                <th class="px-4 py-3.5 text-right font-medium">金额</th>
                <th class="px-6 py-3.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--hairline)]">
              <tr
                v-for="item in items"
                :key="item.id"
                class="transition-colors hover:bg-[var(--surface-hover)]"
                :class="selectedSet.has(item.id) ? 'bg-[var(--accent-tonal)]/40' : ''"
              >
                <td class="py-3.5 pl-5 pr-2">
                  <NCheckbox
                    :checked="selectedSet.has(item.id)"
                    @update:checked="(val: boolean) => toggleRowSelection(item.id, val)"
                  />
                </td>
                <td class="whitespace-nowrap px-4 py-3.5 text-xs tabular-nums text-[var(--text-muted)]">
                  {{ formatDateTime(item.occurredAt) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3.5">
                  <div class="flex items-center gap-2.5">
                    <NTag
                      size="small"
                      :type="
                        item.type === 'INCOME'
                          ? 'success'
                          : item.type === 'EXPENSE'
                            ? 'warning'
                            : 'info'
                      "
                      :bordered="false"
                    >
                      {{ TRANSACTION_TYPE_LABELS[item.type] }}
                    </NTag>
                    <span
                      v-if="item.type !== 'TRANSFER' && item.category?.color"
                      class="h-2 w-2 shrink-0 rounded-full"
                      :style="{ backgroundColor: item.category.color }"
                    />
                    <span class="font-medium text-[var(--text-primary)]">
                      {{
                        item.type === 'TRANSFER' ? '账户互转' : (item.category?.name ?? '未分类')
                      }}
                    </span>
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-3.5 text-xs text-[var(--text-secondary)]">
                  <span v-if="item.type === 'TRANSFER'" class="inline-flex items-center gap-1.5">
                    <span>{{ item.account?.name }}</span>
                    <ArrowRight class="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <span>{{ item.toAccount?.name }}</span>
                  </span>
                  <template v-else>{{ item.account?.name }}</template>
                </td>
                <td class="max-w-xs truncate px-4 py-3.5 text-xs text-[var(--text-secondary)]">
                  {{ item.note || '-' }}
                </td>
                <td class="whitespace-nowrap px-4 py-3.5 text-xs text-[var(--text-muted)]">
                  {{ item.createdBy?.nickname || '-' }}
                </td>
                <td
                  class="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold tabular-nums"
                  :style="{
                    color:
                      item.type === 'INCOME'
                        ? 'var(--positive)'
                        : item.type === 'EXPENSE'
                          ? 'var(--text-primary)'
                          : 'var(--accent-text)',
                  }"
                >
                  {{ item.type === 'INCOME' ? '+' : item.type === 'EXPENSE' ? '-' : '' }}
                  {{ formatMoney(item.amount) }}
                </td>
                <td class="whitespace-nowrap px-6 py-3.5 text-right">
                  <div class="inline-flex items-center gap-1">
                    <button
                      type="button"
                      class="cursor-pointer rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-high)] hover:text-[var(--text-primary)]"
                      title="编辑"
                      @click="openEdit(item)"
                    >
                      <Pencil class="h-3.5 w-3.5" />
                    </button>
                    <NPopconfirm @positive-click="handleDelete(item)">
                      <template #trigger>
                        <button
                          type="button"
                          class="cursor-pointer rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--negative-tonal)] hover:text-[var(--negative)]"
                          title="删除"
                        >
                          <Trash2 class="h-3.5 w-3.5" />
                        </button>
                      </template>
                      确认删除这笔流水？删除后将自动回滚关联账户余额。
                    </NPopconfirm>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="total > filters.pageSize"
          class="flex justify-end border-t border-[var(--hairline)] px-6 py-3.5"
        >
          <NPagination
            v-model:page="filters.page"
            :page-size="filters.pageSize"
            :item-count="total"
          />
        </div>
      </div>
    </NSpin>

    <!-- 批量改分类弹窗 -->
    <NModal v-model:show="showBatchCategoryModal" preset="card" title="批量修改分类" class="max-w-sm">
      <div class="space-y-3">
        <p class="text-xs text-[var(--text-muted)]">
          将选中的 {{ selectedIds.length }} 笔{{ batchTargetType === 'INCOME' ? '收入' : '支出' }}流水统一调整为：
        </p>
        <NSelect
          v-model:value="batchCategoryId"
          :options="batchCategoryOptions"
          filterable
          placeholder="请选择目标分类"
        />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showBatchCategoryModal = false">取消</NButton>
          <NButton
            type="primary"
            :loading="batchBusy"
            :disabled="!batchCategoryId"
            @click="submitBatchCategory"
          >
            确认修改
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- 批量改账户弹窗 -->
    <NModal v-model:show="showBatchAccountModal" preset="card" title="批量修改资金账户" class="max-w-sm">
      <div class="space-y-3">
        <p class="text-xs text-[var(--text-muted)]">
          将选中的 {{ selectedIds.length }} 笔流水迁移至目标资金账户（原账户与目标账户余额将自动重算）：
        </p>
        <NSelect
          v-model:value="batchAccountId"
          :options="activeAccountOptions"
          placeholder="请选择目标资金账户"
        />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showBatchAccountModal = false">取消</NButton>
          <NButton
            type="primary"
            :loading="batchBusy"
            :disabled="!batchAccountId"
            @click="submitBatchAccount"
          >
            确认迁移
          </NButton>
        </div>
      </template>
    </NModal>

    <TransactionModal v-model:show="showModal" :editing="editingItem" />
    <ImportTransactionModal v-model:show="showImportModal" />
  </div>
</template>
