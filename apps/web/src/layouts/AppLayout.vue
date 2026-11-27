<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { NSelect } from 'naive-ui';
import {
  ArrowLeftRight,
  HelpCircle,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Plus,
  RefreshCw,
  Settings,
  Wallet,
  X,
} from 'lucide-vue-next';
import FinanceGuideDrawer from '@/components/FinanceGuideDrawer.vue';
import ThemeSwitcher from '@/components/ThemeSwitcher.vue';
import TransactionModal from '@/components/TransactionModal.vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';
import { useThemeStore } from '@/stores/theme';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();
const themeStore = useThemeStore();

const showQuickAdd = ref(false);
const showGuide = ref(false);
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

const userInitial = computed(() => {
  const nick = authStore.user?.nickname?.trim() || authStore.user?.email?.trim() || 'U';
  return nick.slice(0, 1).toUpperCase();
});

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
  <div class="flex h-dvh w-full overflow-hidden bg-[var(--surface-canvas)] text-[var(--text-primary)]">
    <!-- 移动端抽屉遮罩 -->
    <div
      v-if="mobileMenuOpen"
      class="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] lg:hidden"
      @click="mobileMenuOpen = false"
    />

    <!-- 左侧固定导航栏（桌面端锁定视口高度，不随右侧内容区滚动） -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex h-full shrink-0 flex-col bg-[var(--surface-sidebar)] transition-all duration-200 lg:static lg:translate-x-0"
      :class="[
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        themeStore.sidebarCollapsed ? 'lg:w-[72px] w-[244px]' : 'w-[244px]',
      ]"
    >
      <!-- 品牌顶栏 -->
      <div
        class="flex h-14 shrink-0 items-center px-4"
        :class="themeStore.sidebarCollapsed ? 'lg:justify-center justify-between' : 'justify-between'"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <Layers class="h-5 w-5 shrink-0 text-[var(--accent)]" />
          <span
            v-if="!themeStore.sidebarCollapsed"
            class="truncate text-[15px] font-semibold tracking-tight text-[var(--text-primary)]"
          >
            Home Ledger
          </span>
        </div>

        <button
          type="button"
          class="cursor-pointer rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] lg:hidden"
          aria-label="关闭菜单"
          @click="mobileMenuOpen = false"
        >
          <X class="h-4 w-4" />
        </button>

        <button
          v-if="!themeStore.sidebarCollapsed"
          type="button"
          class="hidden cursor-pointer rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] lg:inline-flex"
          title="收起侧边栏"
          @click="themeStore.toggleSidebar()"
        >
          <PanelLeftClose class="h-4 w-4" />
        </button>
      </div>

      <!-- 折叠态展开按钮 -->
      <div v-if="themeStore.sidebarCollapsed" class="hidden justify-center pb-1 lg:flex">
        <button
          type="button"
          class="cursor-pointer rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          title="展开侧边栏"
          @click="themeStore.toggleSidebar()"
        >
          <PanelLeftOpen class="h-4 w-4" />
        </button>
      </div>

      <!-- M3 经典左侧主动作胶囊按钮：记一笔 -->
      <div class="px-3 pt-1 pb-3">
        <button
          type="button"
          class="flex h-11 w-full cursor-pointer items-center gap-3 rounded-2xl bg-[var(--accent-tonal)] text-sm font-medium text-[var(--accent-text)] transition-all hover:brightness-105 active:scale-[0.99]"
          :class="themeStore.sidebarCollapsed ? 'lg:justify-center lg:px-0 px-4' : 'px-4'"
          title="记一笔"
          @click="showQuickAdd = true"
        >
          <Plus class="h-[18px] w-[18px] shrink-0" />
          <span v-if="!themeStore.sidebarCollapsed" class="truncate">记一笔</span>
        </button>
      </div>

      <!-- 导航列表（纯 Tonal 胶囊选中态，无左侧装饰竖条） -->
      <nav class="custom-scroll flex-1 space-y-1 overflow-y-auto px-3 py-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          :title="themeStore.sidebarCollapsed ? item.label : undefined"
          class="flex items-center gap-3 rounded-full py-2.5 text-[13px] font-medium transition-colors"
          :class="[
            themeStore.sidebarCollapsed ? 'lg:justify-center lg:px-0 px-3.5' : 'px-3.5',
            route.name === item.name
              ? 'bg-[var(--accent-tonal)] font-semibold text-[var(--accent-text)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
          ]"
        >
          <component :is="item.icon" class="h-[18px] w-[18px] shrink-0" />
          <span v-if="!themeStore.sidebarCollapsed" class="truncate">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <!-- 底部家庭账本切换与账号状态 -->
      <div class="shrink-0 space-y-2.5 p-3">
        <div v-if="!themeStore.sidebarCollapsed">
          <NSelect
            :value="authStore.currentFamilyId"
            :options="familyOptions"
            size="small"
            @update:value="handleFamilyChange"
          />
        </div>

        <div
          class="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5"
          :class="themeStore.sidebarCollapsed ? 'lg:justify-center' : 'justify-between'"
        >
          <div class="flex min-w-0 items-center gap-2.5">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--accent-fg)]"
            >
              {{ userInitial }}
            </div>
            <div v-if="!themeStore.sidebarCollapsed" class="min-w-0">
              <div class="truncate text-xs font-medium text-[var(--text-primary)]">
                {{ authStore.user?.nickname }}
              </div>
              <button
                type="button"
                class="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                title="点击刷新后端连接状态"
                @click="appStore.checkBackendHealth()"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :style="{
                    backgroundColor:
                      appStore.health?.status === 'ok'
                        ? 'var(--positive)'
                        : appStore.health?.status === 'degraded'
                          ? 'var(--warning)'
                          : 'var(--negative)',
                  }"
                />
                <span>
                  {{
                    appStore.health?.status === 'ok'
                      ? 'PG 已连接'
                      : appStore.health?.status === 'degraded'
                        ? 'PG 未连接'
                        : 'API 离线'
                  }}
                </span>
                <RefreshCw
                  v-if="appStore.healthLoading"
                  class="h-2.5 w-2.5 animate-spin"
                />
              </button>
            </div>
          </div>

          <button
            v-if="!themeStore.sidebarCollapsed"
            type="button"
            class="cursor-pointer rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--negative-tonal)] hover:text-[var(--negative)]"
            title="退出登录"
            @click="handleLogout"
          >
            <LogOut class="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- 右侧主视口：顶部固定栏 + 唯一独立滚动内容区 -->
    <div class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <header
        class="flex h-14 shrink-0 items-center justify-between border-b border-[var(--hairline)] bg-[var(--surface-canvas)] px-4 lg:px-8"
      >
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            class="cursor-pointer rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] lg:hidden"
            aria-label="打开菜单"
            @click="mobileMenuOpen = true"
          >
            <Menu class="h-5 w-5" />
          </button>
          <h1 class="truncate text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            {{ (route.meta.title as string) || '财务概览' }}
          </h1>
          <span
            v-if="authStore.currentFamily?.name"
            class="hidden text-xs text-[var(--text-muted)] sm:inline"
          >
            · {{ authStore.currentFamily.name }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-container)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
            title="查看大白话财务小白指南"
            @click="showGuide = true"
          >
            <HelpCircle class="h-3.5 w-3.5 shrink-0" />
            <span class="hidden sm:inline">小白指南</span>
          </button>
          <ThemeSwitcher />
          <button
            type="button"
            class="flex h-8 cursor-pointer items-center gap-1 rounded-full bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-fg)] lg:hidden"
            @click="showQuickAdd = true"
          >
            <Plus class="h-3.5 w-3.5" />
            <span>记一笔</span>
          </button>
        </div>
      </header>

      <!-- 唯一可 Y 轴滚动的主内容区 -->
      <main class="custom-scroll flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-7">
        <div class="mx-auto w-full max-w-[1200px]">
          <RouterView />
        </div>
      </main>
    </div>

    <TransactionModal v-model:show="showQuickAdd" />
    <FinanceGuideDrawer
      v-model:show="showGuide"
      @open-quick-add="showQuickAdd = true"
    />
  </div>
</template>
