/** 家庭成员角色 */
export const FamilyRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;
export type FamilyRole = (typeof FamilyRole)[keyof typeof FamilyRole];

export const FAMILY_ROLE_LABELS: Record<FamilyRole, string> = {
  OWNER: '户主',
  ADMIN: '管理员',
  MEMBER: '成员',
  VIEWER: '只读成员',
};

/** 资金账户类型 */
export const AccountType = {
  CASH: 'CASH',
  BANK_CARD: 'BANK_CARD',
  ALIPAY: 'ALIPAY',
  WECHAT: 'WECHAT',
  CREDIT_CARD: 'CREDIT_CARD',
  INVESTMENT: 'INVESTMENT',
  DEBT: 'DEBT',
  OTHER: 'OTHER',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: '现金',
  BANK_CARD: '储蓄卡',
  ALIPAY: '支付宝',
  WECHAT: '微信零钱',
  CREDIT_CARD: '信用卡',
  INVESTMENT: '理财/投资',
  DEBT: '借贷/负债',
  OTHER: '其他账户',
};

/** 交易类型 */
export const TransactionType = {
  EXPENSE: 'EXPENSE',
  INCOME: 'INCOME',
  TRANSFER: 'TRANSFER',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: '支出',
  INCOME: '收入',
  TRANSFER: '转账',
};

/** 分类类型 */
export const CategoryType = {
  EXPENSE: 'EXPENSE',
  INCOME: 'INCOME',
} as const;
export type CategoryType = (typeof CategoryType)[keyof typeof CategoryType];

/** 预算周期 */
export const BudgetPeriod = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;
export type BudgetPeriod = (typeof BudgetPeriod)[keyof typeof BudgetPeriod];
