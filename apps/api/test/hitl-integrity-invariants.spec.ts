import { ApprovalPolicyService } from '../src/devops/approval-policy.service';
import { DevOpsRepository } from '../src/database/repositories/devops.repository';
import { SupabaseService } from '../src/database/supabase.service';

describe('Human-in-the-Loop (HITL) Safety Invariants & Rejection Paths Suite (Prompt 11)', () => {
  let policyService: ApprovalPolicyService;
  let devOpsRepo: DevOpsRepository;

  const ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const PROJ_ID = '11111111-1111-1111-1111-111111111111';

  beforeAll(() => {
    const supabaseService = new SupabaseService({
      get: () => 'mock_val',
    } as any);

    devOpsRepo = new DevOpsRepository(supabaseService);
    policyService = new ApprovalPolicyService(devOpsRepo);
  });

  it('1. Invariant: Production actions strictly reject auto-approval without an explicit enabled policy', async () => {
    const result = await policyService.evaluateAction({
      orgId: ORG_ID,
      projectId: PROJ_ID,
      actionType: 'deploy',
      environment: 'prod',
    });

    // Invariant holds: prod must not auto-approve without matching policy
    expect(result.autoApprove).toBe(false);
    expect(result.reason).toContain('strictly require an explicit human approval gate');
  });

  it('2. Invariant: Production auto-approval rejects if unresolved active incidents exist', async () => {
    // Configure policy with zero-incident requirement
    await devOpsRepo.createApprovalPolicy({
      orgId: ORG_ID,
      projectId: PROJ_ID,
      name: 'Prod Deploy Rule',
      actionType: 'deploy',
      enabled: true,
      environmentPattern: 'prod',
      ruleDefinition: {
        autoApproveProdIfNoActiveIncidents: true,
        maxErrorRateThresholdPercent: 1.0,
      },
    });

    const result = await policyService.evaluateAction({
      orgId: ORG_ID,
      projectId: PROJ_ID,
      actionType: 'deploy',
      environment: 'prod',
      activeIncidentsCount: 2, // 2 open incidents
    });

    expect(result.autoApprove).toBe(false);
    expect(result.reason).toContain('unresolved active incidents exist');
  });

  it('3. Invariant: Staging promotion rejects if automated sandbox smoke tests fail', async () => {
    const result = await policyService.evaluateAction({
      orgId: ORG_ID,
      projectId: PROJ_ID,
      actionType: 'staging_promote',
      environment: 'staging',
      smokeTestPassed: false,
    });

    expect(result.autoApprove).toBe(false);
    expect(result.reason).toContain('smoke tests failed');
  });

  it('4. Invariant: Development builds auto-promote cleanly after unit tests', async () => {
    const result = await policyService.evaluateAction({
      orgId: ORG_ID,
      projectId: PROJ_ID,
      actionType: 'staging_promote',
      environment: 'dev',
    });

    expect(result.autoApprove).toBe(true);
  });
});
