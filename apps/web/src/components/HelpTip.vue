<script setup lang="ts">
import { NPopover } from 'naive-ui';
import { HelpCircle } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    title?: string;
    text: string;
    formula?: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
  }>(),
  {
    title: undefined,
    formula: undefined,
    placement: 'top',
  },
);
</script>

<template>
  <NPopover
    trigger="hover"
    :placement="placement"
    :style="{ maxWidth: '280px' }"
  >
    <template #trigger>
      <button
        type="button"
        class="inline-flex cursor-pointer items-center justify-center rounded-full p-0.5 align-middle text-[var(--text-muted)] transition-colors hover:text-[var(--accent-text)] focus:outline-none"
        :aria-label="title || '查看说明'"
        @click.stop
      >
        <HelpCircle class="h-3.5 w-3.5" />
      </button>
    </template>

    <div class="space-y-1.5">
      <div v-if="title" class="text-xs font-semibold text-[var(--text-primary)]">
        {{ title }}
      </div>
      <p class="text-xs leading-relaxed text-[var(--text-secondary)]">
        {{ text }}
      </p>
      <div
        v-if="formula"
        class="mt-1.5 rounded-lg bg-[var(--surface-high)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-text)]"
      >
        {{ formula }}
      </div>
    </div>
  </NPopover>
</template>
