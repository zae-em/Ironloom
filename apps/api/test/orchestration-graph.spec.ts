process.env.AI_DEFAULT_PROVIDER = 'mock';
process.env.GROQ_API_KEY = 'mock_key';

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { OrchestrationService } from '../src/orchestration/orchestration.service';
import { OrchestrationRepository } from '../src/orchestration/orchestration.repository';
import { SdlcGraphEngine } from '../src/orchestration/engine/sdlc-graph.engine';
import { WorkflowDecisionService } from '../src/orchestration/decisions/workflow-decision.service';
import { SdlcService } from '../src/sdlc/sdlc.service';
import { SdlcRepository } from '../src/sdlc/sdlc.repository';
import { ProjectsService } from '../src/projects/projects.service';
import { BusinessAnalystAgent } from '../src/agents/sdlc/business-analyst.agent';
import { ProductManagerAgent } from '../src/agents/sdlc/product-manager.agent';
import { RequirementsEngineerAgent } from '../src/agents/sdlc/requirements-engineer.agent';
import { ArchitectAgent } from '../src/agents/sdlc/architect.agent';
import { ToolRegistry } from '../src/agents/core/tools/tool.registry';
import { PromptTemplateService } from '../src/agents/core/prompts/prompt-template.service';
import { AiGatewayService } from '../src/ai-gateway/ai-gateway.service';
import { RAGService } from '../src/rag/rag.service';
import { EmbeddingService } from '../src/rag/embedding.service';
import { SupabaseService } from '../src/database/supabase.service';
import { AuditLogRepository } from '../src/database/repositories/audit-log.repository';
import { ProviderRegistryService } from '../src/ai-gateway/adapters/provider-registry.service';
import { CostCalculatorService } from '../src/ai-gateway/cost/cost-calculator.service';
import { QuotaTrackerService } from '../src/ai-gateway/quota/quota-tracker.service';
import { RedisService } from '../src/redis/redis.service';
import { MockAdapter } from '../src/ai-gateway/adapters/mock.adapter';
import { OllamaAdapter } from '../src/ai-gateway/adapters/ollama.adapter';
import { GroqAdapter } from '../src/ai-gateway/adapters/groq.adapter';
import { McpModule } from '../src/mcp/mcp.module';

jest.setTimeout(120000);

describe('Orchestration Graph Engine & Rejection Routing Unit Tests', () => {
  let orchestrationService: OrchestrationService;
  let projectsService: ProjectsService;
  let decisionService: WorkflowDecisionService;
  let repo: OrchestrationRepository;

  const ORG_ALPHA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ACTOR_ALICE = '11111111-1111-1111-1111-111111111111';
  let testProjectId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
                ollama: {
                  baseUrl: 'http://localhost:11434',
                  defaultModel: 'llama3.1',
                  timeoutMs: 1000,
                },
                groq: {
                  apiKey: 'mock_key',
                  baseUrl: 'https://api.groq.com',
                  defaultModel: 'llama-3.3-70b-versatile',
                  timeoutMs: 1000,
                },
              },
              supabase: { url: 'http://localhost:54321', serviceRoleKey: 'test_key' },
            }),
          ],
        }),
        McpModule,
      ],
      providers: [
        OrchestrationService,
        OrchestrationRepository,
        SdlcGraphEngine,
        WorkflowDecisionService,
        SdlcService,
        SdlcRepository,
        ProjectsService,
        BusinessAnalystAgent,
        ProductManagerAgent,
        RequirementsEngineerAgent,
        ArchitectAgent,
        ToolRegistry,
        PromptTemplateService,
        AiGatewayService,
        RAGService,
        EmbeddingService,
        SupabaseService,
        AuditLogRepository,
        ProviderRegistryService,
        CostCalculatorService,
        QuotaTrackerService,
        RedisService,
        MockAdapter,
        OllamaAdapter,
        GroqAdapter,
      ],
    }).compile();

    await module.init();

    orchestrationService = module.get<OrchestrationService>(OrchestrationService);
    projectsService = module.get<ProjectsService>(ProjectsService);
    repo = module.get<OrchestrationRepository>(OrchestrationRepository);

    const project = await projectsService.createProject(ORG_ALPHA, ACTOR_ALICE, {
      name: 'Graph Test Project',
      description: 'Orchestration state machine verification',
    });
    testProjectId = project.id;
  });

  it('1. should start workflow, execute BA node automatically, and pause at gate_business_case', async () => {
    const run = await orchestrationService.startWorkflow({
      orgId: ORG_ALPHA,
      projectId: testProjectId,
      actorUserId: ACTOR_ALICE,
      dto: {
        name: 'Collision Avoidance Pipeline',
        rawIdea: 'Build low-latency drone swarm collision avoidance with spatial indexing.',
      },
    });

    expect(run).toBeDefined();
    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_business_case');
    expect(run.statePayload.businessCase).toBeDefined();
    expect(run.statePayload.businessCase?.problemStatement).toBeDefined();
    expect(run.statePayload.activeApprovalRequestId).toBeDefined();

    // Verify approval request was created
    const approvals = await orchestrationService.listApprovalRequests(testProjectId);
    expect(approvals.length).toBeGreaterThan(0);
    const latestApproval = approvals[0];
    expect(latestApproval.status).toBe('pending');
    expect(latestApproval.nodeName).toBe('gate_business_case');
  });

  it('2. should handle REJECTION branch at gate_business_case and loop back to BA node with reviewer notes', async () => {
    const approvals = await orchestrationService.listApprovalRequests(testProjectId);
    const pendingApproval = approvals.find((a) => a.status === 'pending');
    expect(pendingApproval).toBeDefined();

    const reviewerFeedback =
      'Please emphasize battery consumption and hardware weight constraints in the problem statement.';

    const result = await orchestrationService.decideApproval({
      approvalId: pendingApproval!.id,
      dto: {
        decision: 'rejected',
        notes: reviewerFeedback,
      },
      actorUserId: ACTOR_ALICE,
    });

    expect(result.approval.status).toBe('rejected');
    expect(result.approval.notes).toBe(reviewerFeedback);

    // The workflow engine should have looped back to BA node, re-run with reviewer notes, and reached gate_business_case again
    expect(result.workflowRun.status).toBe('paused_approval');
    expect(result.workflowRun.currentNode).toBe('gate_business_case');
    expect(result.workflowRun.statePayload.iterationCount).toBeGreaterThanOrEqual(2);

    // History should reflect the rejection and re-generation
    const historySummaries = result.workflowRun.statePayload.history.map((h) => h.summary);
    expect(historySummaries.some((s) => s?.includes('Human REJECTED'))).toBe(true);
  });

  it('3. should handle APPROVAL branch and advance automatically to PM node, then pause at gate_epics', async () => {
    const approvals = await orchestrationService.listApprovalRequests(testProjectId);
    const pendingApproval = approvals.find((a) => a.status === 'pending');
    expect(pendingApproval).toBeDefined();

    const result = await orchestrationService.decideApproval({
      approvalId: pendingApproval!.id,
      dto: {
        decision: 'approved',
        notes: 'Business case looks comprehensive now. Approved for epic breakdown.',
      },
      actorUserId: ACTOR_ALICE,
    });

    expect(result.approval.status).toBe('approved');

    // Engine should have transitioned: gate_business_case -> pm_node -> gate_epics
    expect(result.workflowRun.status).toBe('paused_approval');
    expect(result.workflowRun.currentNode).toBe('gate_epics');
    expect(result.workflowRun.statePayload.epics.length).toBeGreaterThan(0);

    // Verify approval request for epics is created
    const latestApprovals = await orchestrationService.listApprovalRequests(testProjectId);
    const epicsApproval = latestApprovals.find(
      (a) => a.nodeName === 'gate_epics' && a.status === 'pending',
    );
    expect(epicsApproval).toBeDefined();
  });
});
