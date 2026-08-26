import { Injectable } from '@nestjs/common';
import { AiProviderName, TokenUsage } from '@ironloom/shared';

interface ModelPricing {
  promptCostPerMillion: number;
  completionCostPerMillion: number;
}

@Injectable()
export class CostCalculatorService {
  // Pricing per 1,000,000 tokens in USD
  private readonly pricingTable: Record<string, ModelPricing> = {
    // Groq published models / free-tier estimates
    'llama-3.3-70b-versatile': { promptCostPerMillion: 0.59, completionCostPerMillion: 0.79 },
    'llama-3.1-70b-versatile': { promptCostPerMillion: 0.59, completionCostPerMillion: 0.79 },
    'llama-3.1-8b-instant': { promptCostPerMillion: 0.05, completionCostPerMillion: 0.08 },
    'llama3-70b-8192': { promptCostPerMillion: 0.59, completionCostPerMillion: 0.79 },
    'llama3-8b-8192': { promptCostPerMillion: 0.05, completionCostPerMillion: 0.08 },
    'mixtral-8x7b-32768': { promptCostPerMillion: 0.24, completionCostPerMillion: 0.24 },
    'gemma2-9b-it': { promptCostPerMillion: 0.2, completionCostPerMillion: 0.2 },
    'qwen-2.5-32b': { promptCostPerMillion: 0.2, completionCostPerMillion: 0.2 },

    // OpenAI models (for reference/future extension)
    'gpt-4o': { promptCostPerMillion: 2.5, completionCostPerMillion: 10.0 },
    'gpt-4o-mini': { promptCostPerMillion: 0.15, completionCostPerMillion: 0.6 },

    // Anthropic models
    'claude-3-5-sonnet': { promptCostPerMillion: 3.0, completionCostPerMillion: 15.0 },
    'claude-3-5-haiku': { promptCostPerMillion: 0.8, completionCostPerMillion: 4.0 },
  };

  calculateCost(provider: AiProviderName, model: string, usage: TokenUsage): number {
    // 1. Ollama is 100% free / local
    if (provider === 'ollama') {
      return 0.0;
    }

    if (provider === 'mock') {
      return 0.0;
    }

    // 2. Lookup model pricing
    const normalizedModel = model.toLowerCase().trim();
    const pricing = this.findPricing(normalizedModel);

    const promptCost = (usage.promptTokens / 1_000_000) * pricing.promptCostPerMillion;
    const completionCost = (usage.completionTokens / 1_000_000) * pricing.completionCostPerMillion;

    const totalCost = promptCost + completionCost;

    // Round to 6 decimal places
    return Math.round(totalCost * 1_000_000) / 1_000_000;
  }

  private findPricing(model: string): ModelPricing {
    if (this.pricingTable[model]) {
      return this.pricingTable[model];
    }

    for (const [key, value] of Object.entries(this.pricingTable)) {
      if (model.includes(key) || key.includes(model)) {
        return value;
      }
    }

    // Default fallback pricing for hosted models (e.g. $0.10/M)
    return {
      promptCostPerMillion: 0.1,
      completionCostPerMillion: 0.1,
    };
  }
}
