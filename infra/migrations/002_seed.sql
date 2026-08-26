-- ==============================================================================
-- IRONLOOM Database Migration 002: Seed Data for Multi-Tenant Dev & Testing
-- ==============================================================================

-- Static UUIDs for deterministic testing
-- User 1 (Alice - Org Alpha Owner)
-- User 2 (Bob - Org Alpha Member)
-- User 3 (Charlie - Org Beta Owner)
-- Org Alpha (Acme Corp)
-- Org Beta (Cyberdyne Systems)

DO $$
DECLARE
  v_user_alice UUID := '11111111-1111-1111-1111-111111111111';
  v_user_bob   UUID := '22222222-2222-2222-2222-222222222222';
  v_user_charlie UUID := '33333333-3333-3333-3333-333333333333';
  v_org_alpha  UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_org_beta   UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_proj_alpha UUID := 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
  v_proj_beta  UUID := 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1';
BEGIN
  -- Insert Users
  INSERT INTO public.users (id, email, name)
  VALUES
    (v_user_alice, 'alice@alpha.io', 'Alice Engineer'),
    (v_user_bob, 'bob@alpha.io', 'Bob Developer'),
    (v_user_charlie, 'charlie@beta.io', 'Charlie Founder')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name;

  -- Insert Organizations
  INSERT INTO public.organizations (id, name, slug)
  VALUES
    (v_org_alpha, 'Alpha Robotics', 'alpha-robotics'),
    (v_org_beta, 'Beta Labs', 'beta-labs')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

  -- Insert Organization Members
  INSERT INTO public.organization_members (user_id, org_id, role)
  VALUES
    (v_user_alice, v_org_alpha, 'owner'),
    (v_user_bob, v_org_alpha, 'member'),
    (v_user_charlie, v_org_beta, 'owner')
  ON CONFLICT (user_id, org_id) DO UPDATE SET
    role = EXCLUDED.role;

  -- Insert Projects
  INSERT INTO public.projects (id, org_id, name, description, status)
  VALUES
    (v_proj_alpha, v_org_alpha, 'Autonomous Drone Navigation', 'Next-gen vision guidance software', 'active'),
    (v_proj_beta, v_org_beta, 'Neural Core V2', 'Edge neural processor firmware', 'active')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

  -- Insert Initial Audit Logs
  INSERT INTO public.audit_log (
    org_id,
    project_id,
    actor_type,
    actor_id,
    action,
    input,
    output,
    model,
    provider,
    cost_usd,
    latency_ms,
    status
  )
  VALUES
    (
      v_org_alpha,
      v_proj_alpha,
      'user',
      v_user_alice::text,
      'project.created',
      '{"projectName": "Autonomous Drone Navigation"}'::jsonb,
      '{"status": "initialized"}'::jsonb,
      NULL,
      NULL,
      0.000000,
      12,
      'success'
    ),
    (
      v_org_alpha,
      v_proj_alpha,
      'agent',
      'agent_architect_01',
      'architecture.draft',
      '{"task": "Design modular pipeline"}'::jsonb,
      '{"components": ["vision", "telemetry", "planner"]}'::jsonb,
      'llama3.1',
      'ollama',
      0.000000,
      1240,
      'success'
    ),
    (
      v_org_beta,
      v_proj_beta,
      'user',
      v_user_charlie::text,
      'project.created',
      '{"projectName": "Neural Core V2"}'::jsonb,
      '{"status": "initialized"}'::jsonb,
      NULL,
      NULL,
      0.000000,
      15,
      'success'
    );
END $$;
