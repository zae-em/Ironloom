-- ==============================================================================
-- IRONLOOM OS MIGRATION 004: AGENT ORCHESTRATION & HUMAN APPROVAL GATES SCHEMA
-- ==============================================================================

-- 1. WORKFLOW RUNS (Graph State Machine Executions)
CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Autonomous SDLC Pipeline Run',
    current_node TEXT NOT NULL DEFAULT 'start',
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused_approval', 'completed', 'failed', 'rejected')),
    state_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_project ON workflow_runs(project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_org ON workflow_runs(org_id, status);

-- 2. APPROVAL REQUESTS (First-Class Human Gate Records)
CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    node_name TEXT NOT NULL,
    payload_to_review JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_run ON approval_requests(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(project_id, status);

-- 3. WORKFLOW DECISIONS (Shared Long-Term Memory across Agents)
CREATE TABLE IF NOT EXISTS workflow_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    node_name TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_decisions_project ON workflow_decisions(project_id, created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_decisions ENABLE ROW LEVEL SECURITY;

-- Workflow Runs Policies
CREATE POLICY "Users can view workflow runs in their organizations"
    ON workflow_runs FOR SELECT
    USING (is_org_member(org_id));

CREATE POLICY "Users can create workflow runs in their organizations"
    ON workflow_runs FOR INSERT
    WITH CHECK (is_org_member(org_id));

CREATE POLICY "Users can update workflow runs in their organizations"
    ON workflow_runs FOR UPDATE
    USING (is_org_member(org_id))
    WITH CHECK (is_org_member(org_id));

CREATE POLICY "Users can delete workflow runs in their organizations"
    ON workflow_runs FOR DELETE
    USING (is_org_member(org_id));

-- Approval Requests Policies
CREATE POLICY "Users can view approval requests in their organizations"
    ON approval_requests FOR SELECT
    USING (is_org_member(org_id));

CREATE POLICY "Users can create approval requests in their organizations"
    ON approval_requests FOR INSERT
    WITH CHECK (is_org_member(org_id));

CREATE POLICY "Users can update approval requests in their organizations"
    ON approval_requests FOR UPDATE
    USING (is_org_member(org_id))
    WITH CHECK (is_org_member(org_id));

-- Workflow Decisions Policies
CREATE POLICY "Users can view workflow decisions in their organizations"
    ON workflow_decisions FOR SELECT
    USING (is_org_member(org_id));

CREATE POLICY "Users can create workflow decisions in their organizations"
    ON workflow_decisions FOR INSERT
    WITH CHECK (is_org_member(org_id));

-- Realtime Publication Enablement (safe if publication exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE workflow_runs;
        ALTER PUBLICATION supabase_realtime ADD TABLE approval_requests;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore error if table already in publication
END $$;
