import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

export const RATE_LIMIT_METADATA_KEY = 'home_ledger:rate_limit';

export interface RateLimitOptions {
  /** 时间窗口内允许的最大请求数 */
  limit: number;
  /** 时间窗口长度（毫秒） */
  windowMs: number;
  /** 限流维度前缀（默认取路由路径） */
  keyPrefix?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_STORE_SIZE = 2000;

/** 为路由方法或控制器配置基于 IP 的固定窗口限流 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, options);

/**
 * 轻量级零依赖内存限流守卫
 * 优先读取 Cloudflare 透传的 CF-Connecting-IP，并采用惰性清理避免后台定时器导致测试挂起
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) {
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const now = Date.now();
    const clientIp = this.resolveClientIp(req);
    const prefix = options.keyPrefix || `${req.method}:${req.path || 'route'}`;
    const key = `${prefix}:${clientIp}`;

    const existing = this.store.get(key);
    if (!existing || existing.resetAt <= now) {
      this.cleanupExpiredEntries(now);
      this.store.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return true;
    }

    if (existing.count >= options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      throw new HttpException('请求过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    return true;
  }

  private resolveClientIp(req: Request): string {
    const cfIp = req.headers?.['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) {
      return cfIp.trim();
    }
    if (Array.isArray(cfIp) && cfIp[0]?.trim()) {
      return cfIp[0].trim();
    }
    if (Array.isArray(req.ips) && req.ips.length > 0 && req.ips[0]) {
      return req.ips[0];
    }
    if (typeof req.ip === 'string' && req.ip.trim()) {
      return req.ip.trim();
    }
    return 'unknown';
  }

  private cleanupExpiredEntries(now: number): void {
    if (this.store.size <= MAX_STORE_SIZE) {
      return;
    }
    for (const [entryKey, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(entryKey);
      }
    }
  }
}
