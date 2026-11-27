import { createRouter, createWebHistory } from 'vue-router';
import AppLayout from '@/layouts/AppLayout.vue';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { title: '登录与注册', public: true },
    },
    {
      path: '/',
      component: AppLayout,
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/dashboard/DashboardView.vue'),
          meta: { title: '财务概览' },
        },
        {
          path: 'transactions',
          name: 'transactions',
          component: () => import('@/views/transactions/TransactionsView.vue'),
          meta: { title: '收支流水' },
        },
        {
          path: 'accounts',
          name: 'accounts',
          component: () => import('@/views/accounts/AccountsView.vue'),
          meta: { title: '资金账户' },
        },
        {
          path: 'budgets',
          name: 'budgets',
          component: () => import('@/views/budgets/BudgetsView.vue'),
          meta: { title: '预算管理' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/settings/SettingsView.vue'),
          meta: { title: '家庭与设置' },
        },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (!authStore.hydrated) {
    await authStore.hydrate();
  }

  const isPublic = Boolean(to.meta.public);
  if (!isPublic && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    return { name: 'dashboard' };
  }

  return true;
});

router.afterEach((to) => {
  const appTitle = import.meta.env.VITE_APP_TITLE || '家庭财务管理系统';
  const pageTitle = typeof to.meta.title === 'string' ? `${to.meta.title} · ${appTitle}` : appTitle;
  document.title = pageTitle;
});

export default router;
