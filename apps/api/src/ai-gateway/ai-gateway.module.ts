import { Module } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
import { AiGatewayController } from './ai-gateway.controller';
import { ProviderRegistryService } from './adapters/provider-registry.service';
import { OllamaAdapter } from './adapters/ollama.adapter';
import { GroqAdapter } from './adapters/groq.adapter';
import { MockAdapter } from './adapters/mock.adapter';
import { CostCalculatorService } from './cost/cost-calculator.service';
import { QuotaTrackerService } from './quota/quota-tracker.service';
import { CostBudgetService } from './cost-budget.service';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [RedisModule, DatabaseModule],
  providers: [
    AiGatewayService,
    ProviderRegistryService,
    OllamaAdapter,
    GroqAdapter,
    MockAdapter,
    CostCalculatorService,
    QuotaTrackerService,
    CostBudgetService,
  ],
  controllers: [AiGatewayController],
  exports: [
    AiGatewayService,
    ProviderRegistryService,
    QuotaTrackerService,
    CostCalculatorService,
    CostBudgetService,
    MockAdapter,
    OllamaAdapter,
    GroqAdapter,
  ],
})
export class AiGatewayModule {}
