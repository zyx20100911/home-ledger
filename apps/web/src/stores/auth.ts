import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { AuthResponseDTO, FamilyDTO, UserDTO } from '@home-ledger/shared';
import { fetchMe, login as loginApi, register as registerApi } from '@/api/auth';

const TOKEN_KEY = 'home_ledger_token';
const FAMILY_KEY = 'home_ledger_family_id';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const user = ref<UserDTO | null>(null);
  const families = ref<FamilyDTO[]>([]);
  const currentFamilyId = ref<string | null>(localStorage.getItem(FAMILY_KEY));
  const hydrated = ref(false);

  const isAuthenticated = computed(() => Boolean(token.value));
  const currentFamily = computed<FamilyDTO | null>(() => {
    if (!families.value.length) return null;
    return families.value.find((f) => f.id === currentFamilyId.value) ?? families.value[0] ?? null;
  });

  function applyAuthResponse(res: AuthResponseDTO): void {
    token.value = res.accessToken;
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    user.value = res.user;
    families.value = res.families;
    hydrated.value = true;
    ensureValidCurrentFamily();
  }

  function ensureValidCurrentFamily(): void {
    if (!families.value.length) {
      currentFamilyId.value = null;
      localStorage.removeItem(FAMILY_KEY);
      return;
    }
    const exists = families.value.some((f) => f.id === currentFamilyId.value);
    if (!exists) {
      const firstId = families.value[0]!.id;
      currentFamilyId.value = firstId;
      localStorage.setItem(FAMILY_KEY, firstId);
    }
  }

  function switchFamily(familyId: string): void {
    if (families.value.some((f) => f.id === familyId)) {
      currentFamilyId.value = familyId;
      localStorage.setItem(FAMILY_KEY, familyId);
    }
  }

  function addFamily(family: FamilyDTO): void {
    if (!families.value.some((f) => f.id === family.id)) {
      families.value.push(family);
    }
    switchFamily(family.id);
  }

  async function login(email: string, password: string): Promise<void> {
    const res = await loginApi({ email, password });
    applyAuthResponse(res);
  }

  async function register(payload: {
    email: string;
    password: string;
    nickname: string;
    familyName?: string;
  }): Promise<void> {
    const res = await registerApi(payload);
    applyAuthResponse(res);
  }

  async function hydrate(): Promise<void> {
    if (!token.value) {
      hydrated.value = true;
      return;
    }
    try {
      const profile = await fetchMe();
      user.value = profile.user;
      families.value = profile.families;
      ensureValidCurrentFamily();
    } catch {
      logout();
    } finally {
      hydrated.value = true;
    }
  }

  function logout(): void {
    token.value = null;
    user.value = null;
    families.value = [];
    currentFamilyId.value = null;
    hydrated.value = true;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(FAMILY_KEY);
  }

  return {
    token,
    user,
    families,
    currentFamilyId,
    currentFamily,
    hydrated,
    isAuthenticated,
    login,
    register,
    hydrate,
    switchFamily,
    addFamily,
    logout,
  };
});
