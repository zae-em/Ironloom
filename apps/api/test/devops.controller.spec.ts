import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DevOpsController } from '../src/devops/devops.controller';
import { DevOpsModule } from '../src/devops/devops.module';
import { DatabaseModule } from '../src/database/database.module';
import { DevOpsRepository } from '../src/database/repositories/devops.repository';
import { OrchestrationModule } from '../src/orchestration/orchestration.module';
import { ProjectsModule } from '../src/projects/projects.module';
import { UsersModule } from '../src/users/users.module';
import { SdlcModule } from '../src/sdlc/sdlc.module';
import { RAGModule } from '../src/rag/rag.module';
import { AiGatewayModule } from '../src/ai-gateway/ai-gateway.module';
import { McpModule } from '../src/mcp/mcp.module';
import { SandboxModule } from '../src/sandbox/sandbox.module';
import { RedisModule } from '../src/redis/redis.module';
import { AgentsCoreModule } from '../src/agents/core/agents-core.module';
import { AuthUserContext } from '@ironloom/shared';

jest.setTimeout(120000);

describe('DevOpsController Integration & REST Suite (Prompt 10)', () => {
  let controller: DevOpsController;
  let devOpsRepo: DevOpsRepository;

  const mockOrgId = '00000000-0000-0000-0000-000000000001';
  const mockProjectId = '00000000-0000-0000-0000-000000000002';
  const mockUser: AuthUserContext = {
    userId: '00000000-0000-0000-0000-000000000003',
    email: 'engineer@ironloom.ai',
    orgId: mockOrgId,
    orgMemberships: [{ orgId: mockOrgId, role: 'admin' }],
    role: 'admin',
  };

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

    controller = moduleRef.get<DevOpsController>(DevOpsController);
    devOpsRepo = moduleRef.get<DevOpsRepository>(DevOpsRepository);
  });

  beforeEach(() => {
    devOpsRepo.reset();
  });

  it('1. should return a healthy Command Center summary with zero incidents and deployments', async () => {
    const summary = await controller.getCommandCenter(mockOrgId);
    expect(summary).toBeDefined();
    expect(summary.systemHealthStatus).toBe('healthy');
    expect(summary.uptimePercentage).toBeGreaterThanOrEqual(99.0);
    expect(summary.openIncidentsCount).toBe(0);
  });

  it('2. should list multi-environments for project (dev, staging, prod)', async () => {
    const envs = await controller.listEnvironments(mockProjectId);
    expect(envs).toHaveLength(3);
    expect(envs.map((e) => e.name)).toEqual(expect.arrayContaining(['dev', 'staging', 'prod']));
  });

  it('3. should perform one-click / policy-driven promotion and record deployment', async () => {
    const deployment = await controller.promoteEnvironment(mockProjectId, mockOrgId, mockUser, {
      environment: 'dev',
      targetEnvironment: 'staging',
      version: 'v1.1.0',
      notes: 'Automated promotion to staging',
    });

    expect(deployment).toBeDefined();
    expect(deployment.status).toBe('success');
    expect(deployment.version).toBe('v1.1.0');

    const deployments = await controller.listDeployments(mockProjectId);
    expect(deployments.length).toBeGreaterThanOrEqual(1);
  });

  it('4. should register rollback deployment with emergency status and confirmation', async () => {
    const rollback = await controller.rollbackEnvironment(mockProjectId, mockOrgId, mockUser, {
      environment: 'prod',
      targetVersion: 'v1.0.0',
      reason: 'P95 latency degradation detected',
    });

    expect(rollback).toBeDefined();
    expect(rollback.status).toBe('rolled_back');
    expect(rollback.releaseNotes).toContain('EMERGENCY ROLLBACK');
  });

  it('5. should create incident, fetch live telemetry, and trigger self-healing remediation', async () => {
    const incident = await controller.createIncident({
      projectId: mockProjectId,
      title: 'P95 Latency Regression on Payment Ingestion',
      summary: 'Latency jumped from 45ms to 850ms',
      environment: 'prod',
      severity: 'high',
      source: 'monitoring',
      telemetrySnapshot: {
        timestamp: new Date().toISOString(),
        cpuUsagePercent: 45.0,
        memoryUsagePercent: 55.0,
        errorRatePercent: 0.1,
        latencyP95Ms: 850,
        requestCount: 5000,
        activeInstances: 3,
      },
    });

    expect(incident).toBeDefined();
    expect(incident.status).toBe('open');
    expect(incident.severity).toBe('high');

    const incidents = await controller.listIncidents(mockProjectId);
    expect(incidents).toHaveLength(1);

    // Trigger remediation hotfix workflow
    const remediationRes = await controller.remediateIncident(incident.id, mockOrgId, mockUser);
    expect(remediationRes).toBeDefined();
    expect(remediationRes.workflowRun).toBeDefined();
    expect(remediationRes.workflowRun.statePayload.isIncidentFeedbackLoop).toBe(true);
  });

  it('6. should support Approval Policy CRUD with plain-English rule definitions', async () => {
    const policy = await controller.createPolicy(mockOrgId, {
      name: 'Custom Staging Auto-Approval Rule',
      description: 'Auto-promotes to staging if smoke tests pass',
      actionType: 'staging_promote',
      environmentPattern: 'staging',
      ruleDefinition: {
        autoApproveStagingIfSmokePassed: true,
        maxErrorRateThresholdPercent: 0.5,
      },
      enabled: true,
    });

    expect(policy).toBeDefined();
    expect(policy.name).toBe('Custom Staging Auto-Approval Rule');

    const policies = await controller.listPolicies(mockOrgId);
    expect(policies.some((p) => p.id === policy.id)).toBe(true);

    const updated = await controller.updatePolicy(policy.id, {
      enabled: false,
    });
    expect(updated.enabled).toBe(false);

    const deleteRes = await controller.deletePolicy(policy.id);
    expect(deleteRes.success).toBe(true);
  });
});
