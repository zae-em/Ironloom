import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
import { ProviderRegistryService } from './adapters/provider-registry.service';
import { QuotaTrackerService } from './quota/quota-tracker.service';
import { AiGatewayRequest, AiGatewayResponse, AiProviderName } from '@ironloom/shared';
import { SlidingWindowRateLimiterGuard } from '../rate-limiter/sliding-window-rate-limiter.guard';

@Controller('gateway')
@UseGuards(SlidingWindowRateLimiterGuard)
export class AiGatewayController {
  constructor(
    private readonly gatewayService: AiGatewayService,
    private readonly providerRegistry: ProviderRegistryService,
    private readonly quotaTracker: QuotaTrackerService,
  ) {}

  @Post('complete')
  async complete(@Body() body: AiGatewayRequest): Promise<AiGatewayResponse> {
    return this.gatewayService.complete(body);
  }

  @Get('health')
  async getHealth() {
    const providers = this.providerRegistry.getAvailableProviderNames();
    const statuses: Record<string, boolean> = {};

    for (const provider of providers) {
      const adapter = this.providerRegistry.get(provider);
      statuses[provider] = adapter ? await adapter.isHealthy() : false;
    }

    return {
      status: 'ok',
      providers: statuses,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('quotas')
  async getQuotas() {
    const providers: AiProviderName[] = ['ollama', 'groq'];
    const quotas: Record<string, any> = {};

    for (const provider of providers) {
      quotas[provider] = await this.quotaTracker.getQuotaStatus(provider);
    }

    return {
      quotas,
      timestamp: new Date().toISOString(),
    };
  }
}
