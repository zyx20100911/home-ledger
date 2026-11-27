<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { NButton, NSelect } from 'naive-ui';
import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  Plus,
  RefreshCw,
  Settings,
  Wallet,
  X,
} from 'lucide-vue-next';
import TransactionModal from '@/components/TransactionModal.vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();

const showQuickAdd = ref(false);
const mobileMenuOpen = ref(false);

const navItems = [
  { name: 'dashboard', label: '财务概览', to: '/dashboard', icon: LayoutDashboard },
  { name: 'transactions', label: '收支流水', to: '/transactions', icon: ArrowLeftRight },
  { name: 'accounts', label: '资金账户', to: '/accounts', icon: Wallet },
  { name: 'budgets', label: '预算管理', to: '/budgets', icon: PieChart },
  { name: 'settings', label: '家庭与设置', to: '/settings', icon: Settings },
];

const familyOptions = computed(() =>
  authStore.families.map((f) => ({
    label: f.name,
    value: f.id,
  })),
);

function handleFamilyChange(familyId: string): void {
  authStore.switchFamily(familyId);
}

function handleLogout(): void {
  authStore.logout();
  ledgerStore.reset();
  void router.push('/login');
}

watch(
  () => authStore.currentFamilyId,
  (familyId) => {
    if (familyId) {
      void ledgerStore.loadFamilyMetadata(familyId);
    }
  },
  { immediate: true },
);

watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false;
  },
);

onMounted(() => {
  void appStore.checkBackendHealth();
});
</script>

<template>
  <div class="flex min-h-screen bg-slate-50 text-slate-900">
    <!-- 移动端遮罩 -->
    <div
      v-if="mobileMenuOpen"
      class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
      @click="mobileMenuOpen = false"
    />

    <!-- 侧边导航栏（桌面固定，移动端抽屉滑出） -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0"
      :class="mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-16 items-center justify-between border-b border-slate-100 px-5">
        <div class="flex items-center gap-2.5">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-xs"
          >
            HL
          </div>
          <div>
            <div class="text-sm font-semibold tracking-tight text-slate-900">Home Ledger</div>
            <div class="text-xs text-slate-500">家庭财务管理系统</div>
          </div>
        </div>
        <button
          type="button"
          class="rounded p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          @click="mobileMenuOpen = false"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- 家庭账本切换 -->
      <div class="border-b border-slate-100 px-3 py-3">
        <div class="mb-1.5 px-1 text-[11px] font-medium text-slate-400">当前家庭账本</div>
        <NSelect
          :value="authStore.currentFamilyId"
          :options="familyOptions"
          size="small"
          @update:value="handleFamilyChange"
        />
      </div>

      <nav class="flex-1 space-y-1 p-3">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
          :class="
            route.name === item.name
              ? 'bg-emerald-50 text-emerald-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          "
        >
          <component :is="item.icon" class="h-4 w-4 shrink-0" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <!-- 用户与系统状态 -->
      <div class="space-y-3 border-t border-slate-100 p-4">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
            <div class="truncate text-xs font-semibold text-slate-800">
              {{ authStore.user?.nickname }}
            </div>
            <div class="truncate text-[11px] text-slate-400">{{ authStore.user?.email }}</div>
          </div>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
            title="退出登录"
            @click="handleLogout"
          >
            <LogOut class="h-4 w-4" />
          </button>
        </div>

        <div class="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
          <div class="flex items-center gap-1.5">
            <span
              class="h-2 w-2 rounded-full"
              :class="
                appStore.health?.status === 'ok'
                  ? 'bg-emerald-500'
                  : appStore.health?.status === 'degraded'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              "
            />
            <span class="text-[11px] text-slate-500">
              {{
                appStore.health?.status === 'ok'
                  ? 'API · PG 正常'
                  : appStore.health?.status === 'degraded'
                    ? 'PG 未连接'
                    : 'API 离线'
              }}
            </span>
          </div>
          <button
            type="button"
            class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="刷新连接状态"
            @click="appStore.checkBackendHealth()"
          >
            <RefreshCw class="h-3 w-3" :class="{ 'animate-spin': appStore.healthLoading }" />
          </button>
        </div>
      </div>
    </aside>

    <!-- 主内容区域 -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs lg:px-8"
      >
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            @click="mobileMenuOpen = true"
          >
            <Menu class="h-5 w-5" />
          </button>
          <h1 class="text-base font-semibold text-slate-900">
            {{ (route.meta.title as string) || '财务概览' }}
          </h1>
        </div>

        <NButton type="primary" size="small" @click="showQuickAdd = true">
          <template #icon>
            <Plus class="h-4 w-4" />
          </template>
          记一笔
        </NButton>
      </header>

      <main class="flex-1 p-4 lg:p-8">
        <RouterView />
      </main>
    </div>

    <TransactionModal v-model:show="showQuickAdd" />
  </div>
</template>
