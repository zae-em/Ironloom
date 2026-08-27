import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ApprovalPolicyService } from '../src/devops/approval-policy.service';
import { DevOpsRepository } from '../src/database/repositories/devops.repository';
import { DatabaseModule } from '../src/database/database.module';
import { DevOpsModule } from '../src/devops/devops.module';

describe('ApprovalPolicyService Unit Tests', () => {
  let policyService: ApprovalPolicyService;
  let devOpsRepo: DevOpsRepository;
  const orgId = 'org-11111111-1111-1111-1111-111111111111';
  const projectId = 'proj-22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              supabase: { url: 'http://localhost:54321', serviceRoleKey: 'test_key' },
            }),
          ],
        }),
        DatabaseModule,
        DevOpsModule,
      ],
    }).compile();

    policyService = moduleRef.get<ApprovalPolicyService>(ApprovalPolicyService);
    devOpsRepo = moduleRef.get<DevOpsRepository>(DevOpsRepository);
  });

  it('should auto-approve dev promotions unconditionally', async () => {
    const result = await policyService.evaluateAction({
      orgId,
      projectId,
      actionType: 'deploy',
      environment: 'dev',
    });

    expect(result.autoApprove).toBe(true);
    expect(result.reason).toContain('Development environment builds auto-promoted');
  });

  it('should auto-approve staging promotions when smoke test passes', async () => {
    const result = await policyService.evaluateAction({
      orgId,
      projectId,
      actionType: 'deploy',
      environment: 'staging',
      smokeTestPassed: true,
    });

    expect(result.autoApprove).toBe(true);
    expect(result.reason).toContain('staging');
  });

  it('should reject staging promotion if automated smoke tests fail', async () => {
    const result = await policyService.evaluateAction({
      orgId,
      projectId,
      actionType: 'deploy',
      environment: 'staging',
      smokeTestPassed: false,
    });

    expect(result.autoApprove).toBe(false);
    expect(result.reason).toContain('smoke tests failed');
  });

  it('should pause production deployments for human approval when no policy is configured', async () => {
    const result = await policyService.evaluateAction({
      orgId,
      projectId,
      actionType: 'deploy',
      environment: 'prod',
      smokeTestPassed: true,
      activeIncidentsCount: 0,
    });

    expect(result.autoApprove).toBe(false);
    expect(result.reason).toContain('human approval gate');
  });

  it('should auto-approve production deployment if explicit policy is enabled and 0 active incidents exist', async () => {
    await devOpsRepo.createApprovalPolicy({
      orgId,
      projectId,
      actionType: 'deploy',
      ruleDefinition: {
        autoApproveProdIfNoActiveIncidents: true,
        maxErrorRateThresholdPercent: 1.0,
      },
      enabled: true,
    });

    const result = await policyService.evaluateAction({
      orgId,
      projectId,
      actionType: 'deploy',
      environment: 'prod',
      smokeTestPassed: true,
      activeIncidentsCount: 0,
    });

    expect(result.autoApprove).toBe(true);
    expect(result.reason).toContain('Auto-approved by policy');
  });

  it('should reject production auto-approval if active unresolved incidents exist despite policy', async () => {
    await devOpsRepo.createApprovalPolicy({
      orgId,
      projectId,
      actionType: 'deploy',
      ruleDefinition: {
        autoApproveProdIfNoActiveIncidents: true,
      },
      enabled: true,
    });

    const result = await policyService.evaluateAction({
      orgId,
      projectId,
      actionType: 'deploy',
      environment: 'prod',
      smokeTestPassed: true,
      activeIncidentsCount: 2,
    });

    expect(result.autoApprove).toBe(false);
    expect(result.reason).toContain('2 unresolved active incidents exist');
  });
});
