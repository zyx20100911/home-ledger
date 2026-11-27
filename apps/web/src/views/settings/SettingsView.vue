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
import { Check, Copy, Monitor, Moon, Plus, Sun, Trash2, UserPlus } from 'lucide-vue-next';
import { createCategory, deleteCategory } from '@/api/categories';
import { createFamily, createFamilyInvite, joinFamily, listFamilyMembers } from '@/api/families';
import { useAuthStore } from '@/stores/auth';
import { useLedgerStore } from '@/stores/ledger';
import { ACCENT_PRESETS, useThemeStore, type ThemeMode } from '@/stores/theme';

const message = useMessage();
const authStore = useAuthStore();
const ledgerStore = useLedgerStore();
const themeStore = useThemeStore();

const members = ref<FamilyMemberDTO[]>([]);
const latestInvite = ref<FamilyInviteDTO | null>(null);
const inviteCodeInput = ref('');
const newFamilyName = ref('');
const busy = ref(false);

const CATEGORY_COLOR_SWATCHES = [
  '#79c6c6',
  '#a5f9f1',
  '#a8c7fa',
  '#0b57d0',
  '#d0bcff',
  '#f28b82',
  '#fbbf24',
  '#e3c38a',
  '#74c69d',
  '#71717a',
];

const modeCards: Array<{ value: ThemeMode; label: string; desc: string; icon: typeof Sun }> = [
  { value: 'light', label: '浅色模式', desc: '明亮通透，适合日间对账', icon: Sun },
  { value: 'dark', label: '深色模式', desc: '成熟低疲劳暗黑灰阶', icon: Moon },
  { value: 'system', label: '跟随系统', desc: '自动匹配操作系统外观', icon: Monitor },
];

const newCategory = reactive({
  name: '',
  type: CategoryType.EXPENSE as CategoryType,
  color: '#79c6c6',
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

function getInitial(name: string): string {
  return (name.trim() || 'U').slice(0, 1).toUpperCase();
}

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
    <!-- 外观与主题偏好 -->
    <section class="tonal-surface p-6">
      <div>
        <h2 class="text-base font-semibold text-[var(--text-primary)]">外观与主题偏好</h2>
        <p class="mt-0.5 text-xs text-[var(--text-muted)]">
          选择深浅外观与成熟 Tonal 主题方案，偏好将自动保存至本地浏览器
        </p>
      </div>

      <!-- 明暗模式选择 -->
      <div class="mt-5">
        <div class="mb-2.5 text-xs font-medium text-[var(--text-secondary)]">外观模式</div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            v-for="item in modeCards"
            :key="item.value"
            type="button"
            class="flex cursor-pointer items-center justify-between gap-3 rounded-2xl p-3.5 text-left transition-colors"
            :class="
              themeStore.mode === item.value
                ? 'bg-[var(--accent-tonal)] text-[var(--accent-text)]'
                : 'bg-[var(--surface-high)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            "
            @click="themeStore.setMode(item.value)"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-xs font-semibold">
                <component :is="item.icon" class="h-3.5 w-3.5 shrink-0" />
                <span>{{ item.label }}</span>
              </div>
              <p class="mt-1 text-[11px] opacity-75">{{ item.desc }}</p>
            </div>
            <Check v-if="themeStore.mode === item.value" class="h-4 w-4 shrink-0" />
          </button>
        </div>
      </div>

      <!-- 4 套主题方案选择 -->
      <div class="mt-6">
        <div class="mb-2.5 text-xs font-medium text-[var(--text-secondary)]">主题配色方案</div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            v-for="preset in ACCENT_PRESETS"
            :key="preset.key"
            type="button"
            class="flex cursor-pointer items-center gap-3.5 rounded-2xl p-3.5 text-left transition-colors"
            :class="
              themeStore.accent === preset.key
                ? 'bg-[var(--accent-tonal)] text-[var(--accent-text)]'
                : 'bg-[var(--surface-high)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            "
            @click="themeStore.setAccent(preset.key)"
          >
            <span class="flex shrink-0 items-center -space-x-2">
              <span
                class="h-7 w-7 rounded-full ring-1 ring-white/15"
                :style="{ backgroundColor: preset.surfaceSwatch }"
              />
              <span
                class="h-7 w-7 rounded-full ring-2 ring-[var(--surface-container)]"
                :style="{ backgroundColor: preset.swatch }"
              />
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-semibold">{{ preset.name }}</div>
              <div class="truncate text-[11px] opacity-75">{{ preset.description }}</div>
            </div>
            <Check v-if="themeStore.accent === preset.key" class="h-4 w-4 shrink-0" />
          </button>
        </div>
      </div>
    </section>

    <!-- 家庭成员与邀请 -->
    <section class="tonal-surface p-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-[var(--text-primary)]">
            家庭成员（{{ authStore.currentFamily?.name }}）
          </h2>
          <p class="mt-0.5 text-xs text-[var(--text-muted)]">
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
        class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--accent-tonal)] px-4 py-3 text-sm text-[var(--accent-text)]"
      >
        <div>
          <span class="text-xs font-medium">最新邀请码（7 天内有效）：</span>
          <strong class="ml-1.5 font-mono text-base tracking-widest text-[var(--text-primary)]">
            {{ latestInvite.code }}
          </strong>
        </div>
        <NButton size="tiny" type="primary" ghost @click="copyInviteCode">
          <template #icon><Copy class="h-3.5 w-3.5" /></template>
          复制邀请码
        </NButton>
      </div>

      <div class="mt-4 divide-y divide-[var(--hairline)]">
        <div
          v-for="m in members"
          :key="m.id"
          class="flex items-center justify-between py-3.5 text-sm"
        >
          <div class="flex min-w-0 items-center gap-3">
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-tonal)] text-xs font-semibold text-[var(--accent-text)]"
            >
              {{ getInitial(m.nickname) }}
            </div>
            <div class="min-w-0">
              <div class="truncate font-medium text-[var(--text-primary)]">{{ m.nickname }}</div>
              <div class="truncate text-xs text-[var(--text-muted)]">{{ m.email }}</div>
            </div>
          </div>
          <NTag size="small" :bordered="false" :type="m.role === 'OWNER' ? 'success' : 'default'">
            {{ FAMILY_ROLE_LABELS[m.role] }}
          </NTag>
        </div>
      </div>

      <!-- 加入或新建家庭 -->
      <div class="mt-5 grid grid-cols-1 gap-4 border-t border-[var(--hairline)] pt-5 md:grid-cols-2">
        <div class="flex items-center gap-2">
          <div class="min-w-0 flex-1">
            <NInput v-model:value="inviteCodeInput" placeholder="输入其他家庭的邀请码..." />
          </div>
          <NButton class="shrink-0" :loading="busy" @click="handleJoinFamily">加入家庭</NButton>
        </div>
        <div class="flex items-center gap-2">
          <div class="min-w-0 flex-1">
            <NInput v-model:value="newFamilyName" placeholder="新建独立家庭账本名称..." />
          </div>
          <NButton class="shrink-0" :loading="busy" @click="handleCreateFamily">新建账本</NButton>
        </div>
      </div>
    </section>

    <!-- 自定义收支分类管理 -->
    <section class="tonal-surface p-6">
      <h2 class="text-base font-semibold text-[var(--text-primary)]">收支分类管理</h2>
      <p class="mt-0.5 text-xs text-[var(--text-muted)]">
        系统已内置常用家庭分类，你也可以按家庭习惯补充自定义分类
      </p>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <div class="w-36 shrink-0">
          <NSelect
            v-model:value="newCategory.type"
            :options="[
              { label: '支出分类', value: CategoryType.EXPENSE },
              { label: '收入分类', value: CategoryType.INCOME },
            ]"
          />
        </div>
        <div class="w-56 shrink-0">
          <NInput v-model:value="newCategory.name" placeholder="输入自定义分类名称" />
        </div>
        <div class="w-32 shrink-0">
          <NColorPicker
            v-model:value="newCategory.color"
            :show-alpha="false"
            :modes="['hex']"
            :swatches="CATEGORY_COLOR_SWATCHES"
          />
        </div>
        <NButton
          type="primary"
          size="medium"
          class="shrink-0"
          :loading="busy"
          @click="handleAddCategory"
        >
          <template #icon><Plus class="h-4 w-4" /></template>
          添加分类
        </NButton>
      </div>

      <NTabs class="mt-5" type="line">
        <NTabPane name="expense" :tab="`支出分类 (${expenseCategories.length})`">
          <div class="flex flex-wrap gap-2.5 pt-2">
            <div
              v-for="cat in expenseCategories"
              :key="cat.id"
              class="inline-flex items-center gap-2 rounded-full bg-[var(--surface-high)] px-3.5 py-1.5 text-xs"
            >
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                :style="{ backgroundColor: cat.color || '#64748b' }"
              />
              <span class="font-medium text-[var(--text-primary)]">{{ cat.name }}</span>
              <span
                v-if="cat.isSystem"
                class="rounded-full bg-[var(--surface-container)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
              >
                系统
              </span>
              <NPopconfirm v-else @positive-click="handleDeleteCategory(cat.id)">
                <template #trigger>
                  <button
                    type="button"
                    class="cursor-pointer text-[var(--text-muted)] transition-colors hover:text-[var(--negative)]"
                  >
                    <Trash2 class="h-3 w-3" />
                  </button>
                </template>
                确认删除自定义分类「{{ cat.name }}」？
              </NPopconfirm>
            </div>
          </div>
        </NTabPane>

        <NTabPane name="income" :tab="`收入分类 (${incomeCategories.length})`">
          <div class="flex flex-wrap gap-2.5 pt-2">
            <div
              v-for="cat in incomeCategories"
              :key="cat.id"
              class="inline-flex items-center gap-2 rounded-full bg-[var(--surface-high)] px-3.5 py-1.5 text-xs"
            >
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                :style="{ backgroundColor: cat.color || '#16a34a' }"
              />
              <span class="font-medium text-[var(--text-primary)]">{{ cat.name }}</span>
              <span
                v-if="cat.isSystem"
                class="rounded-full bg-[var(--surface-container)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
              >
                系统
              </span>
              <NPopconfirm v-else @positive-click="handleDeleteCategory(cat.id)">
                <template #trigger>
                  <button
                    type="button"
                    class="cursor-pointer text-[var(--text-muted)] transition-colors hover:text-[var(--negative)]"
                  >
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
