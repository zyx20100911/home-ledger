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
import HelpTip from '@/components/HelpTip.vue';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';
import { useThemeStore } from '@/stores/theme';

const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();
const themeStore = useThemeStore();

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

function getProgressStatus(usagePercent: number, isOverBudget: boolean): 'success' | 'warning' | 'error' {
  if (isOverBudget) return 'error';
  if (usagePercent >= 80) return 'warning';
  return 'success';
}

function getProgressColor(usagePercent: number, isOverBudget: boolean): string {
  if (isOverBudget) return themeStore.activePalette.negative;
  if (usagePercent >= 80) return themeStore.activePalette.warning;
  return themeStore.activePalette.primary;
}

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
          <h2 class="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            {{ selectedYearMonth.year }} 年 {{ selectedYearMonth.month }} 月预算管理
          </h2>
          <p class="mt-0.5 text-xs tabular-nums text-[var(--text-muted)]">
            本月累计支出 {{ formatMoney(summary?.totalSpent ?? '0') }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-40 shrink-0">
            <NDatePicker v-model:value="selectedMonthMs" type="month" />
          </div>
          <NButton type="primary" size="medium" @click="openSetBudget(null)">
            <template #icon><Plus class="h-4 w-4" /></template>
            设置预算
          </NButton>
        </div>
      </div>

      <!-- 家庭月度总预算卡片 -->
      <section class="tonal-surface p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="inline-flex items-center gap-1 text-base font-semibold text-[var(--text-primary)]">
              <span>家庭月度总预算</span>
              <HelpTip
                text="给整个家定一条本月花钱总红线。设置后，首页会自动帮你算出剩下每天还能放心花多少钱。"
                formula="新手参考：月收入 × 50% 必要生活 + 30% 弹性消费"
              />
            </h3>
            <p class="mt-0.5 text-xs text-[var(--text-muted)]">
              控制家庭当月所有分类的总支出上限
            </p>
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

        <div v-if="summary?.totalBudget" class="mt-6 space-y-3">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <div class="text-2xl font-semibold tracking-tight tabular-nums text-[var(--text-primary)]">
              {{ formatMoney(summary.totalBudget.spent) }}
              <span class="text-sm font-normal text-[var(--text-muted)]">
                / {{ formatMoney(summary.totalBudget.budget.amount) }}
              </span>
            </div>
            <NTag
              :type="
                getProgressStatus(
                  summary.totalBudget.usagePercent,
                  summary.totalBudget.isOverBudget,
                )
              "
              size="small"
              :bordered="false"
            >
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
            :color="
              getProgressColor(summary.totalBudget.usagePercent, summary.totalBudget.isOverBudget)
            "
            :rail-color="themeStore.activePalette.high"
            :height="8"
          />
        </div>
        <div
          v-else
          class="mt-5 rounded-xl bg-[var(--surface-high)] px-4 py-3 text-xs text-[var(--text-muted)]"
        >
          暂未设置本月家庭总预算，点击右上角「立即设置」即可配置。
        </div>
      </section>

      <!-- 分类预算列表 -->
      <section class="space-y-3">
        <h3 class="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
          <span>分项分类预算</span>
          <HelpTip
            text="针对容易超支的单个大类（比如餐饮、购物、娱乐）单独设上限，超支 80% 会自动亮黄灯提醒，不影响总预算设置。"
          />
        </h3>

        <div v-if="!summary?.categoryBudgets.length" class="tonal-surface py-14">
          <NEmpty description="尚未配置分类预算，可按餐饮、购物等大项单独设限" />
        </div>

        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div
            v-for="item in summary.categoryBudgets"
            :key="item.budget.id"
            class="tonal-surface p-5"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span
                  class="h-2.5 w-2.5 rounded-full"
                  :style="{
                    backgroundColor: item.budget.category?.color || themeStore.activePalette.primary,
                  }"
                />
                <span class="text-sm font-semibold text-[var(--text-primary)]">
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
                      class="cursor-pointer rounded-full p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--negative-tonal)] hover:text-[var(--negative)]"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </template>
                  确认删除该分类预算？
                </NPopconfirm>
              </div>
            </div>

            <div class="mt-4 flex items-baseline justify-between text-xs tabular-nums">
              <span class="text-[var(--text-secondary)]">
                已用 <strong class="text-[var(--text-primary)]">{{ formatMoney(item.spent) }}</strong>
                / 预算 {{ formatMoney(item.budget.amount) }}
              </span>
              <span
                class="font-semibold"
                :style="{
                  color: item.isOverBudget
                    ? 'var(--negative)'
                    : item.usagePercent >= 80
                      ? 'var(--warning)'
                      : 'var(--text-secondary)',
                }"
              >
                {{ item.usagePercent }}%
              </span>
            </div>
            <NProgress
              class="mt-2.5"
              type="line"
              :percentage="Math.min(100, item.usagePercent)"
              :color="getProgressColor(item.usagePercent, item.isOverBudget)"
              :rail-color="themeStore.activePalette.high"
              :show-indicator="false"
              :height="7"
            />
          </div>
        </div>
      </section>
    </div>

    <NModal v-model:show="showModal" preset="card" title="设置月度预算" class="max-w-md">
      <div class="mb-4 rounded-xl bg-[var(--surface-high)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
        <template v-if="form.categoryId === '__TOTAL__'">
          新手参考 50/30/20 法则：必要生活约占月收入 50%、弹性消费 30%、存钱 20%。先按前两项之和定个大概上限即可，随时可以调整。
        </template>
        <template v-else>
          给单个容易花超的分类（如餐饮、购物）设小目标，用来提醒自己别买过头。
        </template>
      </div>
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
