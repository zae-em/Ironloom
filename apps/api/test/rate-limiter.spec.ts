import { SlidingWindowRateLimiterGuard } from '../src/rate-limiter/sliding-window-rate-limiter.guard';
import { RedisService } from '../src/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, HttpException } from '@nestjs/common';

describe('SlidingWindowRateLimiterGuard Unit Tests', () => {
  let guard: SlidingWindowRateLimiterGuard;
  let redisService: RedisService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: (key: string, defaultVal: any) => {
        if (key === 'rateLimit.ttl') return 60;
        if (key === 'rateLimit.max') return 3; // Limit to 3 requests for testing
        return defaultVal;
      },
    } as any;

    redisService = new RedisService(configService);
    guard = new SlidingWindowRateLimiterGuard(redisService, configService);
  });

  const createMockContext = (ip = '127.0.0.1'): ExecutionContext => {
    const headers: Record<string, string> = {};
    const req = {
      ip,
      headers: {},
      url: '/api/v1/gateway/complete',
      route: { path: '/gateway/complete' },
    };
    const res = {
      setHeader: (name: string, val: string) => {
        headers[name] = val;
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as any;
  };

  it('should allow requests within limit and attach rate limit response headers', async () => {
    const ctx = createMockContext('192.168.1.10');

    const res1 = await guard.canActivate(ctx);
    const res2 = await guard.canActivate(ctx);
    const res3 = await guard.canActivate(ctx);

    expect(res1).toBe(true);
    expect(res2).toBe(true);
    expect(res3).toBe(true);
  });

  it('should block 4th request and throw 429 Too Many Requests', async () => {
    const ctx = createMockContext('192.168.1.20');

    await guard.canActivate(ctx);
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);

    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
  });
});
