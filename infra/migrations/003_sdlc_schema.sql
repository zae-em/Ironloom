-- ==============================================================================
-- IRONLOOM Database Migration 003: Core SDLC Entities, Versioning & pgvector RAG
-- ==============================================================================

-- Try enabling pgvector extension (graceful fallback if unsupported by standard base image)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not installed in environment, using JSON vector storage fallback';
END $$;

-- 1. BUSINESS CASES TABLE
CREATE TABLE IF NOT EXISTS public.business_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  raw_idea TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_users JSONB NOT NULL DEFAULT '[]'::jsonb,
  success_metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'rejected')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. EPICS TABLE
CREATE TABLE IF NOT EXISTS public.epics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  business_case_id UUID NOT NULL REFERENCES public.business_cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  sizing TEXT NOT NULL DEFAULT 'M' CHECK (sizing IN ('XS', 'S', 'M', 'L', 'XL')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. USER STORIES TABLE
CREATE TABLE IF NOT EXISTS public.user_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  as_a TEXT NOT NULL,
  i_want TEXT NOT NULL,
  so_that TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ACCEPTANCE CRITERIA TABLE (Gherkin Scenarios)
CREATE TABLE IF NOT EXISTS public.acceptance_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_story_id UUID NOT NULL REFERENCES public.user_stories(id) ON DELETE CASCADE,
  scenario_title TEXT NOT NULL,
  given_text TEXT NOT NULL,
  when_text TEXT NOT NULL,
  then_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ARCHITECTURE PROPOSALS TABLE (Versioned: v1, v2...)
CREATE TABLE IF NOT EXISTS public.architecture_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  tech_stack JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_model JSONB NOT NULL DEFAULT '{}'::jsonb,
  diagram_mermaid TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. DOCUMENT EMBEDDINGS (RAG Knowledge Store)
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for foreign key lookup and status filtering
CREATE INDEX IF NOT EXISTS idx_business_cases_project ON public.business_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_business_cases_status ON public.business_cases(status);
CREATE INDEX IF NOT EXISTS idx_epics_business_case ON public.epics(business_case_id);
CREATE INDEX IF NOT EXISTS idx_epics_project ON public.epics(project_id);
CREATE INDEX IF NOT EXISTS idx_user_stories_epic ON public.user_stories(epic_id);
CREATE INDEX IF NOT EXISTS idx_user_stories_project ON public.user_stories(project_id);
CREATE INDEX IF NOT EXISTS idx_acceptance_criteria_story ON public.acceptance_criteria(user_story_id);
CREATE INDEX IF NOT EXISTS idx_architecture_proposals_project ON public.architecture_proposals(project_id, version);
CREATE INDEX IF NOT EXISTS idx_embeddings_project_type ON public.document_embeddings(project_id, document_type);

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR SDLC TABLES
-- ==============================================================================

ALTER TABLE public.business_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acceptance_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.architecture_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- 1. Business Cases Policies
CREATE POLICY business_cases_select ON public.business_cases
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY business_cases_insert ON public.business_cases
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY business_cases_update ON public.business_cases
  FOR UPDATE USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

CREATE POLICY business_cases_delete ON public.business_cases
  FOR DELETE USING (public.is_org_member(org_id));

-- 2. Epics Policies
CREATE POLICY epics_select ON public.epics
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY epics_insert ON public.epics
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY epics_update ON public.epics
  FOR UPDATE USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

CREATE POLICY epics_delete ON public.epics
  FOR DELETE USING (public.is_org_member(org_id));

-- 3. User Stories Policies
CREATE POLICY user_stories_select ON public.user_stories
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY user_stories_insert ON public.user_stories
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY user_stories_update ON public.user_stories
  FOR UPDATE USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

CREATE POLICY user_stories_delete ON public.user_stories
  FOR DELETE USING (public.is_org_member(org_id));

-- 4. Acceptance Criteria Policies
CREATE POLICY acceptance_criteria_select ON public.acceptance_criteria
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY acceptance_criteria_insert ON public.acceptance_criteria
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY acceptance_criteria_update ON public.acceptance_criteria
  FOR UPDATE USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

CREATE POLICY acceptance_criteria_delete ON public.acceptance_criteria
  FOR DELETE USING (public.is_org_member(org_id));

-- 5. Architecture Proposals Policies
CREATE POLICY architecture_proposals_select ON public.architecture_proposals
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY architecture_proposals_insert ON public.architecture_proposals
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY architecture_proposals_update ON public.architecture_proposals
  FOR UPDATE USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

CREATE POLICY architecture_proposals_delete ON public.architecture_proposals
  FOR DELETE USING (public.is_org_member(org_id));

-- 6. Document Embeddings (RAG) Policies
CREATE POLICY document_embeddings_select ON public.document_embeddings
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY document_embeddings_insert ON public.document_embeddings
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY document_embeddings_delete ON public.document_embeddings
  FOR DELETE USING (public.is_org_member(org_id));
