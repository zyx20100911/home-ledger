import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentKey = 'mint' | 'm3-blue' | 'carbon' | 'basalt-gold';

export interface ThemeTokens {
  canvas: string;
  sidebar: string;
  container: string;
  high: string;
  header: string;
  hover: string;
  hairline: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  hoverColor: string;
  pressed: string;
  suppl: string;
  accentFg: string;
  soft: string;
  softBorder: string;
  text: string;
  positive: string;
  positiveTonal: string;
  negative: string;
  negativeTonal: string;
  warning: string;
  info: string;
  chartIncome: string;
  chartExpense: string;
  chartSegments: string[];
}

export interface AccentPreset {
  key: AccentKey;
  name: string;
  description: string;
  swatch: string;
  surfaceSwatch: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    key: 'mint',
    name: '冰川青墨',
    description: '纯粹黑白炭灰配雾青高光',
    swatch: '#79c6c6',
    surfaceSwatch: '#141414',
    light: {
      canvas: '#f7fcfc',
      sidebar: '#f0f8f8',
      container: '#ffffff',
      high: '#e9f4f5',
      header: 'rgba(247, 252, 252, 0.88)',
      hover: 'rgba(10, 75, 79, 0.05)',
      hairline: 'rgba(20, 20, 20, 0.08)',
      borderStrong: 'rgba(52, 52, 52, 0.20)',
      textPrimary: '#141414',
      textSecondary: '#343434',
      textMuted: '#667677',
      primary: '#79c6c6',
      hoverColor: '#62b8b8',
      pressed: '#4ca6a6',
      suppl: '#a5f9f1',
      accentFg: '#141414',
      soft: '#d4f5f2',
      softBorder: 'rgba(121, 198, 198, 0.55)',
      text: '#0a4b4f',
      positive: '#0e7c7b',
      positiveTonal: '#d4f5f2',
      negative: '#b3261e',
      negativeTonal: 'rgba(179, 38, 30, 0.10)',
      warning: '#b87414',
      info: '#2d8585',
      chartIncome: '#4aa6a6',
      chartExpense: '#b3261e',
      chartSegments: ['#79c6c6', '#141414', '#343434', '#4aa6a6', '#b3261e'],
    },
    dark: {
      canvas: '#141414',
      sidebar: '#191919',
      container: '#1f1f1f',
      high: '#2a2a2a',
      header: 'rgba(20, 20, 20, 0.88)',
      hover: 'rgba(165, 249, 241, 0.06)',
      hairline: 'rgba(255, 255, 255, 0.08)',
      borderStrong: '#343434',
      textPrimary: '#f5f5f5',
      textSecondary: '#a3a3a3',
      textMuted: '#737373',
      primary: '#79c6c6',
      hoverColor: '#a5f9f1',
      pressed: '#5fb0b0',
      suppl: '#a5f9f1',
      accentFg: '#141414',
      soft: 'rgba(121, 198, 198, 0.14)',
      softBorder: 'rgba(121, 198, 198, 0.34)',
      text: '#a5f9f1',
      positive: '#a5f9f1',
      positiveTonal: 'rgba(165, 249, 241, 0.12)',
      negative: '#f28b82',
      negativeTonal: 'rgba(242, 139, 130, 0.13)',
      warning: '#f3c969',
      info: '#79c6c6',
      chartIncome: '#79c6c6',
      chartExpense: '#f28b82',
      chartSegments: ['#a5f9f1', '#79c6c6', '#e5e5e5', '#8a8a8a', '#f28b82'],
    },
  },
  {
    key: 'm3-blue',
    name: 'M3 冰雾蓝',
    description: 'Google Material 3 深岩灰蓝调',
    swatch: '#a8c7fa',
    surfaceSwatch: '#111318',
    light: {
      canvas: '#f8fafd',
      sidebar: '#f0f4f9',
      container: '#ffffff',
      high: '#e9eef6',
      header: 'rgba(248, 250, 253, 0.88)',
      hover: 'rgba(11, 87, 208, 0.05)',
      hairline: 'rgba(15, 23, 42, 0.08)',
      borderStrong: 'rgba(15, 23, 42, 0.16)',
      textPrimary: '#1f1f1f',
      textSecondary: '#444746',
      textMuted: '#747775',
      primary: '#0b57d0',
      hoverColor: '#0847ad',
      pressed: '#06398c',
      suppl: '#1b6ef3',
      accentFg: '#ffffff',
      soft: '#d3e3fd',
      softBorder: 'rgba(11, 87, 208, 0.28)',
      text: '#041e49',
      positive: '#146c2e',
      positiveTonal: 'rgba(20, 108, 46, 0.10)',
      negative: '#b3261e',
      negativeTonal: 'rgba(179, 38, 30, 0.10)',
      warning: '#d97706',
      info: '#0b57d0',
      chartIncome: '#146c2e',
      chartExpense: '#b3261e',
      chartSegments: ['#0b57d0', '#00639b', '#146c2e', '#6750a4', '#b3261e'],
    },
    dark: {
      canvas: '#111318',
      sidebar: '#15181f',
      container: '#1b1f27',
      high: '#232833',
      header: 'rgba(17, 19, 24, 0.86)',
      hover: 'rgba(255, 255, 255, 0.05)',
      hairline: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(255, 255, 255, 0.17)',
      textPrimary: '#e3e6ed',
      textSecondary: '#9aa0ad',
      textMuted: '#6c7380',
      primary: '#a8c7fa',
      hoverColor: '#c2d8fc',
      pressed: '#8ab4f8',
      suppl: '#a8c7fa',
      accentFg: '#062e6f',
      soft: 'rgba(168, 199, 250, 0.14)',
      softBorder: 'rgba(168, 199, 250, 0.32)',
      text: '#a8c7fa',
      positive: '#6dd58c',
      positiveTonal: 'rgba(109, 213, 140, 0.13)',
      negative: '#f28b82',
      negativeTonal: 'rgba(242, 139, 130, 0.13)',
      warning: '#fbbf24',
      info: '#7fcfff',
      chartIncome: '#6dd58c',
      chartExpense: '#f28b82',
      chartSegments: ['#a8c7fa', '#7fcfff', '#6dd58c', '#d0bcff', '#f2b8b5'],
    },
  },
  {
    key: 'carbon',
    name: '碳素极简',
    description: 'Linear / Vercel 纯净中性碳黑',
    swatch: '#ededef',
    surfaceSwatch: '#0e0e10',
    light: {
      canvas: '#f7f7f8',
      sidebar: '#f1f1f3',
      container: '#ffffff',
      high: '#ebebef',
      header: 'rgba(247, 247, 248, 0.88)',
      hover: 'rgba(0, 0, 0, 0.04)',
      hairline: 'rgba(0, 0, 0, 0.08)',
      borderStrong: 'rgba(0, 0, 0, 0.18)',
      textPrimary: '#111114',
      textSecondary: '#52525b',
      textMuted: '#71717a',
      primary: '#18181b',
      hoverColor: '#27272a',
      pressed: '#09090b',
      suppl: '#3f3f46',
      accentFg: '#ffffff',
      soft: 'rgba(24, 24, 27, 0.08)',
      softBorder: 'rgba(24, 24, 27, 0.22)',
      text: '#18181b',
      positive: '#059669',
      positiveTonal: 'rgba(5, 150, 105, 0.10)',
      negative: '#dc2626',
      negativeTonal: 'rgba(220, 38, 38, 0.10)',
      warning: '#d97706',
      info: '#2563eb',
      chartIncome: '#059669',
      chartExpense: '#dc2626',
      chartSegments: ['#18181b', '#059669', '#2563eb', '#71717a', '#dc2626'],
    },
    dark: {
      canvas: '#0e0e10',
      sidebar: '#131316',
      container: '#18181c',
      high: '#222228',
      header: 'rgba(14, 14, 16, 0.86)',
      hover: 'rgba(255, 255, 255, 0.05)',
      hairline: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(255, 255, 255, 0.18)',
      textPrimary: '#f0f0f2',
      textSecondary: '#9a9ba6',
      textMuted: '#666873',
      primary: '#ededef',
      hoverColor: '#ffffff',
      pressed: '#d4d4d8',
      suppl: '#ededef',
      accentFg: '#0e0e10',
      soft: 'rgba(255, 255, 255, 0.09)',
      softBorder: 'rgba(255, 255, 255, 0.24)',
      text: '#f0f0f2',
      positive: '#34d399',
      positiveTonal: 'rgba(52, 211, 153, 0.13)',
      negative: '#f87171',
      negativeTonal: 'rgba(248, 113, 113, 0.13)',
      warning: '#fbbf24',
      info: '#60a5fa',
      chartIncome: '#34d399',
      chartExpense: '#f87171',
      chartSegments: ['#ededef', '#34d399', '#60a5fa', '#a1a1aa', '#f87171'],
    },
  },
  {
    key: 'basalt-gold',
    name: '暖岩黑金',
    description: '温润石炭底配私人银行流金',
    swatch: '#e3c38a',
    surfaceSwatch: '#121110',
    light: {
      canvas: '#f7f5f0',
      sidebar: '#f0ece3',
      container: '#ffffff',
      high: '#eae4d8',
      header: 'rgba(247, 245, 240, 0.88)',
      hover: 'rgba(28, 25, 23, 0.04)',
      hairline: 'rgba(28, 25, 23, 0.09)',
      borderStrong: 'rgba(28, 25, 23, 0.18)',
      textPrimary: '#1c1917',
      textSecondary: '#57534e',
      textMuted: '#78716c',
      primary: '#9a6f28',
      hoverColor: '#825d20',
      pressed: '#6b4c18',
      suppl: '#b68635',
      accentFg: '#ffffff',
      soft: 'rgba(154, 111, 40, 0.12)',
      softBorder: 'rgba(154, 111, 40, 0.30)',
      text: '#7c5619',
      positive: '#15803d',
      positiveTonal: 'rgba(21, 128, 61, 0.10)',
      negative: '#c2410c',
      negativeTonal: 'rgba(194, 65, 12, 0.10)',
      warning: '#b45309',
      info: '#9a6f28',
      chartIncome: '#15803d',
      chartExpense: '#c2410c',
      chartSegments: ['#9a6f28', '#c29b57', '#15803d', '#78716c', '#c2410c'],
    },
    dark: {
      canvas: '#121110',
      sidebar: '#171513',
      container: '#1d1b18',
      high: '#272420',
      header: 'rgba(18, 17, 16, 0.86)',
      hover: 'rgba(245, 240, 232, 0.05)',
      hairline: 'rgba(245, 240, 232, 0.09)',
      borderStrong: 'rgba(245, 240, 232, 0.18)',
      textPrimary: '#f2efe9',
      textSecondary: '#a8a196',
      textMuted: '#706a61',
      primary: '#e3c38a',
      hoverColor: '#edd4a6',
      pressed: '#cfab6c',
      suppl: '#e3c38a',
      accentFg: '#1a150c',
      soft: 'rgba(227, 195, 138, 0.14)',
      softBorder: 'rgba(227, 195, 138, 0.34)',
      text: '#ead0a1',
      positive: '#74c69d',
      positiveTonal: 'rgba(116, 198, 157, 0.13)',
      negative: '#e08e6d',
      negativeTonal: 'rgba(224, 142, 109, 0.13)',
      warning: '#eab308',
      info: '#d4a373',
      chartIncome: '#74c69d',
      chartExpense: '#e08e6d',
      chartSegments: ['#e3c38a', '#b89862', '#74c69d', '#8e8579', '#e08e6d'],
    },
  },
];

const MODE_KEY = 'home_ledger_theme_mode';
const ACCENT_KEY = 'home_ledger_theme_accent';
const SIDEBAR_KEY = 'home_ledger_sidebar_collapsed';
const ONBOARDING_DISMISSED_KEY = 'home_ledger_onboarding_dismissed';

function readStoredMode(): ThemeMode {
  const v = localStorage.getItem(MODE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
}

function readStoredAccent(): AccentKey {
  const v = localStorage.getItem(ACCENT_KEY);
  return ACCENT_PRESETS.some((p) => p.key === v) ? (v as AccentKey) : 'mint';
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readStoredMode());
  const accent = ref<AccentKey>(readStoredAccent());
  const sidebarCollapsed = ref<boolean>(localStorage.getItem(SIDEBAR_KEY) === '1');
  const onboardingDismissed = ref<boolean>(localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1');

  const mediaQuery =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const systemPrefersDark = ref<boolean>(mediaQuery?.matches ?? true);

  if (mediaQuery) {
    mediaQuery.addEventListener('change', (e) => {
      systemPrefersDark.value = e.matches;
    });
  }

  const isDark = computed(() =>
    mode.value === 'system' ? systemPrefersDark.value : mode.value === 'dark',
  );

  const activePreset = computed<AccentPreset>(
    () => ACCENT_PRESETS.find((p) => p.key === accent.value) ?? ACCENT_PRESETS[0]!,
  );

  const activePalette = computed<ThemeTokens>(() =>
    isDark.value ? activePreset.value.dark : activePreset.value.light,
  );

  const naiveTheme = computed(() => (isDark.value ? darkTheme : null));

  const naiveThemeOverrides = computed<GlobalThemeOverrides>(() => {
    const p = activePalette.value;
    const dark = isDark.value;
    const controlBg = dark ? p.high : '#ffffff';
    const popoverBg = dark ? p.high : '#ffffff';
    const controlBorder = dark ? p.hairline : 'rgba(20, 20, 20, 0.12)';

    return {
      common: {
        primaryColor: p.primary,
        primaryColorHover: p.hoverColor,
        primaryColorPressed: p.pressed,
        primaryColorSuppl: p.suppl,
        borderRadius: '12px',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
        bodyColor: p.canvas,
        cardColor: p.container,
        modalColor: p.container,
        popoverColor: popoverBg,
        tableColor: p.container,
        inputColor: controlBg,
        actionColor: dark ? p.high : '#fafafa',
        hoverColor: p.hover,
        borderColor: controlBorder,
        dividerColor: p.hairline,
        textColorBase: p.textPrimary,
        textColor1: p.textPrimary,
        textColor2: p.textSecondary,
        textColor3: p.textMuted,
      },
      Button: {
        color: controlBg,
        colorHover: dark ? p.high : '#ffffff',
        colorPressed: dark ? p.high : '#f5f7f7',
        colorFocus: controlBg,
        border: `1px solid ${controlBorder}`,
        borderHover: `1px solid ${p.primary}`,
        borderPressed: `1px solid ${p.pressed}`,
        borderFocus: `1px solid ${p.primary}`,
        textColorPrimary: p.accentFg,
        textColorHoverPrimary: p.accentFg,
        textColorPressedPrimary: p.accentFg,
        textColorFocusPrimary: p.accentFg,
        textColorDisabledPrimary: p.accentFg,
        borderRadiusTiny: '9999px',
        borderRadiusSmall: '9999px',
        borderRadiusMedium: '12px',
        borderRadiusLarge: '14px',
      },
      Card: {
        borderRadius: '20px',
        color: p.container,
        borderColor: p.hairline,
      },
      Modal: {
        borderRadius: '20px',
        color: p.container,
      },
      Drawer: {
        color: p.container,
        titleTextColor: p.textPrimary,
        textColor: p.textSecondary,
        headerBorderBottom: `1px solid ${p.hairline}`,
        footerBorderTop: `1px solid ${p.hairline}`,
      },
      Popover: {
        color: popoverBg,
      },
      DatePicker: {
        panelColor: popoverBg,
        itemColorActive: p.primary,
        itemTextColorActive: p.accentFg,
        itemColorHover: p.soft,
      },
      Select: {
        peers: {
          InternalSelection: {
            color: controlBg,
            colorActive: controlBg,
            border: `1px solid ${controlBorder}`,
            borderHover: `1px solid ${p.primary}`,
            borderActive: `1px solid ${p.primary}`,
            borderFocus: `1px solid ${p.primary}`,
            borderRadius: '12px',
          },
          InternalSelectMenu: {
            color: popoverBg,
            optionTextColor: p.textPrimary,
            optionTextColorActive: p.text,
            optionColorActive: p.soft,
            optionColorActivePending: p.soft,
            optionColorPending: p.hover,
          },
        },
      },
      Input: {
        color: controlBg,
        colorFocus: controlBg,
        border: `1px solid ${controlBorder}`,
        borderHover: `1px solid ${p.primary}`,
        borderFocus: `1px solid ${p.primary}`,
        borderRadius: '12px',
      },
    };
  });

  function applyThemeToDom(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', isDark.value);
    root.style.colorScheme = isDark.value ? 'dark' : 'light';

    const p = activePalette.value;
    const vars: Record<string, string> = {
      '--surface-canvas': p.canvas,
      '--surface-sidebar': p.sidebar,
      '--surface-container': p.container,
      '--surface-high': p.high,
      '--surface-card': p.container,
      '--surface-elevated': p.high,
      '--surface-subtle': p.high,
      '--surface-header': p.header,
      '--surface-hover': p.hover,
      '--hairline': p.hairline,
      '--border-subtle': p.hairline,
      '--border-strong': p.borderStrong,
      '--text-primary': p.textPrimary,
      '--text-secondary': p.textSecondary,
      '--text-muted': p.textMuted,
      '--accent': p.primary,
      '--accent-fg': p.accentFg,
      '--accent-tonal': p.soft,
      '--accent-text': p.text,
      '--brand-primary': p.primary,
      '--brand-hover': p.hoverColor,
      '--brand-pressed': p.pressed,
      '--brand-soft': p.soft,
      '--brand-soft-border': p.softBorder,
      '--brand-text': p.text,
      '--positive': p.positive,
      '--positive-tonal': p.positiveTonal,
      '--negative': p.negative,
      '--negative-tonal': p.negativeTonal,
      '--warning': p.warning,
      '--info': p.info,
    };

    Object.entries(vars).forEach(([k, v]) => {
      root.style.setProperty(k, v);
    });
  }

  watch([isDark, accent], applyThemeToDom, { immediate: true });

  function setMode(next: ThemeMode): void {
    mode.value = next;
    localStorage.setItem(MODE_KEY, next);
  }

  function toggleLightDark(): void {
    setMode(isDark.value ? 'light' : 'dark');
  }

  function setAccent(next: AccentKey): void {
    accent.value = next;
    localStorage.setItem(ACCENT_KEY, next);
  }

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0');
  }

  function setOnboardingDismissed(dismissed: boolean): void {
    onboardingDismissed.value = dismissed;
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, dismissed ? '1' : '0');
  }

  return {
    mode,
    accent,
    sidebarCollapsed,
    onboardingDismissed,
    isDark,
    activePreset,
    activePalette,
    naiveTheme,
    naiveThemeOverrides,
    setMode,
    toggleLightDark,
    setAccent,
    toggleSidebar,
    setOnboardingDismissed,
  };
});
