import {
  AiGatewayRequest,
  AiProviderName,
  TokenUsage,
} from '@ironloom/shared';

export interface ProviderCompletionResult {
  text: string;
  provider: AiProviderName;
  model: string;
  usage: TokenUsage;
  latencyMs: number;
  costUsd: number;
  rawResponse?: any;
}

export interface IProviderAdapter {
  readonly name: AiProviderName;
  complete(request: AiGatewayRequest, overrideModel?: string): Promise<ProviderCompletionResult>;
  calculateCost(usage: TokenUsage, model: string): number;
  isHealthy(): Promise<boolean>;
}
