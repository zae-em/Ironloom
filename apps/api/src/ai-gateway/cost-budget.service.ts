import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { AiProviderName } from '@ironloom/shared';

export interface BudgetConfig {
  id: string;
  orgId: string;
  projectId?: string | null;
  monthlySpendCapUsd: number;
  currentSpendUsd: number;
  alertThresholdPercent: number; // default 80%
  hardStopEnabled: boolean; // default true
  lastAlertSentAt?: string | null;
  updatedAt: string;
}

export interface BudgetPreflightResult {
  allowed: boolean;
  isBudgetExceeded: boolean;
  isAlertTriggered: boolean;
  forcedProvider?: AiProviderName;
  reason?: string;
}

export interface CostRecommendation {
  agentId: string;
  currentProvider: string;
  recommendedProvider: string;
  estimatedMonthlySavingsUsd: number;
  rationale: string;
}

@Injectable()
export class CostBudgetService {
  private readonly logger = new Logger(CostBudgetService.name);

  // In-memory budget stores
  private readonly orgBudgets = new Map<string, BudgetConfig>();
  private readonly projectBudgets = new Map<string, BudgetConfig>();
  private readonly agentSpendMap = new Map<string, number>();
  private readonly providerSpendMap = new Map<string, number>();

  constructor() {}

  /**
   * Preflight verification before executing an LLM completion.
   */
  async preflightCheck(params: {
    orgId: string;
    projectId?: string | null;
    requestedProvider: AiProviderName;
    adminOverride?: boolean;
  }): Promise<BudgetPreflightResult> {
    const orgBudget = this.getOrCreateOrgBudget(params.orgId);
    const projectBudget = params.projectId
      ? this.getOrCreateProjectBudget(params.projectId, params.orgId)
      : null;

    // Check Project Budget
    if (projectBudget && projectBudget.currentSpendUsd >= projectBudget.monthlySpendCapUsd) {
      if (projectBudget.hardStopEnabled && !params.adminOverride) {
        // If provider is already free local Ollama, allow it to proceed
        if (params.requestedProvider === 'ollama' || params.requestedProvider === 'mock') {
          return {
            allowed: true,
            isBudgetExceeded: true,
            isAlertTriggered: true,
            forcedProvider: 'ollama',
            reason: `Project budget of $${projectBudget.monthlySpendCapUsd.toFixed(2)} exceeded. Routed to zero-cost local Ollama.`,
          };
        }

        this.logger.warn(
          `[BUDGET HARD STOP] Project ${params.projectId} exceeded monthly cap ($${projectBudget.currentSpendUsd.toFixed(2)} / $${projectBudget.monthlySpendCapUsd.toFixed(2)}). Forcing local Ollama ($0.00/token).`,
        );

        return {
          allowed: true,
          isBudgetExceeded: true,
          isAlertTriggered: true,
          forcedProvider: 'ollama',
          reason: `Project budget cap ($${projectBudget.monthlySpendCapUsd.toFixed(2)}) reached. Forced fallback to local Ollama.`,
        };
      }
    }

    // Check Org Budget
    if (orgBudget.currentSpendUsd >= orgBudget.monthlySpendCapUsd) {
      if (orgBudget.hardStopEnabled && !params.adminOverride) {
        if (params.requestedProvider === 'ollama' || params.requestedProvider === 'mock') {
          return {
            allowed: true,
            isBudgetExceeded: true,
            isAlertTriggered: true,
            forcedProvider: 'ollama',
            reason: `Organization budget exceeded. Allowed on zero-cost local Ollama.`,
          };
        }

        this.logger.warn(
          `[BUDGET HARD STOP] Org ${params.orgId} exceeded monthly cap ($${orgBudget.currentSpendUsd.toFixed(2)} / $${orgBudget.monthlySpendCapUsd.toFixed(2)}). Forcing local Ollama.`,
        );

        return {
          allowed: true,
          isBudgetExceeded: true,
          isAlertTriggered: true,
          forcedProvider: 'ollama',
          reason: `Organization budget cap ($${orgBudget.monthlySpendCapUsd.toFixed(2)}) reached. Forced fallback to local Ollama.`,
        };
      }
    }

    // Check Alert Thresholds (80%)
    const isOrgAlert =
      orgBudget.currentSpendUsd >=
      (orgBudget.monthlySpendCapUsd * orgBudget.alertThresholdPercent) / 100;

    const isProjectAlert =
      projectBudget &&
      projectBudget.currentSpendUsd >=
        (projectBudget.monthlySpendCapUsd * projectBudget.alertThresholdPercent) / 100;

    return {
      allowed: true,
      isBudgetExceeded: false,
      isAlertTriggered: Boolean(isOrgAlert || isProjectAlert),
    };
  }

  /**
   * Record spend after successful completion.
   */
  async recordSpend(params: {
    orgId: string;
    projectId?: string | null;
    agentId?: string | null;
    provider: string;
    costUsd: number;
  }): Promise<void> {
    if (params.costUsd <= 0) return;

    // 1. Update Org Budget
    const orgBudget = this.getOrCreateOrgBudget(params.orgId);
    orgBudget.currentSpendUsd = Number((orgBudget.currentSpendUsd + params.costUsd).toFixed(5));
    orgBudget.updatedAt = new Date().toISOString();

    // 2. Update Project Budget
    if (params.projectId) {
      const projectBudget = this.getOrCreateProjectBudget(params.projectId, params.orgId);
      projectBudget.currentSpendUsd = Number(
        (projectBudget.currentSpendUsd + params.costUsd).toFixed(5),
      );
      projectBudget.updatedAt = new Date().toISOString();
    }

    // 3. Track Agent & Provider Spend Breakdown
    if (params.agentId) {
      const current = this.agentSpendMap.get(params.agentId) || 0;
      this.agentSpendMap.set(params.agentId, Number((current + params.costUsd).toFixed(5)));
    }

    const currentProviderSpend = this.providerSpendMap.get(params.provider) || 0;
    this.providerSpendMap.set(
      params.provider,
      Number((currentProviderSpend + params.costUsd).toFixed(5)),
    );
  }

  getOrCreateOrgBudget(orgId: string): BudgetConfig {
    let budget = this.orgBudgets.get(orgId);
    if (!budget) {
      budget = {
        id: `budget-org-${orgId}`,
        orgId,
        projectId: null,
        monthlySpendCapUsd: 50.0, // Default $50/mo per org
        currentSpendUsd: 0.0,
        alertThresholdPercent: 80,
        hardStopEnabled: true,
        updatedAt: new Date().toISOString(),
      };
      this.orgBudgets.set(orgId, budget);
    }
    return budget;
  }

  getOrCreateProjectBudget(projectId: string, orgId: string): BudgetConfig {
    let budget = this.projectBudgets.get(projectId);
    if (!budget) {
      budget = {
        id: `budget-proj-${projectId}`,
        orgId,
        projectId,
        monthlySpendCapUsd: 10.0, // Default $10/mo per project
        currentSpendUsd: 0.0,
        alertThresholdPercent: 80,
        hardStopEnabled: true,
        updatedAt: new Date().toISOString(),
      };
      this.projectBudgets.set(projectId, budget);
    }
    return budget;
  }

  updateProjectBudget(
    projectId: string,
    orgId: string,
    updates: Partial<Omit<BudgetConfig, 'id' | 'orgId' | 'projectId'>>,
  ): BudgetConfig {
    const budget = this.getOrCreateProjectBudget(projectId, orgId);
    if (updates.monthlySpendCapUsd !== undefined)
      budget.monthlySpendCapUsd = updates.monthlySpendCapUsd;
    if (updates.alertThresholdPercent !== undefined)
      budget.alertThresholdPercent = updates.alertThresholdPercent;
    if (updates.hardStopEnabled !== undefined) budget.hardStopEnabled = updates.hardStopEnabled;
    budget.updatedAt = new Date().toISOString();
    return budget;
  }

  updateOrgBudget(
    orgId: string,
    updates: Partial<Omit<BudgetConfig, 'id' | 'orgId' | 'projectId'>>,
  ): BudgetConfig {
    const budget = this.getOrCreateOrgBudget(orgId);
    if (updates.monthlySpendCapUsd !== undefined)
      budget.monthlySpendCapUsd = updates.monthlySpendCapUsd;
    if (updates.alertThresholdPercent !== undefined)
      budget.alertThresholdPercent = updates.alertThresholdPercent;
    if (updates.hardStopEnabled !== undefined) budget.hardStopEnabled = updates.hardStopEnabled;
    budget.updatedAt = new Date().toISOString();
    return budget;
  }

  getCostAnalytics(orgId: string) {
    const orgBudget = this.getOrCreateOrgBudget(orgId);
    const recommendations: CostRecommendation[] = [];

    // Analyze if high-volume agents are using hosted providers
    const devopsSpend = this.agentSpendMap.get('devops') || 0;
    if (devopsSpend > 1.0) {
      recommendations.push({
        agentId: 'devops',
        currentProvider: 'groq/hosted',
        recommendedProvider: 'ollama/llama3-8b (local)',
        estimatedMonthlySavingsUsd: Number((devopsSpend * 0.85).toFixed(2)),
        rationale:
          'DevOps agent manifest generation runs high iteration loops. Routing to local Ollama reduces spend to $0.00 with zero quality loss.',
      });
    }

    return {
      orgBudget,
      totalSpendUsd: orgBudget.currentSpendUsd,
      monthlyCapUsd: orgBudget.monthlySpendCapUsd,
      utilizationPercent: Number(
        ((orgBudget.currentSpendUsd / (orgBudget.monthlySpendCapUsd || 1)) * 100).toFixed(1),
      ),
      spendByAgent: Array.from(this.agentSpendMap.entries()).map(([agentId, spendUsd]) => ({
        agentId,
        spendUsd,
      })),
      spendByProvider: Array.from(this.providerSpendMap.entries()).map(([provider, spendUsd]) => ({
        provider,
        spendUsd,
      })),
      recommendations,
    };
  }

  reset() {
    this.orgBudgets.clear();
    this.projectBudgets.clear();
    this.agentSpendMap.clear();
    this.providerSpendMap.clear();
  }
}
