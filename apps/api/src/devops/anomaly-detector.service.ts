import { Injectable, Logger } from '@nestjs/common';
import { MetricTelemetrySnapshot, AnomalyRuleResult } from '@ironloom/shared';

export interface AnomalyThresholds {
  maxErrorRatePercent: number; // default 1.0%
  maxLatencyP95Ms: number; // default 250ms
  maxMemoryPercent: number; // default 85%
  maxCpuPercent: number; // default 80%
}

const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  maxErrorRatePercent: 1.0,
  maxLatencyP95Ms: 250,
  maxMemoryPercent: 85.0,
  maxCpuPercent: 80.0,
};

@Injectable()
export class AnomalyDetectorService {
  private readonly logger = new Logger(AnomalyDetectorService.name);

  evaluateTelemetry(
    telemetry: MetricTelemetrySnapshot,
    thresholds: Partial<AnomalyThresholds> = {},
  ): AnomalyRuleResult {
    const activeThresholds: AnomalyThresholds = {
      ...DEFAULT_THRESHOLDS,
      ...thresholds,
    };

    const triggeredRules: string[] = [];
    const explanations: string[] = [];
    let highestSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // 1. Error Rate Spike Rule
    if (telemetry.errorRatePercent > activeThresholds.maxErrorRatePercent) {
      const severity: 'high' | 'critical' = telemetry.errorRatePercent > 5.0 ? 'critical' : 'high';
      highestSeverity = severity;
      triggeredRules.push('RULE_ERROR_RATE_SPIKE');
      explanations.push(
        `HTTP 5xx error rate is ${telemetry.errorRatePercent.toFixed(2)}%, exceeding threshold of ${activeThresholds.maxErrorRatePercent.toFixed(2)}%.`,
      );
    }

    // 2. Latency Regression Rule
    if (telemetry.latencyP95Ms > activeThresholds.maxLatencyP95Ms) {
      if (highestSeverity === 'low') highestSeverity = 'medium';
      if (telemetry.latencyP95Ms > 1000) highestSeverity = 'high';
      triggeredRules.push('RULE_LATENCY_REGRESSION');
      explanations.push(
        `P95 request latency is ${telemetry.latencyP95Ms.toFixed(0)}ms, exceeding SLA threshold of ${activeThresholds.maxLatencyP95Ms.toFixed(0)}ms.`,
      );
    }

    // 3. Memory Exhaustion Rule
    if (telemetry.memoryUsagePercent > activeThresholds.maxMemoryPercent) {
      if (highestSeverity === 'low' || highestSeverity === 'medium') highestSeverity = 'high';
      if (telemetry.memoryUsagePercent > 95.0) highestSeverity = 'critical';
      triggeredRules.push('RULE_MEMORY_EXHAUSTION');
      explanations.push(
        `Container memory usage is ${telemetry.memoryUsagePercent.toFixed(1)}%, exceeding threshold of ${activeThresholds.maxMemoryPercent.toFixed(1)}%.`,
      );
    }

    // 4. CPU Threshold Rule
    if (telemetry.cpuUsagePercent > activeThresholds.maxCpuPercent) {
      if (highestSeverity === 'low') highestSeverity = 'medium';
      triggeredRules.push('RULE_CPU_THRESHOLD_EXCEEDED');
      explanations.push(
        `CPU saturation is ${telemetry.cpuUsagePercent.toFixed(1)}%, exceeding threshold of ${activeThresholds.maxCpuPercent.toFixed(1)}%.`,
      );
    }

    const isAnomalous = triggeredRules.length > 0;

    let suggestedAction = 'Maintain standard automated operational baseline.';
    if (isAnomalous) {
      if (triggeredRules.includes('RULE_ERROR_RATE_SPIKE')) {
        suggestedAction =
          'Immediately raise high-priority defect task, generate diagnostic snapshot, and initiate automated hotfix workflow.';
      } else if (triggeredRules.includes('RULE_MEMORY_EXHAUSTION')) {
        suggestedAction =
          'Investigate memory leak or scale container replicas; trigger autonomous remediation task.';
      } else {
        suggestedAction =
          'Inspect trace spans for regression bottlenecks and profile service execution.';
      }
    }

    return {
      isAnomalous,
      severity: highestSeverity,
      triggeredRules,
      explanation: isAnomalous
        ? explanations.join(' ')
        : 'All telemetry metrics within standard baseline operational thresholds.',
      suggestedAction,
      metricsSnapshot: telemetry,
    };
  }
}
