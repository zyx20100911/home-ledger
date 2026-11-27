import { TransactionType } from '@prisma/client';
import { yuanToCents } from '@home-ledger/shared';

export interface BalanceImpactInput {
  type: TransactionType;
  amount: string;
  accountId: string;
  toAccountId?: string | null;
}

/**
 * 计算单笔交易对各账户的余额变动（单位：分）
 * - EXPENSE: 扣减主账户余额
 * - INCOME: 增加主账户余额
 * - TRANSFER: 扣减转出账户、增加转入账户
 */
export function computeBalanceDeltasCents(input: BalanceImpactInput): Map<string, number> {
  const cents = yuanToCents(input.amount);
  const deltas = new Map<string, number>();

  if (input.type === TransactionType.EXPENSE) {
    deltas.set(input.accountId, -cents);
  } else if (input.type === TransactionType.INCOME) {
    deltas.set(input.accountId, cents);
  } else if (input.type === TransactionType.TRANSFER) {
    deltas.set(input.accountId, -cents);
    if (input.toAccountId) {
      deltas.set(input.toAccountId, (deltas.get(input.toAccountId) ?? 0) + cents);
    }
  }

  return deltas;
}

/** 合并两份余额变动（例如编辑交易时：先回滚旧变动，再应用新变动） */
export function mergeBalanceDeltas(
  base: Map<string, number>,
  addition: Map<string, number>,
  additionSign: 1 | -1 = 1,
): Map<string, number> {
  const merged = new Map<string, number>(base);
  for (const [accountId, delta] of addition.entries()) {
    const next = (merged.get(accountId) ?? 0) + delta * additionSign;
    if (next === 0) {
      merged.delete(accountId);
    } else {
      merged.set(accountId, next);
    }
  }
  return merged;
}
