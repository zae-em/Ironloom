import { test, expect } from '@playwright/test';

test.describe('IRONLOOM OS Core SDLC & Workspace Smoke Tests (Prompts 1–4)', () => {
  test('should load login page and sign in to workspace dashboard', async ({ page }) => {
    // 1. Visit Login
    await page.goto('/login');
    await expect(page.locator('text=IRONLOOM OS')).toBeVisible();

    // 2. Fill login form
    await page.fill('input[type="email"]', 'alice@alpha.io');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 3. Verify landing on Dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=Autonomous Drone Navigation')).toBeVisible();
    await expect(page.locator('text=Requirement Coverage')).toBeVisible();
    await expect(page.locator('text=Backlog Breakdown')).toBeVisible();
  });

  test('should navigate to Core SDLC Requirements workspace and open Idea Submission Modal', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'alice@alpha.io');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);

    // Navigate to Requirements workspace
    await page.goto('/requirements');
    await expect(page.locator('text=Core SDLC Requirements')).toBeVisible();
    await expect(page.locator('text=Requirements Breakdown Tree')).toBeVisible();

    // Click Submit New Idea button
    const submitIdeaBtn = page.locator('button:has-text("Submit New Idea")');
    await expect(submitIdeaBtn).toBeVisible();
    await submitIdeaBtn.click();

    // Assert Idea Submission Dialog is open
    await expect(page.locator('text=Business Analyst Agent')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('button:has-text("Analyze with BA Agent")')).toBeVisible();

    // Fill sample idea
    await page.fill(
      'textarea',
      'Build a real-time collision avoidance telemetry stream under 100ms budget.',
    );
  });

  test('should view Engineering Tasks Kanban board and interact with columns', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'alice@alpha.io');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);

    // Navigate to Tasks
    await page.goto('/tasks');
    await expect(page.locator('text=Engineering Tasks & Sprint Execution')).toBeVisible();
    await expect(page.locator('text=Backlog')).toBeVisible();
    await expect(page.locator('text=In Progress')).toBeVisible();
    await expect(page.locator('text=Review / QA')).toBeVisible();
    await expect(page.locator('text=Done')).toBeVisible();

    // Click Create Task
    const createBtn = page.locator('button:has-text("Create Task")');
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await expect(page.locator('text=Create SDLC Task')).toBeVisible();
  });

  test('should view Specialized AI Agent roster and open LLM routing configuration', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'alice@alpha.io');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);

    // Navigate to Agents
    await page.goto('/agents');
    await expect(page.locator('text=Specialized AI Agent Roster & LLM Routing')).toBeVisible();
    await expect(page.locator('text=Business Analyst Agent')).toBeVisible();
    await expect(page.locator('text=System Architect Agent')).toBeVisible();

    // Click Configure on first agent
    const configBtn = page.locator('button:has-text("Configure")').first();
    await configBtn.click();
    await expect(page.locator('text=Per-Agent LLM Routing')).toBeVisible();
    await expect(page.locator('text=Ollama (Local)')).toBeVisible();
    await expect(page.locator('text=Groq Cloud')).toBeVisible();
  });

  test('should navigate to AI provider settings and display Ollama & Groq telemetry', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'alice@alpha.io');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);

    // Navigate to AI Providers
    await page.goto('/settings/providers');
    await expect(page.locator('text=AI Gateway & LLM Providers')).toBeVisible();
    await expect(page.locator('text=Ollama (Local LLM)')).toBeVisible();
    await expect(page.locator('text=Groq (Hosted Free Tier)')).toBeVisible();
  });

  test('should navigate to Autonomous Engineering Hub and inspect PR diff, QA suite, and sandbox telemetry', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'alice@alpha.io');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);

    // Navigate to Engineering Hub
    await page.goto('/engineering');
    await expect(page.locator('text=Autonomous Engineering Hub')).toBeVisible();
    await expect(page.locator('text=Code Workspace & PRs')).toBeVisible();
    await expect(page.locator('text=Agent-Authored Pull Requests')).toBeVisible();

    // Verify Diff Viewer is rendered with PR details
    await expect(page.locator('text=PR #101')).toBeVisible();
    await expect(page.locator('text=Traceability: Implements User Story')).toBeVisible();
    await expect(page.locator('text=Changed Files')).toBeVisible();

    // Switch to Testing & QA Suite tab
    await page.click('button:has-text("Testing & QA Suite")');
    await expect(page.locator('text=Automated QA & Test Execution Suite')).toBeVisible();
    await expect(page.locator('text=Coverage Trend Over PR Implementations')).toBeVisible();
    await expect(page.locator('text=Sandbox Test Logs')).toBeVisible();

    // Switch to Sandbox Audit tab
    await page.click('button:has-text("Sandbox Audit")');
    await expect(page.locator('text=Zero-Trust Sandbox Execution Audit Log')).toBeVisible();
    await expect(page.locator('text=Egress Isolated')).toBeVisible();
    await expect(page.locator('text=Recent Sandbox Tasks')).toBeVisible();
  });
});
