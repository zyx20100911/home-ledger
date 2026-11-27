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
  NPopconfirm,
  NProgress,
  NSelect,
  NSpin,
  NTag,
  useMessage,
} from 'naive-ui';
import {
  BudgetPeriod,
  CategoryType,
  formatMoney,
  upsertBudgetSchema,
  type BudgetProgressDTO,
  type BudgetSummaryDTO,
} from '@home-ledger/shared';
import { Plus, Trash2 } from 'lucide-vue-next';
import { deleteBudget, fetchBudgetSummary, upsertBudget } from '@/api/budgets';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';

const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();

const selectedMonthMs = ref<number>(Date.now());
const loading = ref(false);
const summary = ref<BudgetSummaryDTO | null>(null);
const showModal = ref(false);
const submitting = ref(false);

const form = reactive({
  categoryId: null as string | null,
  amount: '',
});

const selectedYearMonth = computed(() => {
  const d = new Date(selectedMonthMs.value);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
});

const expenseCategoryOptions = computed(() => [
  { label: '家庭月度总预算（全部分类）', value: '__TOTAL__' },
  ...ledgerStore.categories
    .filter((c) => c.type === CategoryType.EXPENSE)
    .map((c) => ({ label: c.name, value: c.id })),
]);

async function loadBudgets(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  loading.value = true;
  try {
    summary.value = await fetchBudgetSummary(
      familyId,
      selectedYearMonth.value.year,
      selectedYearMonth.value.month,
    );
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载预算失败');
  } finally {
    loading.value = false;
  }
}

function openSetBudget(presetCategoryId: string | null = null, presetAmount = ''): void {
  form.categoryId = presetCategoryId ?? '__TOTAL__';
  form.amount = presetAmount;
  showModal.value = true;
}

async function handleSaveBudget(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  const categoryId = form.categoryId === '__TOTAL__' ? null : form.categoryId;
  const parsed = upsertBudgetSchema.safeParse({
    categoryId,
    period: BudgetPeriod.MONTHLY,
    year: selectedYearMonth.value.year,
    month: selectedYearMonth.value.month,
    amount: form.amount.trim(),
  });
  if (!parsed.success) {
    message.warning(parsed.error.issues[0]?.message || '请填写正确的预算金额');
    return;
  }

  submitting.value = true;
  try {
    await upsertBudget(familyId, {
      categoryId,
      period: BudgetPeriod.MONTHLY,
      year: selectedYearMonth.value.year,
      month: selectedYearMonth.value.month,
      amount: parsed.data.amount,
    });
    message.success('预算配置已保存');
    showModal.value = false;
    ledgerStore.bumpVersion();
    await loadBudgets();
  } catch (err) {
    message.error(err instanceof Error ? err.message : '保存预算失败');
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(item: BudgetProgressDTO): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  try {
    await deleteBudget(familyId, item.budget.id);
    message.success('预算已删除');
    ledgerStore.bumpVersion();
    await loadBudgets();
  } catch (err) {
    message.error(err instanceof Error ? err.message : '删除失败');
  }
}

watch(
  [() => authStore.currentFamilyId, selectedMonthMs, () => ledgerStore.dataVersion],
  () => {
    void loadBudgets();
  },
  { immediate: true },
);
</script>

<template>
  <NSpin :show="loading">
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">
            {{ selectedYearMonth.year }} 年 {{ selectedYearMonth.month }} 月预算管理
          </h2>
          <p class="text-xs text-slate-500">
            本月累计支出：{{ formatMoney(summary?.totalSpent ?? '0') }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <NDatePicker v-model:value="selectedMonthMs" type="month" class="w-40" />
          <NButton type="primary" size="small" @click="openSetBudget(null)">
            <template #icon><Plus class="h-4 w-4" /></template>
            设置预算
          </NButton>
        </div>
      </div>

      <!-- 家庭月度总预算卡片 -->
      <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-900">家庭月度总预算</h3>
            <p class="mt-0.5 text-xs text-slate-500">控制家庭当月所有分类的总支出上限</p>
          </div>
          <div class="flex items-center gap-2">
            <NButton
              size="small"
              @click="openSetBudget(null, summary?.totalBudget?.budget.amount ?? '')"
            >
              {{ summary?.totalBudget ? '调整总预算' : '立即设置' }}
            </NButton>
            <NPopconfirm
              v-if="summary?.totalBudget"
              @positive-click="handleDelete(summary.totalBudget)"
            >
              <template #trigger>
                <NButton size="small" quaternary type="error">删除</NButton>
              </template>
              确认删除本月家庭总预算？
            </NPopconfirm>
          </div>
        </div>

        <div v-if="summary?.totalBudget" class="mt-5 space-y-2">
          <div class="flex items-baseline justify-between">
            <div class="text-2xl font-bold text-slate-900">
              {{ formatMoney(summary.totalBudget.spent) }}
              <span class="text-sm font-normal text-slate-400">
                / {{ formatMoney(summary.totalBudget.budget.amount) }}
              </span>
            </div>
            <NTag :type="summary.totalBudget.isOverBudget ? 'error' : 'success'" size="small">
              {{
                summary.totalBudget.isOverBudget
                  ? `已超支 ${formatMoney(summary.totalBudget.remaining)}`
                  : `剩余 ${formatMoney(summary.totalBudget.remaining)}`
              }}
            </NTag>
          </div>
          <NProgress
            type="line"
            :percentage="Math.min(100, summary.totalBudget.usagePercent)"
            :status="summary.totalBudget.isOverBudget ? 'error' : 'success'"
          />
        </div>
        <div v-else class="mt-4 text-xs text-slate-400">暂未设置本月家庭总预算。</div>
      </section>

      <!-- 分类预算列表 -->
      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-slate-800">分项分类预算</h3>

        <div
          v-if="!summary?.categoryBudgets.length"
          class="rounded-xl border border-dashed border-slate-300 bg-white py-12"
        >
          <NEmpty description="尚未配置分类预算，可按餐饮、购物等大项单独设限" />
        </div>

        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div
            v-for="item in summary.categoryBudgets"
            :key="item.budget.id"
            class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span
                  class="h-2.5 w-2.5 rounded-full"
                  :style="{ backgroundColor: item.budget.category?.color || '#10b981' }"
                />
                <span class="text-sm font-semibold text-slate-900">
                  {{ item.budget.category?.name || '分类' }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <NButton
                  size="tiny"
                  quaternary
                  @click="openSetBudget(item.budget.categoryId ?? null, item.budget.amount)"
                >
                  修改
                </NButton>
                <NPopconfirm @positive-click="handleDelete(item)">
                  <template #trigger>
                    <button
                      type="button"
                      class="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </template>
                  确认删除该分类预算？
                </NPopconfirm>
              </div>
            </div>

            <div class="mt-3 flex items-baseline justify-between text-xs">
              <span class="text-slate-600">
                已用 <strong>{{ formatMoney(item.spent) }}</strong> / 预算
                {{ formatMoney(item.budget.amount) }}
              </span>
              <span :class="item.isOverBudget ? 'font-semibold text-rose-600' : 'text-slate-500'">
                {{ item.usagePercent }}%
              </span>
            </div>
            <NProgress
              class="mt-2"
              type="line"
              :percentage="Math.min(100, item.usagePercent)"
              :status="item.isOverBudget ? 'error' : 'success'"
              :show-indicator="false"
            />
          </div>
        </div>
      </section>
    </div>

    <NModal v-model:show="showModal" preset="card" title="设置月度预算" class="max-w-md">
      <NForm label-placement="top" :disabled="submitting">
        <NFormItem label="预算维度" required>
          <NSelect v-model:value="form.categoryId" :options="expenseCategoryOptions" filterable />
        </NFormItem>
        <NFormItem label="预算金额（元）" required>
          <NInput v-model:value="form.amount" placeholder="例如 3000.00">
            <template #prefix>¥</template>
          </NInput>
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSaveBudget">保存预算</NButton>
        </div>
      </template>
    </NModal>
  </NSpin>
</template>
