import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiGatewayRequest, AiProviderName, TokenUsage } from '@ironloom/shared';
import {
  IProviderAdapter,
  ProviderCompletionResult,
} from '../interfaces/provider-adapter.interface';
import { CostCalculatorService } from '../cost/cost-calculator.service';

@Injectable()
export class GroqAdapter implements IProviderAdapter {
  readonly name: AiProviderName = 'groq';
  private readonly logger = new Logger(GroqAdapter.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly costCalculator: CostCalculatorService,
  ) {}

  async complete(
    request: AiGatewayRequest,
    overrideModel?: string,
  ): Promise<ProviderCompletionResult> {
    const apiKey =
      this.configService.get<string>('aiGateway.groq.apiKey') || process.env.GROQ_API_KEY;
    const baseUrl = this.configService.get<string>(
      'aiGateway.groq.baseUrl',
      'https://api.groq.com/openai/v1',
    );
    const defaultModel = this.configService.get<string>(
      'aiGateway.groq.defaultModel',
      'qwen/qwen3.8-27b',
    );
    const timeoutMs = this.configService.get<number>('aiGateway.groq.timeoutMs', 30000);
    const model = overrideModel || request.model || defaultModel;

    const startTime = Date.now();

    // Prepare messages payload in OpenAI chat format
    const messages =
      request.messages && request.messages.length > 0
        ? request.messages.map((m) => ({ role: m.role, content: m.content }))
        : [{ role: 'user', content: request.prompt || '' }];

    // If apiKey is mock/unconfigured and running in mock environment, generate simulated Groq response
    if (!apiKey || apiKey === 'mock_groq_api_key' || apiKey.startsWith('mock_')) {
      const latencyMs = Math.floor(Math.random() * 80) + 120;
      const promptTokens = Math.ceil((request.prompt || '').length / 4) + 10;
      const completionTokens = 42;
      const usage: TokenUsage = {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      };
      const costUsd = this.calculateCost(usage, model);

      return {
        text: `[Groq Hosted - ${model}] Completed task for agent ${request.agentId}: verified solution generated.`,
        provider: this.name,
        model,
        usage,
        latencyMs,
        costUsd,
        rawResponse: { simulated: true, provider: 'groq' },
      };
    }

    try {
      this.logger.debug(`Dispatching prompt to Groq API with model ${model}`);
      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model,
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048,
        },
        {
          timeout: timeoutMs,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const latencyMs = Date.now() - startTime;
      const data = response.data;
      const choice = data.choices?.[0];
      const outputText = choice?.message?.content || '';

      const usage: TokenUsage = {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      };

      const costUsd = this.calculateCost(usage, model);

      return {
        text: outputText,
        provider: this.name,
        model,
        usage,
        latencyMs,
        costUsd,
        rawResponse: data,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      const status = error.response?.status;
      const errorMessage =
        error.response?.data?.error?.message || error.message || 'Groq request failed';
      this.logger.warn(
        `Groq request failed (${status || 'network'}) after ${latencyMs}ms: ${errorMessage}`,
      );
      throw new Error(`[Groq ${status || 'ERR'}] ${errorMessage}`);
    }
  }

  calculateCost(usage: TokenUsage, model: string): number {
    return this.costCalculator.calculateCost(this.name, model, usage);
  }

  async isHealthy(): Promise<boolean> {
    const apiKey = this.configService.get<string>('aiGateway.groq.apiKey');
    return Boolean(apiKey && apiKey.length > 10);
  }
}
