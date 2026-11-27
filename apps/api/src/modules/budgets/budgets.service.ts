import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BudgetPeriod, CategoryType, TransactionType } from '@prisma/client';
import type { BudgetDTO, BudgetProgressDTO, BudgetSummaryDTO } from '@home-ledger/shared';
import { centsToYuan, yuanToCents } from '@home-ledger/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { FamilyAccessService } from '@/modules/families/family-access.service';
import type { UpsertBudgetDto } from './dto/budget.dto';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
  ) {}

  async getMonthlySummary(
    familyId: string,
    userId: string,
    year: number,
    month: number,
  ): Promise<BudgetSummaryDTO> {
    await this.access.assertMember(familyId, userId);

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    const [budgets, expenses] = await Promise.all([
      this.prisma.budget.findMany({
        where: { familyId, period: BudgetPeriod.MONTHLY, year, month },
        include: { category: { select: { id: true, name: true, color: true } } },
        orderBy: [{ categoryId: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.transaction.findMany({
        where: {
          familyId,
          type: TransactionType.EXPENSE,
          occurredAt: { gte: start, lt: end },
        },
        select: { categoryId: true, amount: true },
      }),
    ]);

    let totalSpentCents = 0;
    const spentByCategory = new Map<string, number>();

    for (const exp of expenses) {
      const cents = yuanToCents(exp.amount.toFixed(2));
      totalSpentCents += cents;
      if (exp.categoryId) {
        spentByCategory.set(exp.categoryId, (spentByCategory.get(exp.categoryId) ?? 0) + cents);
      }
    }

    let totalBudget: BudgetProgressDTO | null = null;
    const categoryBudgets: BudgetProgressDTO[] = [];

    for (const b of budgets) {
      const dto: BudgetDTO = {
        id: b.id,
        familyId: b.familyId,
        categoryId: b.categoryId,
        period: b.period,
        year: b.year,
        month: b.month,
        amount: b.amount.toFixed(2),
        category: b.category,
      };

      if (!b.categoryId) {
        totalBudget = this.buildProgress(dto, totalSpentCents);
      } else {
        const spent = spentByCategory.get(b.categoryId) ?? 0;
        categoryBudgets.push(this.buildProgress(dto, spent));
      }
    }

    return {
      year,
      month,
      totalBudget,
      categoryBudgets,
      totalSpent: centsToYuan(totalSpentCents),
    };
  }

  async upsert(familyId: string, userId: string, dto: UpsertBudgetDto): Promise<BudgetDTO> {
    await this.access.assertCanWrite(familyId, userId);

    if (yuanToCents(dto.amount) <= 0) {
      throw new BadRequestException('预算金额必须大于 0');
    }

    const period = dto.period ?? BudgetPeriod.MONTHLY;
    const month = period === BudgetPeriod.MONTHLY ? (dto.month ?? null) : null;
    if (period === BudgetPeriod.MONTHLY && !month) {
      throw new BadRequestException('月度预算必须指定月份');
    }

    const categoryId = dto.categoryId || null;
    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: categoryId,
          type: CategoryType.EXPENSE,
          OR: [{ isSystem: true }, { familyId }],
        },
        select: { id: true },
      });
      if (!category) {
        throw new BadRequestException('预算分类不存在或不是支出分类');
      }
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.budget.findFirst({
        where: { familyId, categoryId, period, year: dto.year, month },
      });

      if (existing) {
        return tx.budget.update({
          where: { id: existing.id },
          data: { amount: dto.amount },
          include: { category: { select: { id: true, name: true, color: true } } },
        });
      }

      return tx.budget.create({
        data: {
          familyId,
          categoryId,
          period,
          year: dto.year,
          month,
          amount: dto.amount,
        },
        include: { category: { select: { id: true, name: true, color: true } } },
      });
    });

    return {
      id: saved.id,
      familyId: saved.familyId,
      categoryId: saved.categoryId,
      period: saved.period,
      year: saved.year,
      month: saved.month,
      amount: saved.amount.toFixed(2),
      category: saved.category,
    };
  }

  async remove(familyId: string, budgetId: string, userId: string): Promise<{ id: string }> {
    await this.access.assertCanWrite(familyId, userId);

    const existing = await this.prisma.budget.findFirst({ where: { id: budgetId, familyId } });
    if (!existing) {
      throw new NotFoundException('预算配置不存在');
    }

    await this.prisma.budget.delete({ where: { id: budgetId } });
    return { id: budgetId };
  }

  private buildProgress(budget: BudgetDTO, spentCents: number): BudgetProgressDTO {
    const budgetCents = yuanToCents(budget.amount);
    const remainingCents = budgetCents - spentCents;
    const usagePercent = budgetCents > 0 ? Math.round((spentCents / budgetCents) * 1000) / 10 : 0;

    return {
      budget,
      spent: centsToYuan(spentCents),
      remaining: centsToYuan(remainingCents),
      usagePercent,
      isOverBudget: spentCents > budgetCents,
    };
  }
}
