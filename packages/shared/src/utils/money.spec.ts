import { describe, expect, it } from 'vitest';
import { addMoney, centsToYuan, formatMoney, subMoney, yuanToCents } from './money';

describe('money utilities', () => {
  it('avoids floating point errors on addition and subtraction', () => {
    expect(addMoney('0.1', '0.2')).toBe('0.30');
    expect(subMoney('100.00', '0.01')).toBe('99.99');
    expect(addMoney('-12.34', '5.04')).toBe('-7.30');
  });

  it('converts between yuan and cents accurately', () => {
    expect(yuanToCents('128.5')).toBe(12850);
    expect(yuanToCents('-0.05')).toBe(-5);
    expect(centsToYuan(12850)).toBe('128.50');
    expect(centsToYuan(-5)).toBe('-0.05');
  });

  it('formats CNY currency values', () => {
    expect(formatMoney('12345.6')).toContain('12,345.60');
    expect(formatMoney('50', { showSign: true })).toMatch(/^\+/);
  });
});
