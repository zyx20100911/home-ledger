import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { HealthCheckResponse } from '@home-ledger/shared';
import { fetchHealth } from '@/api/health';

export const useAppStore = defineStore('app', () => {
  const health = ref<HealthCheckResponse | null>(null);
  const healthLoading = ref(false);
  const healthError = ref<string | null>(null);

  async function checkBackendHealth(): Promise<void> {
    healthLoading.value = true;
    healthError.value = null;
    try {
      health.value = await fetchHealth();
    } catch (err) {
      health.value = null;
      healthError.value = err instanceof Error ? err.message : '无法连接后端服务';
    } finally {
      healthLoading.value = false;
    }
  }

  return {
    health,
    healthLoading,
    healthError,
    checkBackendHealth,
  };
});
