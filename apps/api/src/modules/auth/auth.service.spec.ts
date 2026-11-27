import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AppEnv } from '@/config/env.validation';
import type { PrismaService } from '@/prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  function createService(allowRegistration: boolean) {
    const prisma = {
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    const jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    } as unknown as JwtService;

    const configService = {
      get: jest.fn((key: keyof AppEnv) => {
        if (key === 'ALLOW_REGISTRATION') return allowRegistration;
        return undefined;
      }),
    } as unknown as ConfigService<AppEnv, true>;

    return {
      service: new AuthService(prisma, jwtService, configService),
      prisma,
    };
  }

  it('returns allowRegistration flag in public config', () => {
    const { service: openService } = createService(true);
    const { service: closedService } = createService(false);

    expect(openService.getPublicConfig()).toEqual({ allowRegistration: true });
    expect(closedService.getPublicConfig()).toEqual({ allowRegistration: false });
  });

  it('rejects register() with ForbiddenException when registration is disabled', async () => {
    const { service, prisma } = createService(false);

    await expect(
      service.register({
        email: 'newuser@example.com',
        password: 'password123',
        nickname: '测试成员',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
