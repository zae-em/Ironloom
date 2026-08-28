import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import {
  EnvironmentEntity,
  DeploymentEntity,
  IncidentEntity,
  ApprovalPolicy,
} from '@ironloom/shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DevOpsRepository {
  private readonly logger = new Logger(DevOpsRepository.name);

  // In-memory store for fast local integration and testing
  private environments: EnvironmentEntity[] = [];
  private deployments: DeploymentEntity[] = [];
  private incidents: IncidentEntity[] = [];
  private approvalPolicies: ApprovalPolicy[] = [];

  constructor(private readonly supabaseService: SupabaseService) {}

  // ==========================================
  // ENVIRONMENTS
  // ==========================================
  async getOrCreateEnvironment(
    projectId: string,
    name: 'dev' | 'staging' | 'prod',
    config?: Partial<EnvironmentEntity['config']>,
  ): Promise<EnvironmentEntity> {
    let env = this.environments.find((e) => e.projectId === projectId && e.name === name);
    if (!env) {
      env = {
        id: uuidv4(),
        projectId,
        name,
        currentVersion: 'v0.0.0',
        status: 'healthy',
        config: {
          deployTarget: config?.deployTarget || 'docker-container',
          replicas: config?.replicas ?? (name === 'prod' ? 3 : 1),
          autoPromote: config?.autoPromote ?? name === 'dev',
          smokeTestCommand: config?.smokeTestCommand || 'npm run test:smoke',
        },
        updatedAt: new Date().toISOString(),
      };
      this.environments.push(env);
    }
    return env;
  }

  async listEnvironments(projectId: string): Promise<EnvironmentEntity[]> {
    return this.environments.filter((e) => e.projectId === projectId);
  }

  async updateEnvironmentStatus(
    id: string,
    status: EnvironmentEntity['status'],
    version?: string,
  ): Promise<EnvironmentEntity | null> {
    const env = this.environments.find((e) => e.id === id);
    if (env) {
      env.status = status;
      if (version) env.currentVersion = version;
      env.updatedAt = new Date().toISOString();
    }
    return env || null;
  }

  // ==========================================
  // DEPLOYMENTS
  // ==========================================
  async createDeployment(
    dto: Omit<DeploymentEntity, 'id' | 'createdAt'>,
  ): Promise<DeploymentEntity> {
    const deployment: DeploymentEntity = {
      id: uuidv4(),
      ...dto,
      createdAt: new Date().toISOString(),
    };
    this.deployments.push(deployment);
    return deployment;
  }

  async updateDeploymentStatus(
    id: string,
    status: DeploymentEntity['status'],
    sandboxExecutionId?: string,
  ): Promise<DeploymentEntity | null> {
    const dep = this.deployments.find((d) => d.id === id);
    if (dep) {
      dep.status = status;
      if (sandboxExecutionId) dep.sandboxExecutionId = sandboxExecutionId;
      if (status === 'success' || status === 'failed' || status === 'rolled_back') {
        dep.completedAt = new Date().toISOString();
      }
    }
    return dep || null;
  }

  async listDeployments(projectId: string, environmentId?: string): Promise<DeploymentEntity[]> {
    return this.deployments
      .filter(
        (d) => d.projectId === projectId && (!environmentId || d.environmentId === environmentId),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listAllDeployments(): Promise<DeploymentEntity[]> {
    return [...this.deployments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  // ==========================================
  // INCIDENTS
  // ==========================================
  async createIncident(
    dto: Omit<IncidentEntity, 'id' | 'createdAt' | 'status'>,
  ): Promise<IncidentEntity> {
    const incident: IncidentEntity = {
      id: uuidv4(),
      ...dto,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.incidents.push(incident);
    return incident;
  }

  async listIncidents(
    projectId: string,
    status?: IncidentEntity['status'],
  ): Promise<IncidentEntity[]> {
    return this.incidents
      .filter((i) => i.projectId === projectId && (!status || i.status === status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listAllIncidents(status?: IncidentEntity['status']): Promise<IncidentEntity[]> {
    return this.incidents
      .filter((i) => !status || i.status === status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getIncident(id: string): Promise<IncidentEntity | null> {
    return this.incidents.find((i) => i.id === id) || null;
  }

  async updateIncidentStatus(
    id: string,
    status: IncidentEntity['status'],
    linkedUserStoryId?: string,
  ): Promise<IncidentEntity | null> {
    const incident = this.incidents.find((i) => i.id === id);
    if (incident) {
      incident.status = status;
      if (linkedUserStoryId) incident.linkedUserStoryId = linkedUserStoryId;
      if (status === 'resolved') incident.resolvedAt = new Date().toISOString();
    }
    return incident || null;
  }

  // ==========================================
  // APPROVAL POLICIES
  // ==========================================
  async createApprovalPolicy(dto: {
    orgId: string;
    projectId?: string | null;
    name?: string;
    description?: string;
    actionType: ApprovalPolicy['actionType'];
    environmentPattern?: string;
    ruleDefinition?: Partial<ApprovalPolicy['ruleDefinition']>;
    enabled?: boolean;
  }): Promise<ApprovalPolicy> {
    const policy: ApprovalPolicy = {
      id: uuidv4(),
      orgId: dto.orgId,
      projectId: dto.projectId || null,
      name: dto.name || 'Deployment Approval Policy',
      description: dto.description || '',
      actionType: dto.actionType,
      environmentPattern: dto.environmentPattern || '*',
      enabled: dto.enabled ?? true,
      ruleDefinition: {
        autoApproveStagingIfSmokePassed:
          dto.ruleDefinition?.autoApproveStagingIfSmokePassed ?? true,
        autoApproveProdIfNoActiveIncidents:
          dto.ruleDefinition?.autoApproveProdIfNoActiveIncidents ?? false,
        maxErrorRateThresholdPercent: dto.ruleDefinition?.maxErrorRateThresholdPercent ?? 1.0,
        maxLatencyThresholdMs: dto.ruleDefinition?.maxLatencyThresholdMs ?? 300,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.approvalPolicies.push(policy);
    return policy;
  }

  async getApprovalPolicy(id: string): Promise<ApprovalPolicy | null> {
    return this.approvalPolicies.find((p) => p.id === id) || null;
  }

  async updateApprovalPolicy(
    id: string,
    updates: {
      name?: string;
      description?: string;
      actionType?: ApprovalPolicy['actionType'];
      environmentPattern?: string;
      enabled?: boolean;
      ruleDefinition?: Partial<ApprovalPolicy['ruleDefinition']>;
    },
  ): Promise<ApprovalPolicy | null> {
    const policy = this.approvalPolicies.find((p) => p.id === id);
    if (policy) {
      if (updates.name) policy.name = updates.name;
      if (updates.description !== undefined) policy.description = updates.description;
      if (updates.actionType) policy.actionType = updates.actionType;
      if (updates.environmentPattern) policy.environmentPattern = updates.environmentPattern;
      if (updates.enabled !== undefined) policy.enabled = updates.enabled;
      if (updates.ruleDefinition) {
        policy.ruleDefinition = {
          ...policy.ruleDefinition,
          ...updates.ruleDefinition,
        };
      }
      policy.updatedAt = new Date().toISOString();
    }
    return policy || null;
  }

  async deleteApprovalPolicy(id: string): Promise<boolean> {
    const idx = this.approvalPolicies.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.approvalPolicies.splice(idx, 1);
      return true;
    }
    return false;
  }

  async findActivePolicy(
    orgId: string,
    actionType: ApprovalPolicy['actionType'],
    projectId?: string,
  ): Promise<ApprovalPolicy | null> {
    return (
      this.approvalPolicies.find(
        (p) =>
          p.orgId === orgId &&
          p.actionType === actionType &&
          p.enabled &&
          (!p.projectId || p.projectId === projectId),
      ) || null
    );
  }

  async listApprovalPolicies(orgId: string): Promise<ApprovalPolicy[]> {
    return this.approvalPolicies.filter((p) => p.orgId === orgId);
  }

  // Test reset helper
  reset() {
    this.environments = [];
    this.deployments = [];
    this.incidents = [];
    this.approvalPolicies = [];
  }
}
