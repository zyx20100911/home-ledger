<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NForm, NFormItem, NInput, NTabPane, NTabs, useMessage } from 'naive-ui';
import { loginSchema, registerSchema } from '@home-ledger/shared';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();

const mode = ref<'login' | 'register'>('login');
const loading = ref(false);

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
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
    <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
      <div class="mb-6 flex items-center gap-3">
        <div
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-base font-bold text-white"
        >
          HL
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-tight text-slate-900">Home Ledger</h1>
          <p class="text-xs text-slate-500">清晰、安心的家庭财务管理系统</p>
        </div>
      </div>

      <NTabs v-model:value="mode" type="segment" animated>
        <NTabPane name="login" tab="邮箱登录">
          <NForm class="mt-4" label-placement="top" @submit.prevent="handleLogin">
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
          <NForm class="mt-4" label-placement="top" @submit.prevent="handleRegister">
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
    </div>
  </div>
</template>
