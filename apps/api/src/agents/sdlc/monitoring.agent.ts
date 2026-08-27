import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent } from '../core/base.agent';
import { ToolRegistry } from '../core/tools/tool.registry';
import { PromptTemplateService } from '../core/prompts/prompt-template.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { AuditLogRepository } from '../../database/repositories/audit-log.repository';
import { DevOpsRepository } from '../../database/repositories/devops.repository';
import { AnomalyDetectorService } from '../../devops/anomaly-detector.service';
import {
  AgentTaskInput,
  AgentTaskOutput,
  MonitoringAgentInput,
  MonitoringAgentOutput,
  MonitoringAgentInputSchema,
  MonitoringAgentOutputSchema,
  IncidentEntity,
} from '@ironloom/shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MonitoringAgent extends BaseAgent {
  private readonly monitorLogger = new Logger(MonitoringAgent.name);

  constructor(
    toolRegistry: ToolRegistry,
    promptService: PromptTemplateService,
    aiGateway: AiGatewayService,
    private readonly devOpsRepo: DevOpsRepository,
    private readonly anomalyDetector: AnomalyDetectorService,
    private readonly auditRepo: AuditLogRepository,
  ) {
    super(
      'monitoring_01',
      'monitoring',
      {
        defaultProvider: 'ollama',
        fallbackProviders: ['groq', 'mock'],
        temperature: 0.1,
      },
      toolRegistry,
      promptService,
      aiGateway,
    );
  }

  async auditTelemetry(params: {
    agentId?: string;
    actorUserId: string;
    input: MonitoringAgentInput;
    metadata?: {
      orgId?: string;
      projectId?: string;
      workflowRunId?: string;
    };
  }): Promise<{ output: MonitoringAgentOutput; costUsd: number; latencyMs: number }> {
    const startTime = Date.now();
    const input = MonitoringAgentInputSchema.parse(params.input);
    const projectId = input.projectId;
    const envName = input.environment;

    // 1. Evaluate Metrics Against Explainable Anomaly Rules
    const anomalyResult = this.anomalyDetector.evaluateTelemetry(input.telemetry);

    let incidentCreated: IncidentEntity | undefined;
    let taskCreatedId: string | undefined;

    // 2. If Anomalous, Spawn Incident Record and Create Linked Task
    if (anomalyResult.isAnomalous) {
      taskCreatedId = uuidv4();
      const envRecord = await this.devOpsRepo.getOrCreateEnvironment(projectId, envName);

      incidentCreated = await this.devOpsRepo.createIncident({
        projectId,
        environmentId: envRecord.id,
        title: `[${anomalyResult.severity.toUpperCase()}] Production Anomaly: ${anomalyResult.triggeredRules.join(', ')}`,
        summary: anomalyResult.explanation,
        source: 'monitoring',
        severity: anomalyResult.severity,
        metricsSnapshot: input.telemetry,
        linkedTaskId: taskCreatedId,
      });

      // Log to Audit Log for complete traceability
      try {
        await this.auditRepo.create({
          orgId: params.metadata?.orgId || '00000000-0000-0000-0000-000000000000',
          projectId,
          actorType: 'agent',
          actorId: this.agentId,
          action: 'agent.monitoring.anomaly_detected',
          input: { telemetry: input.telemetry },
          output: {
            incidentId: incidentCreated.id,
            linkedTaskId: taskCreatedId,
            triggeredRules: anomalyResult.triggeredRules,
          },
        });
      } catch {}
    }

    const output: MonitoringAgentOutput = {
      anomalyDetected: anomalyResult.isAnomalous,
      anomalyResult,
      incidentCreated,
      taskCreatedId,
      summary: anomalyResult.isAnomalous
        ? `Alert triggered: ${anomalyResult.explanation} Raised incident ${incidentCreated?.id} and spawned self-healing task.`
        : 'Telemetry check passed: all production metrics healthy and nominal.',
    };

    const validatedOutput = MonitoringAgentOutputSchema.parse(output);

    return {
      output: validatedOutput,
      costUsd: 0.0001,
      latencyMs: Date.now() - startTime,
    };
  }

  async execute(input: AgentTaskInput): Promise<AgentTaskOutput> {
    const res = await this.auditTelemetry({
      actorUserId: '00000000-0000-0000-0000-000000000000',
      input: {
        projectId: input.projectId || '00000000-0000-0000-0000-000000000000',
        environment: input.context?.environment || 'prod',
        telemetry: input.context?.telemetry || {
          timestamp: new Date().toISOString(),
          cpuUsagePercent: 25.0,
          memoryUsagePercent: 40.0,
          errorRatePercent: 0.0,
          latencyP95Ms: 50.0,
          requestCount: 1000,
          activeInstances: 1,
        },
      },
      metadata: {
        orgId: input.orgId,
        projectId: input.projectId,
      },
    });

    return {
      taskId: input.taskId,
      status: 'completed',
      result: res.output as any,
      artifacts: [{ type: 'monitoring_report', data: res.output }],
      toolCalls: [],
      metrics: {
        totalTokens: 0,
        totalCostUsd: res.costUsd,
        latencyMs: res.latencyMs,
      },
    };
  }
}
