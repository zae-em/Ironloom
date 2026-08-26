import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import {
  ApprovalRequest,
  ApprovalStatus,
  WorkflowNodeName,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowStatePayload,
} from '@ironloom/shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrchestrationRepository {
  private readonly logger = new Logger(OrchestrationRepository.name);

  // In-memory persistent caches for ultra-fast fallback & test execution
  private readonly memoryWorkflowRuns = new Map<string, WorkflowRun>();
  private readonly memoryApprovalRequests = new Map<string, ApprovalRequest>();

  constructor(private readonly supabaseService: SupabaseService) {}

  // --------------------------------------------------------------------------
  // WORKFLOW RUNS
  // --------------------------------------------------------------------------

  async createWorkflowRun(params: {
    orgId: string;
    projectId: string;
    name: string;
    initialPayload: WorkflowStatePayload;
  }): Promise<WorkflowRun> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: WorkflowRun = {
      id,
      orgId: params.orgId,
      projectId: params.projectId,
      name: params.name,
      currentNode: 'start',
      status: 'running',
      statePayload: params.initialPayload,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      error: null,
    };

    if (this.supabaseService.isServerAvailable()) {
      const admin = this.supabaseService.getAdminClient();
      try {
        await admin.from('workflow_runs').insert({
          id: record.id,
          org_id: record.orgId,
          project_id: record.projectId,
          name: record.name,
          current_node: record.currentNode,
          status: record.status,
          state_payload: record.statePayload,
          started_at: record.startedAt,
          updated_at: record.updatedAt,
        });
      } catch (err: any) {
        this.logger.debug(`Supabase createWorkflowRun fallback: ${err.message}`);
      }
    }

    this.memoryWorkflowRuns.set(id, record);
    return record;
  }

  async getWorkflowRun(id: string): Promise<WorkflowRun> {
    if (this.supabaseService.isServerAvailable()) {
      const admin = this.supabaseService.getAdminClient();
      try {
        const { data, error } = await admin.from('workflow_runs').select('*').eq('id', id).single();

        if (!error && data) {
          return {
            id: data.id,
            orgId: data.org_id,
            projectId: data.project_id,
            name: data.name,
            currentNode: data.current_node,
            status: data.status,
            statePayload: data.state_payload,
            startedAt: data.started_at,
            updatedAt: data.updated_at,
            completedAt: data.completed_at,
            error: data.error,
          };
        }
      } catch {}
    }

    const memory = this.memoryWorkflowRuns.get(id);
    if (!memory) throw new NotFoundException(`Workflow Run ${id} not found`);
    return memory;
  }

  async updateWorkflowRunState(params: {
    id: string;
    currentNode: WorkflowNodeName;
    status: WorkflowRunStatus;
    statePayload: WorkflowStatePayload;
    completedAt?: string | null;
    error?: string | null;
  }): Promise<WorkflowRun> {
    const current = await this.getWorkflowRun(params.id);
    const now = new Date().toISOString();

    const updated: WorkflowRun = {
      ...current,
      currentNode: params.currentNode,
      status: params.status,
      statePayload: params.statePayload,
      updatedAt: now,
      completedAt: params.completedAt !== undefined ? params.completedAt : current.completedAt,
      error: params.error !== undefined ? params.error : current.error,
    };

    if (this.supabaseService.isServerAvailable()) {
      const admin = this.supabaseService.getAdminClient();
      try {
        await admin
          .from('workflow_runs')
          .update({
            current_node: updated.currentNode,
            status: updated.status,
            state_payload: updated.statePayload,
            updated_at: updated.updatedAt,
            completed_at: updated.completedAt,
            error: updated.error,
          })
          .eq('id', params.id);
      } catch {}
    }

    this.memoryWorkflowRuns.set(params.id, updated);
    return updated;
  }

  async listWorkflowRuns(projectId: string): Promise<WorkflowRun[]> {
    if (this.supabaseService.isServerAvailable()) {
      const admin = this.supabaseService.getAdminClient();
      try {
        const { data, error } = await admin
          .from('workflow_runs')
          .select('*')
          .eq('project_id', projectId)
          .order('started_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            orgId: d.org_id,
            projectId: d.project_id,
            name: d.name,
            currentNode: d.current_node,
            status: d.status,
            statePayload: d.state_payload,
            startedAt: d.started_at,
            updatedAt: d.updated_at,
            completedAt: d.completed_at,
            error: d.error,
          }));
        }
      } catch {}
    }

    return Array.from(this.memoryWorkflowRuns.values())
      .filter((w) => w.projectId === projectId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  // --------------------------------------------------------------------------
  // APPROVAL REQUESTS
  // --------------------------------------------------------------------------

  async createApprovalRequest(params: {
    orgId: string;
    projectId: string;
    workflowRunId: string;
    nodeName: WorkflowNodeName;
    payloadToReview: Record<string, any>;
  }): Promise<ApprovalRequest> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: ApprovalRequest = {
      id,
      orgId: params.orgId,
      projectId: params.projectId,
      workflowRunId: params.workflowRunId,
      nodeName: params.nodeName,
      payloadToReview: params.payloadToReview,
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
      notes: null,
      createdAt: now,
    };

    if (this.supabaseService.isServerAvailable()) {
      const admin = this.supabaseService.getAdminClient();
      try {
        await admin.from('approval_requests').insert({
          id: record.id,
          org_id: record.orgId,
          project_id: record.projectId,
          workflow_run_id: record.workflowRunId,
          node_name: record.nodeName,
          payload_to_review: record.payloadToReview,
          status: record.status,
          created_at: record.createdAt,
        });
      } catch {}
    }

    this.memoryApprovalRequests.set(id, record);
    return record;
  }

  async getApprovalRequest(id: string): Promise<ApprovalRequest> {
    if (this.supabaseService.isServerAvailable()) {
      const admin = this.supabaseService.getAdminClient();
      try {
        const { data, error } = await admin
          .from('approval_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return {
            id: data.id,
            orgId: data.org_id,
            projectId: data.project_id,
            workflowRunId: data.workflow_run_id,
            nodeName: data.node_name,
            payloadToReview: data.payload_to_review,
            status: data.status,
            decidedBy: data.decided_by,
            decidedAt: data.decided_at,
            notes: data.notes,
            createdAt: data.created_at,
          };
        }
      } catch {}
    }

    const memory = this.memoryApprovalRequests.get(id);
    if (!memory) throw new NotFoundException(`Approval Request ${id} not found`);
    return memory;
  }

  async updateApprovalDecision(params: {
    id: string;
    status: ApprovalStatus;
    decidedBy?: string | null;
    notes?: string | null;
  }): Promise<ApprovalRequest> {
    const current = await this.getApprovalRequest(params.id);
    const now = new Date().toISOString();

    const updated: ApprovalRequest = {
      ...current,
      status: params.status,
      decidedBy: params.decidedBy || current.decidedBy,
      decidedAt: now,
      notes: params.notes || current.notes,
    };

    if (this.supabaseService.isServerAvailable()) {
      const admin = this.supabaseService.getAdminClient();
      try {
        await admin
          .from('approval_requests')
          .update({
            status: updated.status,
            decided_by: updated.decidedBy,
            decided_at: updated.decidedAt,
            notes: updated.notes,
          })
          .eq('id', params.id);
      } catch {}
    }

    this.memoryApprovalRequests.set(params.id, updated);
    return updated;
  }

  async listApprovalRequests(projectId: string): Promise<ApprovalRequest[]> {
    if (this.supabaseService.isServerAvailable()) {
      const admin = this.supabaseService.getAdminClient();
      try {
        const { data, error } = await admin
          .from('approval_requests')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            orgId: d.org_id,
            projectId: d.project_id,
            workflowRunId: d.workflow_run_id,
            nodeName: d.node_name,
            payloadToReview: d.payload_to_review,
            status: d.status,
            decidedBy: d.decided_by,
            decidedAt: d.decided_at,
            notes: d.notes,
            createdAt: d.created_at,
          }));
        }
      } catch {}
    }

    return Array.from(this.memoryApprovalRequests.values())
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
