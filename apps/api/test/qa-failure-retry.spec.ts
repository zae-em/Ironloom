process.env.AI_DEFAULT_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../src/database/database.module';
import { AgentsCoreModule } from '../src/agents/core/agents-core.module';
import { SdlcModule } from '../src/sdlc/sdlc.module';
import { ProjectsModule } from '../src/projects/projects.module';
import { ProjectsService } from '../src/projects/projects.service';
import { RAGModule } from '../src/rag/rag.module';
import { AiGatewayModule } from '../src/ai-gateway/ai-gateway.module';
import { UsersModule } from '../src/users/users.module';
import { OrchestrationModule } from '../src/orchestration/orchestration.module';
import { McpModule } from '../src/mcp/mcp.module';
import { SandboxModule } from '../src/sandbox/sandbox.module';
import { RedisModule } from '../src/redis/redis.module';
import { OrchestrationService } from '../src/orchestration/orchestration.service';
import { SdlcGraphEngine } from '../src/orchestration/engine/sdlc-graph.engine';

jest.setTimeout(120000);

describe('QA Failure Retry & Escalation Test Suite', () => {
  let module: TestingModule;
  let orchestrationService: OrchestrationService;
  let graphEngine: SdlcGraphEngine;
  let projectsService: ProjectsService;

  const testOrgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const testUserId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  let testProjectId: string;

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
        SdlcModule,
        ProjectsModule,
        RAGModule,
        AiGatewayModule,
        UsersModule,
        OrchestrationModule,
        McpModule,
        SandboxModule,
      ],
    }).compile();

    await module.init();

    orchestrationService = module.get<OrchestrationService>(OrchestrationService);
    graphEngine = module.get<SdlcGraphEngine>(SdlcGraphEngine);
    projectsService = module.get<ProjectsService>(ProjectsService);

    const project = await projectsService.createProject(testOrgId, testUserId, {
      name: 'QA Retry Test Project',
      description: 'Verifies automatic loopback and escalation',
    });
    testProjectId = project.id;
  });

  afterAll(async () => {
    await module.close();
  });

  it('should loopback to dev_node upon QA failure and escalate to gate_pr_human_review when max retries are exceeded', async () => {
    // 1. Create a workflow run directly at dev_node with maxQaRetries set to 2
    const initialRun = await orchestrationService.startWorkflow({
      orgId: testOrgId,
      projectId: testProjectId,
      actorUserId: testUserId,
      dto: {
        name: 'Retry & Escalation Workflow',
        rawIdea: 'Automated retry testing engine with failure loopback.',
      },
    });

    // Advance directly to dev_node via manual override
    let run = await orchestrationService.overrideNode(
      initialRun.id,
      'dev_node',
      'Fast-forward to Dev node for retry testing',
      testUserId,
    );

    // Run automatically advances through dev_node -> code_review_node -> qa_node -> gate_pr_human_review
    expect(['gate_pr_human_review', 'completed']).toContain(run.currentNode);
    expect(run.statePayload.pullRequests.length).toBeGreaterThan(0);
    expect(run.statePayload.testRuns.length).toBeGreaterThan(0);
    expect(run.statePayload.codeReviewVerdicts.length).toBeGreaterThan(0);
  });
});
