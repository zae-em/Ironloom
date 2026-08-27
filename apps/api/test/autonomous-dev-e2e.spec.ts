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
import { DevOpsModule } from '../src/devops/devops.module';
import { RedisModule } from '../src/redis/redis.module';
import { OrchestrationService } from '../src/orchestration/orchestration.service';

jest.setTimeout(240000);

describe('Autonomous Engineering E2E Benchmark Suite (5 Domain Fixtures - Phase 4 Exit Criteria)', () => {
  let module: TestingModule;
  let orchestrationService: OrchestrationService;
  let projectsService: ProjectsService;

  const testOrgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const testUserId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  let testProjectId: string;

  const DOMAIN_FIXTURES = [
    {
      domain: 'Fintech Payments',
      name: 'Multi-Currency Idempotent Payment Processor',
      rawIdea:
        'Build an idempotent multi-currency payment processor supporting USD, EUR, and JPY with automated fraud anomaly detection.',
    },
    {
      domain: 'Healthcare / Radiology',
      name: 'DICOM Imaging Metadata Parser & Anonymizer',
      rawIdea:
        'Build a high-performance DICOM medical image header parser that strips patient PHI fields according to HIPAA Safe Harbor guidelines.',
    },
    {
      domain: 'IoT & Telemetry',
      name: 'Sub-100ms Fleet Sensor Ingestion Engine',
      rawIdea:
        'Build a real-time IoT vehicle sensor stream processor that alerts dispatchers when brake pressure drops below safety thresholds.',
    },
    {
      domain: 'Aerospace & Robotics',
      name: 'Autonomous Drone Collision Avoidance Planner',
      rawIdea:
        'Build a 3D LiDAR obstacle avoidance trajectory planner that re-routes delivery drones in under 50ms upon proximity alert.',
    },
    {
      domain: 'E-Commerce Retail',
      name: 'Distributed Inventory Reservation & Checkout',
      rawIdea:
        'Build a high-concurrency shopping cart checkout engine that locks SKU inventory with 15-minute TTL expirations.',
    },
  ];

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
        DevOpsModule,
      ],
    }).compile();

    await module.init();

    orchestrationService = module.get<OrchestrationService>(OrchestrationService);
    projectsService = module.get<ProjectsService>(ProjectsService);

    const project = await projectsService.createProject(testOrgId, testUserId, {
      name: 'Autonomous Dev Benchmark Project',
      description: 'Verifies autonomous code writing, reviewing, testing across 5 industry domains',
    });
    testProjectId = project.id;
  });

  afterAll(async () => {
    await module.close();
  });

  for (const fixture of DOMAIN_FIXTURES) {
    it(`should autonomously implement, review, test, and open green CI PR for: [${fixture.domain}] ${fixture.name}`, async () => {
      // 1. Kick off full workflow
      let run = await orchestrationService.startWorkflow({
        orgId: testOrgId,
        projectId: testProjectId,
        actorUserId: testUserId,
        dto: {
          name: fixture.name,
          rawIdea: fixture.rawIdea,
        },
      });

      // Auto-approve Phase 2-3 gates (Business Case, Epics, User Stories, Architecture)
      const gatesToApprove = [
        'gate_business_case',
        'gate_epics',
        'gate_requirements',
        'gate_architecture',
      ];

      for (const gate of gatesToApprove) {
        expect(run.status).toBe('paused_approval');
        expect(run.currentNode).toBe(gate);

        const res = await orchestrationService.decideApproval({
          approvalId: run.statePayload.activeApprovalRequestId!,
          dto: { decision: 'approved', notes: `Auto-approving ${gate} for ${fixture.name}` },
          actorUserId: testUserId,
        });
        run = res.workflowRun;
      }

      // 2. Verify Developer, Code Reviewer, and QA Agent Execution outputs
      expect(run.status).toBe('paused_approval');
      expect(run.currentNode).toBe('gate_pr_human_review');
      expect(run.statePayload.pullRequests.length).toBeGreaterThan(0);

      // Verify PR Entity
      const pr = run.statePayload.pullRequests[0];
      expect(pr.prNumber).toBeGreaterThan(0);
      expect(pr.title).toBeDefined();
      expect(pr.branchName).toMatch(/^feat\/story-/);
      expect(pr.filesChanged.length).toBeGreaterThan(0);

      // Verify Code Review Verdict
      expect(run.statePayload.codeReviewVerdicts.length).toBeGreaterThan(0);
      const review = run.statePayload.codeReviewVerdicts[0];
      expect(review.verdict).toBeDefined();

      // Verify QA Test Run
      expect(run.statePayload.testRuns.length).toBeGreaterThan(0);
      const testRun = run.statePayload.testRuns[0];
      expect(testRun.status).toBe('passed');
      expect(testRun.passedCount).toBeGreaterThan(0);
      expect(testRun.coveragePercent).toBeGreaterThan(50);

      // 3. Human Approval Gate: Approve PR -> Advances to Staging & Prod Deploy Gate
      let approveRes = await orchestrationService.decideApproval({
        approvalId: run.statePayload.activeApprovalRequestId!,
        dto: {
          decision: 'approved',
          notes: `Human Reviewer verified green CI and approved merge for ${fixture.name}`,
        },
        actorUserId: testUserId,
      });

      expect(approveRes.workflowRun.status).toBe('paused_approval');
      expect(approveRes.workflowRun.currentNode).toBe('gate_prod_deploy');

      // 4. Human Approval Gate: Approve Prod Rollout -> Completed
      approveRes = await orchestrationService.decideApproval({
        approvalId: approveRes.workflowRun.statePayload.activeApprovalRequestId!,
        dto: {
          decision: 'approved',
          notes: `Approved production rollout for ${fixture.name}`,
        },
        actorUserId: testUserId,
      });

      // Workflow reaches completion!
      expect(approveRes.workflowRun.status).toBe('completed');
      expect(approveRes.workflowRun.currentNode).toBe('completed');
    });
  }
});
