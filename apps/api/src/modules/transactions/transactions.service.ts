import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import type {
  BatchDeleteTransactionsResult,
  BatchImportTransactionsResult,
  BatchUpdateTransactionsResult,
  PaginatedData,
  TransactionDTO,
} from '@home-ledger/shared';
import { TRANSACTION_TYPE_LABELS, centsToYuan, yuanToCents } from '@home-ledger/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { FamilyAccessService } from '@/modules/families/family-access.service';
import { computeBalanceDeltasCents, mergeBalanceDeltas } from './balance-delta';
import type {
  BatchDeleteTransactionsDto,
  BatchImportTransactionsDto,
  BatchUpdateTransactionsDto,
  CreateTransactionDto,
  ExportTransactionsDto,
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
    const where = this.buildWhere(familyId, query);

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

  async exportCsv(
    familyId: string,
    userId: string,
    query: ExportTransactionsDto,
  ): Promise<{ filename: string; content: string }> {
    await this.access.assertMember(familyId, userId);

    const ids = query.ids
      ? query.ids
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;

    const where = this.buildWhere(familyId, { ...query, ids });

    const records = await this.prisma.transaction.findMany({
      where,
      include: TRANSACTION_INCLUDE,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 10_000,
    });

    const header = ['时间', '类型', '分类', '资金账户', '转入账户', '金额', '备注', '记账人'];
    const lines = [
      header.join(','),
      ...records.map((record) =>
        [
          this.formatCsvDateTime(record.occurredAt),
          TRANSACTION_TYPE_LABELS[record.type] ?? record.type,
          record.type === TransactionType.TRANSFER ? '' : (record.category?.name ?? ''),
          record.account?.name ?? '',
          record.type === TransactionType.TRANSFER ? (record.toAccount?.name ?? '') : '',
          record.amount.toFixed(2),
          record.note ?? '',
          record.createdBy?.nickname ?? '',
        ]
          .map((cell) => this.escapeCsvCell(cell))
          .join(','),
      ),
    ];

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

    return {
      filename: `home-ledger-transactions-${datePart}.csv`,
      content: `\uFEFF${lines.join('\r\n')}`,
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

  async batchDelete(
    familyId: string,
    userId: string,
    dto: BatchDeleteTransactionsDto,
  ): Promise<BatchDeleteTransactionsResult> {
    await this.access.assertCanWrite(familyId, userId);

    const uniqueIds = [...new Set(dto.ids)];
    const records = await this.prisma.transaction.findMany({
      where: { id: { in: uniqueIds }, familyId },
    });
    if (records.length !== uniqueIds.length) {
      throw new NotFoundException('部分交易流水不存在或不属于当前家庭');
    }

    let reverseDeltas = new Map<string, number>();
    for (const record of records) {
      const oldDelta = computeBalanceDeltasCents({
        type: record.type,
        amount: record.amount.toFixed(2),
        accountId: record.accountId,
        toAccountId: record.toAccountId,
      });
      reverseDeltas = mergeBalanceDeltas(reverseDeltas, oldDelta, -1);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: { id: { in: uniqueIds }, familyId },
      });
      await this.applyDeltas(tx, reverseDeltas);
    });

    return {
      deletedCount: records.length,
      ids: records.map((r) => r.id),
    };
  }

  async batchUpdate(
    familyId: string,
    userId: string,
    dto: BatchUpdateTransactionsDto,
  ): Promise<BatchUpdateTransactionsResult> {
    await this.access.assertCanWrite(familyId, userId);

    if (!dto.categoryId && !dto.accountId) {
      throw new BadRequestException('请至少选择要批量修改的分类或资金账户');
    }

    const uniqueIds = [...new Set(dto.ids)];
    const records = await this.prisma.transaction.findMany({
      where: { id: { in: uniqueIds }, familyId },
    });
    if (records.length !== uniqueIds.length) {
      throw new NotFoundException('部分交易流水不存在或不属于当前家庭');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          OR: [{ isSystem: true }, { familyId }],
        },
        select: { id: true, type: true },
      });
      if (!category) {
        throw new BadRequestException('所选目标分类不存在或无权使用');
      }

      if (records.some((r) => r.type === TransactionType.TRANSFER)) {
        throw new BadRequestException('转账流水不支持修改收支分类，请取消勾选转账记录');
      }
      if (records.some((r) => r.type !== category.type)) {
        throw new BadRequestException('所选流水的类型与目标分类不匹配，支出与收入不能同时改同一分类');
      }
    }

    let netDeltas = new Map<string, number>();
    if (dto.accountId) {
      const targetAccount = await this.prisma.account.findFirst({
        where: { id: dto.accountId, familyId },
        select: { id: true },
      });
      if (!targetAccount) {
        throw new BadRequestException('所选目标资金账户不存在或不属于当前家庭');
      }

      for (const record of records) {
        if (record.type === TransactionType.TRANSFER && record.toAccountId === dto.accountId) {
          throw new BadRequestException('目标资金账户与所选转账流水的转入账户相同');
        }
        const amountStr = record.amount.toFixed(2);
        const oldDelta = computeBalanceDeltasCents({
          type: record.type,
          amount: amountStr,
          accountId: record.accountId,
          toAccountId: record.toAccountId,
        });
        const newDelta = computeBalanceDeltasCents({
          type: record.type,
          amount: amountStr,
          accountId: dto.accountId,
          toAccountId: record.toAccountId,
        });
        netDeltas = mergeBalanceDeltas(netDeltas, newDelta, 1);
        netDeltas = mergeBalanceDeltas(netDeltas, oldDelta, -1);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.updateMany({
        where: { id: { in: uniqueIds }, familyId },
        data: {
          ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
          ...(dto.accountId ? { accountId: dto.accountId } : {}),
        },
      });
      if (netDeltas.size > 0) {
        await this.applyDeltas(tx, netDeltas);
      }
    });

    return {
      updatedCount: records.length,
      ids: records.map((r) => r.id),
    };
  }

  async batchImport(
    familyId: string,
    userId: string,
    dto: BatchImportTransactionsDto,
  ): Promise<BatchImportTransactionsResult> {
    await this.access.assertCanWrite(familyId, userId);

    const accountIds = new Set<string>();
    const categoryIds = new Set<string>();
    for (const item of dto.items) {
      accountIds.add(item.accountId);
      if (item.toAccountId) accountIds.add(item.toAccountId);
      if (item.categoryId) categoryIds.add(item.categoryId);
    }

    const [accounts, categories] = await Promise.all([
      this.prisma.account.findMany({
        where: { id: { in: [...accountIds] }, familyId },
        select: { id: true },
      }),
      categoryIds.size
        ? this.prisma.category.findMany({
            where: {
              id: { in: [...categoryIds] },
              OR: [{ isSystem: true }, { familyId }],
            },
            select: { id: true, type: true },
          })
        : Promise.resolve([]),
    ]);

    const accountIdSet = new Set(accounts.map((a) => a.id));
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    let totalDeltas = new Map<string, number>();
    const rowsToCreate: Prisma.TransactionCreateManyInput[] = [];

    for (let i = 0; i < dto.items.length; i += 1) {
      const item = dto.items[i]!;
      const rowLabel = `第 ${i + 1} 行`;

      try {
        this.validateTransactionRules({
          type: item.type,
          amount: item.amount,
          accountId: item.accountId,
          toAccountId: item.toAccountId ?? null,
          categoryId: item.categoryId ?? null,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '数据校验失败';
        throw new BadRequestException(`${rowLabel}：${msg}`);
      }

      if (!accountIdSet.has(item.accountId)) {
        throw new BadRequestException(`${rowLabel}：所选资金账户不存在或不属于当前家庭`);
      }
      if (item.type === TransactionType.TRANSFER && (!item.toAccountId || !accountIdSet.has(item.toAccountId))) {
        throw new BadRequestException(`${rowLabel}：所选转入账户不存在或不属于当前家庭`);
      }
      if (item.type !== TransactionType.TRANSFER) {
        const cat = item.categoryId ? categoryMap.get(item.categoryId) : undefined;
        if (!cat) {
          throw new BadRequestException(`${rowLabel}：所选分类不存在或无权使用`);
        }
        if (cat.type !== item.type) {
          throw new BadRequestException(`${rowLabel}：所选分类与交易类型不匹配`);
        }
      }

      const itemDelta = computeBalanceDeltasCents({
        type: item.type,
        amount: item.amount,
        accountId: item.accountId,
        toAccountId: item.toAccountId ?? null,
      });
      totalDeltas = mergeBalanceDeltas(totalDeltas, itemDelta, 1);

      rowsToCreate.push({
        familyId,
        type: item.type,
        amount: item.amount,
        accountId: item.accountId,
        toAccountId: item.type === TransactionType.TRANSFER ? (item.toAccountId ?? null) : null,
        categoryId: item.type === TransactionType.TRANSFER ? null : (item.categoryId ?? null),
        createdById: userId,
        occurredAt: new Date(item.occurredAt),
        note: item.note?.trim() || null,
        tags: item.tags ?? [],
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.createMany({ data: rowsToCreate });
      await this.applyDeltas(tx, totalDeltas);
    });

    return { importedCount: rowsToCreate.length };
  }

  private buildWhere(
    familyId: string,
    query: {
      type?: TransactionType;
      categoryId?: string;
      accountId?: string;
      startDate?: string;
      endDate?: string;
      keyword?: string;
      ids?: string[];
    },
  ): Prisma.TransactionWhereInput {
    return {
      familyId,
      ...(query.ids?.length ? { id: { in: query.ids } } : {}),
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
  }

  private formatCsvDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private escapeCsvCell(value: string): string {
    if (/[",\r\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
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
