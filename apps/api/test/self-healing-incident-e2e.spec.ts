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

describe('Autonomous Self-Healing Incident Remediation Loop Integration Tests (Phase 5)', () => {
  let orchestrationService: OrchestrationService;
  let projectsService: ProjectsService;
  let devOpsRepo: DevOpsRepository;
  let monitoringAgent: MonitoringAgent;
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
    monitoringAgent = moduleRef.get<MonitoringAgent>(MonitoringAgent);

    const project = await projectsService.createProject(orgId, actorUserId, {
      name: 'Resilient Payment Gateway Service',
      description:
        'High-availability financial processing engine with automated self-healing feedback loop.',
    });
    projectId = project.id;
  });

  it('should close the loop: Simulated Incident -> Task -> Promoted Requirement -> Dev/QA/DevOps Pipeline -> Incident Resolved', async () => {
    // 1. Simulate a Production Monitoring Alert (High Error Rate Anomaly)
    const monitorResult = await monitoringAgent.auditTelemetry({
      agentId: 'monitoring_agent_009',
      actorUserId,
      input: {
        projectId,
        environment: 'prod',
        telemetry: {
          timestamp: new Date().toISOString(),
          cpuUsagePercent: 65.0,
          memoryUsagePercent: 78.0,
          errorRatePercent: 4.2, // Anomaly spike > 1.0%
          latencyP95Ms: 180.0,
          requestCount: 22000,
          activeInstances: 3,
        },
      },
    });

    expect(monitorResult.output.anomalyDetected).toBe(true);
    const incident = monitorResult.output.incidentCreated!;
    expect(incident).toBeDefined();
    expect(incident.status).toBe('open');

    // 2. Start Self-Healing Remediation Workflow pre-seeded with Incident Context
    let run = await orchestrationService.startWorkflow({
      orgId,
      projectId,
      actorUserId,
      dto: {
        name: `Automated Hotfix: ${incident.title}`,
        rawIdea: `Fix production defect causing elevated 5xx error rate: ${incident.summary}`,
        isIncidentFeedbackLoop: true,
        incidentContext: incident,
      },
    });

    // Advances automatically through RE -> Architect -> MCP Sync -> Dev Node -> Code Review Node -> QA Node -> Gate 5: PR Human Review
    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_pr_human_review');
    expect(run.statePayload.isIncidentFeedbackLoop).toBe(true);
    expect(run.statePayload.pullRequests).toHaveLength(1);

    // 3. Approve PR merge to trigger multi-environment rollout
    let approvals = await orchestrationService.listApprovalRequests(projectId);
    let gate5 = approvals.find((a) => a.workflowRunId === run.id && a.status === 'pending');
    expect(gate5).toBeDefined();

    let res = await orchestrationService.decideApproval({
      approvalId: gate5!.id,
      dto: { decision: 'approved', notes: 'Hotfix PR approved.' },
      actorUserId,
    });
    run = res.workflowRun;

    expect(run.status).toBe('paused_approval');
    expect(run.currentNode).toBe('gate_prod_deploy');

    // 4. Approve Production Rollout Gate
    approvals = await orchestrationService.listApprovalRequests(projectId);
    let gate6 = approvals.find((a) => a.workflowRunId === run.id && a.status === 'pending');
    expect(gate6).toBeDefined();

    res = await orchestrationService.decideApproval({
      approvalId: gate6!.id,
      dto: { decision: 'approved', notes: 'Emergency production deployment approved.' },
      actorUserId,
    });
    run = res.workflowRun;

    expect(run.status).toBe('completed');
    expect(run.currentNode).toBe('completed');

    // 5. Verify the originating incident is automatically marked RESOLVED
    const incidents = await devOpsRepo.listIncidents(projectId);
    const resolvedIncident = incidents.find((i) => i.id === incident.id);
    expect(resolvedIncident?.status).toBe('resolved');
    expect(resolvedIncident?.resolvedAt).toBeDefined();
  });
});
