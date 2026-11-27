import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountType, FamilyRole } from '@prisma/client';
import type { AuthResponseDTO, FamilyDTO, UserDTO } from '@home-ledger/shared';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import type { LoginDto, RegisterDto } from './dto/auth.dto';
import type { JwtPayload } from './types/auth-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDTO> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('该邮箱已注册，请直接登录');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const familyName = dto.familyName?.trim() || `${dto.nickname.trim()}的家庭`;

    const { user, family } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          nickname: dto.nickname.trim(),
        },
      });

      const createdFamily = await tx.family.create({
        data: {
          name: familyName,
          currency: 'CNY',
          members: {
            create: {
              userId: createdUser.id,
              role: FamilyRole.OWNER,
            },
          },
          accounts: {
            create: [
              {
                name: '现金',
                type: AccountType.CASH,
                balance: '0.00',
                includeInNetWorth: true,
              },
              {
                name: '默认储蓄卡',
                type: AccountType.BANK_CARD,
                balance: '0.00',
                includeInNetWorth: true,
              },
            ],
          },
        },
      });

      return { user: createdUser, family: createdFamily };
    });

    const families: FamilyDTO[] = [
      {
        id: family.id,
        name: family.name,
        currency: family.currency,
        description: family.description,
        role: FamilyRole.OWNER,
        createdAt: family.createdAt.toISOString(),
      },
    ];

    return {
      accessToken: this.signToken(user.id, user.email),
      user: this.toUserDto(user),
      families,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDTO> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { family: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const matched = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matched) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const families: FamilyDTO[] = user.memberships.map((m) => ({
      id: m.family.id,
      name: m.family.name,
      currency: m.family.currency,
      description: m.family.description,
      role: m.role,
      createdAt: m.family.createdAt.toISOString(),
    }));

    return {
      accessToken: this.signToken(user.id, user.email),
      user: this.toUserDto(user),
      families,
    };
  }

  async getProfile(userId: string): Promise<{ user: UserDTO; families: FamilyDTO[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { family: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      user: this.toUserDto(user),
      families: user.memberships.map((m) => ({
        id: m.family.id,
        name: m.family.name,
        currency: m.family.currency,
        description: m.family.description,
        role: m.role,
        createdAt: m.family.createdAt.toISOString(),
      })),
    };
  }

  private signToken(userId: string, email: string): string {
    const payload: JwtPayload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }

  private toUserDto(user: {
    id: string;
    email: string;
    nickname: string;
    avatarUrl: string | null;
    createdAt: Date;
  }): UserDTO {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
