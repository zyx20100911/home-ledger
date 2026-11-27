import { describe, expect, it } from 'vitest';
import { AccountType } from '@home-ledger/shared';
import { parseAccountCsv } from './accountCsv';

describe('accountCsv parser', () => {
  it('parses standard, insurance, medical, social security, and credit card accounts', () => {
    const csv = [
      '账户名称,账户类型,当前余额,计入净资产,状态,承保/所属机构,保额,续保到期日,备注',
      '个人医保账户,医保账户,6840.5,是,启用中,市医保局,,,定点刷卡',
      '住房公积金,SOCIAL_SECURITY,84200,是,启用中,市公积金中心,,,双边缴存',
      '家庭车险,商业保险,0,否,启用中,中国平安,2000000,2027-03-20,纯消费型',
      '招行信用卡,信用卡,-3200.50,是,启用中,招商银行,,,透支欠款',
    ].join('\n');

    const rows = parseAccountCsv(csv);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      name: '个人医保账户',
      type: AccountType.MEDICAL_INSURANCE,
      balance: '6840.50',
      includeInNetWorth: true,
      institution: '市医保局',
      error: null,
    });
    expect(rows[1]).toMatchObject({
      name: '住房公积金',
      type: AccountType.SOCIAL_SECURITY,
      balance: '84200.00',
      error: null,
    });
    expect(rows[2]).toMatchObject({
      name: '家庭车险',
      type: AccountType.INSURANCE,
      balance: '0.00',
      includeInNetWorth: false,
      coverageAmount: '2000000.00',
      renewalDateDisplay: '2027-03-20',
      error: null,
    });
    expect(rows[3]).toMatchObject({
      name: '招行信用卡',
      type: AccountType.CREDIT_CARD,
      balance: '-3200.50',
      error: null,
    });
  });

  it('flags invalid renewal date and invalid balance', () => {
    const csv = [
      '账户名称,账户类型,当前余额,计入净资产,承保/所属机构,保额,续保到期日,备注',
      '异常保单,商业保险,abc,否,平安,100000,not-a-date,',
    ].join('\n');

    const rows = parseAccountCsv(csv);
    expect(rows[0]?.error).not.toBeNull();
  });
});
