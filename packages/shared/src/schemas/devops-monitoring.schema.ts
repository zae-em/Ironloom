import { z } from 'zod';

export const EnvironmentEntitySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.enum(['dev', 'staging', 'prod']),
  currentVersion: z.string().default('v0.0.0'),
  status: z.enum(['healthy', 'degraded', 'deploying', 'down']).default('healthy'),
  config: z
    .object({
      deployTarget: z.string().default('docker-container'),
      replicas: z.number().int().positive().default(1),
      autoPromote: z.boolean().default(false),
      smokeTestCommand: z.string().optional(),
    })
    .default({}),
  updatedAt: z.string().datetime(),
});
export type EnvironmentEntity = z.infer<typeof EnvironmentEntitySchema>;

export const DeploymentEntitySchema = z.object({
  id: z.string().uuid(),
  environmentId: z.string().uuid(),
  projectId: z.string().uuid(),
  version: z.string(),
  commitHash: z.string().optional(),
  status: z.enum(['pending', 'running', 'success', 'failed', 'rolled_back']).default('pending'),
  initiatedBy: z.enum(['agent', 'user']).default('agent'),
  promotedFrom: z.enum(['dev', 'staging', 'none']).default('none'),
  releaseNotes: z.string().default(''),
  manifests: z.record(z.string()).default({}),
  sandboxExecutionId: z.string().optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional().nullable(),
});
export type DeploymentEntity = z.infer<typeof DeploymentEntitySchema>;

export const MetricTelemetrySnapshotSchema = z.object({
  timestamp: z.string().datetime(),
  cpuUsagePercent: z.number().min(0).max(100),
  memoryUsagePercent: z.number().min(0).max(100),
  errorRatePercent: z.number().min(0).max(100),
  latencyP95Ms: z.number().nonnegative(),
  requestCount: z.number().int().nonnegative(),
  activeInstances: z.number().int().positive().default(1),
});
export type MetricTelemetrySnapshot = z.infer<typeof MetricTelemetrySnapshotSchema>;

export const AnomalyRuleResultSchema = z.object({
  isAnomalous: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  triggeredRules: z.array(z.string()),
  explanation: z.string(),
  suggestedAction: z.string(),
  metricsSnapshot: MetricTelemetrySnapshotSchema,
});
export type AnomalyRuleResult = z.infer<typeof AnomalyRuleResultSchema>;

export const IncidentEntitySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  environmentId: z.string().uuid().optional().nullable(),
  title: z.string(),
  summary: z.string(),
  source: z.enum(['monitoring', 'manual']).default('monitoring'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  status: z.enum(['open', 'investigating', 'resolved']).default('open'),
  metricsSnapshot: MetricTelemetrySnapshotSchema.optional().nullable(),
  linkedTaskId: z.string().uuid().optional().nullable(),
  linkedUserStoryId: z.string().uuid().optional().nullable(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional().nullable(),
});
export type IncidentEntity = z.infer<typeof IncidentEntitySchema>;

export const ApprovalPolicyRuleDefinitionSchema = z.object({
  autoApproveStagingIfSmokePassed: z.boolean().optional().default(true),
  autoApproveProdIfNoActiveIncidents: z.boolean().optional().default(false),
  maxErrorRateThresholdPercent: z.number().optional().default(1.0),
  maxLatencyThresholdMs: z.number().optional().default(300),
});
export type ApprovalPolicyRuleDefinition = z.input<typeof ApprovalPolicyRuleDefinitionSchema>;

export const ApprovalPolicySchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  actionType: z.enum(['deploy', 'rollback', 'scale', 'pr_merge', 'staging_promote']),
  ruleDefinition: ApprovalPolicyRuleDefinitionSchema,
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

export const DevOpsAgentInputSchema = z.object({
  environment: z.enum(['dev', 'staging', 'prod']),
  version: z.string().optional().default('v1.0.0'),
  pullRequest: z.any().optional().nullable(),
  deployTarget: z.string().optional().default('docker-container'),
  customConfig: z.record(z.any()).optional().default({}),
});
export type DevOpsAgentInput = z.input<typeof DevOpsAgentInputSchema>;

export const DevOpsAgentOutputSchema = z.object({
  deploymentId: z.string().uuid(),
  environment: z.enum(['dev', 'staging', 'prod']),
  version: z.string(),
  manifests: z.record(z.string()),
  smokeTestResult: z
    .object({
      passed: z.boolean(),
      output: z.string(),
      durationMs: z.number(),
    })
    .optional(),
  status: z.enum(['success', 'failed', 'paused_approval']),
  summary: z.string(),
  sandboxExecutionId: z.string().optional(),
});
export type DevOpsAgentOutput = z.infer<typeof DevOpsAgentOutputSchema>;

export const MonitoringAgentInputSchema = z.object({
  projectId: z.string().uuid(),
  environment: z.enum(['dev', 'staging', 'prod']).default('prod'),
  telemetry: MetricTelemetrySnapshotSchema,
});
export type MonitoringAgentInput = z.infer<typeof MonitoringAgentInputSchema>;

export const MonitoringAgentOutputSchema = z.object({
  anomalyDetected: z.boolean(),
  anomalyResult: AnomalyRuleResultSchema.optional(),
  incidentCreated: IncidentEntitySchema.optional(),
  taskCreatedId: z.string().uuid().optional(),
  summary: z.string(),
});
export type MonitoringAgentOutput = z.infer<typeof MonitoringAgentOutputSchema>;
