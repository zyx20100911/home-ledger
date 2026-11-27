/**
 * 财务金额工具函数（基于整数分运算，避免 JS 浮点精度误差）
 */

const MONEY_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/;

/** 将金额字符串/数字安全转换为整数分 (cents) */
export function yuanToCents(value: string | number): number {
  const normalized = typeof value === 'number' ? value.toFixed(2) : value.trim();
  const match = MONEY_PATTERN.exec(normalized);
  if (!match) {
    throw new Error(`Invalid money value: "${value}"`);
  }

  const sign = match[1] ? -1 : 1;
  const wholePart = Number(match[2]);
  const fracRaw = match[3] ?? '';
  const fracPadded = `${fracRaw}00`.slice(0, 2);
  const fracPart = Number(fracPadded);

  return sign * (wholePart * 100 + fracPart);
}

/** 将整数分转换为两位小数字符串，例如 12850 -> "128.50" */
export function centsToYuan(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Expected safe integer cents, received: ${cents}`);
  }
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

/** 精确加法 */
export function addMoney(a: string | number, b: string | number): string {
  return centsToYuan(yuanToCents(a) + yuanToCents(b));
}

/** 精确减法 */
export function subMoney(a: string | number, b: string | number): string {
  return centsToYuan(yuanToCents(a) - yuanToCents(b));
}

/** 格式化展示金额，例如 "12800.5" -> "¥12,800.50" */
export function formatMoney(
  value: string | number,
  options: { currency?: string; locale?: string; showSign?: boolean } = {},
): string {
  const { currency = 'CNY', locale = 'zh-CN', showSign = false } = options;
  const cents = yuanToCents(value);
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

  if (showSign && cents > 0) {
    return `+${formatted}`;
  }
  return formatted;
}
