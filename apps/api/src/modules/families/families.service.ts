import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, FamilyRole } from '@prisma/client';
import type { FamilyDTO, FamilyInviteDTO, FamilyMemberDTO } from '@home-ledger/shared';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateFamilyDto, CreateInviteDto, JoinFamilyDto } from './dto/family.dto';
import { FamilyAccessService } from './family-access.service';

@Injectable()
export class FamiliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
  ) {}

  async listUserFamilies(userId: string): Promise<FamilyDTO[]> {
    const memberships = await this.prisma.familyMember.findMany({
      where: { userId },
      include: { family: true },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.family.id,
      name: m.family.name,
      currency: m.family.currency,
      description: m.family.description,
      role: m.role,
      createdAt: m.family.createdAt.toISOString(),
    }));
  }

  async createFamily(userId: string, dto: CreateFamilyDto): Promise<FamilyDTO> {
    const family = await this.prisma.family.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        currency: 'CNY',
        members: {
          create: { userId, role: FamilyRole.OWNER },
        },
        accounts: {
          create: [
            { name: '现金', type: AccountType.CASH, balance: '0.00', includeInNetWorth: true },
          ],
        },
      },
    });

    return {
      id: family.id,
      name: family.name,
      currency: family.currency,
      description: family.description,
      role: FamilyRole.OWNER,
      createdAt: family.createdAt.toISOString(),
    };
  }

  async listMembers(familyId: string, userId: string): Promise<FamilyMemberDTO[]> {
    await this.access.assertMember(familyId, userId);

    const members = await this.prisma.familyMember.findMany({
      where: { familyId },
      include: { user: { select: { id: true, email: true, nickname: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      nickname: m.user.nickname,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  async createInvite(
    familyId: string,
    userId: string,
    dto: CreateInviteDto,
  ): Promise<FamilyInviteDTO> {
    await this.access.assertCanManage(familyId, userId);

    const role = dto.role === FamilyRole.OWNER ? FamilyRole.ADMIN : (dto.role ?? FamilyRole.MEMBER);
    const expiresInDays = dto.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const code = randomBytes(4).toString('hex').toUpperCase();

    const invite = await this.prisma.familyInvite.create({
      data: {
        familyId,
        code,
        role,
        createdById: userId,
        expiresAt,
        maxUses: dto.maxUses ?? 5,
      },
    });

    return {
      id: invite.id,
      familyId: invite.familyId,
      code: invite.code,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
    };
  }

  async joinByCode(userId: string, dto: JoinFamilyDto): Promise<FamilyDTO> {
    const code = dto.code.trim().toUpperCase();
    const invite = await this.prisma.familyInvite.findUnique({
      where: { code },
      include: { family: true },
    });

    if (!invite) {
      throw new NotFoundException('邀请码无效，请核对后重试');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('该邀请码已过期');
    }
    if (invite.usedCount >= invite.maxUses) {
      throw new BadRequestException('该邀请码已达到使用上限');
    }

    const existing = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: invite.familyId, userId } },
    });
    if (existing) {
      throw new ConflictException('你已经是该家庭的成员');
    }

    await this.prisma.$transaction([
      this.prisma.familyMember.create({
        data: {
          familyId: invite.familyId,
          userId,
          role: invite.role,
        },
      }),
      this.prisma.familyInvite.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      }),
    ]);

    return {
      id: invite.family.id,
      name: invite.family.name,
      currency: invite.family.currency,
      description: invite.family.description,
      role: invite.role,
      createdAt: invite.family.createdAt.toISOString(),
    };
  }
}
