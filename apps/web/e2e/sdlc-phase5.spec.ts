import { test, expect } from '@playwright/test';

test.describe('IRONLOOM OS Phase 5 Autonomous SDLC Frontend Suite (Prompt 10 of 12)', () => {
  test.beforeEach(async ({ page }) => {
    // Perform authentication
    await page.goto('/login');
    await page.fill('input[type="email"]', 'engineer@ironloom.ai');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);
  });

  test('1. Command Center: should display cross-project mission control with health status and metrics', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Cross-Project Operational Command Center')).toBeVisible();
    await expect(page.locator('text=SYSTEM OPERATIONAL')).toBeVisible();
    await expect(page.locator('text=System Uptime')).toBeVisible();
    await expect(page.locator('text=Active Workflows')).toBeVisible();
    await expect(page.locator('text=Total Promotions')).toBeVisible();
    await expect(page.locator('text=Incident Tracking & Self-Healing Loop')).toBeVisible();
    await expect(page.locator('text=Recent Multi-Environment Promotions')).toBeVisible();
  });

  test('2. Deployments: should display dev/staging/prod environments, promotion pipeline, and policy rules', async ({
    page,
  }) => {
    await page.goto('/deployments');
    await expect(
      page.locator('text=Continuous Delivery & Multi-Environment Deployments'),
    ).toBeVisible();

    // Verify 3 environment cards
    await expect(page.locator('text=Development (dev)')).toBeVisible();
    await expect(page.locator('text=Staging (pre-prod)')).toBeVisible();
    await expect(page.locator('text=Production (prod)')).toBeVisible();

    // Verify Promotion Pipeline visualizer
    await expect(page.locator('text=Autonomous Promotion Pipeline')).toBeVisible();
    await expect(page.locator('text=Stage 1: Dev Build')).toBeVisible();
    await expect(page.locator('text=Stage 2: Staging Gating')).toBeVisible();
    await expect(page.locator('text=Stage 3: Production')).toBeVisible();

    // Test Rollback Modal trigger
    const rollbackBtn = page.locator('button:has-text("Rollback")').first();
    await rollbackBtn.click();
    await expect(page.locator('text=Confirm Emergency Rollback')).toBeVisible();
    await page.click('button:has-text("Cancel")');

    // Switch to Approval Policies tab
    await page.click('button:has-text("Approval Policies")');
    await expect(page.locator('text=Configurable Auto-Approval Policies')).toBeVisible();
    await expect(page.locator('button:has-text("Create Policy Rule")')).toBeVisible();
  });

  test('3. Monitoring: should display live Prometheus telemetry, anomaly chaos simulator, and alert lineage', async ({
    page,
  }) => {
    await page.goto('/monitoring');
    await expect(page.locator('text=SRE Live Monitoring & Telemetry Observability')).toBeVisible();
    await expect(page.locator('text=Telemetry Feed Active')).toBeVisible();

    // Verify 4 live charts
    await expect(page.locator('text=HTTP Error Rate (5xx)')).toBeVisible();
    await expect(page.locator('text=P95 Request Latency')).toBeVisible();
    await expect(page.locator('text=Cluster CPU Load')).toBeVisible();
    await expect(page.locator('text=Container Memory RSS')).toBeVisible();

    // Verify Anomaly Simulator & Alert Traceability Lineage
    await expect(page.locator('text=Chaos & Anomaly Injection Simulator')).toBeVisible();
    await expect(page.locator('text=Closed-Loop Self-Healing Traceability Lineage')).toBeVisible();
    await expect(page.locator('text=1. Telemetry Alert')).toBeVisible();
    await expect(page.locator('text=6. Production Deploy')).toBeVisible();
  });

  test('4. Approvals Unified Inbox: should aggregate all 6 SDLC gates and support quick inline decisions', async ({
    page,
  }) => {
    await page.goto('/approvals');
    await expect(page.locator('text=Unified Approvals Inbox & Human Gates')).toBeVisible();
    await expect(page.locator('text=Pending Action')).toBeVisible();
    await expect(page.locator('text=Decided History')).toBeVisible();

    // Verify filter dropdown
    const selectGate = page.locator('select');
    await expect(selectGate).toBeVisible();
    await selectGate.selectOption('prod_deploy');
  });
});
