process.env.AI_DEFAULT_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../src/database/database.module';
import { AgentsCoreModule } from '../src/agents/core/agents-core.module';
import { AiGatewayModule } from '../src/ai-gateway/ai-gateway.module';
import { RAGModule } from '../src/rag/rag.module';
import { SandboxModule } from '../src/sandbox/sandbox.module';
import { McpModule } from '../src/mcp/mcp.module';
import { RedisModule } from '../src/redis/redis.module';
import { QaAgent } from '../src/agents/sdlc/qa.agent';
import { UserStory } from '@ironloom/shared';

describe('QA / Testing Agent Unit Tests', () => {
  let module: TestingModule;
  let qaAgent: QaAgent;

  const mockStory: UserStory = {
    id: '11111111-1111-1111-1111-111111111111',
    orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    projectId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    epicId: '22222222-2222-2222-2222-222222222222',
    title: 'Process Payment Transactions with Idempotency',
    asA: 'Merchant',
    iWant: 'To process credit card transactions safely with unique idempotency keys',
    soThat: 'Double charging customers is completely prevented',
    acceptanceCriteria: [
      {
        id: '33333333-3333-3333-3333-333333333331',
        userStoryId: '11111111-1111-1111-1111-111111111111',
        scenarioTitle: 'Idempotency Check',
        givenText: 'A payment charge request with idempotency key',
        whenText: 'The payment processor receives the charge',
        thenText: 'It must verify key uniqueness before executing payment',
      },
    ],
    status: 'in_review',
    createdAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              aiGateway: {
                defaultProvider: 'mock',
                fallbackProviders: [],
                maxRetries: 1,
                retryDelayMs: 10,
              },
              supabase: { url: 'http://localhost:54321', serviceRoleKey: 'test_key' },
            }),
          ],
        }),
        RedisModule,
        DatabaseModule,
        AgentsCoreModule,
        AiGatewayModule,
        RAGModule,
        SandboxModule,
        McpModule,
      ],
      providers: [QaAgent],
    }).compile();

    await module.init();

    qaAgent = module.get<QaAgent>(QaAgent);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should synthesize unit/integration tests, execute in sandbox, and output test run report', async () => {
    const result = await qaAgent.runTestingPipeline({
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      projectId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      prNumber: 101,
      filesChanged: [
        {
          path: 'src/services/payment.service.ts',
          action: 'create',
          content:
            'export class PaymentService { async process(idempKey: string) { return { status: "success" }; } }\n',
        },
      ],
      userStory: mockStory,
    });

    expect(result.output).toBeDefined();
    expect(result.output.generatedTests.length).toBeGreaterThan(0);
    expect(result.output.testRun.prNumber).toBe(101);
    expect(result.output.testRun.status).toBe('passed');
    expect(result.output.testRun.coveragePercent).toBeGreaterThan(50);
    expect(result.output.testRun.sandboxExecutionId).toBeDefined();
  });
});
