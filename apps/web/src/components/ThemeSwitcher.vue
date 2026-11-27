<script setup lang="ts">
import { NPopover } from 'naive-ui';
import { Check, Monitor, Moon, Sun } from 'lucide-vue-next';
import { ACCENT_PRESETS, useThemeStore, type ThemeMode } from '@/stores/theme';

const themeStore = useThemeStore();

const modeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '系统', icon: Monitor },
];
</script>

<template>
  <div class="inline-flex items-center gap-1.5">
    <!-- 一键明暗切换 -->
    <button
      type="button"
      class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[var(--surface-container)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-high)] hover:text-[var(--text-primary)]"
      :title="themeStore.isDark ? '切换为浅色模式' : '切换为深色模式'"
      @click="themeStore.toggleLightDark()"
    >
      <Sun v-if="themeStore.isDark" class="h-4 w-4" />
      <Moon v-else class="h-4 w-4" />
    </button>

    <!-- 主题配色面板 -->
    <NPopover trigger="click" placement="bottom-end" :width="288">
      <template #trigger>
        <button
          type="button"
          class="flex h-8 cursor-pointer items-center gap-2 rounded-full bg-[var(--surface-container)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-high)] hover:text-[var(--text-primary)]"
          title="外观与主题配色"
        >
          <span class="flex items-center -space-x-1">
            <span
              class="h-3 w-3 rounded-full ring-1 ring-[var(--hairline)]"
              :style="{ backgroundColor: themeStore.activePreset.surfaceSwatch }"
            />
            <span
              class="h-3 w-3 rounded-full ring-1 ring-[var(--surface-container)]"
              :style="{ backgroundColor: themeStore.activePreset.swatch }"
            />
          </span>
          <span class="hidden sm:inline">{{ themeStore.activePreset.name }}</span>
        </button>
      </template>

      <div class="space-y-4 p-1">
        <div>
          <div class="mb-2 text-xs font-semibold text-[var(--text-primary)]">外观模式</div>
          <div class="grid grid-cols-3 gap-1 rounded-full bg-[var(--surface-high)] p-1">
            <button
              v-for="opt in modeOptions"
              :key="opt.value"
              type="button"
              class="flex cursor-pointer items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-colors"
              :class="
                themeStore.mode === opt.value
                  ? 'bg-[var(--surface-container)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              "
              @click="themeStore.setMode(opt.value)"
            >
              <component :is="opt.icon" class="h-3.5 w-3.5" />
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-semibold text-[var(--text-primary)]">主题方案</span>
            <span class="text-[11px] text-[var(--text-muted)]">{{ themeStore.activePreset.name }}</span>
          </div>
          <div class="space-y-1.5">
            <button
              v-for="preset in ACCENT_PRESETS"
              :key="preset.key"
              type="button"
              class="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors"
              :class="
                themeStore.accent === preset.key
                  ? 'bg-[var(--accent-tonal)] font-semibold text-[var(--accent-text)]'
                  : 'bg-[var(--surface-high)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              "
              @click="themeStore.setAccent(preset.key)"
            >
              <span class="flex min-w-0 items-center gap-2.5">
                <span class="flex shrink-0 items-center -space-x-1.5">
                  <span
                    class="h-4 w-4 rounded-full ring-1 ring-white/15"
                    :style="{ backgroundColor: preset.surfaceSwatch }"
                  />
                  <span
                    class="h-4 w-4 rounded-full ring-1 ring-[var(--surface-container)]"
                    :style="{ backgroundColor: preset.swatch }"
                  />
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-xs">{{ preset.name }}</span>
                  <span class="block truncate text-[10px] opacity-75">{{ preset.description }}</span>
                </span>
              </span>
              <Check v-if="themeStore.accent === preset.key" class="h-3.5 w-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </NPopover>
  </div>
</template>
