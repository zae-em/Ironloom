-- ==============================================================================
-- IRONLOOM Database Migration 001: Initial Schema & Row-Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create auth schema if not existing (for compatibility with standalone Postgres & Supabase)
CREATE SCHEMA IF NOT EXISTS auth;

-- Helper function to extract auth.uid() safely across Supabase & custom Postgres sessions
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid,
    NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 1. USERS TABLE (Mirrors Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ORGANIZATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, org_id)
);

-- 4. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agent')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  input JSONB DEFAULT '{}'::jsonb,
  output JSONB DEFAULT '{}'::jsonb,
  model TEXT,
  provider TEXT,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'pending', 'fallback')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON public.audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_project_id ON public.audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Trigger to sync auth.users into public.users if auth.users exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $user_sync$
    BEGIN
      INSERT INTO public.users (id, email, name, avatar_url)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        updated_at = NOW();
      RETURN NEW;
    END;
    $user_sync$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Helper security function to check if auth.uid() belongs to org_id
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = target_org_id
      AND om.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1. USERS POLICIES
-- Users can view their own profile and profiles of members in their organizations
CREATE POLICY users_select_policy ON public.users
  FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members my_om
      JOIN public.organization_members target_om ON my_om.org_id = target_om.org_id
      WHERE my_om.user_id = auth.uid() AND target_om.user_id = public.users.id
    )
  );

-- Users can only update their own profile
CREATE POLICY users_update_policy ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow user insertion during signup
CREATE POLICY users_insert_policy ON public.users
  FOR INSERT
  WITH CHECK (id = auth.uid() OR auth.uid() IS NULL);

-- 2. ORGANIZATIONS POLICIES
-- Members can view organizations they belong to
CREATE POLICY orgs_select_policy ON public.organizations
  FOR SELECT
  USING (public.is_org_member(id));

-- Owners and Admins can update their organizations
CREATE POLICY orgs_update_policy ON public.organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id = public.organizations.id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Authenticated users can create new organizations
CREATE POLICY orgs_insert_policy ON public.organizations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. ORGANIZATION MEMBERS POLICIES
-- Members can view members of their organization
CREATE POLICY org_members_select_policy ON public.organization_members
  FOR SELECT
  USING (public.is_org_member(org_id));

-- Admins and owners can manage members
CREATE POLICY org_members_insert_policy ON public.organization_members
  FOR INSERT
  WITH CHECK (
    -- Initial creator adding themselves as owner or admin adding member
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id = public.organization_members.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY org_members_update_policy ON public.organization_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id = public.organization_members.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY org_members_delete_policy ON public.organization_members
  FOR DELETE
  USING (
    user_id = auth.uid() -- Can leave org
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id = public.organization_members.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- 4. PROJECTS POLICIES
-- Members can view projects in their organization
CREATE POLICY projects_select_policy ON public.projects
  FOR SELECT
  USING (public.is_org_member(org_id));

-- Members can insert projects into their organization
CREATE POLICY projects_insert_policy ON public.projects
  FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

-- Members can update projects in their organization
CREATE POLICY projects_update_policy ON public.projects
  FOR UPDATE
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

-- Admins / Owners can delete projects
CREATE POLICY projects_delete_policy ON public.projects
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id = public.projects.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- 5. AUDIT LOG POLICIES
-- Members can view audit logs for their organization
CREATE POLICY audit_log_select_policy ON public.audit_log
  FOR SELECT
  USING (public.is_org_member(org_id));

-- Users or agents operating in the org can insert audit log records
CREATE POLICY audit_log_insert_policy ON public.audit_log
  FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

-- Audit logs are immutable (no updates or deletes allowed by regular users)
-- No UPDATE or DELETE policy granted to public roles
