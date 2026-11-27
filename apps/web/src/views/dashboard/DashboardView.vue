<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NDatePicker, NEmpty, NProgress, NSpin, useMessage } from 'naive-ui';
import { use } from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import {
  formatMoney,
  TransactionType,
  type OverviewReportDTO,
  type TransactionDTO,
} from '@home-ledger/shared';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Compass,
  X,
} from 'lucide-vue-next';
import { fetchOverviewReport } from '@/api/reports';
import { fetchTransactions } from '@/api/transactions';
import HelpTip from '@/components/HelpTip.vue';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';
import { useThemeStore } from '@/stores/theme';

use([CanvasRenderer, LineChart, BarChart, TooltipComponent, GridComponent]);

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();
const themeStore = useThemeStore();

const selectedMonthMs = ref<number>(Date.now());
const loading = ref(false);
const report = ref<OverviewReportDTO | null>(null);
const recentTransactions = ref<TransactionDTO[]>([]);
const chartMode = ref<'curve' | 'bar'>('curve');

const selectedYearMonth = computed(() => {
  const d = new Date(selectedMonthMs.value);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
});

async function loadOverview(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  const { year, month } = selectedYearMonth.value;
  const startDate = new Date(year, month - 1, 1, 0, 0, 0).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  loading.value = true;
  try {
    const [overviewRes, txRes] = await Promise.all([
      fetchOverviewReport(familyId, year, month),
      fetchTransactions(familyId, { page: 1, pageSize: 6, startDate, endDate }),
    ]);
    report.value = overviewRes;
    recentTransactions.value = txRes.items;
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载财务概览失败');
  } finally {
    loading.value = false;
  }
}

watch(
  [() => authStore.currentFamilyId, selectedMonthMs, () => ledgerStore.dataVersion],
  () => {
    void loadOverview();
  },
  { immediate: true },
);

const savingsRate = computed(() => {
  const income = Number(report.value?.monthIncome ?? 0);
  const balance = Number(report.value?.monthBalance ?? 0);
  if (income <= 0) return '0.0%';
  return `${Math.max(0, (balance / income) * 100).toFixed(1)}%`;
});

const budgetStats = computed(() => {
  const totalStr = report.value?.totalBudgetAmount;
  if (!totalStr) return null;
  const total = Number(totalStr);
  const spent = Number(report.value?.monthExpense ?? 0);
  const remaining = total - spent;
  const pct = report.value?.budgetUsagePercent ?? 0;
  const isOver = pct > 100;

  const { year, month } = selectedYearMonth.value;
  const daysInMonth = new Date(year, month, 0).getDate();
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const daysLeft = isCurrentMonth ? Math.max(1, daysInMonth - now.getDate() + 1) : daysInMonth;
  const dailyAvailable = remaining > 0 ? remaining / daysLeft : 0;

  return {
    total: totalStr,
    spent: report.value?.monthExpense ?? '0',
    remaining: remaining.toFixed(2),
    pct,
    isOver,
    isWarning: !isOver && pct >= 80,
    daysLeft,
    dailyAvailable: dailyAvailable.toFixed(2),
  };
});

const topAccounts = computed(() =>
  ledgerStore
    .accounts()
    .filter((a) => !a.isArchived && (a.includeInNetWorth || Number(a.balance) !== 0))
    .slice(0, 4),
);

const hasActiveAccounts = computed(() =>
  ledgerStore.accounts().some((a) => !a.isArchived),
);

const hasAnyTransactions = computed(
  () =>
    recentTransactions.value.length > 0 ||
    Number(report.value?.monthIncome ?? 0) > 0 ||
    Number(report.value?.monthExpense ?? 0) > 0 ||
    (report.value?.monthlyTrend ?? []).some(
      (t) => Number(t.income) > 0 || Number(t.expense) > 0,
    ),
);

const hasTotalBudget = computed(() => Boolean(report.value?.totalBudgetAmount));

const onboardingSteps = computed(() => [
  {
    key: 'accounts',
    title: '把常用的钱袋子建起来',
    desc: '建好工资卡、微信、信用卡或医保账户，系统才能自动算清你手里有多少钱',
    done: hasActiveAccounts.value,
    actionLabel: '去建账户',
    to: '/accounts',
  },
  {
    key: 'transactions',
    title: '记下第一笔账，或一键导入账单',
    desc: '日常点左上角「记一笔」，也可以直接导入微信 / 支付宝导出账单',
    done: hasAnyTransactions.value,
    actionLabel: '去记账 / 导入',
    to: '/transactions',
  },
  {
    key: 'budgets',
    title: '给本月定一条花钱红线',
    desc: '设个家庭月度总预算，首页就会自动帮你算每天还能安心花多少',
    done: hasTotalBudget.value,
    actionLabel: '去定预算',
    to: '/budgets',
  },
]);

const completedStepsCount = computed(
  () => onboardingSteps.value.filter((s) => s.done).length,
);

const showOnboardingCard = computed(
  () =>
    !themeStore.onboardingDismissed &&
    report.value !== null &&
    completedStepsCount.value < 3,
);

const trendOption = computed(() => {
  const items = report.value?.monthlyTrend ?? [];
  const p = themeStore.activePalette;
  const tooltipStyle = {
    backgroundColor: p.high,
    borderColor: p.hairline,
    textStyle: { color: p.textPrimary, fontSize: 12 },
  };

  if (chartMode.value === 'curve') {
    return {
      tooltip: {
        trigger: 'axis',
        ...tooltipStyle,
      },
      grid: { top: 14, left: 6, right: 12, bottom: 22, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: items.map((i) => i.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: p.textMuted, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: p.hairline, type: 'dashed' } },
        axisLabel: { color: p.textMuted, fontSize: 11 },
      },
      series: [
        {
          name: '月度结余',
          type: 'line',
          smooth: 0.4,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5, color: p.primary },
          itemStyle: { color: p.primary },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: p.soft },
                { offset: 1, color: 'rgba(0,0,0,0)' },
              ],
            },
          },
          data: items.map((i) => Number(i.balance)),
        },
      ],
    };
  }

  return {
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle,
    },
    grid: { top: 14, left: 6, right: 12, bottom: 22, containLabel: true },
    xAxis: {
      type: 'category',
      data: items.map((i) => i.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: p.textMuted, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: p.hairline, type: 'dashed' } },
      axisLabel: { color: p.textMuted, fontSize: 11 },
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: { color: p.chartIncome, borderRadius: [4, 4, 0, 0] },
        data: items.map((i) => Number(i.income)),
      },
      {
        name: '支出',
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: { color: p.chartExpense, borderRadius: [4, 4, 0, 0] },
        data: items.map((i) => Number(i.expense)),
      },
    ],
  };
});

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<template>
  <NSpin :show="loading">
    <div class="space-y-6">
      <!-- 0. 新手 3 步极简上手清单 -->
      <section v-if="showOnboardingCard" class="tonal-surface p-5 lg:p-6">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <Compass class="h-4 w-4 text-[var(--accent-text)]" />
            <h2 class="text-sm font-semibold text-[var(--text-primary)]">新手 3 步上手</h2>
            <span
              class="rounded-full bg-[var(--accent-tonal)] px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-[var(--accent-text)]"
            >
              已完成 {{ completedStepsCount }}/3
            </span>
          </div>
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            @click="themeStore.setOnboardingDismissed(true)"
          >
            <span>我已熟悉，收起</span>
            <X class="h-3.5 w-3.5" />
          </button>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div
            v-for="(step, idx) in onboardingSteps"
            :key="step.key"
            class="flex flex-col justify-between rounded-2xl border p-4 transition-colors"
            :class="
              step.done
                ? 'border-[var(--hairline)] bg-[var(--surface-high)]/45 opacity-75'
                : 'border-[var(--hairline)] bg-[var(--surface-high)]'
            "
          >
            <div>
              <div class="flex items-start gap-2.5">
                <CheckCircle2
                  v-if="step.done"
                  class="mt-0.5 h-4 w-4 shrink-0"
                  style="color: var(--positive)"
                />
                <Circle
                  v-else
                  class="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-text)]"
                />
                <div class="min-w-0">
                  <div class="text-xs font-semibold text-[var(--text-primary)]">
                    {{ idx + 1 }}. {{ step.title }}
                  </div>
                  <p class="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                    {{ step.desc }}
                  </p>
                </div>
              </div>
            </div>

            <div class="mt-3.5 flex justify-end">
              <span
                v-if="step.done"
                class="text-[11px] font-medium"
                style="color: var(--positive)"
              >
                已完成
              </span>
              <button
                v-else
                type="button"
                class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[var(--accent-tonal)] px-3 py-1 text-[11px] font-medium text-[var(--accent-text)] transition-all hover:brightness-105"
                @click="router.push(step.to)"
              >
                <span>{{ step.actionLabel }}</span>
                <ChevronRight class="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 1. Google Finance 风格净资产主舞台（非对称 5:7 双列） -->
      <section class="tonal-surface p-6 lg:p-7">
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          <div class="lg:col-span-5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)]">
                <span>{{ authStore.currentFamily?.name || '家庭账本' }} · 家庭净资产</span>
                <HelpTip
                  title="什么是家庭净资产？"
                  text="真正完全属于你的家底。把所有银行卡、现金、理财、医保余额加起来，再减去信用卡和借款等欠款。"
                  formula="净资产 = 总资产 − 总负债"
                />
              </span>
              <div class="w-36 shrink-0">
                <NDatePicker v-model:value="selectedMonthMs" type="month" size="small" />
              </div>
            </div>

            <div
              class="mt-3 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--text-primary)] lg:text-[40px]"
            >
              {{ formatMoney(report?.netWorth ?? '0') }}
            </div>

            <div class="mt-3 flex items-center gap-2.5">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums"
                :style="{
                  backgroundColor:
                    Number(report?.monthBalance ?? 0) >= 0
                      ? 'var(--positive-tonal)'
                      : 'var(--negative-tonal)',
                  color:
                    Number(report?.monthBalance ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)',
                }"
              >
                {{ formatMoney(report?.monthBalance ?? '0', { showSign: true }) }}
              </span>
              <span class="text-xs text-[var(--text-muted)]">
                {{ selectedYearMonth.year }} 年 {{ selectedYearMonth.month }} 月净结余
              </span>
            </div>

            <div class="mt-7 grid grid-cols-3 border-t border-[var(--hairline)] pt-5">
              <div class="pr-3">
                <div class="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  <span>总资产</span>
                  <HelpTip
                    text="所有正余额账户加起来的总钱数（不包含纯消费型保单和已归档账户）。"
                  />
                </div>
                <div class="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {{ formatMoney(report?.totalAssets ?? '0') }}
                </div>
              </div>
              <div class="border-l border-[var(--hairline)] px-3">
                <div class="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  <span>总负债</span>
                  <HelpTip
                    text="所有欠款（负余额账户，如信用卡待还账单、房贷、借款）的欠款总额。"
                  />
                </div>
                <div class="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {{ formatMoney(report?.totalLiabilities ?? '0') }}
                </div>
              </div>
              <div class="border-l border-[var(--hairline)] pl-3">
                <div class="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  <span>本月储蓄率</span>
                  <HelpTip
                    title="什么是储蓄率？"
                    text="本月赚的钱里，最后成功留下来没花掉的比例。一般家庭能保持在 20% 以上就很健康。"
                    formula="储蓄率 = 本月净结余 ÷ 本月总收入"
                  />
                </div>
                <div
                  class="mt-1 text-sm font-semibold tabular-nums"
                  style="color: var(--positive)"
                >
                  {{ savingsRate }}
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：平滑趋势曲线 / 收支对比切换 -->
          <div class="lg:col-span-7">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs font-medium text-[var(--text-muted)]">近 6 个月趋势</span>
              <div class="inline-flex rounded-full bg-[var(--surface-high)] p-0.5 text-[11px]">
                <button
                  type="button"
                  class="cursor-pointer rounded-full px-2.5 py-1 font-medium transition-colors"
                  :class="
                    chartMode === 'curve'
                      ? 'bg-[var(--surface-container)] text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  "
                  @click="chartMode = 'curve'"
                >
                  净结余曲线
                </button>
                <button
                  type="button"
                  class="cursor-pointer rounded-full px-2.5 py-1 font-medium transition-colors"
                  :class="
                    chartMode === 'bar'
                      ? 'bg-[var(--surface-container)] text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  "
                  @click="chartMode = 'bar'"
                >
                  收支对比
                </button>
              </div>
            </div>

            <div class="h-48 w-full">
              <VChart
                v-if="report?.monthlyTrend.length"
                :option="trendOption"
                autoresize
                class="h-full w-full"
              />
              <div v-else class="flex h-full items-center justify-center">
                <NEmpty description="暂无趋势数据" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. 8:4 非对称核心业务流 -->
      <section class="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <!-- 左 8 列：本月收支摘要 + 近期收支流水 -->
        <div class="space-y-6 lg:col-span-8">
          <div class="tonal-surface p-6">
            <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <div class="text-xs text-[var(--text-muted)]">本月收入</div>
                <div
                  class="mt-1.5 text-xl font-semibold tracking-tight tabular-nums"
                  style="color: var(--positive)"
                >
                  {{ formatMoney(report?.monthIncome ?? '0') }}
                </div>
              </div>
              <div>
                <div class="text-xs text-[var(--text-muted)]">本月支出</div>
                <div
                  class="mt-1.5 text-xl font-semibold tracking-tight tabular-nums text-[var(--text-primary)]"
                >
                  {{ formatMoney(report?.monthExpense ?? '0') }}
                </div>
              </div>
              <div>
                <div class="text-xs text-[var(--text-muted)]">本月结余</div>
                <div
                  class="mt-1.5 text-xl font-semibold tracking-tight tabular-nums"
                  :style="{
                    color:
                      Number(report?.monthBalance ?? 0) >= 0
                        ? 'var(--accent-text)'
                        : 'var(--negative)',
                  }"
                >
                  {{ formatMoney(report?.monthBalance ?? '0', { showSign: true }) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Google Pay / Apple Card 风格分组流水行 -->
          <div class="tonal-surface py-5">
            <div class="flex items-center justify-between px-6 pb-3">
              <h2 class="text-sm font-semibold text-[var(--text-primary)]">
                {{ selectedYearMonth.month }} 月近期流水
              </h2>
              <button
                type="button"
                class="cursor-pointer text-xs font-medium text-[var(--accent-text)] hover:underline"
                @click="router.push('/transactions')"
              >
                查看全部
              </button>
            </div>

            <div v-if="!recentTransactions.length && !loading" class="py-12">
              <NEmpty description="本月暂无收支记录" />
            </div>

            <div v-else class="divide-y divide-[var(--hairline)]">
              <div
                v-for="item in recentTransactions"
                :key="item.id"
                class="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-[var(--surface-hover)]"
              >
                <div class="flex min-w-0 items-center gap-3.5">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    :style="{
                      backgroundColor:
                        item.type === TransactionType.INCOME
                          ? 'var(--positive-tonal)'
                          : item.type === TransactionType.TRANSFER
                            ? 'var(--accent-tonal)'
                            : 'var(--surface-high)',
                      color:
                        item.type === TransactionType.INCOME
                          ? 'var(--positive)'
                          : item.type === TransactionType.TRANSFER
                            ? 'var(--accent-text)'
                            : 'var(--text-secondary)',
                    }"
                  >
                    <ArrowDownLeft v-if="item.type === TransactionType.INCOME" class="h-4 w-4" />
                    <ArrowLeftRight
                      v-else-if="item.type === TransactionType.TRANSFER"
                      class="h-4 w-4"
                    />
                    <ArrowUpRight v-else class="h-4 w-4" />
                  </div>

                  <div class="min-w-0">
                    <div class="truncate text-sm font-medium text-[var(--text-primary)]">
                      {{
                        item.note ||
                        (item.type === TransactionType.TRANSFER
                          ? '账户互转'
                          : item.category?.name || '未分类')
                      }}
                    </div>
                    <div class="truncate text-xs text-[var(--text-muted)]">
                      {{
                        item.type === TransactionType.TRANSFER
                          ? `${item.account?.name ?? ''} → ${item.toAccount?.name ?? ''}`
                          : `${item.category?.name ?? '未分类'} · ${item.account?.name ?? ''}`
                      }}
                      · {{ formatShortTime(item.occurredAt) }}
                    </div>
                  </div>
                </div>

                <span
                  class="ml-4 shrink-0 text-sm font-semibold tabular-nums"
                  :style="{
                    color:
                      item.type === TransactionType.INCOME
                        ? 'var(--positive)'
                        : item.type === TransactionType.TRANSFER
                          ? 'var(--accent-text)'
                          : 'var(--text-primary)',
                  }"
                >
                  {{
                    item.type === TransactionType.INCOME
                      ? '+'
                      : item.type === TransactionType.EXPENSE
                        ? '-'
                        : ''
                  }}{{ formatMoney(item.amount) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右 4 列：预算节奏 + 支出结构条 + 账户速览 -->
        <div class="space-y-6 lg:col-span-4">
          <!-- 月度预算节奏 -->
          <div class="tonal-surface p-6">
            <template v-if="budgetStats">
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
                  <span>{{ budgetStats.isOver ? '本月预算超支' : '本月剩余预算' }}</span>
                  <HelpTip
                    text="用本月总预算减去已经花掉的钱，再除以本月剩下的天数，告诉你接下来平均每天还能放心花多少。"
                  />
                </span>
                <span
                  class="text-xs font-medium tabular-nums"
                  :style="{
                    color: budgetStats.isOver
                      ? 'var(--negative)'
                      : budgetStats.isWarning
                        ? 'var(--warning)'
                        : 'var(--accent-text)',
                  }"
                >
                  已用 {{ budgetStats.pct }}%
                </span>
              </div>

              <div
                class="mt-2 text-2xl font-semibold tracking-tight tabular-nums"
                :style="{ color: budgetStats.isOver ? 'var(--negative)' : 'var(--text-primary)' }"
              >
                {{ formatMoney(budgetStats.remaining) }}
              </div>

              <div class="mt-1 text-xs tabular-nums text-[var(--text-secondary)]">
                <template v-if="budgetStats.isOver">
                  超出上限，建议留意后续非必要开支
                </template>
                <template v-else>
                  剩余 {{ budgetStats.daysLeft }} 天 · 日均可用
                  {{ formatMoney(budgetStats.dailyAvailable) }}
                </template>
              </div>

              <div class="mt-4">
                <NProgress
                  type="line"
                  :percentage="Math.min(100, budgetStats.pct)"
                  :color="
                    budgetStats.isOver
                      ? themeStore.activePalette.negative
                      : budgetStats.isWarning
                        ? themeStore.activePalette.warning
                        : themeStore.activePalette.primary
                  "
                  :rail-color="themeStore.activePalette.high"
                  :show-indicator="false"
                  :height="8"
                />
              </div>

              <div class="mt-2.5 flex justify-between text-[11px] tabular-nums text-[var(--text-muted)]">
                <span>已支出 {{ formatMoney(budgetStats.spent) }}</span>
                <span>总预算 {{ formatMoney(budgetStats.total) }}</span>
              </div>
            </template>

            <template v-else>
              <div class="text-xs font-medium text-[var(--text-muted)]">月度总预算</div>
              <p class="mt-2 text-sm text-[var(--text-secondary)]">尚未设置本月家庭支出上限</p>
              <NButton
                size="small"
                class="mt-4"
                secondary
                type="primary"
                @click="router.push('/budgets')"
              >
                前往配置预算
              </NButton>
            </template>
          </div>

          <!-- 支出结构（横向分段堆叠条 + 明细列表） -->
          <div class="tonal-surface p-6">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold text-[var(--text-primary)]">支出结构</h2>
              <span class="text-xs text-[var(--text-muted)]">{{ selectedYearMonth.month }} 月</span>
            </div>

            <template v-if="report?.expenseByCategory.length">
              <div class="mt-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-[var(--surface-high)]">
                <div
                  v-for="cat in report.expenseByCategory.slice(0, 5)"
                  :key="cat.categoryName"
                  :style="{ width: `${cat.percent}%`, backgroundColor: cat.color }"
                  :title="`${cat.categoryName} ${cat.percent}%`"
                />
              </div>

              <div class="mt-5 space-y-3 text-xs">
                <div
                  v-for="cat in report.expenseByCategory.slice(0, 6)"
                  :key="cat.categoryName"
                  class="flex items-center justify-between gap-2"
                >
                  <span class="flex min-w-0 items-center gap-2 text-[var(--text-secondary)]">
                    <span
                      class="h-2 w-2 shrink-0 rounded-full"
                      :style="{ backgroundColor: cat.color }"
                    />
                    <span class="truncate">{{ cat.categoryName }}</span>
                  </span>
                  <span class="shrink-0 tabular-nums">
                    <span class="mr-2 text-[var(--text-muted)]">{{ cat.percent }}%</span>
                    <strong class="font-semibold text-[var(--text-primary)]">
                      {{ formatMoney(cat.amount) }}
                    </strong>
                  </span>
                </div>
              </div>
            </template>

            <div v-else class="py-8">
              <NEmpty description="本月暂无分类支出" />
            </div>
          </div>

          <!-- 资金账户速览 -->
          <div class="tonal-surface p-6">
            <div class="flex items-center justify-between pb-3">
              <h2 class="text-sm font-semibold text-[var(--text-primary)]">资金账户</h2>
              <button
                type="button"
                class="cursor-pointer text-xs font-medium text-[var(--accent-text)] hover:underline"
                @click="router.push('/accounts')"
              >
                管理
              </button>
            </div>

            <div v-if="topAccounts.length" class="space-y-2.5 text-xs">
              <div
                v-for="acc in topAccounts"
                :key="acc.id"
                class="flex items-center justify-between rounded-xl bg-[var(--surface-high)] px-3.5 py-2.5"
              >
                <div class="min-w-0 pr-3">
                  <div class="truncate font-medium text-[var(--text-primary)]">{{ acc.name }}</div>
                  <div v-if="acc.note" class="truncate text-[11px] text-[var(--text-muted)]">
                    {{ acc.note }}
                  </div>
                </div>
                <span
                  class="shrink-0 text-sm font-semibold tabular-nums"
                  :style="{
                    color: Number(acc.balance) < 0 ? 'var(--negative)' : 'var(--text-primary)',
                  }"
                >
                  {{ formatMoney(acc.balance) }}
                </span>
              </div>
            </div>

            <div v-else class="py-6 text-center text-xs text-[var(--text-muted)]">
              暂无启用账户
            </div>
          </div>
        </div>
      </section>
    </div>
  </NSpin>
</template>
