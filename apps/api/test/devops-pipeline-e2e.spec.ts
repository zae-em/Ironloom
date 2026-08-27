import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SdlcGraphEngine } from '../src/orchestration/engine/sdlc-graph.engine';
import { OrchestrationService } from '../src/orchestration/orchestration.service';
import { OrchestrationRepository } from '../src/orchestration/orchestration.repository';
import { WorkflowDecisionService } from '../src/orchestration/decisions/workflow-decision.service';
import { BusinessAnalystAgent } from '../src/agents/sdlc/business-analyst.agent';
import { ProductManagerAgent } from '../src/agents/sdlc/product-manager.agent';
import { RequirementsEngineerAgent } from '../src/agents/sdlc/requirements-engineer.agent';
import { ArchitectAgent } from '../src/agents/sdlc/architect.agent';
import { DeveloperAgent } from '../src/agents/sdlc/developer.agent';
import { CodeReviewerAgent } from '../src/agents/sdlc/code-reviewer.agent';
import { QaAgent } from '../src/agents/sdlc/qa.agent';
import { DevOpsAgent } from '../src/agents/sdlc/devops.agent';
import { MonitoringAgent } from '../src/agents/sdlc/monitoring.agent';
import { SdlcService } from '../src/sdlc/sdlc.service';
import { SdlcRepository } from '../src/sdlc/sdlc.repository';
import { ProjectsService } from '../src/projects/projects.service';
import { AiGatewayService } from '../src/ai-gateway/ai-gateway.service';
import { ToolRegistry } from '../src/agents/core/tools/tool.registry';
import { PromptTemplateService } from '../src/agents/core/prompts/prompt-template.service';
import { RAGService } from '../src/rag/rag.service';
import { EmbeddingService } from '../src/rag/embedding.service';
import { DevOpsRepository } from '../src/database/repositories/devops.repository';
import { ProviderRegistryService } from '../src/ai-gateway/adapters/provider-registry.service';
import { CostCalculatorService } from '../src/ai-gateway/cost/cost-calculator.service';
import { QuotaTrackerService } from '../src/ai-gateway/quota/quota-tracker.service';
import { RedisService } from '../src/redis/redis.service';
import { MockAdapter } from '../src/ai-gateway/adapters/mock.adapter';
import { OllamaAdapter } from '../src/ai-gateway/adapters/ollama.adapter';
import { GroqAdapter } from '../src/ai-gateway/adapters/groq.adapter';
import { McpModule } from '../src/mcp/mcp.module';
import { SandboxModule } from '../src/sandbox/sandbox.module';
import { DevOpsModule } from '../src/devops/devops.module';

import { DatabaseModule } from '../src/database/database.module';

jest.setTimeout(180000);

describe('DevOps Multi-Environment Promotion & CI/CD Pipeline Integration Tests (Phase 5)', () => {
  let orchestrationService: OrchestrationService;
  let projectsService: ProjectsService;
  let devOpsRepo: DevOpsRepository;
  const orgId = '00000000-0000-0000-0000-000000000001';
  let projectId: string;
  const actorUserId = '00000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
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
        DatabaseModule,
        McpModule,
        SandboxModule,
        DevOpsModule,
      ],
      providers: [
        RedisService,
        QuotaTrackerService,
        CostCalculatorService,
        ProviderRegistryService,
        MockAdapter,
        OllamaAdapter,
        GroqAdapter,
        ToolRegistry,
        PromptTemplateService,
        AiGatewayService,
        EmbeddingService,
        RAGService,
        SdlcRepository,
        SdlcService,
        ProjectsService,
        BusinessAnalystAgent,
        ProductManagerAgent,
        RequirementsEngineerAgent,
        ArchitectAgent,
        DeveloperAgent,
        CodeReviewerAgent,
        QaAgent,
        DevOpsAgent,
        MonitoringAgent,
        WorkflowDecisionService,
        OrchestrationRepository,
        SdlcGraphEngine,
        OrchestrationService,
      ],
    }).compile();

    orchestrationService = moduleRef.get<OrchestrationService>(OrchestrationService);
    projectsService = moduleRef.get<ProjectsService>(ProjectsService);
    devOpsRepo = moduleRef.get<DevOpsRepository>(DevOpsRepository);

    const project = await projectsService.createProject(orgId, actorUserId, {
      name: 'Cloud Native Telemetry Microservice',
      description: 'Distributed event processing system with multi-environment CI/CD pipeline.',
    });
    projectId = project.id;
  });

  it('should promote an idea through the entire SDLC pipeline from conception to production with human PR and deploy gates', async () => {
    // 1. Start Workflow Run
    let run = await orchestrationService.startWorkflow({
      orgId,
      projectId,
      actorUserId,
      dto: {
        name: 'Autonomous Release Pipeline v1.0',
        rawIdea:
          'Implement a high-throughput metrics ingestion pipeline handling 50k req/sec with zero packet loss.',
      },
    });

    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_business_case');

    // 2. Approve Gate 1: Business Case
    let approvals = await orchestrationService.listApprovalRequests(projectId);
    let gate1 = approvals.find((a) => a.workflowRunId === run.id && a.status === 'pending');
    expect(gate1).toBeDefined();

    let res = await orchestrationService.decideApproval({
      approvalId: gate1!.id,
      dto: { decision: 'approved', notes: 'Business case approved.' },
      actorUserId,
    });
    run = res.workflowRun;
    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_epics');

    // 3. Approve Gate 2: Epics
    approvals = await orchestrationService.listApprovalRequests(projectId);
    let gate2 = approvals.find((a) => a.workflowRunId === run.id && a.status === 'pending');
    expect(gate2).toBeDefined();

    res = await orchestrationService.decideApproval({
      approvalId: gate2!.id,
      dto: { decision: 'approved', notes: 'Epics backlog approved.' },
      actorUserId,
    });
    run = res.workflowRun;
    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_requirements');

    // 4. Approve Gate 3: User Stories
    approvals = await orchestrationService.listApprovalRequests(projectId);
    let gate3 = approvals.find((a) => a.workflowRunId === run.id && a.status === 'pending');
    expect(gate3).toBeDefined();

    res = await orchestrationService.decideApproval({
      approvalId: gate3!.id,
      dto: { decision: 'approved', notes: 'Acceptance criteria approved.' },
      actorUserId,
    });
    run = res.workflowRun;
    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_architecture');

    // 5. Approve Gate 4: Architecture Proposal
    approvals = await orchestrationService.listApprovalRequests(projectId);
    let gate4 = approvals.find((a) => a.workflowRunId === run.id && a.status === 'pending');
    expect(gate4).toBeDefined();

    res = await orchestrationService.decideApproval({
      approvalId: gate4!.id,
      dto: { decision: 'approved', notes: 'System architecture approved.' },
      actorUserId,
    });
    run = res.workflowRun;

    // Advances through MCP Sync -> Dev Node -> Code Review Node -> QA Node -> Gate 5: PR Human Review
    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_pr_human_review');
    expect(run.statePayload.pullRequests).toHaveLength(1);
    expect(run.statePayload.codeReviewVerdicts).toHaveLength(1);
    expect(run.statePayload.testRuns).toHaveLength(1);

    // 6. Approve Gate 5: Human Pull Request Review
    // Advances through Dev promotion -> Staging promotion & Smoke Test -> Gate 6: Prod Deploy
    approvals = await orchestrationService.listApprovalRequests(projectId);
    let gate5 = approvals.find((a) => a.workflowRunId === run.id && a.status === 'pending');
    expect(gate5).toBeDefined();

    res = await orchestrationService.decideApproval({
      approvalId: gate5!.id,
      dto: { decision: 'approved', notes: 'PR #101 verified and approved for merge to main.' },
      actorUserId,
    });
    run = res.workflowRun;

    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_prod_deploy');

    // 7. Approve Gate 6: Production Deployment Gate
    // Advances through Prod Deploy -> Monitoring Telemetry Audit -> Completed
    approvals = await orchestrationService.listApprovalRequests(projectId);
    let gate6 = approvals.find((a) => a.workflowRunId === run.id && a.status === 'pending');
    expect(gate6).toBeDefined();

    res = await orchestrationService.decideApproval({
      approvalId: gate6!.id,
      dto: { decision: 'approved', notes: 'Approved for production rollout.' },
      actorUserId,
    });
    run = res.workflowRun;

    expect(run.status).toBe('completed');
    expect(run.currentNode).toBe('completed');
    expect(run.completedAt).toBeDefined();

    // Verify multi-environment records in repository
    const deployments = await devOpsRepo.listDeployments(projectId);
    expect(deployments.length).toBeGreaterThanOrEqual(3); // dev, staging, prod
    expect(deployments.map((d) => d.status)).toContain('success');
  });
});
