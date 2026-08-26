import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiGatewayRequest,
  AiGatewayResponse,
  AiProviderName,
  AiGatewayRequestSchema,
} from '@ironloom/shared';
import { ProviderRegistryService } from './adapters/provider-registry.service';
import { QuotaTrackerService } from './quota/quota-tracker.service';
import { AuditLogRepository } from '../database/repositories/audit-log.repository';
import { ProviderCompletionResult } from './interfaces/provider-adapter.interface';
import { v4 as uuidv4 } from 'uuid';

export interface CompleteOptions {
  agentDefaultProvider?: AiProviderName;
  customFallbackChain?: AiProviderName[];
  skipQuotaCheck?: boolean;
}

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly providerRegistry: ProviderRegistryService,
    private readonly quotaTracker: QuotaTrackerService,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  /**
   * Primary single entry-point for all LLM calls across all agents and services.
   */
  async complete(
    rawRequest: AiGatewayRequest,
    options: CompleteOptions = {},
  ): Promise<AiGatewayResponse> {
    // 1. Validate request with Zod
    const request = AiGatewayRequestSchema.parse(rawRequest);

    const maxRetries = this.configService.get<number>('aiGateway.maxRetries', 2);
    const retryDelayMs = this.configService.get<number>('aiGateway.retryDelayMs', 500);

    // 2. Build provider candidate chain
    const defaultProvider = this.configService.get<string>(
      'aiGateway.defaultProvider',
      'ollama',
    ) as AiProviderName;
    const configuredFallbacks = this.configService.get<string[]>('aiGateway.fallbackProviders', [
      'groq',
    ]) as AiProviderName[];

    const primaryProvider =
      request.preferredProvider || options.agentDefaultProvider || defaultProvider;

    const fallbackProviders =
      request.fallbackProviders ||
      options.customFallbackChain ||
      configuredFallbacks.filter((p) => p !== primaryProvider);

    const providerChain: AiProviderName[] = [primaryProvider, ...fallbackProviders];

    // Remove duplicates while preserving priority
    const uniqueChain = Array.from(new Set(providerChain));

    const totalStartTime = Date.now();
    let totalAttempts = 0;
    const errors: { provider: AiProviderName; attempt: number; error: string }[] = [];

    // 3. Iterate through provider chain
    for (let pIndex = 0; pIndex < uniqueChain.length; pIndex++) {
      const providerName = uniqueChain[pIndex];
      const adapter = this.providerRegistry.get(providerName);

      if (!adapter) {
        this.logger.warn(
          `Provider '${providerName}' is not registered in AI Gateway registry. Skipping.`,
        );
        continue;
      }

      // 4. Rate-Limit / Quota Pre-emptive Awareness Check
      if (!options.skipQuotaCheck) {
        const quota = await this.quotaTracker.checkAvailability(providerName);
        if (!quota.isAvailable) {
          this.logger.warn(
            `[Quota Exhausted] Pre-emptively skipping provider '${providerName}': ${quota.reason}. Routing to next provider in fallback chain.`,
          );
          errors.push({
            provider: providerName,
            attempt: 0,
            error: `Pre-emptively skipped due to quota limits: ${quota.reason}`,
          });
          continue;
        }
      }

      // 5. Attempt execution with retries on current provider
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        totalAttempts++;
        try {
          this.logger.log(
            `Executing completion: Agent=${request.agentId}, Provider=${providerName}, Task=${request.taskType} (Provider Attempt ${attempt}/${maxRetries + 1})`,
          );

          const result: ProviderCompletionResult = await adapter.complete(request);

          // 6. Record successful quota consumption in Redis
          await this.quotaTracker.recordUsage(providerName, result.usage.totalTokens);

          const isFallback = pIndex > 0;
          const status = isFallback ? 'fallback_success' : 'success';
          const totalLatencyMs = Date.now() - totalStartTime;

          // 7. Write completion to Audit Log
          const auditLog = await this.auditLogRepository.create({
            orgId: request.orgId || '00000000-0000-0000-0000-000000000000',
            projectId: request.projectId || null,
            actorType: 'agent',
            actorId: request.agentId,
            action: 'ai_gateway.complete',
            input: {
              prompt: request.prompt ? request.prompt.substring(0, 500) : undefined,
              messagesCount: request.messages?.length,
              taskType: request.taskType,
              preferredProvider: request.preferredProvider,
              model: result.model,
            },
            output: {
              textSnippet: result.text.substring(0, 500),
              usage: result.usage,
              attempts: totalAttempts,
              failovers: pIndex,
            },
            model: result.model,
            provider: result.provider,
            costUsd: result.costUsd,
            latencyMs: totalLatencyMs,
            status: isFallback ? 'fallback' : 'success',
          });

          return {
            id: uuidv4(),
            text: result.text,
            provider: result.provider,
            model: result.model,
            usage: result.usage,
            latencyMs: totalLatencyMs,
            costUsd: result.costUsd,
            status,
            attempts: totalAttempts,
            auditLogId: auditLog.id,
            rawResponse: result.rawResponse,
          };
        } catch (error: any) {
          const errMsg = error.message || 'Unknown provider error';
          this.logger.warn(`Provider ${providerName} attempt ${attempt} failed: ${errMsg}`);
          errors.push({ provider: providerName, attempt, error: errMsg });

          const isUnreachable =
            error.code === 'ECONNREFUSED' ||
            errMsg.includes('ECONNREFUSED') ||
            errMsg.includes('ENOTFOUND');

          if (isUnreachable) {
            this.logger.warn(
              `Provider ${providerName} connection refused. Advancing immediately to fallback.`,
            );
            break;
          }

          if (attempt <= maxRetries) {
            const delay = retryDelayMs * Math.pow(1.5, attempt - 1);
            await new Promise((res) => setTimeout(res, delay));
          }
        }
      }

      this.logger.warn(
        `Provider '${providerName}' exhausted all retry attempts. Failing over to next provider.`,
      );
    }

    // 8. All providers in fallback chain failed -> Log failure and throw
    const totalLatencyMs = Date.now() - totalStartTime;
    const failureSummary = errors
      .map((e) => `[${e.provider} #${e.attempt}]: ${e.error}`)
      .join(' | ');

    await this.auditLogRepository.create({
      orgId: request.orgId || '00000000-0000-0000-0000-000000000000',
      projectId: request.projectId || null,
      actorType: 'agent',
      actorId: request.agentId,
      action: 'ai_gateway.complete',
      input: {
        taskType: request.taskType,
        providerChain: uniqueChain,
      },
      output: {
        errors,
      },
      model: request.model || null,
      provider: uniqueChain.join('->'),
      costUsd: 0,
      latencyMs: totalLatencyMs,
      status: 'failure',
    });

    throw new Error(
      `AI Gateway failed to execute request across provider chain [${uniqueChain.join(', ')}] after ${totalAttempts} total attempts. Errors: ${failureSummary}`,
    );
  }
}
