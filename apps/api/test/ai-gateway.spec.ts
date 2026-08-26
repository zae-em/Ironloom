import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AiGatewayService } from '../src/ai-gateway/ai-gateway.service';
import { ProviderRegistryService } from '../src/ai-gateway/adapters/provider-registry.service';
import { QuotaTrackerService } from '../src/ai-gateway/quota/quota-tracker.service';
import { AuditLogRepository } from '../src/database/repositories/audit-log.repository';
import { MockAdapter } from '../src/ai-gateway/adapters/mock.adapter';
import { OllamaAdapter } from '../src/ai-gateway/adapters/ollama.adapter';
import { GroqAdapter } from '../src/ai-gateway/adapters/groq.adapter';
import { CostCalculatorService } from '../src/ai-gateway/cost/cost-calculator.service';
import { RedisService } from '../src/redis/redis.service';
import { SupabaseService } from '../src/database/supabase.service';

describe('AiGatewayService Unit Tests', () => {
  let gatewayService: AiGatewayService;
  let mockAdapter: MockAdapter;
  let quotaTracker: QuotaTrackerService;
  let auditRepo: AuditLogRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              aiGateway: {
                defaultProvider: 'mock',
                fallbackProviders: ['groq'],
                maxRetries: 1,
                retryDelayMs: 10,
                ollama: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3.1', timeoutMs: 1000 },
                groq: { apiKey: 'mock_key', baseUrl: 'https://api.groq.com', defaultModel: 'llama-3.3-70b-versatile', timeoutMs: 1000 },
              },
            }),
          ],
        }),
      ],
      providers: [
        AiGatewayService,
        ProviderRegistryService,
        CostCalculatorService,
        QuotaTrackerService,
        RedisService,
        AuditLogRepository,
        SupabaseService,
        MockAdapter,
        OllamaAdapter,
        GroqAdapter,
      ],
    }).compile();

    await module.init();

    gatewayService = module.get<AiGatewayService>(AiGatewayService);
    mockAdapter = module.get<MockAdapter>(MockAdapter);
    quotaTracker = module.get<QuotaTrackerService>(QuotaTrackerService);
    auditRepo = module.get<AuditLogRepository>(AuditLogRepository);
  });

  it('should successfully route request to preferred provider', async () => {
    const response = await gatewayService.complete({
      agentId: 'test_agent',
      taskType: 'unit_test',
      prompt: 'Hello AI Gateway',
      preferredProvider: 'mock',
    });

    expect(response).toBeDefined();
    expect(response.provider).toBe('mock');
    expect(response.status).toBe('success');
    expect(response.attempts).toBe(1);
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  });

  it('should automatically failover to secondary provider when primary fails', async () => {
    // Primary mock adapter fails
    mockAdapter.setShouldFail(true, 'Primary connection timeout');

    const response = await gatewayService.complete({
      agentId: 'failover_agent',
      taskType: 'failover_test',
      prompt: 'Test failover mechanism',
      preferredProvider: 'mock',
      fallbackProviders: ['groq'],
    });

    expect(response).toBeDefined();
    expect(response.provider).toBe('groq');
    expect(response.status).toBe('fallback_success');
    expect(response.attempts).toBeGreaterThanOrEqual(2);

    mockAdapter.setShouldFail(false);
  });

  it('should pre-emptively route away from a provider whose quota is exhausted', async () => {
    // Simulate groq quota exhaustion
    jest.spyOn(quotaTracker, 'checkAvailability').mockImplementation(async (provider) => {
      if (provider === 'mock') {
        return { isAvailable: false, remainingRPM: 0, remainingTPM: 0, reason: 'RPM quota reached' };
      }
      return { isAvailable: true, remainingRPM: 30, remainingTPM: 6000 };
    });

    const response = await gatewayService.complete({
      agentId: 'quota_agent',
      taskType: 'quota_test',
      prompt: 'Check quota pre-emptive routing',
      preferredProvider: 'mock',
      fallbackProviders: ['groq'],
    });

    expect(response.provider).toBe('groq');
    expect(response.status).toBe('fallback_success');
  });

  it('should throw an informative error when all providers fail', async () => {
    mockAdapter.setShouldFail(true, 'Fatal mock error');

    // Force groq to fail by passing invalid fallback
    await expect(
      gatewayService.complete({
        agentId: 'error_agent',
        taskType: 'error_test',
        prompt: 'Trigger full exhaustion',
        preferredProvider: 'mock',
        fallbackProviders: [],
      }),
    ).rejects.toThrow(/AI Gateway failed to execute request/);

    mockAdapter.setShouldFail(false);
  });
});
