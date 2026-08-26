import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SlidingWindowRateLimiterGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const ip = request.ip || request.headers['x-forwarded-for'] || request.socket?.remoteAddress || '127.0.0.1';
    const userId = request.user?.userId;
    const clientIdentifier = userId ? `user:${userId}` : `ip:${ip}`;
    const route = request.route?.path || request.url;

    const key = `ratelimit:${clientIdentifier}:${route}`;
    const windowSeconds = this.configService.get<number>('rateLimit.ttl', 60);
    const limit = this.configService.get<number>('rateLimit.max', 100);

    const { count, resetMs } = await this.redisService.incrementSlidingWindow(key, windowSeconds);

    const remaining = Math.max(0, limit - count);

    if (response && response.setHeader) {
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader('X-RateLimit-Remaining', remaining.toString());
      response.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + resetMs / 1000).toString());
    }

    if (count > limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please retry later.',
          retryAfterMs: resetMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
