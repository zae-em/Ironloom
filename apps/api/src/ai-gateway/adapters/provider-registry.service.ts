import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiProviderName } from '@ironloom/shared';
import { IProviderAdapter } from '../interfaces/provider-adapter.interface';
import { OllamaAdapter } from './ollama.adapter';
import { GroqAdapter } from './groq.adapter';
import { MockAdapter } from './mock.adapter';

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private readonly adapters = new Map<AiProviderName, IProviderAdapter>();

  constructor(
    private readonly ollamaAdapter: OllamaAdapter,
    private readonly groqAdapter: GroqAdapter,
    private readonly mockAdapter: MockAdapter,
  ) {}

  onModuleInit() {
    this.register(this.ollamaAdapter);
    this.register(this.groqAdapter);
    this.register(this.mockAdapter);
    this.logger.log(
      `Initialized AI Gateway Provider Registry with [${this.getAvailableProviderNames().join(', ')}]`,
    );
  }

  register(adapter: IProviderAdapter): void {
    this.adapters.set(adapter.name, adapter);
    this.logger.debug(`Registered AI Provider Adapter: ${adapter.name}`);
  }

  get(name: AiProviderName): IProviderAdapter | undefined {
    return this.adapters.get(name);
  }

  has(name: AiProviderName): boolean {
    return this.adapters.has(name);
  }

  getAvailableProviderNames(): AiProviderName[] {
    return Array.from(this.adapters.keys());
  }
}
