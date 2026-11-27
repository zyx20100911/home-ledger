<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  NButton,
  NEmpty,
  NInput,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSwitch,
  NTag,
  useMessage,
} from 'naive-ui';
import { ACCOUNT_TYPE_LABELS, AccountType, formatMoney } from '@home-ledger/shared';
import { Download, FileSpreadsheet, Trash2, Upload } from 'lucide-vue-next';
import { batchImportAccounts, type SaveAccountPayload } from '@/api/accounts';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';
import {
  downloadAccountImportTemplate,
  parseAccountCsv,
  validateAccountRow,
  type ParsedAccountRow,
} from '@/utils/accountCsv';
import { decodeCsvFileBuffer } from '@/utils/transactionCsv';

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
const duplicateStrategy = ref<'update' | 'skip'>('update');
const rows = ref<ParsedAccountRow[]>([]);

const accountTypeOptions = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  label,
  value: value as AccountType,
}));

const existingNameSet = computed(
  () => new Set(ledgerStore.accounts().map((a) => a.name.trim().toLowerCase())),
);

const validRows = computed(() => rows.value.filter((r) => !r.error));
const invalidRows = computed(() => rows.value.filter((r) => Boolean(r.error)));

function isDuplicateName(name: string): boolean {
  return existingNameSet.value.has(name.trim().toLowerCase());
}

function resetState(): void {
  fileName.value = '';
  duplicateStrategy.value = 'update';
  rows.value = [];
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) resetState();
  },
);

function revalidateRow(row: ParsedAccountRow): void {
  row.error = validateAccountRow(row);
}

function removeRow(rowKey: string): void {
  rows.value = rows.value.filter((r) => r.rowKey !== rowKey);
}

function clearInvalidRows(): void {
  const before = rows.value.length;
  rows.value = rows.value.filter((r) => !r.error);
  message.info(`已移除 ${before - rows.value.length} 条异常记录`);
}

async function processFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    message.warning('请选择 .csv 格式的文件');
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const text = decodeCsvFileBuffer(buffer);
    const parsed = parseAccountCsv(text);
    if (parsed.length > 200) {
      message.warning(`单次最多导入 200 个账户，当前文件共 ${parsed.length} 条`);
      return;
    }

    fileName.value = file.name;
    rows.value = parsed;
    message.success(`成功解析 ${parsed.length} 条账户记录`);
  } catch (err) {
    message.error(err instanceof Error ? err.message : '解析账户 CSV 失败');
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
    message.warning('没有可导入的账户数据');
    return;
  }
  if (invalidRows.value.length > 0) {
    message.warning(`还有 ${invalidRows.value.length} 条异常记录，请先修正或移除`);
    return;
  }

  const items: SaveAccountPayload[] = rows.value.map((r) => ({
    name: r.name.trim(),
    type: r.type,
    balance: r.balance,
    includeInNetWorth: r.includeInNetWorth,
    institution: r.institution.trim() || null,
    coverageAmount: r.coverageAmount.trim() || null,
    renewalDate: r.renewalDateIso,
    note: r.note.trim() || null,
  }));

  importing.value = true;
  try {
    const res = await batchImportAccounts(familyId, {
      duplicateStrategy: duplicateStrategy.value,
      items,
    });
    message.success(
      `导入完成：新增 ${res.createdCount} 个，校准更新 ${res.updatedCount} 个，跳过 ${res.skippedCount} 个`,
    );
    await ledgerStore.loadFamilyMetadata(familyId);
    ledgerStore.bumpVersion();
    emit('imported');
    emit('update:show', false);
  } catch (err) {
    message.error(err instanceof Error ? err.message : '批量导入账户失败');
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="批量导入 / 盘点资金账户"
    class="max-w-5xl"
    @update:show="emit('update:show', $event)"
  >
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
          点击选择或拖拽账户 CSV 文件到此处
        </div>
        <p class="mt-1 text-xs text-[var(--text-muted)]">
          支持储蓄卡、信用卡、医保账户、社保/公积金及商业保险（含承保机构、保额与续保日期）
        </p>
        <input
          ref="fileInputRef"
          type="file"
          accept=".csv,text/csv"
          class="hidden"
          @change="handleFileSelect"
        />
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-high)] px-4 py-3 text-xs"
      >
        <div class="flex items-center gap-2 text-[var(--text-secondary)]">
          <FileSpreadsheet class="h-4 w-4 text-[var(--accent-text)]" />
          <span>模板内置银行卡、医保、公积金、消费型车险与储蓄型保单示例</span>
        </div>
        <NButton size="tiny" secondary type="primary" @click="downloadAccountImportTemplate">
          <template #icon><Download class="h-3.5 w-3.5" /></template>
          下载账户模板
        </NButton>
      </div>
    </div>

    <div v-else class="space-y-4">
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-high)] px-4 py-3 text-xs"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium text-[var(--text-primary)]">{{ fileName }}</span>
          <span class="text-[var(--text-muted)]">·</span>
          <span style="color: var(--positive)">就绪 {{ validRows.length }} 个</span>
          <span v-if="invalidRows.length" style="color: var(--negative)">
            · 异常 {{ invalidRows.length }} 个
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[var(--text-muted)]">同名账户：</span>
          <NRadioGroup v-model:value="duplicateStrategy" size="small">
            <NRadioButton value="update">校准更新余额与信息</NRadioButton>
            <NRadioButton value="skip">跳过同名</NRadioButton>
          </NRadioGroup>
          <NButton
            v-if="invalidRows.length"
            size="tiny"
            type="error"
            quaternary
            @click="clearInvalidRows"
          >
            移除异常行
          </NButton>
        </div>
      </div>

      <div class="custom-scroll max-h-[380px] overflow-auto rounded-xl border border-[var(--hairline)]">
        <table v-if="rows.length" class="w-full text-left text-xs">
          <thead
            class="sticky top-0 z-10 border-b border-[var(--hairline)] bg-[var(--surface-container)] text-[var(--text-muted)]"
          >
            <tr>
              <th class="px-3 py-2.5 font-medium">账户名称</th>
              <th class="w-32 px-2 py-2.5 font-medium">类型</th>
              <th class="w-28 px-2 py-2.5 text-right font-medium">当前余额</th>
              <th class="w-20 px-2 py-2.5 text-center font-medium">计净资产</th>
              <th class="w-28 px-2 py-2.5 font-medium">机构</th>
              <th class="w-28 px-2 py-2.5 text-right font-medium">保额</th>
              <th class="w-28 px-2 py-2.5 font-medium">续保到期日</th>
              <th class="px-2 py-2.5 font-medium">匹配状态</th>
              <th class="w-10 px-2 py-2.5 text-right font-medium">移除</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--hairline)]">
            <tr
              v-for="row in rows"
              :key="row.rowKey"
              :style="row.error ? { backgroundColor: 'var(--negative-tonal)' } : undefined"
            >
              <td class="min-w-[130px] px-3 py-2">
                <NInput v-model:value="row.name" size="tiny" @update:value="revalidateRow(row)" />
              </td>
              <td class="px-2 py-2">
                <NSelect
                  v-model:value="row.type"
                  size="tiny"
                  :options="accountTypeOptions"
                  @update:value="revalidateRow(row)"
                />
              </td>
              <td class="px-2 py-2">
                <NInput
                  v-model:value="row.balance"
                  size="tiny"
                  class="text-right tabular-nums"
                  @update:value="revalidateRow(row)"
                />
              </td>
              <td class="px-2 py-2 text-center">
                <NSwitch v-model:value="row.includeInNetWorth" size="small" />
              </td>
              <td class="px-2 py-2">
                <NInput v-model:value="row.institution" size="tiny" placeholder="选填" />
              </td>
              <td class="px-2 py-2 text-right tabular-nums">
                {{ row.coverageAmount ? formatMoney(row.coverageAmount) : '-' }}
              </td>
              <td class="whitespace-nowrap px-2 py-2 tabular-nums text-[var(--text-secondary)]">
                {{ row.renewalDateDisplay || '-' }}
              </td>
              <td class="whitespace-nowrap px-2 py-2">
                <span v-if="row.error" class="font-medium" style="color: var(--negative)">
                  {{ row.error }}
                </span>
                <NTag
                  v-else-if="isDuplicateName(row.name)"
                  size="tiny"
                  :bordered="false"
                  :type="duplicateStrategy === 'update' ? 'warning' : 'default'"
                >
                  {{ duplicateStrategy === 'update' ? '校准更新' : '将跳过' }}
                </NTag>
                <NTag v-else size="tiny" :bordered="false" type="success">新增</NTag>
              </td>
              <td class="px-2 py-2 text-right">
                <button
                  type="button"
                  class="cursor-pointer rounded-full p-1 text-[var(--text-muted)] hover:text-[var(--negative)]"
                  @click="removeRow(row.rowKey)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="py-10">
          <NEmpty description="暂无待导入账户" />
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
            确认导入 {{ validRows.length }} 个账户
          </NButton>
        </div>
      </div>
    </template>
  </NModal>
</template>
