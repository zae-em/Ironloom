import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ApprovalPolicy,
  CommandCenterSummary,
  CreateApprovalPolicyDto,
  CreateIncidentDto,
  DeploymentEntity,
  EnvironmentEntity,
  IncidentEntity,
  MetricTelemetrySnapshot,
  PromoteEnvironmentDto,
  RollbackEnvironmentDto,
} from '@ironloom/shared';
import { DevOpsRepository } from '../database/repositories/devops.repository';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { AnomalyDetectorService } from './anomaly-detector.service';
import { DevOpsAgent } from '../agents/sdlc/devops.agent';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DevOpsService {
  private readonly logger = new Logger(DevOpsService.name);

  constructor(
    private readonly devOpsRepo: DevOpsRepository,
    private readonly orchestrationService: OrchestrationService,
    private readonly anomalyDetector: AnomalyDetectorService,
    private readonly devopsAgent: DevOpsAgent,
  ) {}

  /**
   * Command Center Summary across all projects in the organization.
   */
  async getCommandCenterSummary(orgId: string): Promise<CommandCenterSummary> {
    const allWorkflows = await this.orchestrationService.listAllWorkflowRuns(orgId);
    const allDeployments = await this.devOpsRepo.listAllDeployments();
    const allIncidents = await this.devOpsRepo.listAllIncidents();
    const allApprovals = await this.orchestrationService.listAllApprovalRequests(orgId);

    const activeWorkflowsCount = allWorkflows.filter((w) => w.status === 'running').length;
    const pausedApprovalsCount = allWorkflows.filter((w) => w.status === 'paused_approval').length;
    const failedWorkflowsCount = allWorkflows.filter((w) => w.status === 'failed').length;
    const openIncidents = allIncidents.filter((i) => i.status === 'open');

    let systemHealthStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (openIncidents.some((i) => i.severity === 'critical')) {
      systemHealthStatus = 'critical';
    } else if (openIncidents.length > 0 || failedWorkflowsCount > 0) {
      systemHealthStatus = 'degraded';
    }

    const pendingApprovals = allApprovals.filter((a) => a.status === 'pending');

    return {
      systemHealthStatus,
      uptimePercentage: systemHealthStatus === 'critical' ? 98.45 : 99.98,
      activeWorkflowsCount,
      pausedApprovalsCount,
      failedWorkflowsCount,
      totalDeploymentsCount: allDeployments.length,
      openIncidentsCount: openIncidents.length,
      recentDeployments: allDeployments.slice(0, 8),
      openIncidents,
      pendingApprovals,
    };
  }

  /**
   * List Environments for a specific project.
   */
  async getEnvironments(projectId: string): Promise<EnvironmentEntity[]> {
    const envs = await this.devOpsRepo.listEnvironments(projectId);
    if (envs.length === 0) {
      const dev = await this.devOpsRepo.getOrCreateEnvironment(projectId, 'dev');
      const staging = await this.devOpsRepo.getOrCreateEnvironment(projectId, 'staging');
      const prod = await this.devOpsRepo.getOrCreateEnvironment(projectId, 'prod');
      return [dev, staging, prod];
    }
    return envs;
  }

  /**
   * List Deployments for a project.
   */
  async getDeployments(projectId: string, environmentId?: string): Promise<DeploymentEntity[]> {
    return this.devOpsRepo.listDeployments(projectId, environmentId);
  }

  /**
   * Manual or policy-triggered promotion to target environment.
   */
  async promoteEnvironment(params: {
    projectId: string;
    orgId: string;
    actorUserId: string;
    dto: PromoteEnvironmentDto;
  }): Promise<DeploymentEntity> {
    const res = await this.devopsAgent.promoteEnvironment({
      actorUserId: params.actorUserId,
      input: {
        environment: params.dto.targetEnvironment,
        version: params.dto.version || 'v1.0.0',
        deployTarget: 'docker-container',
      },
      metadata: {
        orgId: params.orgId,
        projectId: params.projectId,
      },
    });

    const env = await this.devOpsRepo.getOrCreateEnvironment(
      params.projectId,
      params.dto.targetEnvironment,
    );

    const deployments = await this.devOpsRepo.listDeployments(params.projectId, env.id);
    return (
      deployments[0] || {
        id: uuidv4(),
        environmentId: env.id,
        projectId: params.projectId,
        version: params.dto.version || 'v1.0.0',
        status: res.output.status === 'success' ? 'success' : 'failed',
        initiatedBy: 'human',
        promotedFrom:
          params.dto.environment === 'prod'
            ? 'staging'
            : params.dto.environment === 'staging'
              ? 'dev'
              : 'none',
        releaseNotes:
          params.dto.notes || `Promoted to ${params.dto.targetEnvironment.toUpperCase()}`,
        manifests: res.output.manifests,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }
    );
  }

  /**
   * Rollback environment to a previous version.
   */
  async rollbackEnvironment(params: {
    projectId: string;
    orgId: string;
    actorUserId: string;
    dto: RollbackEnvironmentDto;
  }): Promise<DeploymentEntity> {
    const env = await this.devOpsRepo.getOrCreateEnvironment(
      params.projectId,
      params.dto.environment,
    );

    const rollbackDeployment = await this.devOpsRepo.createDeployment({
      environmentId: env.id,
      projectId: params.projectId,
      version: params.dto.targetVersion,
      status: 'rolled_back',
      initiatedBy: 'human',
      promotedFrom: params.dto.environment === 'prod' ? 'staging' : 'none',
      releaseNotes: `EMERGENCY ROLLBACK to ${params.dto.targetVersion}. Reason: ${params.dto.reason}`,
      manifests: {
        'rollback.yaml': `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app-rollback\nspec:\n  replicas: 3\n  template:\n    spec:\n      containers:\n      - name: app\n        image: ironloom/app:${params.dto.targetVersion}`,
      },
      completedAt: new Date().toISOString(),
    });

    await this.devOpsRepo.updateEnvironmentStatus(env.id, 'healthy', params.dto.targetVersion);
    return rollbackDeployment;
  }

  /**
   * List Incidents.
   */
  async getIncidents(projectId?: string): Promise<IncidentEntity[]> {
    if (projectId) {
      return this.devOpsRepo.listIncidents(projectId);
    }
    return this.devOpsRepo.listAllIncidents();
  }

  /**
   * Create Incident (manual or simulated).
   */
  async createIncident(dto: CreateIncidentDto & { projectId: string }): Promise<IncidentEntity> {
    const env = await this.devOpsRepo.getOrCreateEnvironment(dto.projectId, dto.environment);

    return this.devOpsRepo.createIncident({
      projectId: dto.projectId,
      environmentId: env.id,
      title: dto.title,
      severity: dto.severity,
      source: dto.source || 'manual',
      summary: dto.summary,
      metricsSnapshot: dto.telemetrySnapshot || null,
    });
  }

  /**
   * Trigger Automated Self-Healing Remediation workflow for an open incident.
   */
  async remediateIncident(params: { incidentId: string; orgId: string; actorUserId: string }) {
    const incident = await this.devOpsRepo.getIncident(params.incidentId);
    if (!incident) {
      throw new NotFoundException(`Incident ${params.incidentId} not found`);
    }

    const workflowRun = await this.orchestrationService.startWorkflow({
      orgId: params.orgId,
      projectId: incident.projectId,
      actorUserId: params.actorUserId,
      dto: {
        name: `[HOTFIX] ${incident.title}`,
        rawIdea: `Self-Healing Hotfix: ${incident.title}. ${incident.summary}`,
        isIncidentFeedbackLoop: true,
        incidentContext: incident,
      },
    });

    await this.devOpsRepo.updateIncidentStatus(incident.id, 'open');

    return {
      incident,
      workflowRun,
    };
  }

  /**
   * Live Telemetry snapshot for environment.
   */
  async getTelemetry(
    _projectId: string,
    environment: 'dev' | 'staging' | 'prod',
  ): Promise<MetricTelemetrySnapshot> {
    const now = new Date().toISOString();
    const baseErrorRate = environment === 'prod' ? 0.05 : environment === 'staging' ? 0.2 : 0.5;
    const baseLatency = environment === 'prod' ? 45 : environment === 'staging' ? 65 : 120;
    const baseCpu = environment === 'prod' ? 38.5 : 22.0;
    const baseMemory = environment === 'prod' ? 48.0 : 35.0;

    return {
      timestamp: now,
      cpuUsagePercent: Number((baseCpu + Math.random() * 5).toFixed(1)),
      memoryUsagePercent: Number((baseMemory + Math.random() * 4).toFixed(1)),
      errorRatePercent: Number((baseErrorRate + Math.random() * 0.1).toFixed(2)),
      latencyP95Ms: Math.round(baseLatency + Math.random() * 15),
      requestCount: 14250,
      activeInstances: environment === 'prod' ? 3 : 1,
    };
  }

  /**
   * Approval Policies CRUD
   */
  async listPolicies(orgId: string): Promise<ApprovalPolicy[]> {
    const policies = await this.devOpsRepo.listApprovalPolicies(orgId);
    if (policies.length === 0) {
      const defaultPolicy = await this.devOpsRepo.createApprovalPolicy({
        orgId,
        name: 'Standard Staging & Pre-Prod Auto-Promotion Policy',
        description:
          'Automatically approves staging deployments when smoke tests pass and zero active incidents exist.',
        actionType: 'deploy',
        environmentPattern: 'staging',
        ruleDefinition: {
          autoApproveStagingIfSmokePassed: true,
          autoApproveProdIfNoActiveIncidents: false,
          maxErrorRateThresholdPercent: 1.0,
          maxLatencyThresholdMs: 300,
        },
        enabled: true,
      });
      return [defaultPolicy];
    }
    return policies;
  }

  async createPolicy(orgId: string, dto: CreateApprovalPolicyDto): Promise<ApprovalPolicy> {
    return this.devOpsRepo.createApprovalPolicy({
      orgId,
      name: dto.name,
      description: dto.description || '',
      actionType: dto.actionType,
      environmentPattern: dto.environmentPattern || '*',
      ruleDefinition: dto.ruleDefinition,
      enabled: dto.enabled ?? true,
    });
  }

  async updatePolicy(id: string, dto: Partial<CreateApprovalPolicyDto>): Promise<ApprovalPolicy> {
    const updated = await this.devOpsRepo.updateApprovalPolicy(id, dto);
    if (!updated) {
      throw new NotFoundException(`Policy ${id} not found`);
    }
    return updated;
  }

  async deletePolicy(id: string): Promise<{ success: boolean }> {
    const deleted = await this.devOpsRepo.deleteApprovalPolicy(id);
    if (!deleted) {
      throw new NotFoundException(`Policy ${id} not found`);
    }
    return { success: true };
  }
}
