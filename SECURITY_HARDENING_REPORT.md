# IRONLOOM Production Hardening & Security Audit Report (Prompt 11 of 12)

**Date**: 2026-08-28  
**Platform**: IRONLOOM Autonomous Engineering Platform (ForgeOS)  
**Scope**: Sandbox Isolation, MCP Permission Scoping, Secret Redaction, Multi-Tenant RLS, Cost & Budget Caps, HITL Invariant Verification, and Evaluation Expansion.

---

## 1. Security Hardening Audit & Adversarial Testing Matrix

| Security Domain                    | Test / Invariant Checked                                                                                                         | Status   | Result / Mitigation                                                                                                                                                                  |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sandbox Network Egress**         | Deliberate outbound exfiltration (`curl`, socket connections) with `networkPolicy: 'none'`                                       | **PASS** | Blocked by sandbox firewall; zero egress bytes emitted.                                                                                                                              |
| **Sandbox Memory Bomb**            | Unlimited memory allocation attempt inside sandbox worker                                                                        | **PASS** | Terminated with SIGKILL (Exit code 137) upon exceeding cgroup limit.                                                                                                                 |
| **Sandbox Execution Timeout**      | Hanging process execution beyond specified task `timeoutMs`                                                                      | **PASS** | Terminated with SIGKILL (Exit code 124) upon hitting deadline.                                                                                                                       |
| **Host Secret Leaks**              | Attempt to inspect ambient environment variables from child process                                                              | **PASS** | Child environment strictly whitelisted (`PATH`, `NODE_ENV: sandbox`, `HOME`, `TMPDIR`). Host credentials (`GROQ_API_KEY`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) never passed. |
| **MCP Scoped Tool Permissions**    | Out-of-scope tool invocation (e.g. Business Analyst calling `github_create_pull_request` or Monitoring calling `figma_get_file`) | **PASS** | Rejected at execution time with `ForbiddenException`.                                                                                                                                |
| **Secret Redaction in Audit Logs** | Automatic redaction of API keys (`gsk_...`, `sk-...`, `ghp_...`), DB connection URIs, passwords, and JWTs in persistence layers  | **PASS** | All persisted records sanitized via `sanitizeSecrets` before writing to database or logs.                                                                                            |
| **Multi-Tenant Cross-Org RLS**     | Cross-tenant data isolation across all SDLC entities, Incidents, Policies, Workflow Runs, and Approvals                          | **PASS** | Verified across all repositories.                                                                                                                                                    |
| **Transactional Email Delivery**   | Organization member invitation dispatch                                                                                          | **PASS** | `TransactionalEmailService` active with HTML templates and zero-cost pluggable transport.                                                                                            |

---

## 2. Cost Control & Spend Cap Invariants

1. **Configurable Spend Caps**:
   - Project-level caps (default: `$10.00/mo`) and Organization-level caps (default: `$50.00/mo`).
2. **Early-Warning Thresholds**:
   - Triggers warning alerts at 80% utilization.
3. **100% Hard-Stop Invariant**:
   - When 100% cap is hit, all paid hosted LLM calls are blocked and redirected to local Ollama ($0.00/token) fallback, ensuring zero accidental billing overages while allowing engineering workflows to proceed locally.
   - Admin override parameter (`adminOverride: true`) allows authorized bypass.
4. **Cost Optimization Engine**:
   - Heuristics identify high-volume agents (e.g., DevOps manifest iteration) using hosted models and recommend zero-cost local LLMs.

---

## 3. Human-in-the-Loop (HITL) Safety Invariants

- **Invariant 1**: No production deployment, rollback, or PR merge can proceed without an `approval_request` record marked `approved` or a matching, enabled `approval_policy`.
- **Invariant 2**: Production auto-approval is strictly prohibited if unresolved active incidents exist or error rate telemetry exceeds threshold.
- **Invariant 3**: Staging promotions are blocked if automated sandbox smoke tests fail.

---

## 4. Secret Storage & Rotation Procedure

### Secret Hierarchy

- **API Keys & Tokens**: Loaded from OS environment or encrypted database storage.
- **Child Sandbox Boundaries**: Never receive ambient host environment variables.
- **Audit Logs**: Filtered through `sanitizeSecrets` regex pattern matcher.

### Manual / Automated Rotation Procedure

1. **Groq / OpenAI API Keys**:
   - Generate a new key in provider console.
   - Update `GROQ_API_KEY` in `apps/api/.env` or via `PUT /api/v1/organizations/:id/provider-settings`.
   - Revoke previous key in provider console.
2. **GitHub Personal Access Tokens (MCP Connector)**:
   - Generate new fine-grained GitHub PAT with repository permissions.
   - Update `GITHUB_TOKEN` in backend environment.
   - Revoke old token on GitHub.
3. **Database / Supabase Service Role Keys**:
   - Generate replacement key in Supabase Dashboard $\to$ Settings $\to$ API.
   - Update `SUPABASE_SERVICE_ROLE_KEY` and restart API server.

---

## 5. Automated Regression Test Results

- `sandbox-security-hardening.spec.ts`: **4/4 PASS**
- `mcp-scoped-permissions.spec.ts`: **4/4 PASS**
- `secret-redaction.spec.ts`: **3/3 PASS**
- `comprehensive-cross-org-rls.spec.ts`: **4/4 PASS**
- `cost-budget-controls.spec.ts`: **5/5 PASS**
- `hitl-integrity-invariants.spec.ts`: **4/4 PASS**
- `audit-export-alerting.spec.ts`: **3/3 PASS**
- `eval-runner.ts` (9-Agent Benchmark Harness): **100% PASS**
