import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { AccountDTO, AccountSummaryDTO, CategoryDTO } from '@home-ledger/shared';
import { fetchAccountSummary } from '@/api/accounts';
import { fetchCategories } from '@/api/categories';

export const useLedgerStore = defineStore('ledger', () => {
  const accountSummary = ref<AccountSummaryDTO | null>(null);
  const categories = ref<CategoryDTO[]>([]);
  const loadingMeta = ref(false);
  /** 每次记账/改账/改账户后递增，通知首页与流水页按需刷新 */
  const dataVersion = ref(0);

  const accounts = (): AccountDTO[] => accountSummary.value?.accounts ?? [];

  async function loadFamilyMetadata(familyId: string, includeArchived = false): Promise<void> {
    loadingMeta.value = true;
    try {
      const [summary, cats] = await Promise.all([
        fetchAccountSummary(familyId, includeArchived),
        fetchCategories(familyId),
      ]);
      accountSummary.value = summary;
      categories.value = cats;
    } finally {
      loadingMeta.value = false;
    }
  }

  function bumpVersion(): void {
    dataVersion.value += 1;
  }

  function reset(): void {
    accountSummary.value = null;
    categories.value = [];
  }

  return {
    accountSummary,
    categories,
    loadingMeta,
    dataVersion,
    accounts,
    loadFamilyMetadata,
    bumpVersion,
    reset,
  };
});
