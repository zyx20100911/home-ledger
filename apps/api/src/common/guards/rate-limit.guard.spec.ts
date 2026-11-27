import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_METADATA_KEY, RateLimitGuard, type RateLimitOptions } from './rate-limit.guard';

function createMockContext(
  ip: string,
  headers: Record<string, string | string[]> = {},
): {
  context: ExecutionContext;
  setHeader: jest.Mock;
} {
  const setHeader = jest.fn();
  const req = {
    ip,
    ips: [],
    method: 'POST',
    path: '/api/v1/auth/login',
    headers,
  };
  const res = {
    setHeader,
  };
  const handler = () => {};
  class DummyController {}

  const context = {
    getHandler: () => handler,
    getClass: () => DummyController,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;

  return { context, setHeader };
}

describe('RateLimitGuard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows requests when no rate limit metadata is set', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RateLimitGuard(reflector);
    const { context } = createMockContext('127.0.0.1');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks requests exceeding the limit and sets Retry-After', () => {
    const options: RateLimitOptions = { limit: 2, windowMs: 60_000, keyPrefix: 'login' };
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === RATE_LIMIT_METADATA_KEY ? options : undefined,
      ),
    } as unknown as Reflector;
    const guard = new RateLimitGuard(reflector);

    const req1 = createMockContext('10.0.0.1');
    const req2 = createMockContext('10.0.0.1');
    const req3 = createMockContext('10.0.0.1');

    expect(guard.canActivate(req1.context)).toBe(true);
    expect(guard.canActivate(req2.context)).toBe(true);

    try {
      guard.canActivate(req3.context);
      fail('Expected RateLimitGuard to throw 429');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    expect(req3.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('tracks different IPs separately and prefers cf-connecting-ip', () => {
    const options: RateLimitOptions = { limit: 1, windowMs: 60_000, keyPrefix: 'login' };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(options),
    } as unknown as Reflector;
    const guard = new RateLimitGuard(reflector);

    const userA = createMockContext('172.18.0.5', { 'cf-connecting-ip': '203.0.113.10' });
    const userB = createMockContext('172.18.0.5', { 'cf-connecting-ip': '203.0.113.11' });
    const userAAgain = createMockContext('172.18.0.5', { 'cf-connecting-ip': '203.0.113.10' });

    expect(guard.canActivate(userA.context)).toBe(true);
    expect(guard.canActivate(userB.context)).toBe(true);
    expect(() => guard.canActivate(userAAgain.context)).toThrow(HttpException);
  });
});
