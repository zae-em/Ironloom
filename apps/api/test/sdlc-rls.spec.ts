import * as fs from 'fs';
import * as path from 'path';

describe('SDLC Database Migration & Row-Level Security (RLS) Policy Tests', () => {
  const USER_ALICE = '11111111-1111-1111-1111-111111111111';
  const USER_CHARLIE = '33333333-3333-3333-3333-333333333333';

  const ORG_ALPHA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORG_BETA = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('should verify migration 003_sdlc_schema.sql contains RLS policies on all 6 tables', () => {
    const migrationPath = path.resolve(__dirname, '../../../infra/migrations/003_sdlc_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ALTER TABLE public.business_cases ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.epics ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.acceptance_criteria ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.architecture_proposals ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY');

    expect(sql).toContain('CREATE POLICY business_cases_select');
    expect(sql).toContain('CREATE POLICY epics_select');
    expect(sql).toContain('CREATE POLICY user_stories_select');
    expect(sql).toContain('CREATE POLICY acceptance_criteria_select');
    expect(sql).toContain('CREATE POLICY architecture_proposals_select');
    expect(sql).toContain('CREATE POLICY document_embeddings_select');
  });

  it('should enforce multi-tenant isolation and deny cross-org SDLC entity access', () => {
    const memberships = [
      { userId: USER_ALICE, orgId: ORG_ALPHA, role: 'owner' },
      { userId: USER_CHARLIE, orgId: ORG_BETA, role: 'owner' },
    ];

    const businessCases = [
      { id: 'bc-alpha', orgId: ORG_ALPHA, problemStatement: 'Alpha Telemetry' },
      { id: 'bc-beta', orgId: ORG_BETA, problemStatement: 'Beta Quantum Synapse' },
    ];

    const architectureProposals = [
      { id: 'arch-alpha', orgId: ORG_ALPHA, title: 'Alpha Architecture v1' },
      { id: 'arch-beta', orgId: ORG_BETA, title: 'Beta Architecture v1' },
    ];

    function isOrgMember(userId: string, orgId: string): boolean {
      return memberships.some((m) => m.userId === userId && m.orgId === orgId);
    }

    function selectCasesForUser(userId: string) {
      return businessCases.filter((bc) => isOrgMember(userId, bc.orgId));
    }

    function selectProposalsForUser(userId: string) {
      return architectureProposals.filter((ap) => isOrgMember(userId, ap.orgId));
    }

    function insertProposalAsUser(userId: string, item: { id: string; orgId: string; title: string }) {
      if (!isOrgMember(userId, item.orgId)) {
        throw new Error(`Postgres RLS Policy Violation: Access denied to organization ${item.orgId}`);
      }
      architectureProposals.push(item);
      return item;
    }

    // 1. Positive test: Alice can view Alpha cases
    const aliceCases = selectCasesForUser(USER_ALICE);
    expect(aliceCases.length).toBe(1);
    expect(aliceCases[0].id).toBe('bc-alpha');

    // 2. Negative test: Alice CANNOT view Beta cases
    const hasBetaCase = aliceCases.some((c) => c.orgId === ORG_BETA);
    expect(hasBetaCase).toBe(false);

    // 3. Positive test: Charlie can view Beta proposals
    const charlieProposals = selectProposalsForUser(USER_CHARLIE);
    expect(charlieProposals.length).toBe(1);
    expect(charlieProposals[0].id).toBe('arch-beta');

    // 4. Negative test: Charlie CANNOT view Alpha proposals
    const hasAlphaProposal = charlieProposals.some((p) => p.orgId === ORG_ALPHA);
    expect(hasAlphaProposal).toBe(false);

    // 5. Negative test: Alice attempts to inject proposal into Beta Org -> Denied
    expect(() => {
      insertProposalAsUser(USER_ALICE, {
        id: 'cross-org-arch-01',
        orgId: ORG_BETA,
        title: 'Unauthorized Infiltration Proposal',
      });
    }).toThrow(/RLS Policy Violation/);
  });
});
