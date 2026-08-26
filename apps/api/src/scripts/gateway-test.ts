import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { AuditLogRepository } from '../database/repositories/audit-log.repository';
import { MockAdapter } from '../ai-gateway/adapters/mock.adapter';
import { ProviderRegistryService } from '../ai-gateway/adapters/provider-registry.service';
import { AiGatewayRequest } from '@ironloom/shared';

function printHeader(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function printRow(label: string, value: any) {
  console.log(`  ${label.padEnd(25)}: ${value}`);
}

async function runHarness() {
  console.log('\n🚀 Starting IRONLOOM AI Gateway Multi-Provider & Failover Test Harness\n');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const gatewayService = moduleRef.get<AiGatewayService>(AiGatewayService);
  const auditRepo = moduleRef.get<AuditLogRepository>(AuditLogRepository);
  const providerRegistry = moduleRef.get<ProviderRegistryService>(ProviderRegistryService);
  const mockAdapter = moduleRef.get<MockAdapter>(MockAdapter);

  const testResults: Array<{
    testName: string;
    primaryProvider: string;
    resolvedProvider: string;
    model: string;
    costUsd: number;
    latencyMs: number;
    status: string;
    attempts: number;
    auditLogId?: string;
  }> = [];

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Primary Ollama (Zero-Cost Local Provider)
    // ------------------------------------------------------------------------
    printHeader('TEST 1: Primary Ollama Execution (Local Zero-Cost)');
    const req1: AiGatewayRequest = {
      agentId: 'architect_agent_01',
      taskType: 'architecture_design',
      prompt: 'Design a high-throughput event processing architecture for IoT telemetry.',
      preferredProvider: 'ollama',
      fallbackProviders: ['groq', 'mock'],
      temperature: 0.2,
      maxTokens: 500,
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    };

    try {
      const res1 = await gatewayService.complete(req1);
      printRow('Requested Provider', 'ollama');
      printRow('Resolved Provider', res1.provider);
      printRow('Model', res1.model);
      printRow('Total Tokens', res1.usage.totalTokens);
      printRow('Estimated Cost ($)', `$${res1.costUsd.toFixed(6)} (Ollama = $0.00)`);
      printRow('Execution Latency', `${res1.latencyMs} ms`);
      printRow('Attempts Taken', res1.attempts);
      printRow('Status', res1.status);
      printRow('Audit Log Record ID', res1.auditLogId);

      testResults.push({
        testName: '1. Ollama Primary Test',
        primaryProvider: 'ollama',
        resolvedProvider: res1.provider,
        model: res1.model,
        costUsd: res1.costUsd,
        latencyMs: res1.latencyMs,
        status: res1.status,
        attempts: res1.attempts,
        auditLogId: res1.auditLogId,
      });
    } catch (err: any) {
      console.log(
        `  [Note] Ollama local service not active (${err.message}). Testing via registered mock provider for zero-cost validation.`,
      );
      const res1Mock = await gatewayService.complete({
        ...req1,
        preferredProvider: 'mock',
        fallbackProviders: ['groq'],
      });
      testResults.push({
        testName: '1. Ollama/Local Primary (Mock Fallback)',
        primaryProvider: 'ollama',
        resolvedProvider: res1Mock.provider,
        model: res1Mock.model,
        costUsd: res1Mock.costUsd,
        latencyMs: res1Mock.latencyMs,
        status: res1Mock.status,
        attempts: res1Mock.attempts,
        auditLogId: res1Mock.auditLogId,
      });
    }

    // ------------------------------------------------------------------------
    // TEST 2: Forced Groq Primary (Hosted Provider with Cost Accounting)
    // ------------------------------------------------------------------------
    printHeader('TEST 2: Forced Groq Primary Execution (Hosted Cost Accounting)');
    const req2: AiGatewayRequest = {
      agentId: 'developer_agent_01',
      taskType: 'code_generation',
      prompt: 'Write a TypeScript function to calculate sliding window token rate limits.',
      preferredProvider: 'groq',
      fallbackProviders: ['mock'],
      model: process.env.GROQ_DEFAULT_MODEL || 'qwen/qwen3.8-27b',
      temperature: 0.1,
      maxTokens: 400,
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    };

    const res2 = await gatewayService.complete(req2);
    printRow('Requested Provider', 'groq');
    printRow('Resolved Provider', res2.provider);
    printRow('Model', res2.model);
    printRow('Prompt Tokens', res2.usage.promptTokens);
    printRow('Completion Tokens', res2.usage.completionTokens);
    printRow('Total Tokens', res2.usage.totalTokens);
    printRow('Estimated Cost ($)', `$${res2.costUsd.toFixed(6)}`);
    printRow('Execution Latency', `${res2.latencyMs} ms`);
    printRow('Status', res2.status);
    printRow('Audit Log Record ID', res2.auditLogId);

    // Verify audit log entry was written
    const latestLogs = await auditRepo.findLatest(1);
    const recordedLog = latestLogs[0];
    printRow(
      'Audit Log Confirmed',
      recordedLog ? `Yes (${recordedLog.action}, $${recordedLog.cost_usd})` : 'Pending',
    );

    testResults.push({
      testName: '2. Groq Primary (Cost Tracking)',
      primaryProvider: 'groq',
      resolvedProvider: res2.provider,
      model: res2.model,
      costUsd: res2.costUsd,
      latencyMs: res2.latencyMs,
      status: res2.status,
      attempts: res2.attempts,
      auditLogId: res2.auditLogId,
    });

    // ------------------------------------------------------------------------
    // TEST 3: Simulated Primary Failure -> Automatic Failover to Secondary Provider
    // ------------------------------------------------------------------------
    printHeader('TEST 3: Simulated Primary Failure -> Automatic Failover');

    // Configure mock adapter to fail intentionally as primary
    mockAdapter.setShouldFail(true, 'Simulated 500 Network Gateway Timeout on Primary Adapter');

    const req3: AiGatewayRequest = {
      agentId: 'qa_agent_01',
      taskType: 'test_generation',
      prompt: 'Generate unit tests for multi-tenant Row Level Security policies.',
      preferredProvider: 'mock', // Starts on failing mock primary
      fallbackProviders: ['groq'], // Must failover automatically to groq
      temperature: 0.3,
      orgId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    };

    console.log('  [Simulating Primary Failure]: Mock provider set to fail immediately...');
    const res3 = await gatewayService.complete(req3);

    printRow('Primary Provider', 'mock (Simulated Failure)');
    printRow('Failover Provider', res3.provider);
    printRow('Model', res3.model);
    printRow('Failover Status', res3.status);
    printRow('Total Attempts', res3.attempts);
    printRow('Latency', `${res3.latencyMs} ms`);
    printRow('Audit Log Record ID', res3.auditLogId);

    // Reset mock adapter
    mockAdapter.setShouldFail(false);

    testResults.push({
      testName: '3. Automatic Failover Simulation',
      primaryProvider: 'mock (failed)',
      resolvedProvider: res3.provider,
      model: res3.model,
      costUsd: res3.costUsd,
      latencyMs: res3.latencyMs,
      status: res3.status,
      attempts: res3.attempts,
      auditLogId: res3.auditLogId,
    });

    // ------------------------------------------------------------------------
    // SUMMARY REPORT
    // ------------------------------------------------------------------------
    printHeader('AI GATEWAY TEST HARNESS SUMMARY REPORT');
    console.table(
      testResults.map((r) => ({
        'Test Name': r.testName,
        'Requested Provider': r.primaryProvider,
        'Resolved Provider': r.resolvedProvider,
        Model: r.model,
        'Cost ($)': `$${r.costUsd.toFixed(6)}`,
        'Latency (ms)': r.latencyMs,
        Status: r.status,
        Attempts: r.attempts,
      })),
    );

    console.log('\n✅ All AI Gateway tests and failover simulations completed successfully!\n');
  } catch (error: any) {
    console.error('\n❌ Test Harness encountered an error:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  runHarness();
}
