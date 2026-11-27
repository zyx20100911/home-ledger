import { describe, expect, it } from 'vitest';
import {
  AccountType,
  CategoryType,
  TransactionType,
  type AccountDTO,
  type CategoryDTO,
} from '@home-ledger/shared';
import { parseCsvRows, parseTransactionCsv } from './transactionCsv';

const mockAccounts: AccountDTO[] = [
  {
    id: 'acc-cmb',
    familyId: 'fam-1',
    name: '招商银行储蓄卡',
    type: AccountType.BANK_CARD,
    currency: 'CNY',
    balance: '10000.00',
    includeInNetWorth: true,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'acc-wechat',
    familyId: 'fam-1',
    name: '微信零钱通',
    type: AccountType.WECHAT,
    currency: 'CNY',
    balance: '2000.00',
    includeInNetWorth: true,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'acc-alipay',
    familyId: 'fam-1',
    name: '支付宝余额宝',
    type: AccountType.ALIPAY,
    currency: 'CNY',
    balance: '5000.00',
    includeInNetWorth: true,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const mockCategories: CategoryDTO[] = [
  {
    id: 'cat-food',
    name: '餐饮美食',
    type: CategoryType.EXPENSE,
    sortOrder: 1,
    isSystem: true,
  },
  {
    id: 'cat-shop',
    name: '日常购物',
    type: CategoryType.EXPENSE,
    sortOrder: 2,
    isSystem: true,
  },
  {
    id: 'cat-salary',
    name: '工资薪金',
    type: CategoryType.INCOME,
    sortOrder: 1,
    isSystem: true,
  },
];

describe('transactionCsv parser', () => {
  it('parses RFC 4180 quoted commas and escaped quotes', () => {
    const rows = parseCsvRows('时间,备注\n2026-11-27 12:00,"苹果, ""红富士"""');
    expect(rows).toEqual([
      ['时间', '备注'],
      ['2026-11-27 12:00', '苹果, "红富士"'],
    ]);
  });

  it('parses standard Home Ledger CSV template accurately', () => {
    const csv = [
      '时间,类型,分类,资金账户,转入账户,金额,备注',
      '2026-11-27 12:30:00,支出,餐饮美食,微信零钱通,,48.5,午餐',
      '2026-11-26 18:00:00,转账,,招商银行储蓄卡,微信零钱通,1000,备用金',
    ].join('\n');

    const result = parseTransactionCsv(csv, mockAccounts, mockCategories);
    expect(result.source).toBe('standard');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      type: TransactionType.EXPENSE,
      amount: '48.50',
      accountId: 'acc-wechat',
      categoryId: 'cat-food',
      error: null,
    });
    expect(result.rows[1]).toMatchObject({
      type: TransactionType.TRANSFER,
      amount: '1000.00',
      accountId: 'acc-cmb',
      toAccountId: 'acc-wechat',
      error: null,
    });
  });

  it('parses WeChat bill CSV and skips neutral records', () => {
    const csv = [
      '微信支付账单明细,,,,,,,,',
      '交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,备注',
      '2026-11-27 12:15:00,商户消费,美团外卖,牛肉面,支出,¥32.50,零钱,支付成功,/',
      '2026-11-27 14:00:00,零钱通转入,零钱通,/,不计收支,¥500.00,零钱,已存入,/',
    ].join('\n');

    const result = parseTransactionCsv(csv, mockAccounts, mockCategories);
    expect(result.source).toBe('wechat');
    expect(result.skippedCount).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      type: TransactionType.EXPENSE,
      amount: '32.50',
      accountId: 'acc-wechat',
      categoryId: 'cat-food',
      error: null,
    });
  });

  it('parses Alipay bill CSV and skips closed orders', () => {
    const csv = [
      '支付宝交易明细,,,,,,,,',
      '交易时间,交易分类,交易对方,商品说明,收/支,金额,收/付款方式,交易状态,备注',
      '2026-11-25 09:00:00,日用百货,山姆会员店,鲜奶与水果,支出,168.00,余额宝,交易成功,',
      '2026-11-25 10:00:00,日用百货,某店铺,取消订单,支出,99.00,余额宝,交易关闭,',
    ].join('\n');

    const result = parseTransactionCsv(csv, mockAccounts, mockCategories);
    expect(result.source).toBe('alipay');
    expect(result.skippedCount).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      type: TransactionType.EXPENSE,
      amount: '168.00',
      accountId: 'acc-alipay',
      categoryId: 'cat-shop',
      error: null,
    });
  });
});
