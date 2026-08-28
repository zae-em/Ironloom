import { SdlcRepository } from '../src/sdlc/sdlc.repository';
import { DevOpsRepository } from '../src/database/repositories/devops.repository';
import { OrchestrationRepository } from '../src/orchestration/orchestration.repository';
import { SupabaseService } from '../src/database/supabase.service';

describe('Comprehensive Multi-Tenant Cross-Org RLS & Data Isolation Suite (Prompt 11)', () => {
  let sdlcRepo: SdlcRepository;
  let devOpsRepo: DevOpsRepository;
  let orchRepo: OrchestrationRepository;
  let supabaseService: SupabaseService;

  const ORG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const PROJ_A = '11111111-1111-1111-1111-111111111111';
  const PROJ_B = '22222222-2222-2222-2222-222222222222';

  beforeAll(() => {
    supabaseService = new SupabaseService({
      get: () => 'mock_val',
    } as any);

    sdlcRepo = new SdlcRepository(supabaseService);
    devOpsRepo = new DevOpsRepository(supabaseService);
    orchRepo = new OrchestrationRepository(supabaseService);
  });

  it('1. should isolate Business Cases between Org A and Org B', async () => {
    await sdlcRepo.createBusinessCase({
      orgId: ORG_A,
      projectId: PROJ_A,
      rawIdea: 'Org A Secret Idea',
      problemStatement: 'Problem A',
      goals: ['Goal A'],
      targetUsers: ['Users A'],
      successMetrics: ['Metric A'],
      assumptions: ['Assumption A'],
      risks: ['Risk A'],
      status: 'approved',
      version: 1,
    });

    const orgALogs = await sdlcRepo.listBusinessCases(PROJ_A);
    expect(orgALogs.length).toBeGreaterThan(0);
    expect(orgALogs[0].orgId).toBe(ORG_A);

    const orgBLogs = await sdlcRepo.listBusinessCases(PROJ_B);
    expect(orgBLogs.length).toBe(0);
  });

  it('2. should isolate Incidents & Telemetry between Project A and Project B', async () => {
    await devOpsRepo.createIncident({
      projectId: PROJ_A,
      title: 'Project A Prod Latency Breach',
      summary: 'High P95 latency detected',
      severity: 'critical',
      source: 'monitoring',
    });

    const projAIncidents = await devOpsRepo.listIncidents(PROJ_A);
    const projBIncidents = await devOpsRepo.listIncidents(PROJ_B);

    expect(projAIncidents.some((i) => i.projectId === PROJ_A)).toBe(true);
    expect(projBIncidents.some((i) => i.projectId === PROJ_A)).toBe(false);
  });

  it('3. should isolate Approval Policies between Org A and Org B', async () => {
    await devOpsRepo.createApprovalPolicy({
      orgId: ORG_A,
      name: 'Org A Zero-Incident Policy',
      actionType: 'deploy',
      enabled: true,
      environmentPattern: 'prod',
      ruleDefinition: {
        autoApproveProdIfNoActiveIncidents: true,
        maxErrorRateThresholdPercent: 0.5,
      },
    });

    const orgAPolicy = await devOpsRepo.findActivePolicy(ORG_A, 'deploy');
    const orgBPolicy = await devOpsRepo.findActivePolicy(ORG_B, 'deploy');

    expect(orgAPolicy).toBeDefined();
    expect(orgAPolicy?.orgId).toBe(ORG_A);
    expect(orgBPolicy).toBeNull();
  });

  it('4. should isolate Approval Requests and Workflow Runs across organizations', async () => {
    const orgAApprovals = await orchRepo.listAllApprovalRequests(ORG_A);
    const orgBApprovals = await orchRepo.listAllApprovalRequests(ORG_B);

    expect(orgAApprovals.every((a) => a.orgId === ORG_A)).toBe(true);
    expect(orgBApprovals.every((a) => a.orgId === ORG_B)).toBe(true);
  });
});
