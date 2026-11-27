<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  NButton,
  NDatePicker,
  NEmpty,
  NInput,
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
import { Pencil, Plus, Trash2 } from 'lucide-vue-next';
import { deleteTransaction, fetchTransactions } from '@/api/transactions';
import TransactionModal from '@/components/TransactionModal.vue';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';

const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();

const loading = ref(false);
const items = ref<TransactionDTO[]>([]);
const total = ref(0);
const showModal = ref(false);
const editingItem = ref<TransactionDTO | null>(null);

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

const categoryOptions = computed(() =>
  ledgerStore.categories.map((c) => ({
    label: `${c.type === 'EXPENSE' ? '[支]' : '[收]'} ${c.name}`,
    value: c.id,
  })),
);

async function loadTransactions(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  let startDate: string | undefined;
  let endDate: string | undefined;
  if (filters.monthMs) {
    const d = new Date(filters.monthMs);
    startDate = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0).toISOString();
    endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  }

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
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载流水失败');
  } finally {
    loading.value = false;
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
  <div class="space-y-5">
    <!-- 筛选栏 -->
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
      <div class="flex flex-wrap items-center gap-3">
        <NDatePicker
          v-model:value="filters.monthMs"
          type="month"
          clearable
          placeholder="全部月份"
          class="w-36"
        />
        <NSelect
          v-model:value="filters.type"
          :options="typeOptions"
          clearable
          placeholder="交易类型"
          class="w-28"
        />
        <NSelect
          v-model:value="filters.accountId"
          :options="accountOptions"
          clearable
          placeholder="资金账户"
          class="w-36"
        />
        <NSelect
          v-model:value="filters.categoryId"
          :options="categoryOptions"
          clearable
          filterable
          placeholder="收支分类"
          class="w-40"
        />
        <NInput
          v-model:value="filters.keyword"
          placeholder="搜索备注关键词..."
          clearable
          class="w-44"
          @keyup.enter="
            filters.page = 1;
            loadTransactions();
          "
        />
        <NButton
          size="small"
          @click="
            filters.page = 1;
            loadTransactions();
          "
        >
          搜索
        </NButton>
        <NButton size="small" quaternary @click="resetFilters">重置</NButton>

        <div class="ml-auto">
          <NButton type="primary" size="small" @click="openCreate">
            <template #icon><Plus class="h-4 w-4" /></template>
            记一笔
          </NButton>
        </div>
      </div>
    </div>

    <!-- 流水列表 -->
    <NSpin :show="loading">
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div v-if="!items.length && !loading" class="py-16">
          <NEmpty description="暂无符合条件的交易流水，点击右上角「记一笔」开始记账" />
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th class="px-5 py-3 font-medium">时间</th>
                <th class="px-4 py-3 font-medium">类型 / 分类</th>
                <th class="px-4 py-3 font-medium">资金账户</th>
                <th class="px-4 py-3 font-medium">备注</th>
                <th class="px-4 py-3 font-medium">记账人</th>
                <th class="px-4 py-3 text-right font-medium">金额</th>
                <th class="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in items" :key="item.id" class="hover:bg-slate-50/70">
                <td class="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500">
                  {{ formatDateTime(item.occurredAt) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3.5">
                  <div class="flex items-center gap-2">
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
                    <span class="font-medium text-slate-800">
                      {{
                        item.type === 'TRANSFER' ? '账户互转' : (item.category?.name ?? '未分类')
                      }}
                    </span>
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600">
                  <template v-if="item.type === 'TRANSFER'">
                    {{ item.account?.name }} → {{ item.toAccount?.name }}
                  </template>
                  <template v-else>{{ item.account?.name }}</template>
                </td>
                <td class="max-w-xs truncate px-4 py-3.5 text-xs text-slate-600">
                  {{ item.note || '-' }}
                </td>
                <td class="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">
                  {{ item.createdBy?.nickname || '-' }}
                </td>
                <td
                  class="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums"
                  :class="
                    item.type === 'INCOME'
                      ? 'text-emerald-600'
                      : item.type === 'EXPENSE'
                        ? 'text-slate-900'
                        : 'text-sky-600'
                  "
                >
                  {{ item.type === 'INCOME' ? '+' : item.type === 'EXPENSE' ? '-' : '' }}
                  {{ formatMoney(item.amount) }}
                </td>
                <td class="whitespace-nowrap px-5 py-3.5 text-right">
                  <div class="inline-flex items-center gap-1">
                    <button
                      type="button"
                      class="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="编辑"
                      @click="openEdit(item)"
                    >
                      <Pencil class="h-3.5 w-3.5" />
                    </button>
                    <NPopconfirm @positive-click="handleDelete(item)">
                      <template #trigger>
                        <button
                          type="button"
                          class="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
          class="flex justify-end border-t border-slate-100 px-5 py-3"
        >
          <NPagination
            v-model:page="filters.page"
            :page-size="filters.pageSize"
            :item-count="total"
          />
        </div>
      </div>
    </NSpin>

    <TransactionModal v-model:show="showModal" :editing="editingItem" />
  </div>
</template>
