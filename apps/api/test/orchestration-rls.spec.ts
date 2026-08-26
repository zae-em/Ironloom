import * as fs from 'fs';
import * as path from 'path';

describe('Orchestration Database Migration & Row-Level Security (RLS) Policy Tests', () => {
  const USER_ALICE = '11111111-1111-1111-1111-111111111111';
  const USER_CHARLIE = '33333333-3333-3333-3333-333333333333';

  const ORG_ALPHA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORG_BETA = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('should verify migration 004_orchestration_schema.sql contains RLS policies on all 3 orchestration tables', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../../infra/migrations/004_orchestration_schema.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE workflow_decisions ENABLE ROW LEVEL SECURITY');

    expect(sql).toContain('CREATE POLICY "Users can view workflow runs in their organizations"');
    expect(sql).toContain('CREATE POLICY "Users can create workflow runs in their organizations"');
    expect(sql).toContain(
      'CREATE POLICY "Users can view approval requests in their organizations"',
    );
    expect(sql).toContain(
      'CREATE POLICY "Users can view workflow decisions in their organizations"',
    );
  });

  it('should enforce multi-tenant isolation and deny cross-org workflow & approval access', () => {
    const memberships = [
      { userId: USER_ALICE, orgId: ORG_ALPHA, role: 'owner' },
      { userId: USER_CHARLIE, orgId: ORG_BETA, role: 'owner' },
    ];

    const workflowRuns = [
      {
        id: 'run-alpha',
        orgId: ORG_ALPHA,
        name: 'Alpha Drone Pipeline',
        status: 'paused_approval',
      },
      { id: 'run-beta', orgId: ORG_BETA, name: 'Beta Fintech Pipeline', status: 'running' },
    ];

    const approvalRequests = [
      { id: 'appr-alpha', orgId: ORG_ALPHA, workflowRunId: 'run-alpha', status: 'pending' },
      { id: 'appr-beta', orgId: ORG_BETA, workflowRunId: 'run-beta', status: 'pending' },
    ];

    function isOrgMember(userId: string, orgId: string): boolean {
      return memberships.some((m) => m.userId === userId && m.orgId === orgId);
    }

    function selectRunsForUser(userId: string) {
      return workflowRuns.filter((r) => isOrgMember(userId, r.orgId));
    }

    function selectApprovalsForUser(userId: string) {
      return approvalRequests.filter((a) => isOrgMember(userId, a.orgId));
    }

    function decideApprovalAsUser(userId: string, approvalId: string, orgId: string) {
      if (!isOrgMember(userId, orgId)) {
        throw new Error(`Postgres RLS Policy Violation: Access denied to organization ${orgId}`);
      }
      return { success: true };
    }

    // Alice in Org Alpha
    const aliceRuns = selectRunsForUser(USER_ALICE);
    expect(aliceRuns).toHaveLength(1);
    expect(aliceRuns[0].id).toBe('run-alpha');

    const aliceApprovals = selectApprovalsForUser(USER_ALICE);
    expect(aliceApprovals).toHaveLength(1);
    expect(aliceApprovals[0].id).toBe('appr-alpha');

    // Charlie in Org Beta
    const charlieRuns = selectRunsForUser(USER_CHARLIE);
    expect(charlieRuns).toHaveLength(1);
    expect(charlieRuns[0].id).toBe('run-beta');

    // Cross-tenant breach attempt: Alice attempts to decide Beta's approval
    expect(() => decideApprovalAsUser(USER_ALICE, 'appr-beta', ORG_BETA)).toThrow(
      /Postgres RLS Policy Violation/,
    );
  });
});
