import { Module } from '@nestjs/common';
import { SlidingWindowRateLimiterGuard } from './sliding-window-rate-limiter.guard';

@Module({
  providers: [SlidingWindowRateLimiterGuard],
  exports: [SlidingWindowRateLimiterGuard],
})
export class RateLimiterModule {}
