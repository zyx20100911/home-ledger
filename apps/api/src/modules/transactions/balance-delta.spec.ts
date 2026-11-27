import { TransactionType } from '@prisma/client';
import { computeBalanceDeltasCents, mergeBalanceDeltas } from './balance-delta';

describe('balance-delta helpers', () => {
  it('computes deltas for expense, income, and transfer', () => {
    const exp = computeBalanceDeltasCents({
      type: TransactionType.EXPENSE,
      amount: '58.90',
      accountId: 'acc-1',
    });
    expect(exp.get('acc-1')).toBe(-5890);

    const inc = computeBalanceDeltasCents({
      type: TransactionType.INCOME,
      amount: '12000.00',
      accountId: 'acc-1',
    });
    expect(inc.get('acc-1')).toBe(1200000);

    const tr = computeBalanceDeltasCents({
      type: TransactionType.TRANSFER,
      amount: '500.00',
      accountId: 'acc-1',
      toAccountId: 'acc-2',
    });
    expect(tr.get('acc-1')).toBe(-50000);
    expect(tr.get('acc-2')).toBe(50000);
  });

  it('computes net deltas when editing a transaction across accounts', () => {
    const oldDelta = computeBalanceDeltasCents({
      type: TransactionType.EXPENSE,
      amount: '100.00',
      accountId: 'acc-1',
    });
    const newDelta = computeBalanceDeltasCents({
      type: TransactionType.EXPENSE,
      amount: '120.50',
      accountId: 'acc-2',
    });

    const net = mergeBalanceDeltas(newDelta, oldDelta, -1);
    expect(net.get('acc-1')).toBe(10000);
    expect(net.get('acc-2')).toBe(-12050);
  });

  it('cancels out zero deltas when reversing identical transaction', () => {
    const delta = computeBalanceDeltasCents({
      type: TransactionType.EXPENSE,
      amount: '88.00',
      accountId: 'acc-1',
    });
    const net = mergeBalanceDeltas(delta, delta, -1);
    expect(net.size).toBe(0);
  });

  it('aggregates reverse deltas for batch deletion of mixed transactions', () => {
    const records = [
      { type: TransactionType.EXPENSE, amount: '50.25', accountId: 'acc-1', toAccountId: null },
      { type: TransactionType.INCOME, amount: '200.00', accountId: 'acc-1', toAccountId: null },
      { type: TransactionType.TRANSFER, amount: '80.00', accountId: 'acc-1', toAccountId: 'acc-2' },
    ];
    let reverseDeltas = new Map<string, number>();
    for (const r of records) {
      reverseDeltas = mergeBalanceDeltas(reverseDeltas, computeBalanceDeltasCents(r), -1);
    }
    // acc-1 had -5025 + 20000 - 8000 = +6975, so reversing yields -6975
    expect(reverseDeltas.get('acc-1')).toBe(-6975);
    // acc-2 had +8000, so reversing yields -8000
    expect(reverseDeltas.get('acc-2')).toBe(-8000);
  });

  it('aggregates net deltas when batch migrating accountId across multiple transactions', () => {
    const records = [
      { type: TransactionType.EXPENSE, amount: '30.00', accountId: 'acc-old', toAccountId: null },
      { type: TransactionType.INCOME, amount: '100.00', accountId: 'acc-old', toAccountId: null },
    ];
    let netDeltas = new Map<string, number>();
    for (const r of records) {
      const oldD = computeBalanceDeltasCents(r);
      const newD = computeBalanceDeltasCents({ ...r, accountId: 'acc-new' });
      netDeltas = mergeBalanceDeltas(netDeltas, newD, 1);
      netDeltas = mergeBalanceDeltas(netDeltas, oldD, -1);
    }
    expect(netDeltas.get('acc-old')).toBe(-7000);
    expect(netDeltas.get('acc-new')).toBe(7000);
  });
});
