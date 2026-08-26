import { Injectable, Logger } from '@nestjs/common';
import { WorkflowNodeName, WorkflowRun, WorkflowStatePayload } from '@ironloom/shared';
import { BusinessAnalystAgent } from '../../agents/sdlc/business-analyst.agent';
import { ProductManagerAgent } from '../../agents/sdlc/product-manager.agent';
import { RequirementsEngineerAgent } from '../../agents/sdlc/requirements-engineer.agent';
import { ArchitectAgent } from '../../agents/sdlc/architect.agent';
import { SdlcService } from '../../sdlc/sdlc.service';
import { ProjectsService } from '../../projects/projects.service';
import { WorkflowDecisionService } from '../decisions/workflow-decision.service';
import { OrchestrationRepository } from '../orchestration.repository';

export interface NodeExecutionResult {
  nextNode: WorkflowNodeName;
  state: WorkflowStatePayload;
  shouldPause: boolean;
  status: 'running' | 'paused_approval' | 'completed' | 'failed';
  error?: string;
}

@Injectable()
export class SdlcGraphEngine {
  private readonly logger = new Logger(SdlcGraphEngine.name);

  constructor(
    private readonly repo: OrchestrationRepository,
    private readonly baAgent: BusinessAnalystAgent,
    private readonly pmAgent: ProductManagerAgent,
    private readonly reAgent: RequirementsEngineerAgent,
    private readonly architectAgent: ArchitectAgent,
    private readonly sdlcService: SdlcService,
    private readonly projectsService: ProjectsService,
    private readonly decisionService: WorkflowDecisionService,
  ) {}

  /**
   * Executes the workflow state machine graph until an approval gate or terminal state is reached.
   */
  async executeUntilGateOrEnd(run: WorkflowRun, actorUserId: string): Promise<WorkflowRun> {
    let currentRun = run;

    while (currentRun.status === 'running') {
      const currentNode = currentRun.currentNode;
      this.logger.log(`[Workflow Engine] Run ${currentRun.id} executing node: ${currentNode}`);

      const result = await this.executeNode(currentRun, currentNode, actorUserId);

      // Persist state after EVERY node transition (Resumability guarantee)
      currentRun = await this.repo.updateWorkflowRunState({
        id: currentRun.id,
        currentNode: result.nextNode,
        status: result.status,
        statePayload: result.state,
        completedAt: result.status === 'completed' ? new Date().toISOString() : null,
        error: result.error || null,
      });

      if (result.shouldPause || result.status !== 'running') {
        this.logger.log(
          `[Workflow Engine] Run ${currentRun.id} paused at node ${result.nextNode} (Status: ${result.status})`,
        );
        break;
      }
    }

    return currentRun;
  }

  /**
   * Executes an individual node in the state graph.
   */
  async executeNode(
    run: WorkflowRun,
    node: WorkflowNodeName,
    actorUserId: string,
  ): Promise<NodeExecutionResult> {
    const state = { ...run.statePayload };

    try {
      switch (node) {
        // --------------------------------------------------------------------
        // START NODE -> BA NODE
        // --------------------------------------------------------------------
        case 'start': {
          state.history.push({
            node: 'start',
            timestamp: new Date().toISOString(),
            summary: `Workflow initiated with prompt: "${state.rawIdea.substring(0, 80)}..."`,
          });
          return {
            nextNode: 'ba_node',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // 1. BUSINESS ANALYST AGENT NODE -> GATE: BUSINESS CASE
        // --------------------------------------------------------------------
        case 'ba_node': {
          let promptToAnalyze = state.rawIdea;
          if (state.reviewerNotes) {
            promptToAnalyze += `\n\n[HUMAN REVIEWER FEEDBACK TO INCORPORATE]: ${state.reviewerNotes}`;
          }

          // Run BA Agent
          const businessCase = await this.sdlcService.submitIdeaAndAnalyze({
            orgId: run.orgId,
            projectId: run.projectId,
            actorUserId,
            rawIdea: promptToAnalyze,
          });

          state.businessCase = businessCase;
          state.iterationCount = (state.iterationCount || 0) + 1;
          state.reviewerNotes = null; // Cleared after incorporating

          await this.decisionService.recordDecision({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'ba_node',
            decisionType: 'business_case_formulated',
            summary: `Problem: ${businessCase.problemStatement}. Goals: ${businessCase.goals.join(', ')}`,
            payload: { businessCaseId: businessCase.id, version: businessCase.version },
          });

          state.history.push({
            node: 'ba_node',
            timestamp: new Date().toISOString(),
            summary: `Business Case formulated (v${businessCase.version})`,
            outputSnippet: businessCase.problemStatement,
          });

          // Create First-Class Approval Request Gate
          const approvalReq = await this.repo.createApprovalRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'gate_business_case',
            payloadToReview: {
              type: 'business_case',
              businessCase,
            },
          });

          state.activeApprovalRequestId = approvalReq.id;

          return {
            nextNode: 'gate_business_case',
            state,
            shouldPause: true,
            status: 'paused_approval',
          };
        }

        // --------------------------------------------------------------------
        // 2. PRODUCT MANAGER AGENT NODE -> GATE: EPICS
        // --------------------------------------------------------------------
        case 'pm_node': {
          if (!state.businessCase) {
            throw new Error('Cannot execute PM node without an approved Business Case');
          }

          // Generate epics from business case
          const epics = await this.sdlcService.generateEpicsFromBusinessCase({
            orgId: run.orgId,
            businessCaseId: state.businessCase.id,
            actorUserId,
          });

          state.epics = epics;
          state.reviewerNotes = null;

          await this.decisionService.recordDecision({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'pm_node',
            decisionType: 'epics_backlog_generated',
            summary: `Generated ${epics.length} prioritized epics: ${epics.map((e) => e.title).join(', ')}`,
            payload: { epicCount: epics.length },
          });

          state.history.push({
            node: 'pm_node',
            timestamp: new Date().toISOString(),
            summary: `Generated ${epics.length} epics in backlog`,
            outputSnippet: epics.map((e) => `[${e.sizing}] ${e.title}`).join(' | '),
          });

          // Create First-Class Approval Request Gate
          const approvalReq = await this.repo.createApprovalRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'gate_epics',
            payloadToReview: {
              type: 'epics',
              epics,
            },
          });

          state.activeApprovalRequestId = approvalReq.id;

          return {
            nextNode: 'gate_epics',
            state,
            shouldPause: true,
            status: 'paused_approval',
          };
        }

        // --------------------------------------------------------------------
        // 3. REQUIREMENTS ENGINEER AGENT NODE -> GATE: REQUIREMENTS
        // --------------------------------------------------------------------
        case 'requirements_node': {
          if (!state.epics || state.epics.length === 0) {
            throw new Error('Cannot execute Requirements node without Epics');
          }

          const allStories: any[] = [];
          for (const epic of state.epics) {
            const stories = await this.sdlcService.generateStoriesFromEpic({
              orgId: run.orgId,
              epicId: epic.id,
              actorUserId,
            });
            allStories.push(...stories);
          }

          state.userStories = allStories;
          state.reviewerNotes = null;

          await this.decisionService.recordDecision({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'requirements_node',
            decisionType: 'user_stories_and_gherkin_generated',
            summary: `Synthesized ${allStories.length} user stories with Gherkin acceptance criteria`,
            payload: { storyCount: allStories.length },
          });

          state.history.push({
            node: 'requirements_node',
            timestamp: new Date().toISOString(),
            summary: `Synthesized ${allStories.length} user stories with Gherkin scenarios`,
            outputSnippet: allStories
              .slice(0, 3)
              .map((s) => s.title)
              .join(', '),
          });

          // Create First-Class Approval Request Gate
          const approvalReq = await this.repo.createApprovalRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'gate_requirements',
            payloadToReview: {
              type: 'user_stories',
              userStories: allStories,
            },
          });

          state.activeApprovalRequestId = approvalReq.id;

          return {
            nextNode: 'gate_requirements',
            state,
            shouldPause: true,
            status: 'paused_approval',
          };
        }

        // --------------------------------------------------------------------
        // 4. SYSTEM ARCHITECT AGENT NODE -> GATE: ARCHITECTURE
        // --------------------------------------------------------------------
        case 'architect_node': {
          const proposal = await this.sdlcService.generateArchitectureProposal({
            orgId: run.orgId,
            projectId: run.projectId,
            actorUserId,
          });

          state.architectureProposal = proposal;
          state.reviewerNotes = null;

          await this.decisionService.recordDecision({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'architect_node',
            decisionType: 'system_architecture_synthesized',
            summary: `Architecture v${proposal.version}: ${proposal.title}. Components: ${proposal.components.length}`,
            payload: { proposalId: proposal.id, version: proposal.version },
          });

          state.history.push({
            node: 'architect_node',
            timestamp: new Date().toISOString(),
            summary: `Synthesized Architecture Proposal v${proposal.version}`,
            outputSnippet: proposal.summary,
          });

          // Create First-Class Approval Request Gate
          const approvalReq = await this.repo.createApprovalRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'gate_architecture',
            payloadToReview: {
              type: 'architecture_proposal',
              architectureProposal: proposal,
            },
          });

          state.activeApprovalRequestId = approvalReq.id;

          return {
            nextNode: 'gate_architecture',
            state,
            shouldPause: true,
            status: 'paused_approval',
          };
        }

        // --------------------------------------------------------------------
        // 5. PHASE 4 STUBS & COMPLETION
        // --------------------------------------------------------------------
        case 'dev_stub_node': {
          state.history.push({
            node: 'dev_stub_node',
            timestamp: new Date().toISOString(),
            summary: 'Developer Agent node (Prompt 7 placeholder)',
          });
          return {
            nextNode: 'qa_stub_node',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        case 'qa_stub_node': {
          state.history.push({
            node: 'qa_stub_node',
            timestamp: new Date().toISOString(),
            summary: 'QA Engineer Agent node (Prompt 9 placeholder)',
          });
          return {
            nextNode: 'completed',
            state,
            shouldPause: false,
            status: 'completed',
          };
        }

        case 'completed': {
          return {
            nextNode: 'completed',
            state,
            shouldPause: true,
            status: 'completed',
          };
        }

        default: {
          throw new Error(`Unknown workflow node: ${node}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error executing workflow node ${node}: ${err.message}`, err.stack);
      state.history.push({
        node,
        timestamp: new Date().toISOString(),
        summary: `Error executing node: ${err.message}`,
      });
      return {
        nextNode: 'failed',
        state,
        shouldPause: true,
        status: 'failed',
        error: err.message,
      };
    }
  }

  /**
   * Resumes a paused workflow run after an approval or rejection decision.
   */
  async processGateDecision(params: {
    run: WorkflowRun;
    gateNode: WorkflowNodeName;
    decision: 'approved' | 'rejected';
    notes?: string;
    actorUserId: string;
  }): Promise<WorkflowRun> {
    const state = { ...params.run.statePayload };
    state.activeApprovalRequestId = null;

    if (params.decision === 'approved') {
      // Advance to next agent node in pipeline
      let nextNode: WorkflowNodeName = 'completed';
      if (params.gateNode === 'gate_business_case') nextNode = 'pm_node';
      else if (params.gateNode === 'gate_epics') nextNode = 'requirements_node';
      else if (params.gateNode === 'gate_requirements') nextNode = 'architect_node';
      else if (params.gateNode === 'gate_architecture') nextNode = 'dev_stub_node';

      state.history.push({
        node: params.gateNode,
        timestamp: new Date().toISOString(),
        summary: `Human APPROVED gate ${params.gateNode}. Notes: ${params.notes || 'None'}`,
      });

      const updatedRun = await this.repo.updateWorkflowRunState({
        id: params.run.id,
        currentNode: nextNode,
        status: 'running',
        statePayload: state,
      });

      // Continue automated execution until the next gate or end
      return this.executeUntilGateOrEnd(updatedRun, params.actorUserId);
    } else {
      // ----------------------------------------------------------------------
      // REJECTION BRANCH: Route back to prior generative agent with feedback
      // ----------------------------------------------------------------------
      let targetNode: WorkflowNodeName = 'ba_node';
      if (params.gateNode === 'gate_business_case') targetNode = 'ba_node';
      else if (params.gateNode === 'gate_epics') targetNode = 'pm_node';
      else if (params.gateNode === 'gate_requirements') targetNode = 'requirements_node';
      else if (params.gateNode === 'gate_architecture') targetNode = 'architect_node';

      state.reviewerNotes = params.notes || 'Human requested revisions.';
      state.rejectedAtNode = params.gateNode;

      state.history.push({
        node: params.gateNode,
        timestamp: new Date().toISOString(),
        summary: `Human REJECTED gate ${params.gateNode}. Feedback: "${state.reviewerNotes}". Routing back to ${targetNode}.`,
      });

      const updatedRun = await this.repo.updateWorkflowRunState({
        id: params.run.id,
        currentNode: targetNode,
        status: 'running',
        statePayload: state,
      });

      // Resume graph execution at the target re-generation node
      return this.executeUntilGateOrEnd(updatedRun, params.actorUserId);
    }
  }
}
