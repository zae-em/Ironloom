# IRONLOOM: AI-Powered Software Engineering Operating System

> **Phase 1, 2 & 3: Backend Foundation, AI Gateway, Frontend Shell, CI Pipeline & Core SDLC Agent Backend**

IRONLOOM is an AI-powered software engineering operating system composed of collaborating specialized agents (**Business Analyst, Product Manager, Requirements Engineer, Architect, Developer, Code Reviewer, QA, DevOps, Monitoring**) with human-in-the-loop approvals at every critical gate.

Built strictly with **zero-licensing-cost, free/open-source and free-tier tools**, with a fully **provider-agnostic LLM layer**.

---

## 🏗️ Repository Architecture (pnpm Monorepo)

```
.
├── apps/
│   ├── api/                    # NestJS backend service (Modular DI architecture)
│   │   ├── src/
│   │   │   ├── ai-gateway/     # Provider-agnostic gateway, quota tracking, cost accounting
│   │   │   ├── agents/
│   │   │   │   ├── core/       # BaseAgent, ToolRegistry, versioned markdown prompt templates
│   │   │   │   └── sdlc/       # BusinessAnalyst, ProductManager, RequirementsEngineer, Architect
│   │   │   ├── rag/            # Zero-cost Ollama embedding & pgvector retrieval pipeline
│   │   │   ├── sdlc/           # REST Controller, Service, Repository & Lineage Graph
│   │   │   ├── auth/           # Supabase Auth & multi-tenant JWT guards
│   │   │   ├── users/          # User profile and membership endpoints
│   │   │   ├── organizations/  # Org creation, role-gated member management, provider keys
│   │   │   ├── projects/       # Multi-tenant project workspace management
│   │   │   ├── database/       # PostgreSQL/Supabase clients & AuditLog repository
│   │   │   ├── redis/          # Resilient Redis service with memory-fallback
│   │   │   └── rate-limiter/   # Sliding window API rate limiter
│   │   └── test/               # Jest test suites (RLS, Agents, RAG, Traceability, Gateway)
│   └── web/                    # Next.js 14 App Router frontend (Tailwind CSS, TanStack Query)
│       ├── src/
│       │   ├── app/            # App Router pages (Auth, Dashboard, Settings, Agents)
│       │   ├── components/     # AppShell, Sidebar, TopBar, Dialog, Card, Badges
│       │   └── lib/            # Supabase browser client, API client, QueryClient
│       └── e2e/                # Playwright end-to-end smoke tests
├── packages/
│   └── shared/                 # Shared TypeScript types, Zod schemas, audit event & SDLC contracts
├── infra/
│   ├── docker-compose.yml      # Local dev stack (Redis 7, Ollama, PostgreSQL 16)
│   └── migrations/
│       ├── 001_initial_schema.sql  # Users, Orgs, Members, Projects, Audit Log + RLS Policies
│       ├── 002_seed.sql            # Seed tenant data for Alpha & Beta organizations
│       └── 003_sdlc_schema.sql     # SDLC Entities (Business Cases, Epics, Stories, Criteria, Proposals, Embeddings)
├── .github/
│   └── workflows/ci.yml        # GitHub Actions CI pipeline (Lint, Typecheck, Test, Build)
├── .env.example                # Canonical environment variable template
└── pnpm-workspace.yaml         # pnpm workspace definition
```

---

## ⚡ Key Features (Phases 1–3)

### 1. Specialized SDLC Collaborating Agents (`apps/api/src/agents/sdlc`)

- **Business Analyst (BA)**: Ingests unstructured idea text and generates structured, field-by-field `BusinessCase` entities (`problemStatement`, `goals`, `targetUsers`, `successMetrics`, `assumptions`, `risks`).
- **Product Manager (PM)**: Decomposes business cases into prioritized Epics with rationale and T-shirt sizing (`XS`–`XL`).
- **Requirements Engineer**: Formulates user stories ("As a... I want... So that...") with structured Gherkin-style testable Acceptance Criteria (Given/When/Then).
- **System Architect**: Synthesizes approved requirements into versioned Architecture Proposals (`v1`, `v2`...) with modular components, tech stack justifications, entity relationships, and Mermaid diagram specs (`graph TD`).

### 2. Zero-Cost pgvector RAG Knowledge Pipeline (`apps/api/src/rag`)

- Embeds documents with local Ollama (`nomic-embed-text`, 768 dimensions, $0.00 / token).
- Automatically ingests approved business cases, user stories, and architecture proposals.
- Queries prior context scoped strictly to the active tenant (`org_id`) and project (`project_id`).

### 3. Bi-Directional Traceability Graph (`apps/api/src/sdlc`)

- **Upstream Traceability**: Query any user story to traverse upstream: `Story → Epic → Business Case → Project → Raw Idea`.
- **Downstream Traceability**: Query any business case to traverse downstream: `Business Case → Epics → Stories → Acceptance Criteria → Architecture Proposals`.

### 4. Human-in-the-Loop Review Statuses & PostgreSQL RLS

- Review workflow on all tables: `draft` → `in_review` → `approved` → `rejected`.
- Database-level isolation enforced via `is_org_member(org_id)` Row-Level Security policies.

---

## 🚀 Running Tests & Verification

```bash
# Run all backend unit, RAG, RLS, and SDLC multi-agent integration tests (30/30 tests)
pnpm test

# Run AI Gateway Multi-Provider & Failover Test Harness
pnpm gateway:test

# Build all monorepo workspaces
pnpm build
```

---

## 🗺️ Roadmap (12-Prompt Build)

- [x] **Prompt 1: Backend Foundation & AI Gateway**
- [x] **Prompt 2: Frontend Foundation & CI Pipeline**
- [x] **Prompt 3: Problem Definition & Core SDLC Agent Backend** _(Completed)_
- [ ] **Prompt 4: Product Requirements & PM Agent (Interactive Frontend UI)**
- [ ] **Prompt 5: System Architecture & Architect Agent (ADR & Schema Visualizer)**
- [ ] **Prompt 6: Task Breakdown & Estimation Engine**
- [ ] **Prompt 7: Code Generation & Developer Agent**
- [ ] **Prompt 8: Automated Code Review & Security Analysis**
- [ ] **Prompt 9: Quality Assurance & Test Generation Agent**
- [ ] **Prompt 10: DevOps, CI/CD & Deployment Agent**
- [ ] **Prompt 11: Production Monitoring & Self-Healing Agent**
- [ ] **Prompt 12: End-to-End Orchestration & Hardening**
