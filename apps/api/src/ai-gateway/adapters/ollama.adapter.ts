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
export class OllamaAdapter implements IProviderAdapter {
  readonly name: AiProviderName = 'ollama';
  private readonly logger = new Logger(OllamaAdapter.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly costCalculator: CostCalculatorService,
  ) {}

  async complete(
    request: AiGatewayRequest,
    overrideModel?: string,
  ): Promise<ProviderCompletionResult> {
    const baseUrl = this.configService.get<string>(
      'aiGateway.ollama.baseUrl',
      'http://localhost:11434',
    );
    const defaultModel = this.configService.get<string>(
      'aiGateway.ollama.defaultModel',
      'llama3.1',
    );
    const timeoutMs = this.configService.get<number>('aiGateway.ollama.timeoutMs', 2000);
    const model = overrideModel || request.model || defaultModel;

    const startTime = Date.now();

    // Prepare messages array for /api/chat
    const messages =
      request.messages && request.messages.length > 0
        ? request.messages.map((m) => ({ role: m.role, content: m.content }))
        : [{ role: 'user', content: request.prompt || '' }];

    try {
      this.logger.debug(`Dispatching prompt to Ollama at ${baseUrl} with model ${model}`);
      const response = await axios.post(
        `${baseUrl}/api/chat`,
        {
          model,
          messages,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.7,
            num_predict: request.maxTokens ?? 2048,
          },
        },
        {
          timeout: timeoutMs,
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const latencyMs = Date.now() - startTime;
      const data = response.data;
      const outputText = data.message?.content || '';

      const promptTokens = data.prompt_eval_count || Math.ceil((request.prompt || '').length / 4);
      const completionTokens = data.eval_count || Math.ceil(outputText.length / 4);
      const usage: TokenUsage = {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
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
      const errorMessage = error.response?.data?.error || error.message || 'Ollama request failed';
      this.logger.warn(`Ollama request failed after ${latencyMs}ms: ${errorMessage}`);
      throw new Error(`[Ollama] ${errorMessage}`);
    }
  }

  calculateCost(usage: TokenUsage, model: string): number {
    return this.costCalculator.calculateCost(this.name, model, usage);
  }

  async isHealthy(): Promise<boolean> {
    const baseUrl = this.configService.get<string>(
      'aiGateway.ollama.baseUrl',
      'http://localhost:11434',
    );
    try {
      const res = await axios.get(`${baseUrl}/api/tags`, { timeout: 3000 });
      return res.status === 200;
    } catch {
      return false;
    }
  }
}
