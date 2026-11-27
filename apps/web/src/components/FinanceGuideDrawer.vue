<script setup lang="ts">
import { useRouter } from 'vue-router';
import { NButton, NDrawer, NDrawerContent } from 'naive-ui';
import {
  ArrowLeftRight,
  CreditCard,
  FileSpreadsheet,
  PieChart,
  Scale,
  ShieldCheck,
} from 'lucide-vue-next';
import { useThemeStore } from '@/stores/theme';

defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  'open-quick-add': [];
}>();

const router = useRouter();
const themeStore = useThemeStore();

function close(): void {
  emit('update:show', false);
}

function goTo(path: string): void {
  close();
  void router.push(path);
}

function handleQuickAdd(): void {
  close();
  emit('open-quick-add');
}

function handleRestoreOnboarding(): void {
  themeStore.setOnboardingDismissed(false);
  close();
  void router.push('/dashboard');
}
</script>

<template>
  <NDrawer
    :show="show"
    :width="430"
    placement="right"
    style="max-width: 92vw"
    @update:show="emit('update:show', $event)"
  >
    <NDrawerContent title="财务小白指南" closable :native-scrollbar="false">
      <div class="space-y-3.5">
        <p class="text-xs leading-relaxed text-[var(--text-muted)]">
          不懂专业会计也能轻松管钱，花 1 分钟看懂下面 6 个生活常识就够了。
        </p>

        <!-- 1. 净资产、总资产、储蓄率 -->
        <section class="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-high)]/45 p-4">
          <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <Scale class="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
            <span>净资产、总资产、储蓄率是啥？</span>
          </div>
          <p class="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            总资产是你手头所有正余额账户的合计，减去信用卡、借款等欠款后，才是真正属于你的家底。储蓄率反映你本月赚的钱里留下来多少，能达到 20%~30% 就非常健康。
          </p>
          <div class="mt-2.5 space-y-1 rounded-xl bg-[var(--surface-container)] px-3 py-2 text-[11px] font-medium text-[var(--accent-text)]">
            <div>净资产 = 手里所有的钱 − 欠别人的钱</div>
            <div>储蓄率 = 本月剩下的钱 ÷ 本月收入</div>
          </div>
        </section>

        <!-- 2. 转账逻辑 -->
        <section class="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-high)]/45 p-4">
          <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <ArrowLeftRight class="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
            <span>还信用卡、微信提现，为什么记「转账」？</span>
          </div>
          <p class="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            刷信用卡买东西那天已经记过「支出」了；月底用储蓄卡还信用卡，钱只是从左兜挪到右兜，记「转账」才不会重复算成花钱。微信提现到银行卡、转入余额宝同理。
          </p>
        </section>

        <!-- 3. 医保、社保与保险 -->
        <section class="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-high)]/45 p-4">
          <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <ShieldCheck class="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
            <span>医保、公积金、车险、储蓄险怎么记？</span>
          </div>
          <div class="mt-2.5 space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            <div class="rounded-xl bg-[var(--surface-container)] px-3 py-2">
              <span class="font-semibold text-[var(--text-primary)]">消费型保险</span>
              （车险 / 百万医疗 / 重疾险）：交保费记「支出」；账户建「商业保险」余额填 0 且不计净资产，留着看保额和续保提醒。
            </div>
            <div class="rounded-xl bg-[var(--surface-container)] px-3 py-2">
              <span class="font-semibold text-[var(--text-primary)]">储蓄型保险</span>
              （增额寿 / 年金险）：缴费记「转账」到保单账户，余额填当前现金价值并开启「计入净资产」。
            </div>
            <div class="rounded-xl bg-[var(--surface-container)] px-3 py-2">
              <span class="font-semibold text-[var(--text-primary)]">医保 / 公积金</span>
              ：当成专用储蓄卡建账户，刷医保买药直接从医保账户记「支出」。
            </div>
          </div>
        </section>

        <!-- 4. 信用卡负数 -->
        <section class="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-high)]/45 p-4">
          <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <CreditCard class="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
            <span>信用卡 / 借款欠款为什么填负数？</span>
          </div>
          <p class="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            欠银行 ¥3,000 填 <code class="font-semibold text-[var(--text-primary)]">-3000</code>。这样系统会自动把它算进「总负债」，等你还 ¥1,000（记转账转入信用卡）后，余额自动变成 <code class="font-semibold text-[var(--text-primary)]">-2000</code>，一目了然。
          </p>
        </section>

        <!-- 5. 懒人导入 -->
        <section class="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-high)]/45 p-4">
          <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <FileSpreadsheet class="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
            <span>懒得天天记账怎么办？</span>
          </div>
          <p class="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            不用每顿饭都手动记！月底花 1 分钟在微信或支付宝导出账单 CSV，进入「收支流水」点「导入」，系统会自动识别格式并批量入账。
          </p>
        </section>

        <!-- 6. 50/30/20 预算法则 -->
        <section class="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-high)]/45 p-4">
          <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <PieChart class="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
            <span>本月预算怎么定比较合理？</span>
          </div>
          <p class="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            新手可参考经典的「50 / 30 / 20 法则」：月收入的 50% 给必要生活（房租、吃饭、水电）、30% 给想要消费（购物、聚餐、旅行）、至少 20% 存下来。先定一个「月度总预算」就足够。
          </p>
        </section>
      </div>

      <template #footer>
        <div class="flex w-full flex-col gap-2.5">
          <div class="grid grid-cols-3 gap-2">
            <NButton size="small" @click="goTo('/accounts')">去建账户</NButton>
            <NButton size="small" type="primary" @click="handleQuickAdd">记一笔</NButton>
            <NButton size="small" @click="goTo('/transactions')">去导入账单</NButton>
          </div>
          <button
            v-if="themeStore.onboardingDismissed"
            type="button"
            class="w-full cursor-pointer py-1 text-center text-xs font-medium text-[var(--accent-text)] hover:underline"
            @click="handleRestoreOnboarding"
          >
            恢复首页新手上手清单
          </button>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
