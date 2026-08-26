import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AuditLogRepository } from '../src/database/repositories/audit-log.repository';
import { SupabaseService } from '../src/database/supabase.service';
import { CostCalculatorService } from '../src/ai-gateway/cost/cost-calculator.service';

describe('Audit Log & Cost Accounting Unit Tests', () => {
  let auditRepo: AuditLogRepository;
  let costCalculator: CostCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ supabase: { url: 'http://localhost:54321', serviceRoleKey: 'test_key' } })],
        }),
      ],
      providers: [AuditLogRepository, SupabaseService, CostCalculatorService],
    }).compile();

    auditRepo = module.get<AuditLogRepository>(AuditLogRepository);
    costCalculator = module.get<CostCalculatorService>(CostCalculatorService);
    auditRepo.clearMemoryLogs();
  });

  it('should calculate $0.00 cost for local Ollama completions regardless of token count', () => {
    const cost = costCalculator.calculateCost('ollama', 'llama3.1', {
      promptTokens: 1500,
      completionTokens: 2500,
      totalTokens: 4000,
    });
    expect(cost).toBe(0.0);
  });

  it('should accurately calculate cost for Groq models based on published pricing', () => {
    const cost = costCalculator.calculateCost('groq', 'llama-3.3-70b-versatile', {
      promptTokens: 10000, // $0.59 / 1M = $0.0059
      completionTokens: 5000, // $0.79 / 1M = $0.00395
      totalTokens: 15000,
    });

    expect(cost).toBeCloseTo(0.00985, 5);
  });

  it('should create and store audit log events with correct actor and status', async () => {
    const log = await auditRepo.create({
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      projectId: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
      actorType: 'agent',
      actorId: 'architect_agent_01',
      action: 'architecture.generate',
      input: { prompt: 'Design database schema' },
      output: { tables: ['users', 'projects'] },
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      costUsd: 0.00012,
      latencyMs: 340,
      status: 'success',
    });

    expect(log).toBeDefined();
    expect(log.id).toBeDefined();
    expect(log.actor_type).toBe('agent');
    expect(log.actor_id).toBe('architect_agent_01');
    expect(log.cost_usd).toBe(0.00012);
    expect(log.status).toBe('success');

    const retrieved = await auditRepo.findByOrg('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(retrieved.length).toBeGreaterThanOrEqual(1);
    expect(retrieved[0].id).toBe(log.id);
  });
});
