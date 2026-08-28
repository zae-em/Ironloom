import { CostBudgetService } from '../src/ai-gateway/cost-budget.service';

describe('Cost Control & Budget Cap Invariant Suite (Prompt 11)', () => {
  let budgetService: CostBudgetService;
  const ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const PROJ_ID = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    budgetService = new CostBudgetService();
    budgetService.reset();
  });

  it('1. should allow requests within monthly spend cap', async () => {
    budgetService.updateOrgBudget(ORG_ID, {
      monthlySpendCapUsd: 10.0,
      hardStopEnabled: true,
      alertThresholdPercent: 80,
    });

    const check = await budgetService.preflightCheck({
      orgId: ORG_ID,
      projectId: PROJ_ID,
      requestedProvider: 'groq',
    });

    expect(check.allowed).toBe(true);
    expect(check.isBudgetExceeded).toBe(false);
    expect(check.isAlertTriggered).toBe(false);
  });

  it('2. should trigger warning alert when spend exceeds 80% threshold', async () => {
    budgetService.updateOrgBudget(ORG_ID, {
      monthlySpendCapUsd: 10.0,
      alertThresholdPercent: 80,
    });

    // Record $8.50 spend (85% of $10.00)
    await budgetService.recordSpend({
      orgId: ORG_ID,
      projectId: PROJ_ID,
      agentId: 'architect',
      provider: 'groq',
      costUsd: 8.5,
    });

    const check = await budgetService.preflightCheck({
      orgId: ORG_ID,
      projectId: PROJ_ID,
      requestedProvider: 'groq',
    });

    expect(check.allowed).toBe(true);
    expect(check.isAlertTriggered).toBe(true);
    expect(check.isBudgetExceeded).toBe(false);
  });

  it('3. should enforce hard stop at 100% budget and force local Ollama zero-cost fallback', async () => {
    budgetService.updateProjectBudget(PROJ_ID, ORG_ID, {
      monthlySpendCapUsd: 5.0,
      hardStopEnabled: true,
    });

    // Record $5.50 spend
    await budgetService.recordSpend({
      orgId: ORG_ID,
      projectId: PROJ_ID,
      agentId: 'developer',
      provider: 'groq',
      costUsd: 5.5,
    });

    const check = await budgetService.preflightCheck({
      orgId: ORG_ID,
      projectId: PROJ_ID,
      requestedProvider: 'groq',
    });

    // Hard stop redirects to zero-cost local Ollama
    expect(check.isBudgetExceeded).toBe(true);
    expect(check.forcedProvider).toBe('ollama');
    expect(check.reason).toContain('budget cap');
  });

  it('4. should bypass hard stop when adminOverride is explicitly enabled', async () => {
    budgetService.updateOrgBudget(ORG_ID, {
      monthlySpendCapUsd: 5.0,
      hardStopEnabled: true,
    });

    await budgetService.recordSpend({
      orgId: ORG_ID,
      provider: 'groq',
      costUsd: 10.0,
    });

    const check = await budgetService.preflightCheck({
      orgId: ORG_ID,
      requestedProvider: 'groq',
      adminOverride: true,
    });

    expect(check.forcedProvider).toBeUndefined();
    expect(check.allowed).toBe(true);
  });

  it('5. should compute cost optimization recommendations for high-volume agents', async () => {
    await budgetService.recordSpend({
      orgId: ORG_ID,
      agentId: 'devops',
      provider: 'groq',
      costUsd: 3.5,
    });

    const analytics = budgetService.getCostAnalytics(ORG_ID);

    expect(analytics.recommendations.length).toBeGreaterThan(0);
    expect(analytics.recommendations[0].agentId).toBe('devops');
    expect(analytics.recommendations[0].recommendedProvider).toContain('ollama');
  });
});
