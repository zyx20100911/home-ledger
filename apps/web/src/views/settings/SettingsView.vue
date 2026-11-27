<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  NButton,
  NColorPicker,
  NInput,
  NPopconfirm,
  NSelect,
  NTabPane,
  NTabs,
  NTag,
  useMessage,
} from 'naive-ui';
import {
  CategoryType,
  createCategorySchema,
  FAMILY_ROLE_LABELS,
  FamilyRole,
  type FamilyInviteDTO,
  type FamilyMemberDTO,
} from '@home-ledger/shared';
import { Copy, Plus, Trash2, UserPlus } from 'lucide-vue-next';
import { createCategory, deleteCategory } from '@/api/categories';
import { createFamily, createFamilyInvite, joinFamily, listFamilyMembers } from '@/api/families';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';

const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();

const members = ref<FamilyMemberDTO[]>([]);
const latestInvite = ref<FamilyInviteDTO | null>(null);
const inviteCodeInput = ref('');
const newFamilyName = ref('');
const busy = ref(false);

const newCategory = reactive({
  name: '',
  type: CategoryType.EXPENSE as CategoryType,
  color: '#10b981',
});

const canManage = computed(() => {
  const role = authStore.currentFamily?.role;
  return role === FamilyRole.OWNER || role === FamilyRole.ADMIN;
});

const expenseCategories = computed(() =>
  ledgerStore.categories.filter((c) => c.type === CategoryType.EXPENSE),
);
const incomeCategories = computed(() =>
  ledgerStore.categories.filter((c) => c.type === CategoryType.INCOME),
);

async function loadMembers(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;
  try {
    members.value = await listFamilyMembers(familyId);
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载家庭成员失败');
  }
}

async function handleGenerateInvite(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  busy.value = true;
  try {
    latestInvite.value = await createFamilyInvite(familyId, {
      role: FamilyRole.MEMBER,
      expiresInDays: 7,
    });
    message.success('邀请码已生成，7 天内有效');
  } catch (err) {
    message.error(err instanceof Error ? err.message : '生成邀请码失败');
  } finally {
    busy.value = false;
  }
}

async function copyInviteCode(): Promise<void> {
  if (!latestInvite.value) return;
  try {
    await navigator.clipboard.writeText(latestInvite.value.code);
    message.success('邀请码已复制到剪贴板');
  } catch {
    message.info(`邀请码：${latestInvite.value.code}`);
  }
}

async function handleJoinFamily(): Promise<void> {
  const code = inviteCodeInput.value.trim();
  if (!code) {
    message.warning('请输入邀请码');
    return;
  }
  busy.value = true;
  try {
    const family = await joinFamily(code);
    authStore.addFamily(family);
    inviteCodeInput.value = '';
    message.success(`已成功加入「${family.name}」`);
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加入家庭失败');
  } finally {
    busy.value = false;
  }
}

async function handleCreateFamily(): Promise<void> {
  const name = newFamilyName.value.trim();
  if (!name) {
    message.warning('请输入新家庭账本名称');
    return;
  }
  busy.value = true;
  try {
    const family = await createFamily({ name });
    authStore.addFamily(family);
    newFamilyName.value = '';
    message.success(`已创建并切换到「${family.name}」`);
  } catch (err) {
    message.error(err instanceof Error ? err.message : '创建家庭失败');
  } finally {
    busy.value = false;
  }
}

async function handleAddCategory(): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  const parsed = createCategorySchema.safeParse({
    name: newCategory.name,
    type: newCategory.type,
    color: newCategory.color,
  });
  if (!parsed.success) {
    message.warning(parsed.error.issues[0]?.message || '请填写分类名称');
    return;
  }

  busy.value = true;
  try {
    await createCategory(familyId, parsed.data);
    newCategory.name = '';
    message.success('自定义分类已添加');
    await ledgerStore.loadFamilyMetadata(familyId);
  } catch (err) {
    message.error(err instanceof Error ? err.message : '添加分类失败');
  } finally {
    busy.value = false;
  }
}

async function handleDeleteCategory(categoryId: string): Promise<void> {
  const familyId = authStore.currentFamilyId;
  if (!familyId) return;

  try {
    await deleteCategory(familyId, categoryId);
    message.success('分类已删除');
    await ledgerStore.loadFamilyMetadata(familyId);
  } catch (err) {
    message.error(err instanceof Error ? err.message : '删除分类失败');
  }
}

watch(
  () => authStore.currentFamilyId,
  () => {
    latestInvite.value = null;
    void loadMembers();
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-6">
    <!-- 家庭成员与邀请 -->
    <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-slate-900">
            家庭成员（{{ authStore.currentFamily?.name }}）
          </h2>
          <p class="mt-0.5 text-xs text-slate-500">
            同一家庭的成员共同维护账本，按角色区分管理与记账权限
          </p>
        </div>
        <NButton
          v-if="canManage"
          type="primary"
          size="small"
          :loading="busy"
          @click="handleGenerateInvite"
        >
          <template #icon><UserPlus class="h-4 w-4" /></template>
          生成家庭邀请码
        </NButton>
      </div>

      <div
        v-if="latestInvite"
        class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm"
      >
        <div>
          <span class="text-xs text-emerald-700">最新邀请码（7 天内有效）：</span>
          <strong class="ml-1 font-mono text-base tracking-widest text-emerald-900">
            {{ latestInvite.code }}
          </strong>
        </div>
        <NButton size="tiny" type="primary" ghost @click="copyInviteCode">
          <template #icon><Copy class="h-3.5 w-3.5" /></template>
          复制邀请码
        </NButton>
      </div>

      <div class="mt-4 divide-y divide-slate-100">
        <div
          v-for="m in members"
          :key="m.id"
          class="flex items-center justify-between py-3 text-sm"
        >
          <div>
            <div class="font-medium text-slate-900">{{ m.nickname }}</div>
            <div class="text-xs text-slate-400">{{ m.email }}</div>
          </div>
          <NTag size="small" :bordered="false" :type="m.role === 'OWNER' ? 'success' : 'default'">
            {{ FAMILY_ROLE_LABELS[m.role] }}
          </NTag>
        </div>
      </div>

      <!-- 加入或新建家庭 -->
      <div class="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
        <div class="flex gap-2">
          <NInput v-model:value="inviteCodeInput" placeholder="输入其他家庭的邀请码..." />
          <NButton :loading="busy" @click="handleJoinFamily">加入家庭</NButton>
        </div>
        <div class="flex gap-2">
          <NInput v-model:value="newFamilyName" placeholder="新建独立家庭账本名称..." />
          <NButton :loading="busy" @click="handleCreateFamily">新建账本</NButton>
        </div>
      </div>
    </section>

    <!-- 自定义收支分类管理 -->
    <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
      <h2 class="text-base font-semibold text-slate-900">收支分类管理</h2>
      <p class="mt-0.5 text-xs text-slate-500">
        系统已内置常用家庭分类，你也可以按家庭习惯补充自定义分类
      </p>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <NSelect
          v-model:value="newCategory.type"
          :options="[
            { label: '支出分类', value: CategoryType.EXPENSE },
            { label: '收入分类', value: CategoryType.INCOME },
          ]"
          class="w-32"
        />
        <NInput v-model:value="newCategory.name" placeholder="输入自定义分类名称" class="w-48" />
        <NColorPicker
          v-model:value="newCategory.color"
          :show-alpha="false"
          :modes="['hex']"
          class="w-28"
        />
        <NButton type="primary" size="small" :loading="busy" @click="handleAddCategory">
          <template #icon><Plus class="h-4 w-4" /></template>
          添加分类
        </NButton>
      </div>

      <NTabs class="mt-5" type="line">
        <NTabPane name="expense" :tab="`支出分类 (${expenseCategories.length})`">
          <div class="flex flex-wrap gap-2 pt-2">
            <div
              v-for="cat in expenseCategories"
              :key="cat.id"
              class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
            >
              <span
                class="h-2.5 w-2.5 rounded-full"
                :style="{ backgroundColor: cat.color || '#64748b' }"
              />
              <span class="font-medium text-slate-700">{{ cat.name }}</span>
              <span v-if="cat.isSystem" class="text-[10px] text-slate-400">系统</span>
              <NPopconfirm v-else @positive-click="handleDeleteCategory(cat.id)">
                <template #trigger>
                  <button type="button" class="text-slate-400 hover:text-rose-600">
                    <Trash2 class="h-3 w-3" />
                  </button>
                </template>
                确认删除自定义分类「{{ cat.name }}」？
              </NPopconfirm>
            </div>
          </div>
        </NTabPane>

        <NTabPane name="income" :tab="`收入分类 (${incomeCategories.length})`">
          <div class="flex flex-wrap gap-2 pt-2">
            <div
              v-for="cat in incomeCategories"
              :key="cat.id"
              class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
            >
              <span
                class="h-2.5 w-2.5 rounded-full"
                :style="{ backgroundColor: cat.color || '#16a34a' }"
              />
              <span class="font-medium text-slate-700">{{ cat.name }}</span>
              <span v-if="cat.isSystem" class="text-[10px] text-slate-400">系统</span>
              <NPopconfirm v-else @positive-click="handleDeleteCategory(cat.id)">
                <template #trigger>
                  <button type="button" class="text-slate-400 hover:text-rose-600">
                    <Trash2 class="h-3 w-3" />
                  </button>
                </template>
                确认删除自定义分类「{{ cat.name }}」？
              </NPopconfirm>
            </div>
          </div>
        </NTabPane>
      </NTabs>
    </section>
  </div>
</template>
