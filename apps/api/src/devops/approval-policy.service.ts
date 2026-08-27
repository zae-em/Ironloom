import { Injectable, Logger } from '@nestjs/common';
import { DevOpsRepository } from '../database/repositories/devops.repository';
import { ApprovalPolicy, MetricTelemetrySnapshot } from '@ironloom/shared';

export interface PolicyEvaluationContext {
  orgId: string;
  projectId: string;
  actionType: ApprovalPolicy['actionType'];
  environment: 'dev' | 'staging' | 'prod';
  smokeTestPassed?: boolean;
  activeIncidentsCount?: number;
  latestTelemetry?: MetricTelemetrySnapshot;
}

export interface PolicyEvaluationResult {
  autoApprove: boolean;
  policyId?: string;
  reason: string;
}

@Injectable()
export class ApprovalPolicyService {
  private readonly logger = new Logger(ApprovalPolicyService.name);

  constructor(private readonly devOpsRepo: DevOpsRepository) {}

  async evaluateAction(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    const policy = await this.devOpsRepo.findActivePolicy(
      context.orgId,
      context.actionType,
      context.projectId,
    );

    // Rule: Prod deployments NEVER auto-approve unless an explicit policy is enabled AND meets all criteria
    if (context.environment === 'prod') {
      if (!policy || !policy.enabled) {
        return {
          autoApprove: false,
          reason:
            'Production deployments strictly require an explicit human approval gate (no active auto-approval policy configured).',
        };
      }

      const rule = policy.ruleDefinition;
      if (!rule.autoApproveProdIfNoActiveIncidents) {
        return {
          autoApprove: false,
          policyId: policy.id,
          reason: 'Policy enforces mandatory human review for all production releases.',
        };
      }

      if ((context.activeIncidentsCount || 0) > 0) {
        return {
          autoApprove: false,
          policyId: policy.id,
          reason: `Policy rejected auto-approval: ${context.activeIncidentsCount} unresolved active incidents exist in production.`,
        };
      }

      if (
        context.latestTelemetry &&
        context.latestTelemetry.errorRatePercent > (rule.maxErrorRateThresholdPercent ?? 1.0)
      ) {
        return {
          autoApprove: false,
          policyId: policy.id,
          reason: `Policy rejected auto-approval: telemetry error rate (${context.latestTelemetry.errorRatePercent}%) exceeds threshold.`,
        };
      }

      return {
        autoApprove: true,
        policyId: policy.id,
        reason: `Auto-approved by policy '${policy.id}': 0 active incidents and all production health criteria satisfied.`,
      };
    }

    // Staging environment promotion evaluation
    if (context.environment === 'staging') {
      if (context.smokeTestPassed === false) {
        return {
          autoApprove: false,
          reason: 'Staging auto-approval rejected: automated smoke tests failed.',
        };
      }

      if (policy && policy.enabled) {
        const rule = policy.ruleDefinition;
        if (rule.autoApproveStagingIfSmokePassed !== false && context.smokeTestPassed) {
          return {
            autoApprove: true,
            policyId: policy.id,
            reason: `Auto-approved staging promotion by policy '${policy.id}': automated smoke tests passed.`,
          };
        }
      }

      // Default safe behavior for staging if smoke test passed
      if (context.smokeTestPassed) {
        return {
          autoApprove: true,
          reason: 'Auto-promoted to staging: automated smoke test suite cleanly passed.',
        };
      }
    }

    // Dev environment promotion is always auto-approved
    if (context.environment === 'dev') {
      return {
        autoApprove: true,
        reason: 'Development environment builds auto-promoted without restriction.',
      };
    }

    return {
      autoApprove: false,
      reason: 'Action paused for manual human approval.',
    };
  }
}
