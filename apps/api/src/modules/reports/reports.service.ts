import { Injectable } from '@nestjs/common';
import { BudgetPeriod, TransactionType } from '@prisma/client';
import type {
  CategoryBreakdownItem,
  MonthlyTrendItem,
  OverviewReportDTO,
} from '@home-ledger/shared';
import { centsToYuan, yuanToCents } from '@home-ledger/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { FamilyAccessService } from '@/modules/families/family-access.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
  ) {}

  async getOverview(
    familyId: string,
    userId: string,
    year: number,
    month: number,
  ): Promise<OverviewReportDTO> {
    await this.access.assertMember(familyId, userId);

    // 6-month trend window ending at (year, month)
    const months: Array<{ year: number; month: number; key: string; label: string }> = [];
    for (let offset = 5; offset >= 0; offset--) {
      const d = new Date(Date.UTC(year, month - 1 - offset, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      months.push({
        year: y,
        month: m,
        key: `${y}-${String(m).padStart(2, '0')}`,
        label: `${m}月`,
      });
    }

    const windowStart = new Date(Date.UTC(months[0]!.year, months[0]!.month - 1, 1, 0, 0, 0));
    const windowEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const currentMonthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));

    const [accounts, transactions, totalBudget] = await Promise.all([
      this.prisma.account.findMany({
        where: { familyId, isArchived: false, includeInNetWorth: true },
        select: { balance: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          familyId,
          type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
          occurredAt: { gte: windowStart, lt: windowEnd },
        },
        select: {
          type: true,
          amount: true,
          occurredAt: true,
          categoryId: true,
          category: { select: { name: true, color: true } },
        },
      }),
      this.prisma.budget.findFirst({
        where: {
          familyId,
          categoryId: null,
          period: BudgetPeriod.MONTHLY,
          year,
          month,
        },
        select: { amount: true },
      }),
    ]);

    let totalAssetsCents = 0;
    let totalLiabilitiesCents = 0;
    for (const acc of accounts) {
      const cents = yuanToCents(acc.balance.toFixed(2));
      if (cents >= 0) {
        totalAssetsCents += cents;
      } else {
        totalLiabilitiesCents += Math.abs(cents);
      }
    }

    const trendMap = new Map<string, { income: number; expense: number }>();
    for (const m of months) {
      trendMap.set(m.key, { income: 0, expense: 0 });
    }

    let monthIncomeCents = 0;
    let monthExpenseCents = 0;
    const categoryTotals = new Map<
      string,
      { categoryId: string | null; categoryName: string; color: string; cents: number }
    >();

    for (const tx of transactions) {
      const cents = yuanToCents(tx.amount.toFixed(2));
      const key = `${tx.occurredAt.getUTCFullYear()}-${String(tx.occurredAt.getUTCMonth() + 1).padStart(2, '0')}`;
      const bucket = trendMap.get(key);
      if (bucket) {
        if (tx.type === TransactionType.INCOME) {
          bucket.income += cents;
        } else if (tx.type === TransactionType.EXPENSE) {
          bucket.expense += cents;
        }
      }

      if (tx.occurredAt >= currentMonthStart && tx.occurredAt < windowEnd) {
        if (tx.type === TransactionType.INCOME) {
          monthIncomeCents += cents;
        } else if (tx.type === TransactionType.EXPENSE) {
          monthExpenseCents += cents;
          const catKey = tx.categoryId ?? 'uncategorized';
          const existing = categoryTotals.get(catKey);
          if (existing) {
            existing.cents += cents;
          } else {
            categoryTotals.set(catKey, {
              categoryId: tx.categoryId,
              categoryName: tx.category?.name ?? '未分类',
              color: tx.category?.color ?? '#94a3b8',
              cents,
            });
          }
        }
      }
    }

    const expenseByCategory: CategoryBreakdownItem[] = Array.from(categoryTotals.values())
      .sort((a, b) => b.cents - a.cents)
      .map((item) => ({
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        color: item.color,
        amount: centsToYuan(item.cents),
        percent:
          monthExpenseCents > 0 ? Math.round((item.cents / monthExpenseCents) * 1000) / 10 : 0,
      }));

    const monthlyTrend: MonthlyTrendItem[] = months.map((m) => {
      const stats = trendMap.get(m.key) ?? { income: 0, expense: 0 };
      return {
        year: m.year,
        month: m.month,
        label: m.label,
        income: centsToYuan(stats.income),
        expense: centsToYuan(stats.expense),
        balance: centsToYuan(stats.income - stats.expense),
      };
    });

    const totalBudgetAmount = totalBudget ? totalBudget.amount.toFixed(2) : null;
    const totalBudgetCents = totalBudgetAmount ? yuanToCents(totalBudgetAmount) : null;
    const budgetUsagePercent =
      totalBudgetCents && totalBudgetCents > 0
        ? Math.round((monthExpenseCents / totalBudgetCents) * 1000) / 10
        : null;

    return {
      year,
      month,
      totalAssets: centsToYuan(totalAssetsCents),
      totalLiabilities: centsToYuan(totalLiabilitiesCents),
      netWorth: centsToYuan(totalAssetsCents - totalLiabilitiesCents),
      monthIncome: centsToYuan(monthIncomeCents),
      monthExpense: centsToYuan(monthExpenseCents),
      monthBalance: centsToYuan(monthIncomeCents - monthExpenseCents),
      totalBudgetAmount,
      budgetUsagePercent,
      expenseByCategory,
      monthlyTrend,
    };
  }
}
