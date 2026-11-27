import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import type { PaginatedData, TransactionDTO } from '@home-ledger/shared';
import { centsToYuan, yuanToCents } from '@home-ledger/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { FamilyAccessService } from '@/modules/families/family-access.service';
import { computeBalanceDeltasCents, mergeBalanceDeltas } from './balance-delta';
import type {
  CreateTransactionDto,
  QueryTransactionsDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';

const TRANSACTION_INCLUDE = {
  account: { select: { id: true, name: true, type: true } },
  toAccount: { select: { id: true, name: true, type: true } },
  category: { select: { id: true, name: true, color: true, icon: true } },
  createdBy: { select: { id: true, nickname: true } },
} satisfies Prisma.TransactionInclude;

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: typeof TRANSACTION_INCLUDE;
}>;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
  ) {}

  async list(
    familyId: string,
    userId: string,
    query: QueryTransactionsDto,
  ): Promise<PaginatedData<TransactionDTO>> {
    await this.access.assertMember(familyId, userId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.TransactionWhereInput = {
      familyId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.accountId
        ? { OR: [{ accountId: query.accountId }, { toAccountId: query.accountId }] }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            occurredAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.keyword?.trim()
        ? { note: { contains: query.keyword.trim(), mode: 'insensitive' } }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: TRANSACTION_INCLUDE,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((item) => this.toDto(item)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async create(
    familyId: string,
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionDTO> {
    await this.access.assertCanWrite(familyId, userId);

    this.validateTransactionRules({
      type: dto.type,
      amount: dto.amount,
      accountId: dto.accountId,
      toAccountId: dto.toAccountId ?? null,
      categoryId: dto.categoryId ?? null,
    });

    await this.verifyReferences(familyId, {
      type: dto.type,
      accountId: dto.accountId,
      toAccountId: dto.toAccountId ?? null,
      categoryId: dto.categoryId ?? null,
    });

    const deltas = computeBalanceDeltasCents({
      type: dto.type,
      amount: dto.amount,
      accountId: dto.accountId,
      toAccountId: dto.toAccountId ?? null,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const record = await tx.transaction.create({
        data: {
          familyId,
          type: dto.type,
          amount: dto.amount,
          accountId: dto.accountId,
          toAccountId: dto.type === TransactionType.TRANSFER ? (dto.toAccountId ?? null) : null,
          categoryId: dto.type === TransactionType.TRANSFER ? null : (dto.categoryId ?? null),
          createdById: userId,
          occurredAt: new Date(dto.occurredAt),
          note: dto.note?.trim() || null,
          tags: dto.tags ?? [],
        },
        include: TRANSACTION_INCLUDE,
      });

      await this.applyDeltas(tx, deltas);
      return record;
    });

    return this.toDto(created);
  }

  async update(
    familyId: string,
    transactionId: string,
    userId: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionDTO> {
    await this.access.assertCanWrite(familyId, userId);

    const existing = await this.prisma.transaction.findFirst({
      where: { id: transactionId, familyId },
    });
    if (!existing) {
      throw new NotFoundException('交易流水不存在');
    }

    const nextType = dto.type ?? existing.type;
    const nextAmount = dto.amount ?? existing.amount.toFixed(2);
    const nextAccountId = dto.accountId ?? existing.accountId;
    const nextToAccountId =
      nextType === TransactionType.TRANSFER
        ? dto.toAccountId !== undefined
          ? dto.toAccountId
          : existing.toAccountId
        : null;
    const nextCategoryId =
      nextType === TransactionType.TRANSFER
        ? null
        : dto.categoryId !== undefined
          ? dto.categoryId
          : existing.categoryId;

    this.validateTransactionRules({
      type: nextType,
      amount: nextAmount,
      accountId: nextAccountId,
      toAccountId: nextToAccountId,
      categoryId: nextCategoryId,
    });

    await this.verifyReferences(familyId, {
      type: nextType,
      accountId: nextAccountId,
      toAccountId: nextToAccountId,
      categoryId: nextCategoryId,
    });

    const oldDeltas = computeBalanceDeltasCents({
      type: existing.type,
      amount: existing.amount.toFixed(2),
      accountId: existing.accountId,
      toAccountId: existing.toAccountId,
    });
    const newDeltas = computeBalanceDeltasCents({
      type: nextType,
      amount: nextAmount,
      accountId: nextAccountId,
      toAccountId: nextToAccountId,
    });
    const netDeltas = mergeBalanceDeltas(newDeltas, oldDeltas, -1);

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          type: nextType,
          amount: nextAmount,
          accountId: nextAccountId,
          toAccountId: nextToAccountId,
          categoryId: nextCategoryId,
          ...(dto.occurredAt !== undefined ? { occurredAt: new Date(dto.occurredAt) } : {}),
          ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
          ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        },
        include: TRANSACTION_INCLUDE,
      });

      await this.applyDeltas(tx, netDeltas);
      return record;
    });

    return this.toDto(updated);
  }

  async remove(familyId: string, transactionId: string, userId: string): Promise<{ id: string }> {
    await this.access.assertCanWrite(familyId, userId);

    const existing = await this.prisma.transaction.findFirst({
      where: { id: transactionId, familyId },
    });
    if (!existing) {
      throw new NotFoundException('交易流水不存在');
    }

    const oldDeltas = computeBalanceDeltasCents({
      type: existing.type,
      amount: existing.amount.toFixed(2),
      accountId: existing.accountId,
      toAccountId: existing.toAccountId,
    });
    const reverseDeltas = mergeBalanceDeltas(new Map(), oldDeltas, -1);

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id: transactionId } });
      await this.applyDeltas(tx, reverseDeltas);
    });

    return { id: transactionId };
  }

  private validateTransactionRules(input: {
    type: TransactionType;
    amount: string;
    accountId: string;
    toAccountId: string | null;
    categoryId: string | null;
  }): void {
    if (yuanToCents(input.amount) <= 0) {
      throw new BadRequestException('交易金额必须大于 0');
    }

    if (input.type === TransactionType.TRANSFER) {
      if (!input.toAccountId) {
        throw new BadRequestException('转账类型必须指定转入账户');
      }
      if (input.toAccountId === input.accountId) {
        throw new BadRequestException('转出账户与转入账户不能相同');
      }
    } else if (!input.categoryId) {
      throw new BadRequestException('支出或收入交易必须选择分类');
    }
  }

  private async verifyReferences(
    familyId: string,
    input: {
      type: TransactionType;
      accountId: string;
      toAccountId: string | null;
      categoryId: string | null;
    },
  ): Promise<void> {
    const accountIds = [input.accountId, ...(input.toAccountId ? [input.toAccountId] : [])];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds }, familyId },
      select: { id: true },
    });

    if (accounts.length !== new Set(accountIds).size) {
      throw new BadRequestException('所选资金账户不存在或不属于当前家庭');
    }

    if (input.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: input.categoryId,
          OR: [{ isSystem: true }, { familyId }],
        },
        select: { id: true, type: true },
      });

      if (!category) {
        throw new BadRequestException('所选分类不存在或无权使用');
      }
      if (category.type !== input.type) {
        throw new BadRequestException('所选分类与交易类型不匹配');
      }
    }
  }

  private async applyDeltas(
    tx: Prisma.TransactionClient,
    deltas: Map<string, number>,
  ): Promise<void> {
    for (const [accountId, deltaCents] of deltas.entries()) {
      if (deltaCents === 0) continue;
      await tx.account.update({
        where: { id: accountId },
        data: {
          balance: {
            increment: centsToYuan(deltaCents),
          },
        },
      });
    }
  }

  private toDto(record: TransactionWithRelations): TransactionDTO {
    return {
      id: record.id,
      familyId: record.familyId,
      type: record.type,
      amount: record.amount.toFixed(2),
      accountId: record.accountId,
      toAccountId: record.toAccountId,
      categoryId: record.categoryId,
      createdById: record.createdById,
      occurredAt: record.occurredAt.toISOString(),
      note: record.note,
      tags: record.tags,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      account: record.account,
      toAccount: record.toAccount,
      category: record.category,
      createdBy: record.createdBy,
    };
  }
}
