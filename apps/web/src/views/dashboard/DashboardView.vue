<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NDatePicker, NEmpty, NProgress, NSpin, useMessage } from 'naive-ui';
import { use } from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import { formatMoney, type OverviewReportDTO } from '@home-ledger/shared';
import { fetchOverviewReport } from '@/api/reports';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';

use([CanvasRenderer, PieChart, BarChart, TooltipComponent, LegendComponent, GridComponent]);

const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();

const selectedMonthMs = ref<number>(Date.now());
const loading = ref(false);
const report = ref<OverviewReportDTO | null>(null);

const selectedYearMonth = computed(() => {
  const d = new Date(selectedMonthMs.value);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
});

async function loadOverview(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  loading.value = true;
  try {
    report.value = await fetchOverviewReport(
      familyId,
      selectedYearMonth.value.year,
      selectedYearMonth.value.month,
    );
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

const pieOption = computed(() => {
  const items = report.value?.expenseByCategory ?? [];
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ¥{c} ({d}%)',
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#475569', fontSize: 12 },
    },
    series: [
      {
        name: '支出分类',
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: items.map((item) => ({
          name: item.categoryName,
          value: Number(item.amount),
          itemStyle: { color: item.color },
        })),
      },
    ],
  };
});

const trendOption = computed(() => {
  const items = report.value?.monthlyTrend ?? [];
  return {
    tooltip: { trigger: 'axis' },
    legend: {
      bottom: 0,
      textStyle: { color: '#475569', fontSize: 12 },
    },
    grid: { top: 16, left: 16, right: 16, bottom: 36, containLabel: true },
    xAxis: {
      type: 'category',
      data: items.map((i) => i.label),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLabel: { color: '#64748b' },
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        barMaxWidth: 22,
        itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        data: items.map((i) => Number(i.income)),
      },
      {
        name: '支出',
        type: 'bar',
        barMaxWidth: 22,
        itemStyle: { color: '#f97316', borderRadius: [4, 4, 0, 0] },
        data: items.map((i) => Number(i.expense)),
      },
    ],
  };
});
</script>

<template>
  <NSpin :show="loading">
    <div class="space-y-6">
      <!-- 顶部月份筛选 -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">
            {{ selectedYearMonth.year }} 年 {{ selectedYearMonth.month }} 月财务总览
          </h2>
          <p class="text-xs text-slate-500">所有资产与收支数据实时按精确金额汇总</p>
        </div>
        <NDatePicker v-model:value="selectedMonthMs" type="month" class="w-40" />
      </div>

      <!-- KPI 卡片 -->
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div class="text-xs font-medium text-slate-500">家庭净资产</div>
          <div class="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {{ formatMoney(report?.netWorth ?? '0') }}
          </div>
          <div class="mt-2 flex items-center gap-3 text-xs text-slate-400">
            <span>总资产 {{ formatMoney(report?.totalAssets ?? '0') }}</span>
            <span>负债 {{ formatMoney(report?.totalLiabilities ?? '0') }}</span>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div class="text-xs font-medium text-slate-500">本月总收入</div>
          <div class="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
            {{ formatMoney(report?.monthIncome ?? '0') }}
          </div>
          <div class="mt-2 text-xs text-slate-400">含工资、奖金、理财等全部入账</div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div class="text-xs font-medium text-slate-500">本月总支出</div>
          <div class="mt-2 text-2xl font-bold tracking-tight text-orange-600">
            {{ formatMoney(report?.monthExpense ?? '0') }}
          </div>
          <div class="mt-2 text-xs text-slate-400">
            <template v-if="report?.totalBudgetAmount">
              总预算 {{ formatMoney(report.totalBudgetAmount) }}
            </template>
            <template v-else>暂未设置本月总预算</template>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div class="text-xs font-medium text-slate-500">本月收支结余</div>
          <div
            class="mt-2 text-2xl font-bold tracking-tight"
            :class="Number(report?.monthBalance ?? 0) >= 0 ? 'text-slate-900' : 'text-rose-600'"
          >
            {{ formatMoney(report?.monthBalance ?? '0', { showSign: true }) }}
          </div>
          <div class="mt-2 text-xs text-slate-400">本月收入减去本月支出</div>
        </div>
      </section>

      <!-- 总预算进度条 -->
      <section
        v-if="report?.totalBudgetAmount"
        class="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs"
      >
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="font-medium text-slate-800">本月家庭总预算执行进度</span>
          <span
            class="text-xs font-semibold"
            :class="(report.budgetUsagePercent ?? 0) > 100 ? 'text-rose-600' : 'text-emerald-600'"
          >
            已用 {{ formatMoney(report.monthExpense) }} /
            {{ formatMoney(report.totalBudgetAmount) }} （{{ report.budgetUsagePercent }}%）
          </span>
        </div>
        <NProgress
          type="line"
          :percentage="Math.min(100, report.budgetUsagePercent ?? 0)"
          :status="(report.budgetUsagePercent ?? 0) > 100 ? 'error' : 'success'"
          :show-indicator="false"
        />
      </section>

      <!-- 图表区域 -->
      <section class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
          <h3 class="text-sm font-semibold text-slate-900">本月支出分类占比</h3>
          <div class="mt-4 h-72">
            <VChart
              v-if="report?.expenseByCategory.length"
              :option="pieOption"
              autoresize
              class="h-full w-full"
            />
            <div v-else class="flex h-full items-center justify-center">
              <NEmpty description="本月暂无支出记录" />
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
          <h3 class="text-sm font-semibold text-slate-900">近 6 个月收支趋势</h3>
          <div class="mt-4 h-72">
            <VChart
              v-if="report?.monthlyTrend.length"
              :option="trendOption"
              autoresize
              class="h-full w-full"
            />
            <div v-else class="flex h-full items-center justify-center">
              <NEmpty description="暂无收支趋势数据" />
            </div>
          </div>
        </div>
      </section>
    </div>
  </NSpin>
</template>
