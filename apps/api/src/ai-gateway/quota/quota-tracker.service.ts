import { Injectable, Logger } from '@nestjs/common';
import { AiProviderName, ProviderQuotaStatus } from '@ironloom/shared';
import { RedisService } from '../../redis/redis.service';

interface ProviderQuotaLimit {
  maxRPM: number; // Max requests per minute
  maxTPM: number; // Max tokens per minute
  safetyMarginRPM: number; // Safety buffer before pre-emptive failover
  safetyMarginTPM: number;
}

@Injectable()
export class QuotaTrackerService {
  private readonly logger = new Logger(QuotaTrackerService.name);

  // Free-tier rate limits
  private readonly providerLimits: Partial<Record<AiProviderName, ProviderQuotaLimit>> = {
    groq: {
      maxRPM: 30,
      maxTPM: 6000,
      safetyMarginRPM: 2, // Pre-emptively route away when within 2 requests of limit
      safetyMarginTPM: 500,
    },
    ollama: {
      maxRPM: 10000, // Effectively unlimited local
      maxTPM: 1000000,
      safetyMarginRPM: 0,
      safetyMarginTPM: 0,
    },
    mock: {
      maxRPM: 10000,
      maxTPM: 1000000,
      safetyMarginRPM: 0,
      safetyMarginTPM: 0,
    },
  };

  constructor(private readonly redisService: RedisService) {}

  async checkAvailability(
    provider: AiProviderName,
    estimatedTokens = 500,
  ): Promise<{
    isAvailable: boolean;
    remainingRPM: number;
    remainingTPM: number;
    reason?: string;
  }> {
    const limits = this.providerLimits[provider];
    if (!limits) {
      return { isAvailable: true, remainingRPM: 999, remainingTPM: 999999 };
    }

    const { rpm, tpm } = await this.redisService.getProviderCurrentUsage(provider);

    const remainingRPM = Math.max(0, limits.maxRPM - rpm);
    const remainingTPM = Math.max(0, limits.maxTPM - tpm);

    if (remainingRPM <= limits.safetyMarginRPM) {
      this.logger.warn(
        `Pre-emptive quota alert: ${provider} RPM exhausted (${rpm}/${limits.maxRPM}). Routing to fallback.`,
      );
      return {
        isAvailable: false,
        remainingRPM,
        remainingTPM,
        reason: `RPM limit approached (${rpm}/${limits.maxRPM})`,
      };
    }

    if (remainingTPM <= limits.safetyMarginTPM || remainingTPM < estimatedTokens) {
      this.logger.warn(
        `Pre-emptive quota alert: ${provider} TPM exhausted (${tpm}/${limits.maxTPM}). Routing to fallback.`,
      );
      return {
        isAvailable: false,
        remainingRPM,
        remainingTPM,
        reason: `TPM limit approached (${tpm}/${limits.maxTPM})`,
      };
    }

    return {
      isAvailable: true,
      remainingRPM,
      remainingTPM,
    };
  }

  async recordUsage(provider: AiProviderName, totalTokens: number): Promise<void> {
    await this.redisService.recordProviderCall(provider, totalTokens);
  }

  async getQuotaStatus(provider: AiProviderName): Promise<ProviderQuotaStatus> {
    const { isAvailable, remainingRPM, remainingTPM } = await this.checkAvailability(provider);
    return {
      provider,
      isAvailable,
      remainingRPM,
      remainingTPM,
      estimatedResetMs: 60000 - (Date.now() % 60000),
    };
  }
}
