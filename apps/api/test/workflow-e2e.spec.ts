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

jest.setTimeout(120000);

describe('Full SDLC End-to-End Orchestrated Pipeline Integration Tests', () => {
  let orchestrationService: OrchestrationService;
  let projectsService: ProjectsService;
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
                ollama: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3.1', timeoutMs: 1000 },
                groq: { apiKey: 'mock_key', baseUrl: 'https://api.groq.com', defaultModel: 'llama-3.3-70b-versatile', timeoutMs: 1000 },
              },
              supabase: { url: 'http://localhost:54321', serviceRoleKey: 'test_key' },
            }),
          ],
        }),
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

    const project = await projectsService.createProject(
      ORG_ALPHA,
      ACTOR_ALICE,
      {
        name: 'E2E SDLC Swarm Project',
        description: 'Verifies entire unattended chain with human approval gates',
      },
    );
    testProjectId = project.id;
  });

  it('should run unattended BA -> PM -> Requirements -> Architect chain with human approval at each gate', async () => {
    // 1. Kick off full workflow with a single API call
    let currentRun = await orchestrationService.startWorkflow({
      orgId: ORG_ALPHA,
      projectId: testProjectId,
      actorUserId: ACTOR_ALICE,
      dto: {
        name: 'Autonomous Swarm Navigation Workflow',
        rawIdea: 'Build a high-reliability drone collision avoidance system that alerts operators in under 100ms.',
      },
    });

    // ------------------------------------------------------------------------
    // Gate 1: Business Case Review
    // ------------------------------------------------------------------------
    expect(currentRun.status).toBe('paused_approval');
    expect(currentRun.currentNode).toBe('gate_business_case');
    expect(currentRun.statePayload.businessCase).toBeDefined();

    let approvals = await orchestrationService.listApprovalRequests(testProjectId);
    let gate1 = approvals.find((a) => a.workflowRunId === currentRun.id && a.status === 'pending');
    expect(gate1).toBeDefined();

    // Human approves Gate 1
    let result = await orchestrationService.decideApproval({
      approvalId: gate1!.id,
      dto: { decision: 'approved', notes: 'Business case approved.' },
      actorUserId: ACTOR_ALICE,
    });
    currentRun = result.workflowRun;

    // ------------------------------------------------------------------------
    // Gate 2: Epics Review
    // ------------------------------------------------------------------------
    expect(currentRun.status).toBe('paused_approval');
    expect(currentRun.currentNode).toBe('gate_epics');
    expect(currentRun.statePayload.epics.length).toBeGreaterThan(0);

    approvals = await orchestrationService.listApprovalRequests(testProjectId);
    let gate2 = approvals.find((a) => a.workflowRunId === currentRun.id && a.status === 'pending');
    expect(gate2).toBeDefined();

    // Human approves Gate 2
    result = await orchestrationService.decideApproval({
      approvalId: gate2!.id,
      dto: { decision: 'approved', notes: 'Epics approved.' },
      actorUserId: ACTOR_ALICE,
    });
    currentRun = result.workflowRun;

    // ------------------------------------------------------------------------
    // Gate 3: User Stories & Acceptance Criteria Review
    // ------------------------------------------------------------------------
    expect(currentRun.status).toBe('paused_approval');
    expect(currentRun.currentNode).toBe('gate_requirements');
    expect(currentRun.statePayload.userStories.length).toBeGreaterThan(0);

    approvals = await orchestrationService.listApprovalRequests(testProjectId);
    let gate3 = approvals.find((a) => a.workflowRunId === currentRun.id && a.status === 'pending');
    expect(gate3).toBeDefined();

    // Human approves Gate 3
    result = await orchestrationService.decideApproval({
      approvalId: gate3!.id,
      dto: { decision: 'approved', notes: 'Requirements and Gherkin criteria approved.' },
      actorUserId: ACTOR_ALICE,
    });
    currentRun = result.workflowRun;

    // ------------------------------------------------------------------------
    // Gate 4: Architecture Proposal Review
    // ------------------------------------------------------------------------
    expect(currentRun.status).toBe('paused_approval');
    expect(currentRun.currentNode).toBe('gate_architecture');
    expect(currentRun.statePayload.architectureProposal).toBeDefined();
    expect(currentRun.statePayload.architectureProposal?.components.length).toBeGreaterThan(0);

    approvals = await orchestrationService.listApprovalRequests(testProjectId);
    let gate4 = approvals.find((a) => a.workflowRunId === currentRun.id && a.status === 'pending');
    expect(gate4).toBeDefined();

    // Human approves Gate 4
    result = await orchestrationService.decideApproval({
      approvalId: gate4!.id,
      dto: { decision: 'approved', notes: 'Architecture blueprint approved.' },
      actorUserId: ACTOR_ALICE,
    });
    currentRun = result.workflowRun;

    // ------------------------------------------------------------------------
    // Workflow Completion
    // ------------------------------------------------------------------------
    expect(currentRun.status).toBe('completed');
    expect(currentRun.currentNode).toBe('completed');
    expect(currentRun.completedAt).toBeDefined();
    expect(currentRun.statePayload.history.length).toBeGreaterThanOrEqual(8);
  });
});
