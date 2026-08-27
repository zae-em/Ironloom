import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ApprovalRequest,
  DecideApprovalDto,
  StartWorkflowDto,
  WorkflowRun,
  WorkflowStatePayload,
} from '@ironloom/shared';
import { OrchestrationRepository } from './orchestration.repository';
import { SdlcGraphEngine } from './engine/sdlc-graph.engine';
import { AuditLogRepository } from '../database/repositories/audit-log.repository';

@Injectable()
export class OrchestrationService {
  private readonly logger = new Logger(OrchestrationService.name);

  constructor(
    private readonly repo: OrchestrationRepository,
    private readonly graphEngine: SdlcGraphEngine,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  /**
   * Starts a new cross-agent SDLC workflow run for a project.
   */
  async startWorkflow(params: {
    orgId: string;
    projectId: string;
    actorUserId: string;
    dto: StartWorkflowDto;
  }): Promise<WorkflowRun> {
    const initialPayload: WorkflowStatePayload = {
      rawIdea: params.dto.rawIdea,
      businessCase: null,
      epics: [],
      userStories: [],
      architectureProposal: null,
      reviewerNotes: null,
      rejectedAtNode: null,
      iterationCount: 0,
      activeApprovalRequestId: null,
      mcpToolCalls: [],
      pullRequests: [],
      activePrNumber: null,
      codeReviewVerdicts: [],
      testRuns: [],
      qaRetryCount: 0,
      maxQaRetries: 3,
      history: [],
    };

    const initialRun = await this.repo.createWorkflowRun({
      orgId: params.orgId,
      projectId: params.projectId,
      name: params.dto.name || 'Autonomous SDLC Pipeline Run',
      initialPayload,
    });

    await this.auditRepo.create({
      orgId: params.orgId,
      actorType: 'user',
      actorId: params.actorUserId,
      projectId: params.projectId,
      action: 'start_workflow',
      input: { rawIdea: params.dto.rawIdea },
      status: 'success',
    });

    // Execute state machine until the first approval gate is reached
    return this.graphEngine.executeUntilGateOrEnd(initialRun, params.actorUserId);
  }

  /**
   * Resumes an existing workflow run from its persisted state (e.g. after a process crash or pause).
   */
  async resumeWorkflow(runId: string, actorUserId: string): Promise<WorkflowRun> {
    const run = await this.repo.getWorkflowRun(runId);
    if (run.status !== 'running') {
      return run;
    }

    this.logger.log(`Resuming workflow run ${runId} from persisted node: ${run.currentNode}`);
    return this.graphEngine.executeUntilGateOrEnd(run, actorUserId);
  }

  /**
   * Decides an active human approval gate (approve or reject with feedback notes)
   * and resumes/branches graph execution.
   */
  async decideApproval(params: {
    approvalId: string;
    dto: DecideApprovalDto;
    actorUserId: string;
  }): Promise<{ approval: ApprovalRequest; workflowRun: WorkflowRun }> {
    const approval = await this.repo.getApprovalRequest(params.approvalId);
    const updatedApproval = await this.repo.updateApprovalDecision({
      id: params.approvalId,
      status: params.dto.decision,
      decidedBy: params.actorUserId,
      notes: params.dto.notes || null,
    });

    const workflowRun = await this.repo.getWorkflowRun(approval.workflowRunId);

    await this.auditRepo.create({
      orgId: approval.orgId,
      actorType: 'user',
      actorId: params.actorUserId,
      projectId: approval.projectId,
      action: `gate_decision_${params.dto.decision}`,
      input: {
        nodeName: approval.nodeName,
        decision: params.dto.decision,
        notes: params.dto.notes,
      },
      status: 'success',
    });

    // Process gate decision in graph state machine
    const resumedRun = await this.graphEngine.processGateDecision({
      run: workflowRun,
      gateNode: approval.nodeName,
      decision: params.dto.decision,
      notes: params.dto.notes,
      actorUserId: params.actorUserId,
    });

    return {
      approval: updatedApproval,
      workflowRun: resumedRun,
    };
  }

  async listWorkflowRuns(projectId: string): Promise<WorkflowRun[]> {
    return this.repo.listWorkflowRuns(projectId);
  }

  async getWorkflowRun(id: string): Promise<WorkflowRun> {
    return this.repo.getWorkflowRun(id);
  }

  async listApprovalRequests(projectId: string): Promise<ApprovalRequest[]> {
    return this.repo.listApprovalRequests(projectId);
  }

  async getApprovalRequest(id: string): Promise<ApprovalRequest> {
    return this.repo.getApprovalRequest(id);
  }

  async pauseWorkflow(runId: string, actorUserId: string): Promise<WorkflowRun> {
    return this.graphEngine.pauseWorkflow(runId, actorUserId);
  }

  async overrideNode(
    runId: string,
    targetNode: any,
    reason: string,
    actorUserId: string,
  ): Promise<WorkflowRun> {
    return this.graphEngine.overrideNode(runId, targetNode, reason, actorUserId);
  }

  async editWorkflowState(
    runId: string,
    statePayload: WorkflowStatePayload,
    reason: string,
    actorUserId: string,
  ): Promise<WorkflowRun> {
    return this.graphEngine.editWorkflowState(runId, statePayload, reason, actorUserId);
  }
}
