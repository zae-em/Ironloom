import { AnomalyDetectorService } from '../src/devops/anomaly-detector.service';
import { MetricTelemetrySnapshot } from '@ironloom/shared';

describe('AnomalyDetectorService Unit Tests', () => {
  let detector: AnomalyDetectorService;

  beforeEach(() => {
    detector = new AnomalyDetectorService();
  });

  it('should evaluate nominal metrics as healthy with no triggered rules', () => {
    const telemetry: MetricTelemetrySnapshot = {
      timestamp: new Date().toISOString(),
      cpuUsagePercent: 25.0,
      memoryUsagePercent: 42.0,
      errorRatePercent: 0.05,
      latencyP95Ms: 45.0,
      requestCount: 8500,
      activeInstances: 3,
    };

    const result = detector.evaluateTelemetry(telemetry);

    expect(result.isAnomalous).toBe(false);
    expect(result.severity).toBe('low');
    expect(result.triggeredRules).toHaveLength(0);
    expect(result.explanation).toContain('standard baseline');
  });

  it('should detect error rate spike rule when 5xx errors exceed 1.0%', () => {
    const telemetry: MetricTelemetrySnapshot = {
      timestamp: new Date().toISOString(),
      cpuUsagePercent: 30.0,
      memoryUsagePercent: 50.0,
      errorRatePercent: 2.85,
      latencyP95Ms: 60.0,
      requestCount: 12000,
      activeInstances: 3,
    };

    const result = detector.evaluateTelemetry(telemetry);

    expect(result.isAnomalous).toBe(true);
    expect(result.severity).toBe('high');
    expect(result.triggeredRules).toContain('RULE_ERROR_RATE_SPIKE');
    expect(result.explanation).toContain('HTTP 5xx error rate is 2.85%');
    expect(result.suggestedAction).toContain('high-priority defect task');
  });

  it('should escalate to critical severity if error rate exceeds 5.0%', () => {
    const telemetry: MetricTelemetrySnapshot = {
      timestamp: new Date().toISOString(),
      cpuUsagePercent: 30.0,
      memoryUsagePercent: 50.0,
      errorRatePercent: 8.5,
      latencyP95Ms: 60.0,
      requestCount: 12000,
      activeInstances: 3,
    };

    const result = detector.evaluateTelemetry(telemetry);

    expect(result.isAnomalous).toBe(true);
    expect(result.severity).toBe('critical');
    expect(result.triggeredRules).toContain('RULE_ERROR_RATE_SPIKE');
  });

  it('should detect latency regression when P95 latency exceeds 250ms SLA', () => {
    const telemetry: MetricTelemetrySnapshot = {
      timestamp: new Date().toISOString(),
      cpuUsagePercent: 40.0,
      memoryUsagePercent: 55.0,
      errorRatePercent: 0.2,
      latencyP95Ms: 420.0,
      requestCount: 5000,
      activeInstances: 2,
    };

    const result = detector.evaluateTelemetry(telemetry);

    expect(result.isAnomalous).toBe(true);
    expect(result.triggeredRules).toContain('RULE_LATENCY_REGRESSION');
    expect(result.explanation).toContain('P95 request latency is 420ms');
  });

  it('should detect memory exhaustion when container memory exceeds 85%', () => {
    const telemetry: MetricTelemetrySnapshot = {
      timestamp: new Date().toISOString(),
      cpuUsagePercent: 45.0,
      memoryUsagePercent: 92.4,
      errorRatePercent: 0.1,
      latencyP95Ms: 75.0,
      requestCount: 9000,
      activeInstances: 2,
    };

    const result = detector.evaluateTelemetry(telemetry);

    expect(result.isAnomalous).toBe(true);
    expect(result.triggeredRules).toContain('RULE_MEMORY_EXHAUSTION');
    expect(result.explanation).toContain('Container memory usage is 92.4%');
    expect(result.suggestedAction).toContain('memory leak');
  });
});
