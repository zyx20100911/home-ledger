import { Injectable } from '@nestjs/common';
import type { HealthCheckResponse } from '@home-ledger/shared';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResponse> {
    const dbHealthy = await this.prisma.isHealthy();

    return {
      status: dbHealthy ? 'ok' : 'degraded',
      service: 'home-ledger-api',
      version: process.env.npm_package_version ?? '0.1.0',
      database: dbHealthy ? 'connected' : 'disconnected',
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
