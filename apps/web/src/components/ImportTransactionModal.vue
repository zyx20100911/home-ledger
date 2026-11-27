<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NEmpty, NInput, NModal, NSelect, NTag, useMessage } from 'naive-ui';
import { formatMoney, TransactionType } from '@home-ledger/shared';
import { Download, FileSpreadsheet, Trash2, Upload } from 'lucide-vue-next';
import { batchImportTransactions, type SaveTransactionPayload } from '@/api/transactions';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';
import {
  CSV_SOURCE_LABELS,
  decodeCsvFileBuffer,
  downloadImportTemplate,
  parseTransactionCsv,
  validateImportRow,
  type CsvSource,
  type ParsedImportRow,
} from '@/utils/transactionCsv';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  imported: [];
}>();

const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();

const fileInputRef = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const importing = ref(false);
const fileName = ref('');
const source = ref<CsvSource | null>(null);
const skippedCount = ref(0);
const rows = ref<ParsedImportRow[]>([]);

const bulkAccountId = ref<string | null>(null);
const bulkExpenseCategoryId = ref<string | null>(null);
const bulkIncomeCategoryId = ref<string | null>(null);

const activeAccounts = computed(() => ledgerStore.accounts().filter((a) => !a.isArchived));

const accountOptions = computed(() =>
  activeAccounts.value.map((a) => ({ label: a.name, value: a.id })),
);

const expenseCategoryOptions = computed(() =>
  ledgerStore.categories
    .filter((c) => c.type === 'EXPENSE')
    .map((c) => ({ label: c.name, value: c.id })),
);

const incomeCategoryOptions = computed(() =>
  ledgerStore.categories
    .filter((c) => c.type === 'INCOME')
    .map((c) => ({ label: c.name, value: c.id })),
);

const typeOptions = [
  { label: '支出', value: TransactionType.EXPENSE },
  { label: '收入', value: TransactionType.INCOME },
  { label: '转账', value: TransactionType.TRANSFER },
];

const validRows = computed(() => rows.value.filter((r) => !r.error));
const invalidRows = computed(() => rows.value.filter((r) => Boolean(r.error)));
const missingExpenseCategoryCount = computed(
  () => rows.value.filter((r) => r.type === TransactionType.EXPENSE && !r.categoryId).length,
);
const missingIncomeCategoryCount = computed(
  () => rows.value.filter((r) => r.type === TransactionType.INCOME && !r.categoryId).length,
);

function resetState(): void {
  fileName.value = '';
  source.value = null;
  skippedCount.value = 0;
  rows.value = [];
  bulkAccountId.value = activeAccounts.value[0]?.id ?? null;
  bulkExpenseCategoryId.value = expenseCategoryOptions.value[0]?.value ?? null;
  bulkIncomeCategoryId.value = incomeCategoryOptions.value[0]?.value ?? null;
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      resetState();
    }
  },
);

function getCategoryOptionsForType(type: TransactionType) {
  if (type === TransactionType.EXPENSE) return expenseCategoryOptions.value;
  if (type === TransactionType.INCOME) return incomeCategoryOptions.value;
  return [];
}

function revalidateRow(row: ParsedImportRow): void {
  if (row.type === TransactionType.TRANSFER) {
    row.categoryId = null;
  } else {
    row.toAccountId = null;
    const valid = ledgerStore.categories.some(
      (c) => c.id === row.categoryId && c.type === (row.type as string),
    );
    if (!valid) {
      row.categoryId = null;
    }
  }
  row.error = validateImportRow(row);
}

function applyBulkAccount(): void {
  if (!bulkAccountId.value) return;
  for (const row of rows.value) {
    row.accountId = bulkAccountId.value;
    row.error = validateImportRow(row);
  }
  message.success('已将全部待导入流水的资金账户统一更新');
}

function fillMissingCategory(type: TransactionType, categoryId: string | null): void {
  if (!categoryId) return;
  let updated = 0;
  for (const row of rows.value) {
    if (row.type === type && !row.categoryId) {
      row.categoryId = categoryId;
      row.error = validateImportRow(row);
      updated += 1;
    }
  }
  if (updated > 0) {
    message.success(`已为 ${updated} 条流水填充默认分类`);
  }
}

function removeRow(rowKey: string): void {
  rows.value = rows.value.filter((r) => r.rowKey !== rowKey);
}

function clearInvalidRows(): void {
  const before = rows.value.length;
  rows.value = rows.value.filter((r) => !r.error);
  message.info(`已移除 ${before - rows.value.length} 条异常流水`);
}

async function processFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    message.warning('目前支持 .csv 格式文件，请先从微信/支付宝或模板导出 CSV');
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const text = decodeCsvFileBuffer(buffer);
    const parsed = parseTransactionCsv(
      text,
      ledgerStore.accounts(),
      ledgerStore.categories,
      activeAccounts.value[0]?.id ?? null,
    );
    if (parsed.rows.length > 500) {
      message.warning(`单次最多导入 500 条流水，当前文件共 ${parsed.rows.length} 条，请分批导入`);
      return;
    }

    fileName.value = file.name;
    source.value = parsed.source;
    skippedCount.value = parsed.skippedCount;
    rows.value = parsed.rows;
    message.success(
      `已识别「${CSV_SOURCE_LABELS[parsed.source]}」，共解析 ${parsed.rows.length} 条记录`,
    );
  } catch (err) {
    message.error(err instanceof Error ? err.message : '解析 CSV 文件失败');
  }
}

function handleFileSelect(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    void processFile(file);
  }
}

function handleDrop(event: DragEvent): void {
  dragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    void processFile(file);
  }
}

async function handleConfirmImport(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  if (!rows.value.length) {
    message.warning('没有可导入的流水记录');
    return;
  }
  if (invalidRows.value.length > 0) {
    message.warning(`还有 ${invalidRows.value.length} 条记录未补全或存在错误，请先修正或移除`);
    return;
  }

  const payload: SaveTransactionPayload[] = rows.value.map((r) => ({
    type: r.type,
    amount: r.amount,
    accountId: r.accountId!,
    toAccountId: r.type === TransactionType.TRANSFER ? r.toAccountId : null,
    categoryId: r.type === TransactionType.TRANSFER ? null : r.categoryId,
    occurredAt: r.occurredAt,
    note: r.note.trim() || null,
    tags: [],
  }));

  importing.value = true;
  try {
    const res = await batchImportTransactions(familyId, payload);
    message.success(`成功导入 ${res.importedCount} 笔流水，相关账户余额已同步`);
    await ledgerStore.loadFamilyMetadata(familyId);
    ledgerStore.bumpVersion();
    emit('imported');
    emit('update:show', false);
  } catch (err) {
    message.error(err instanceof Error ? err.message : '批量导入失败');
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="批量导入收支流水"
    class="max-w-5xl"
    @update:show="emit('update:show', $event)"
  >
    <!-- 阶段一：选择 / 拖拽 CSV 文件 -->
    <div v-if="!rows.length" class="space-y-4">
      <div
        class="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center transition-colors"
        :class="
          dragging
            ? 'border-[var(--accent)] bg-[var(--accent-tonal)]'
            : 'border-[var(--border-strong)] bg-[var(--surface-high)]/50 hover:border-[var(--accent)]'
        "
        @click="fileInputRef?.click()"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="handleDrop"
      >
        <div
          class="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-tonal)] text-[var(--accent-text)]"
        >
          <Upload class="h-5 w-5" />
        </div>
        <div class="mt-3 text-sm font-semibold text-[var(--text-primary)]">
          点击选择或拖拽 CSV 账单文件到此处
        </div>
        <p class="mt-1 text-xs text-[var(--text-muted)]">
          自动兼容 Home Ledger 标准模板、微信支付导出账单、支付宝导出账单（自动识别 UTF-8 / GBK，单次最多 500 条）
        </p>
        <input
          ref="fileInputRef"
          type="file"
          accept=".csv,text/csv"
          class="hidden"
          @change="handleFileSelect"
        />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-high)] px-4 py-3 text-xs">
        <div class="flex items-center gap-2 text-[var(--text-secondary)]">
          <FileSpreadsheet class="h-4 w-4 text-[var(--accent-text)]" />
          <span>首次手动整理账单？可先下载标准 CSV 模板填写</span>
        </div>
        <NButton
          size="tiny"
          secondary
          type="primary"
          @click="downloadImportTemplate(ledgerStore.accounts(), ledgerStore.categories)"
        >
          <template #icon><Download class="h-3.5 w-3.5" /></template>
          下载标准模板
        </NButton>
      </div>
    </div>

    <!-- 阶段二：预览与映射补全 -->
    <div v-else class="space-y-4">
      <!-- 解析摘要 -->
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-high)] px-4 py-3 text-xs">
        <div class="flex flex-wrap items-center gap-2">
          <NTag size="small" type="info" :bordered="false">
            {{ source ? CSV_SOURCE_LABELS[source] : 'CSV' }}
          </NTag>
          <span class="font-medium text-[var(--text-primary)]">{{ fileName }}</span>
          <span class="text-[var(--text-muted)]">·</span>
          <span style="color: var(--positive)">就绪 {{ validRows.length }} 笔</span>
          <span v-if="invalidRows.length" style="color: var(--negative)">
            · 待补全/异常 {{ invalidRows.length }} 笔
          </span>
          <span v-if="skippedCount" class="text-[var(--text-muted)]">
            · 已过滤不计收支/关闭 {{ skippedCount }} 笔
          </span>
        </div>

        <NButton v-if="invalidRows.length" size="tiny" type="error" quaternary @click="clearInvalidRows">
          移除异常行
        </NButton>
      </div>

      <!-- 批量补全快捷栏 -->
      <div class="flex flex-wrap items-center gap-3 text-xs">
        <div class="flex items-center gap-1.5">
          <span class="text-[var(--text-muted)]">统一账户:</span>
          <div class="w-40">
            <NSelect v-model:value="bulkAccountId" size="small" :options="accountOptions" />
          </div>
          <NButton size="small" @click="applyBulkAccount">应用全部</NButton>
        </div>

        <div v-if="missingExpenseCategoryCount > 0" class="flex items-center gap-1.5">
          <span class="text-[var(--text-muted)]">未匹配支出({{ missingExpenseCategoryCount }}):</span>
          <div class="w-36">
            <NSelect
              v-model:value="bulkExpenseCategoryId"
              size="small"
              :options="expenseCategoryOptions"
              filterable
            />
          </div>
          <NButton
            size="small"
            @click="fillMissingCategory(TransactionType.EXPENSE, bulkExpenseCategoryId)"
          >
            填充
          </NButton>
        </div>

        <div v-if="missingIncomeCategoryCount > 0" class="flex items-center gap-1.5">
          <span class="text-[var(--text-muted)]">未匹配收入({{ missingIncomeCategoryCount }}):</span>
          <div class="w-36">
            <NSelect
              v-model:value="bulkIncomeCategoryId"
              size="small"
              :options="incomeCategoryOptions"
              filterable
            />
          </div>
          <NButton
            size="small"
            @click="fillMissingCategory(TransactionType.INCOME, bulkIncomeCategoryId)"
          >
            填充
          </NButton>
        </div>
      </div>

      <!-- 预览编辑表格 -->
      <div class="custom-scroll max-h-[380px] overflow-auto rounded-xl border border-[var(--hairline)]">
        <table v-if="rows.length" class="w-full text-left text-xs">
          <thead class="sticky top-0 z-10 border-b border-[var(--hairline)] bg-[var(--surface-container)] text-[var(--text-muted)]">
            <tr>
              <th class="px-3 py-2.5 font-medium">时间</th>
              <th class="w-24 px-2 py-2.5 font-medium">类型</th>
              <th class="w-36 px-2 py-2.5 font-medium">分类 / 转入账户</th>
              <th class="w-40 px-2 py-2.5 font-medium">资金账户</th>
              <th class="px-2 py-2.5 text-right font-medium">金额</th>
              <th class="px-2 py-2.5 font-medium">备注</th>
              <th class="px-2 py-2.5 font-medium">状态</th>
              <th class="w-10 px-2 py-2.5 text-right font-medium">移除</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--hairline)]">
            <tr
              v-for="row in rows"
              :key="row.rowKey"
              :style="row.error ? { backgroundColor: 'var(--negative-tonal)' } : undefined"
            >
              <td class="whitespace-nowrap px-3 py-2 tabular-nums text-[var(--text-secondary)]">
                {{ row.occurredAtDisplay }}
              </td>
              <td class="px-2 py-2">
                <NSelect
                  v-model:value="row.type"
                  size="tiny"
                  :options="typeOptions"
                  @update:value="revalidateRow(row)"
                />
              </td>
              <td class="px-2 py-2">
                <NSelect
                  v-if="row.type === TransactionType.TRANSFER"
                  v-model:value="row.toAccountId"
                  size="tiny"
                  :options="accountOptions"
                  placeholder="转入账户"
                  @update:value="revalidateRow(row)"
                />
                <NSelect
                  v-else
                  v-model:value="row.categoryId"
                  size="tiny"
                  :options="getCategoryOptionsForType(row.type)"
                  filterable
                  :placeholder="row.rawCategoryName ? `未匹配: ${row.rawCategoryName}` : '选择分类'"
                  @update:value="revalidateRow(row)"
                />
              </td>
              <td class="px-2 py-2">
                <NSelect
                  v-model:value="row.accountId"
                  size="tiny"
                  :options="accountOptions"
                  :placeholder="row.rawAccountName || '选择账户'"
                  @update:value="revalidateRow(row)"
                />
              </td>
              <td class="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums">
                {{ /^\d/.test(row.amount) ? formatMoney(row.amount) : row.amount }}
              </td>
              <td class="min-w-[140px] px-2 py-2">
                <NInput v-model:value="row.note" size="tiny" placeholder="备注" />
              </td>
              <td class="whitespace-nowrap px-2 py-2">
                <span v-if="row.error" class="font-medium" style="color: var(--negative)">
                  {{ row.error }}
                </span>
                <span v-else style="color: var(--positive)">就绪</span>
              </td>
              <td class="px-2 py-2 text-right">
                <button
                  type="button"
                  class="cursor-pointer rounded-full p-1 text-[var(--text-muted)] hover:text-[var(--negative)]"
                  title="移除此行"
                  @click="removeRow(row.rowKey)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="py-10">
          <NEmpty description="暂无待导入数据" />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <NButton v-if="rows.length" size="small" quaternary @click="resetState">
            重新选择文件
          </NButton>
        </div>
        <div class="flex items-center gap-2">
          <NButton @click="emit('update:show', false)">取消</NButton>
          <NButton
            v-if="rows.length"
            type="primary"
            :loading="importing"
            :disabled="!rows.length || invalidRows.length > 0"
            @click="handleConfirmImport"
          >
            确认导入 {{ validRows.length }} 笔
          </NButton>
        </div>
      </div>
    </template>
  </NModal>
</template>
