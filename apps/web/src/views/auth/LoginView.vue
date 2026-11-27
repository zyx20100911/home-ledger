<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NForm, NFormItem, NInput, NTabPane, NTabs, useMessage } from 'naive-ui';
import { loginSchema, registerSchema } from '@home-ledger/shared';
import { Layers } from 'lucide-vue-next';
import { fetchAuthConfig } from '@/api/auth';
import ThemeSwitcher from '@/components/ThemeSwitcher.vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();

const mode = ref<'login' | 'register'>('login');
const loading = ref(false);
const allowRegistration = ref(true);

onMounted(async () => {
  try {
    const config = await fetchAuthConfig();
    if (!config.allowRegistration) {
      allowRegistration.value = false;
      mode.value = 'login';
    }
  } catch {
    // 配置探测失败时静默降级，不阻塞登录流程
  }
});

const loginForm = reactive({
  email: '',
  password: '',
});

const registerForm = reactive({
  email: '',
  password: '',
  nickname: '',
  familyName: '',
});

const pillars = [
  {
    title: '多家庭账本隔离',
    desc: '按家庭成员与角色协作记账，资产边界清晰可控',
  },
  {
    title: 'Decimal 精确账务',
    desc: '全链路高精度十进制计算，账户余额实时同步与自动回滚',
  },
  {
    title: '预算节奏与现金流分析',
    desc: '按月跟踪日均可用额度与分类消费结构变化',
  },
];

async function handleLogin(): Promise<void> {
  const parsed = loginSchema.safeParse(loginForm);
  if (!parsed.success) {
    message.warning(parsed.error.issues[0]?.message || '请填写正确的邮箱和密码');
    return;
  }

  loading.value = true;
  try {
    await authStore.login(parsed.data.email, parsed.data.password);
    message.success('欢迎回来');
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    await router.replace(redirect);
  } catch (err) {
    message.error(err instanceof Error ? err.message : '登录失败');
  } finally {
    loading.value = false;
  }
}

async function handleRegister(): Promise<void> {
  const parsed = registerSchema.safeParse({
    ...registerForm,
    familyName: registerForm.familyName.trim() || undefined,
  });
  if (!parsed.success) {
    message.warning(parsed.error.issues[0]?.message || '请检查注册信息');
    return;
  }

  loading.value = true;
  try {
    await authStore.register(parsed.data);
    message.success('注册成功，已自动为你创建默认家庭账本');
    await router.replace('/dashboard');
  } catch (err) {
    message.error(err instanceof Error ? err.message : '注册失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="grid min-h-dvh overflow-y-auto bg-[var(--surface-canvas)] lg:grid-cols-12">
    <!-- 左侧编辑部品牌陈述（Tonal Surface，零发光球） -->
    <aside
      class="hidden flex-col justify-between border-r border-[var(--hairline)] bg-[var(--surface-sidebar)] p-10 lg:col-span-5 lg:flex xl:p-14"
    >
      <div class="flex items-center gap-2.5">
        <Layers class="h-6 w-6 text-[var(--accent)]" />
        <span class="text-base font-semibold tracking-tight text-[var(--text-primary)]">
          Home Ledger
        </span>
      </div>

      <div class="my-auto space-y-8 py-8">
        <div>
          <h2
            class="text-3xl font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)]"
          >
            清晰掌控每一笔<br />家庭资产与收支流动
          </h2>
          <p class="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            围绕真实家庭协作场景设计，让记账、账户对账与月度预算管理变得安静、准确且有条理。
          </p>
        </div>

        <div class="divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          <div v-for="item in pillars" :key="item.title" class="py-4">
            <div class="text-sm font-medium text-[var(--text-primary)]">{{ item.title }}</div>
            <div class="mt-1 text-xs text-[var(--text-muted)]">{{ item.desc }}</div>
          </div>
        </div>
      </div>

      <div class="text-xs text-[var(--text-muted)]">Home Ledger · Personal &amp; Family Finance</div>
    </aside>

    <!-- 右侧登录与注册工作区 -->
    <main class="relative flex flex-col items-center justify-center px-4 py-12 lg:col-span-7 lg:px-10">
      <div class="absolute right-5 top-5">
        <ThemeSwitcher />
      </div>

      <div class="tonal-surface w-full max-w-md p-8">
        <div class="mb-6 flex items-center gap-2.5 lg:hidden">
          <Layers class="h-6 w-6 text-[var(--accent)]" />
          <div>
            <h1 class="text-base font-semibold tracking-tight text-[var(--text-primary)]">
              Home Ledger
            </h1>
            <p class="text-xs text-[var(--text-muted)]">现代家庭财务管理系统</p>
          </div>
        </div>

        <div class="mb-6 hidden lg:block">
          <h1 class="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            {{ mode === 'login' ? '欢迎回来' : '创建你的家庭账本' }}
          </h1>
          <p class="mt-1 text-xs text-[var(--text-muted)]">
            {{
              mode === 'login'
                ? '使用注册邮箱登录你的家庭财务工作台'
                : '注册后将自动为你初始化默认家庭账本与常用账户'
            }}
          </p>
        </div>

        <NTabs v-if="allowRegistration" v-model:value="mode" type="segment" animated>
          <NTabPane name="login" tab="邮箱登录">
            <NForm class="mt-5" label-placement="top" @submit.prevent="handleLogin">
              <NFormItem label="邮箱">
                <NInput v-model:value="loginForm.email" placeholder="name@example.com" size="large" />
              </NFormItem>
              <NFormItem label="密码">
                <NInput
                  v-model:value="loginForm.password"
                  type="password"
                  show-password-on="click"
                  placeholder="请输入密码"
                  size="large"
                  @keyup.enter="handleLogin"
                />
              </NFormItem>
              <NButton
                type="primary"
                block
                size="large"
                :loading="loading"
                class="mt-2"
                @click="handleLogin"
              >
                登录
              </NButton>
            </NForm>
          </NTabPane>

          <NTabPane name="register" tab="注册新账号">
            <NForm class="mt-5" label-placement="top" @submit.prevent="handleRegister">
              <NFormItem label="邮箱">
                <NInput
                  v-model:value="registerForm.email"
                  placeholder="name@example.com"
                  size="large"
                />
              </NFormItem>
              <NFormItem label="昵称">
                <NInput
                  v-model:value="registerForm.nickname"
                  placeholder="例如：爸爸 / 妈妈"
                  size="large"
                />
              </NFormItem>
              <NFormItem label="登录密码">
                <NInput
                  v-model:value="registerForm.password"
                  type="password"
                  show-password-on="click"
                  placeholder="至少 6 位"
                  size="large"
                />
              </NFormItem>
              <NFormItem label="初始家庭账本名称（选填）">
                <NInput
                  v-model:value="registerForm.familyName"
                  placeholder="留空则默认创建「你的昵称的家庭」"
                  size="large"
                  @keyup.enter="handleRegister"
                />
              </NFormItem>
              <NButton
                type="primary"
                block
                size="large"
                :loading="loading"
                class="mt-2"
                @click="handleRegister"
              >
                注册并进入账本
              </NButton>
            </NForm>
          </NTabPane>
        </NTabs>

        <NForm v-else class="mt-2" label-placement="top" @submit.prevent="handleLogin">
          <NFormItem label="邮箱">
            <NInput v-model:value="loginForm.email" placeholder="name@example.com" size="large" />
          </NFormItem>
          <NFormItem label="密码">
            <NInput
              v-model:value="loginForm.password"
              type="password"
              show-password-on="click"
              placeholder="请输入密码"
              size="large"
              @keyup.enter="handleLogin"
            />
          </NFormItem>
          <NButton
            type="primary"
            block
            size="large"
            :loading="loading"
            class="mt-2"
            @click="handleLogin"
          >
            登录
          </NButton>
        </NForm>
      </div>
    </main>
  </div>
</template>
