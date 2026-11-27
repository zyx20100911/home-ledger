import { Injectable, NotFoundException } from '@nestjs/common';
import type { Account } from '@prisma/client';
import type {
  AccountDTO,
  AccountSummaryDTO,
  BatchImportAccountsResult,
} from '@home-ledger/shared';
import { ACCOUNT_TYPE_LABELS, centsToYuan, yuanToCents } from '@home-ledger/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { FamilyAccessService } from '@/modules/families/family-access.service';
import type {
  BatchImportAccountsDto,
  CreateAccountDto,
  UpdateAccountDto,
} from './dto/account.dto';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
  ) {}

  async list(
    familyId: string,
    userId: string,
    includeArchived = false,
  ): Promise<AccountSummaryDTO> {
    await this.access.assertMember(familyId, userId);

    const rows = await this.prisma.account.findMany({
      where: {
        familyId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ isArchived: 'asc' }, { createdAt: 'asc' }],
    });

    let totalAssetsCents = 0;
    let totalLiabilitiesCents = 0;

    const accounts: AccountDTO[] = rows.map((row) => {
      const balanceStr = row.balance.toFixed(2);
      if (row.includeInNetWorth && !row.isArchived) {
        const cents = yuanToCents(balanceStr);
        if (cents >= 0) {
          totalAssetsCents += cents;
        } else {
          totalLiabilitiesCents += Math.abs(cents);
        }
      }

      return this.toDto(row);
    });

    return {
      totalAssets: centsToYuan(totalAssetsCents),
      totalLiabilities: centsToYuan(totalLiabilitiesCents),
      netWorth: centsToYuan(totalAssetsCents - totalLiabilitiesCents),
      accounts,
    };
  }

  async exportCsv(
    familyId: string,
    userId: string,
    includeArchived = false,
  ): Promise<{ filename: string; content: string }> {
    const summary = await this.list(familyId, userId, includeArchived);
    const header = [
      '账户名称',
      '账户类型',
      '当前余额',
      '计入净资产',
      '状态',
      '承保/所属机构',
      '保额',
      '续保到期日',
      '备注',
    ];

    const lines = [
      header.join(','),
      ...summary.accounts.map((acc) =>
        [
          acc.name,
          ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type,
          acc.balance,
          acc.includeInNetWorth ? '是' : '否',
          acc.isArchived ? '已归档' : '启用中',
          acc.institution ?? '',
          acc.coverageAmount ?? '',
          acc.renewalDate ? acc.renewalDate.slice(0, 10) : '',
          acc.note ?? '',
        ]
          .map((cell) => this.escapeCsvCell(cell))
          .join(','),
      ),
    ];

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

    return {
      filename: `home-ledger-accounts-${datePart}.csv`,
      content: `\uFEFF${lines.join('\r\n')}`,
    };
  }

  async create(familyId: string, userId: string, dto: CreateAccountDto): Promise<AccountDTO> {
    await this.access.assertCanWrite(familyId, userId);

    const created = await this.prisma.account.create({
      data: {
        familyId,
        name: dto.name.trim(),
        type: dto.type,
        balance: dto.balance ?? '0.00',
        includeInNetWorth: dto.includeInNetWorth ?? true,
        institution: dto.institution?.trim() || null,
        coverageAmount: dto.coverageAmount || null,
        renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null,
        note: dto.note?.trim() || null,
      },
    });

    return this.toDto(created);
  }

  async update(
    familyId: string,
    accountId: string,
    userId: string,
    dto: UpdateAccountDto,
  ): Promise<AccountDTO> {
    await this.access.assertCanWrite(familyId, userId);

    const existing = await this.prisma.account.findFirst({
      where: { id: accountId, familyId },
    });
    if (!existing) {
      throw new NotFoundException('资金账户不存在');
    }

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.balance !== undefined ? { balance: dto.balance } : {}),
        ...(dto.includeInNetWorth !== undefined
          ? { includeInNetWorth: dto.includeInNetWorth }
          : {}),
        ...(dto.institution !== undefined ? { institution: dto.institution?.trim() || null } : {}),
        ...(dto.coverageAmount !== undefined
          ? { coverageAmount: dto.coverageAmount || null }
          : {}),
        ...(dto.renewalDate !== undefined
          ? { renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null }
          : {}),
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
      },
    });

    return this.toDto(updated);
  }

  async batchImport(
    familyId: string,
    userId: string,
    dto: BatchImportAccountsDto,
  ): Promise<BatchImportAccountsResult> {
    await this.access.assertCanWrite(familyId, userId);

    const strategy = dto.duplicateStrategy ?? 'update';
    const existingList = await this.prisma.account.findMany({
      where: { familyId },
    });
    const existingByName = new Map<string, Account>(
      existingList.map((a) => [a.name.trim().toLowerCase(), a]),
    );

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const cleanName = item.name.trim();
        const key = cleanName.toLowerCase();
        const matched = existingByName.get(key);

        if (matched) {
          if (strategy === 'skip') {
            skippedCount += 1;
            continue;
          }

          const updated = await tx.account.update({
            where: { id: matched.id },
            data: {
              name: cleanName,
              type: item.type,
              balance: item.balance ?? '0.00',
              includeInNetWorth: item.includeInNetWorth ?? true,
              institution: item.institution?.trim() || null,
              coverageAmount: item.coverageAmount || null,
              renewalDate: item.renewalDate ? new Date(item.renewalDate) : null,
              note: item.note?.trim() || null,
            },
          });
          existingByName.set(key, updated);
          updatedCount += 1;
          continue;
        }

        const created = await tx.account.create({
          data: {
            familyId,
            name: cleanName,
            type: item.type,
            balance: item.balance ?? '0.00',
            includeInNetWorth: item.includeInNetWorth ?? true,
            institution: item.institution?.trim() || null,
            coverageAmount: item.coverageAmount || null,
            renewalDate: item.renewalDate ? new Date(item.renewalDate) : null,
            note: item.note?.trim() || null,
          },
        });
        existingByName.set(key, created);
        createdCount += 1;
      }
    });

    return {
      createdCount,
      updatedCount,
      skippedCount,
    };
  }

  private escapeCsvCell(value: string): string {
    if (/[",\r\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private toDto(row: Account): AccountDTO {
    return {
      id: row.id,
      familyId: row.familyId,
      name: row.name,
      type: row.type,
      currency: row.currency,
      balance: row.balance.toFixed(2),
      includeInNetWorth: row.includeInNetWorth,
      institution: row.institution,
      coverageAmount: row.coverageAmount ? row.coverageAmount.toFixed(2) : null,
      renewalDate: row.renewalDate ? row.renewalDate.toISOString() : null,
      icon: row.icon,
      note: row.note,
      isArchived: row.isArchived,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
