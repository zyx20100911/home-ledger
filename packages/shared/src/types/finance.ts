import type {
  AccountType,
  BudgetPeriod,
  CategoryType,
  FamilyRole,
  TransactionType,
} from '../enums/finance';

export interface UserDTO {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface FamilyDTO {
  id: string;
  name: string;
  currency: string;
  description?: string | null;
  role: FamilyRole;
  createdAt: string;
}

export interface AuthResponseDTO {
  accessToken: string;
  user: UserDTO;
  families: FamilyDTO[];
}

export interface FamilyMemberDTO {
  id: string;
  userId: string;
  email: string;
  nickname: string;
  role: FamilyRole;
  joinedAt: string;
}

export interface FamilyInviteDTO {
  id: string;
  familyId: string;
  code: string;
  role: FamilyRole;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
}

export interface AccountDTO {
  id: string;
  familyId: string;
  name: string;
  type: AccountType;
  currency: string;
  /** 精确金额字符串，例如 "1280.50"（信用卡/负债欠款可为负数，例如 "-520.00"） */
  balance: string;
  includeInNetWorth: boolean;
  icon?: string | null;
  note?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountSummaryDTO {
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  accounts: AccountDTO[];
}

export interface CategoryDTO {
  id: string;
  familyId?: string | null;
  parentId?: string | null;
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
  sortOrder: number;
  isSystem: boolean;
}

export interface TransactionDTO {
  id: string;
  familyId: string;
  type: TransactionType;
  /** 精确金额字符串，始终为正数，例如 "68.50" */
  amount: string;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  createdById: string;
  occurredAt: string;
  note?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  account?: { id: string; name: string; type: AccountType };
  toAccount?: { id: string; name: string; type: AccountType } | null;
  category?: { id: string; name: string; color?: string | null; icon?: string | null } | null;
  createdBy?: { id: string; nickname: string };
}

export interface BudgetDTO {
  id: string;
  familyId: string;
  categoryId?: string | null;
  period: BudgetPeriod;
  year: number;
  month?: number | null;
  amount: string;
  category?: { id: string; name: string; color?: string | null } | null;
}

export interface BudgetProgressDTO {
  budget: BudgetDTO;
  spent: string;
  remaining: string;
  usagePercent: number;
  isOverBudget: boolean;
}

export interface BudgetSummaryDTO {
  year: number;
  month: number;
  totalBudget: BudgetProgressDTO | null;
  categoryBudgets: BudgetProgressDTO[];
  totalSpent: string;
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string;
  color: string;
  amount: string;
  percent: number;
}

export interface MonthlyTrendItem {
  year: number;
  month: number;
  label: string;
  income: string;
  expense: string;
  balance: string;
}

export interface OverviewReportDTO {
  year: number;
  month: number;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  monthIncome: string;
  monthExpense: string;
  monthBalance: string;
  totalBudgetAmount: string | null;
  budgetUsagePercent: number | null;
  expenseByCategory: CategoryBreakdownItem[];
  monthlyTrend: MonthlyTrendItem[];
}
