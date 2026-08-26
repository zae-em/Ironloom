import { Injectable } from '@nestjs/common';
import { AiGatewayRequest, AiProviderName, TokenUsage } from '@ironloom/shared';
import {
  IProviderAdapter,
  ProviderCompletionResult,
} from '../interfaces/provider-adapter.interface';
import { CostCalculatorService } from '../cost/cost-calculator.service';

@Injectable()
export class MockAdapter implements IProviderAdapter {
  readonly name: AiProviderName = 'mock';
  private shouldFail = false;
  private failureError = 'Simulated mock adapter failure';
  private simulatedLatencyMs = 15;

  constructor(private readonly costCalculator: CostCalculatorService) {}

  setShouldFail(shouldFail: boolean, errorMsg = 'Simulated mock adapter failure'): void {
    this.shouldFail = shouldFail;
    this.failureError = errorMsg;
  }

  setSimulatedLatency(ms: number): void {
    this.simulatedLatencyMs = ms;
  }

  async complete(
    request: AiGatewayRequest,
    overrideModel?: string,
  ): Promise<ProviderCompletionResult> {
    if (this.shouldFail) {
      throw new Error(`[MockAdapter] ${this.failureError}`);
    }

    const model = overrideModel || request.model || 'mock-model-v1';
    const promptTokens = Math.ceil((request.prompt || '').length / 4) || 25;
    const completionTokens = 35;
    const usage: TokenUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };

    const costUsd = this.calculateCost(usage, model);

    return {
      text: `[Mock Output] Processed prompt for agent ${request.agentId} on task ${request.taskType}`,
      provider: this.name,
      model,
      usage,
      latencyMs: this.simulatedLatencyMs,
      costUsd,
      rawResponse: { mock: true },
    };
  }

  calculateCost(usage: TokenUsage, model: string): number {
    return this.costCalculator.calculateCost(this.name, model, usage);
  }

  async isHealthy(): Promise<boolean> {
    return !this.shouldFail;
  }
}
