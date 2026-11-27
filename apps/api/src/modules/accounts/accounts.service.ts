import { Injectable, NotFoundException } from '@nestjs/common';
import type { AccountDTO, AccountSummaryDTO } from '@home-ledger/shared';
import { centsToYuan, yuanToCents } from '@home-ledger/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { FamilyAccessService } from '@/modules/families/family-access.service';
import type { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

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

      return {
        id: row.id,
        familyId: row.familyId,
        name: row.name,
        type: row.type,
        currency: row.currency,
        balance: balanceStr,
        includeInNetWorth: row.includeInNetWorth,
        icon: row.icon,
        note: row.note,
        isArchived: row.isArchived,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    return {
      totalAssets: centsToYuan(totalAssetsCents),
      totalLiabilities: centsToYuan(totalLiabilitiesCents),
      netWorth: centsToYuan(totalAssetsCents - totalLiabilitiesCents),
      accounts,
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
        note: dto.note?.trim() || null,
      },
    });

    return {
      id: created.id,
      familyId: created.familyId,
      name: created.name,
      type: created.type,
      currency: created.currency,
      balance: created.balance.toFixed(2),
      includeInNetWorth: created.includeInNetWorth,
      icon: created.icon,
      note: created.note,
      isArchived: created.isArchived,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
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
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
      },
    });

    return {
      id: updated.id,
      familyId: updated.familyId,
      name: updated.name,
      type: updated.type,
      currency: updated.currency,
      balance: updated.balance.toFixed(2),
      includeInNetWorth: updated.includeInNetWorth,
      icon: updated.icon,
      note: updated.note,
      isArchived: updated.isArchived,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
