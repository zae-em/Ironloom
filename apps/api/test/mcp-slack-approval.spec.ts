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
import { RedisModule } from '../src/redis/redis.module';
import { OrchestrationService } from '../src/orchestration/orchestration.service';
import { McpController } from '../src/mcp/mcp.controller';

jest.setTimeout(120000);

describe('Slack Webhook Interactive Approval Test Suite', () => {
  let module: TestingModule;
  let orchestrationService: OrchestrationService;
  let projectsService: ProjectsService;
  let mcpController: McpController;

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
      ],
    }).compile();

    await module.init();

    orchestrationService = module.get<OrchestrationService>(OrchestrationService);
    projectsService = module.get<ProjectsService>(ProjectsService);
    mcpController = module.get<McpController>(McpController);

    const project = await projectsService.createProject(testOrgId, testUserId, {
      name: 'Slack Approval Test Project',
      description: 'Verifies Slack interactive webhook integration',
    });
    testProjectId = project.id;
  });

  afterAll(async () => {
    await module.close();
  });

  it('should start a workflow, pause at gate, and resolve approval via Slack webhook interaction', async () => {
    // 1. Start Workflow -> Runs BA agent and pauses at gate_business_case
    const initialRun = await orchestrationService.startWorkflow({
      orgId: testOrgId,
      projectId: testProjectId,
      actorUserId: testUserId,
      dto: {
        name: 'Slack Approval Integration Test',
        rawIdea: 'Automated high-frequency trading platform with zero-latency gateway.',
      },
    });

    expect(initialRun.status).toBe('paused_approval');
    expect(initialRun.currentNode).toBe('gate_business_case');
    expect(initialRun.statePayload.activeApprovalRequestId).toBeDefined();

    const approvalRequestId = initialRun.statePayload.activeApprovalRequestId!;

    // 2. Simulate Slack Interactive Button Click Callback
    const slackPayload = {
      action: 'approve',
      workflowRunId: initialRun.id,
      approvalRequestId,
      actorUserId: 'slack_engineer_42',
      notes: 'Approved via Slack #sdlc-approvals channel',
    };

    const webhookResponse = await mcpController.handleSlackInteraction(slackPayload);

    expect(webhookResponse.status).toBe('success');
    expect(webhookResponse.workflowRunId).toBe(initialRun.id);

    // 3. Verify workflow resumed and progressed past gate_business_case to next approval gate
    const updatedRun = await orchestrationService.getWorkflowRun(initialRun.id);
    expect(updatedRun.currentNode).toBe('gate_epics');
    expect(updatedRun.statePayload.epics.length).toBeGreaterThan(0);
    expect(updatedRun.status).toBe('paused_approval');
  });
});
