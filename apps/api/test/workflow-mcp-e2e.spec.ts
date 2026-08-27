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
import { AuditLogRepository } from '../src/database/repositories/audit-log.repository';

jest.setTimeout(240000);

describe('Workflow & MCP E2E Integration Test Suite', () => {
  let module: TestingModule;
  let orchestrationService: OrchestrationService;
  let projectsService: ProjectsService;
  let auditRepo: AuditLogRepository;

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
    auditRepo = module.get<AuditLogRepository>(AuditLogRepository);

    const project = await projectsService.createProject(testOrgId, testUserId, {
      name: 'MCP E2E Test Project',
      description: 'Verifies full SDLC workflow with MCP sync node and audit logging',
    });
    testProjectId = project.id;
  });

  afterAll(async () => {
    await module.close();
  });

  it('should run full cross-agent workflow, execute mcp_sync_node, and log external actions', async () => {
    // 1. Start Workflow -> Runs BA Agent, pauses at gate_business_case
    let run = await orchestrationService.startWorkflow({
      orgId: testOrgId,
      projectId: testProjectId,
      actorUserId: testUserId,
      dto: {
        name: 'MCP Integrated Cloud Native Swarm Run',
        rawIdea: 'Automated satellite telemetry data ingestion platform with real-time alerting.',
      },
    });

    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_business_case');

    // 2. Approve Gate 1: Business Case -> Runs PM Agent, pauses at gate_epics
    let res = await orchestrationService.decideApproval({
      approvalId: run.statePayload.activeApprovalRequestId!,
      dto: { decision: 'approved', notes: 'Approved Business Case' },
      actorUserId: testUserId,
    });
    run = res.workflowRun;
    expect(run.currentNode).toBe('gate_epics');
    expect(run.statePayload.epics.length).toBeGreaterThan(0);

    // 3. Approve Gate 2: Epics -> Runs Requirements Agent, pauses at gate_requirements
    res = await orchestrationService.decideApproval({
      approvalId: run.statePayload.activeApprovalRequestId!,
      dto: { decision: 'approved', notes: 'Approved Epics' },
      actorUserId: testUserId,
    });
    run = res.workflowRun;
    expect(run.currentNode).toBe('gate_requirements');
    expect(run.statePayload.userStories.length).toBeGreaterThan(0);

    // 4. Approve Gate 3: Requirements -> Runs Architect Agent, pauses at gate_architecture
    res = await orchestrationService.decideApproval({
      approvalId: run.statePayload.activeApprovalRequestId!,
      dto: { decision: 'approved', notes: 'Approved User Stories & Gherkin Scenarios' },
      actorUserId: testUserId,
    });
    run = res.workflowRun;
    expect(run.currentNode).toBe('gate_architecture');
    expect(run.statePayload.architectureProposal).toBeDefined();

    // 5. Approve Gate 4: Architecture -> Automatically executes mcp_sync_node -> dev_node -> code_review_node -> qa_node -> pauses at gate_pr_human_review!
    res = await orchestrationService.decideApproval({
      approvalId: run.statePayload.activeApprovalRequestId!,
      dto: {
        decision: 'approved',
        notes: 'Final Architecture Approved. Trigger external MCP sync & autonomous dev.',
      },
      actorUserId: testUserId,
    });
    run = res.workflowRun;

    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_pr_human_review');
    expect(run.statePayload.pullRequests.length).toBeGreaterThan(0);

    // 6. Approve Final Human PR Review Gate -> Marks completed
    res = await orchestrationService.decideApproval({
      approvalId: run.statePayload.activeApprovalRequestId!,
      dto: {
        decision: 'approved',
        notes: 'Human verified green CI and approved merge.',
      },
      actorUserId: testUserId,
    });
    run = res.workflowRun;

    // Workflow must have progressed through full pipeline and reached completion!
    expect(run.status).toBe('completed');
    expect(run.currentNode).toBe('completed');

    // Assert MCP tool calls were executed and recorded in workflow state payload
    expect(run.statePayload.mcpToolCalls).toBeDefined();
    expect(run.statePayload.mcpToolCalls.length).toBeGreaterThanOrEqual(3);

    const toolNames = run.statePayload.mcpToolCalls.map((t) => t.toolName);
    expect(toolNames).toContain('github_create_issue');
    expect(toolNames).toContain('jira_create_epic');
    expect(toolNames).toContain('slack_post_notification');

    // Verify audit logs recorded MCP executions
    const memoryLogs = auditRepo.getMemoryLogs();
    const mcpAuditLogs = memoryLogs.filter((l) => l.action.startsWith('mcp.'));
    expect(mcpAuditLogs.length).toBeGreaterThanOrEqual(3);
  });
});
