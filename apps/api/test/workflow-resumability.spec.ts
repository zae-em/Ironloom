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

describe('Workflow Resumability & State Persistence Integration Tests', () => {
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
      name: 'Resumability Verification Project',
      description: 'Verifies state persistence across process restarts',
    });
    testProjectId = project.id;
  });

  it('1. should persist state after every node and resume cleanly after simulated restart', async () => {
    // 1. Start initial workflow
    const run = await orchestrationService.startWorkflow({
      orgId: ORG_ALPHA,
      projectId: testProjectId,
      actorUserId: ACTOR_ALICE,
      dto: {
        name: 'Resumable Pipeline',
        rawIdea: 'Automated high-throughput event processing engine with zero-trust security.',
      },
    });

    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_business_case');

    // 2. Fetch directly from repository to verify DB persistence
    const persisted = await repo.getWorkflowRun(run.id);
    expect(persisted.currentNode).toBe('gate_business_case');
    expect(persisted.statePayload.businessCase).toBeDefined();
    expect(persisted.statePayload.businessCase?.problemStatement).toBeDefined();

    // 3. Approve gate 1
    const approvals = await orchestrationService.listApprovalRequests(testProjectId);
    const gate1 = approvals.find((a) => a.workflowRunId === run.id && a.status === 'pending');
    expect(gate1).toBeDefined();

    const decisionResult = await orchestrationService.decideApproval({
      approvalId: gate1!.id,
      dto: { decision: 'approved' },
      actorUserId: ACTOR_ALICE,
    });

    expect(decisionResult.workflowRun.status).toBe('paused_approval');
    expect(decisionResult.workflowRun.currentNode).toBe('gate_epics');
    expect(decisionResult.workflowRun.statePayload.epics.length).toBeGreaterThan(0);

    // 4. Simulate a process crash / restart:
    // Calling resume on a paused workflow returns its exact persisted state
    const resumed = await orchestrationService.resumeWorkflow(run.id, ACTOR_ALICE);
    expect(resumed.id).toBe(run.id);
    expect(resumed.currentNode).toBe('gate_epics');
    expect(resumed.statePayload.epics.length).toBeGreaterThan(0);
  });
});
