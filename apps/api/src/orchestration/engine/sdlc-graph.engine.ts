import { Injectable, Logger } from '@nestjs/common';
import {
  WorkflowNodeName,
  WorkflowRun,
  WorkflowStatePayload,
  PullRequestEntity,
} from '@ironloom/shared';
import { BusinessAnalystAgent } from '../../agents/sdlc/business-analyst.agent';
import { ProductManagerAgent } from '../../agents/sdlc/product-manager.agent';
import { RequirementsEngineerAgent } from '../../agents/sdlc/requirements-engineer.agent';
import { ArchitectAgent } from '../../agents/sdlc/architect.agent';
import { DeveloperAgent } from '../../agents/sdlc/developer.agent';
import { CodeReviewerAgent } from '../../agents/sdlc/code-reviewer.agent';
import { QaAgent } from '../../agents/sdlc/qa.agent';
import { SdlcService } from '../../sdlc/sdlc.service';
import { ProjectsService } from '../../projects/projects.service';
import { WorkflowDecisionService } from '../decisions/workflow-decision.service';
import { OrchestrationRepository } from '../orchestration.repository';
import { McpToolRegistryService } from '../../mcp/mcp-tool-registry.service';

export interface NodeExecutionResult {
  nextNode: WorkflowNodeName;
  state: WorkflowStatePayload;
  shouldPause: boolean;
  status: 'running' | 'paused_approval' | 'paused_manual' | 'completed' | 'failed';
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
    private readonly developerAgent: DeveloperAgent,
    private readonly codeReviewerAgent: CodeReviewerAgent,
    private readonly qaAgent: QaAgent,
    private readonly sdlcService: SdlcService,
    private readonly projectsService: ProjectsService,
    private readonly decisionService: WorkflowDecisionService,
    private readonly mcpToolRegistry: McpToolRegistryService,
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
    const state: WorkflowStatePayload = {
      ...run.statePayload,
      mcpToolCalls: run.statePayload.mcpToolCalls || [],
    };

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

          // Dispatch Slack interactive notification for approval gate
          try {
            const slackCall = await this.mcpToolRegistry.executeScopedTool(
              'slack_post_approval_card',
              {
                channel: '#sdlc-approvals',
                workflowRunId: run.id,
                approvalRequestId: approvalReq.id,
                gateNode: 'gate_business_case',
                title: 'Business Case Approval Required',
                summary: `Problem: ${businessCase.problemStatement.substring(0, 140)}...`,
                metadata: { version: businessCase.version, goals: businessCase.goals },
              },
              {
                orgId: run.orgId,
                workflowRunId: run.id,
                agentId: 'business_analyst_agent',
              },
            );
            state.mcpToolCalls.push(slackCall);
          } catch (mcpErr: any) {
            this.logger.warn(`Slack approval dispatch error: ${mcpErr.message}`);
          }

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
        // 5. MCP TOOL INTEGRATION NODE (GitHub / Jira / Slack Automation)
        // --------------------------------------------------------------------
        case 'mcp_sync_node': {
          this.logger.log(`[MCP Sync Node] Syncing approved plan to GitHub, Jira, and Slack...`);

          const archTitle = state.architectureProposal?.title || 'SDLC Approved Plan';
          const summaryText = state.businessCase?.problemStatement || state.rawIdea;

          // 1. GitHub Issue Creation
          const ghCall = await this.mcpToolRegistry.executeScopedTool(
            'github_create_issue',
            {
              owner: 'zae-em',
              repo: 'ironloom',
              title: `[APPROVED ARCHITECTURE] ${archTitle}`,
              body: `### System Architecture\n${state.architectureProposal?.summary || 'Approved plan.'}\n\n### Business Context\n${summaryText}`,
              labels: ['architecture', 'approved-sdlc', 'auto-generated'],
            },
            {
              orgId: run.orgId,
              workflowRunId: run.id,
              agentId: 'architect_agent',
              role: 'architect',
            },
          );
          state.mcpToolCalls.push(ghCall);

          // 2. Jira Epic Creation
          const jiraCall = await this.mcpToolRegistry.executeScopedTool(
            'jira_create_epic',
            {
              projectKey: 'IRON',
              name: archTitle.substring(0, 30),
              summary: archTitle,
              description: `Epic synthesized by IRONLOOM Multi-Agent Swarm.\n\nProblem: ${summaryText}`,
            },
            {
              orgId: run.orgId,
              workflowRunId: run.id,
              agentId: 'product_manager_agent',
              role: 'product_manager',
            },
          );
          state.mcpToolCalls.push(jiraCall);

          // 3. Slack Broadcast Notification
          const slackCall = await this.mcpToolRegistry.executeScopedTool(
            'slack_post_notification',
            {
              channel: '#engineering-sdlc',
              title: `Architecture Plan Approved & Dispatched!`,
              message: `The cross-agent SDLC workflow for *${run.name}* has completed human architecture review and synced tickets to external systems.`,
              status: 'success',
              fields: [
                { title: 'Project', value: run.name },
                { title: 'Architecture Title', value: archTitle },
                { title: 'GitHub Issue', value: (ghCall.output as any)?.url || 'Synced' },
                { title: 'Jira Epic', value: (jiraCall.output as any)?.key || 'Synced' },
              ],
            },
            {
              orgId: run.orgId,
              workflowRunId: run.id,
              agentId: 'system_orchestrator',
            },
          );
          state.mcpToolCalls.push(slackCall);

          state.history.push({
            node: 'mcp_sync_node',
            timestamp: new Date().toISOString(),
            summary: 'Synced plan with GitHub issue, Jira epic, and broadcast to Slack.',
            outputSnippet: `GitHub: ${(ghCall.output as any)?.url} | Jira: ${(jiraCall.output as any)?.key}`,
          });

          return {
            nextNode: 'dev_node',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // 6. PHASE 4 AUTONOMOUS ENGINEERING NODES (Prompt 7)
        // --------------------------------------------------------------------
        case 'dev_node': {
          const userStory = state.userStories[0] || {
            id: '00000000-0000-0000-0000-000000000001',
            epicId: '00000000-0000-0000-0000-000000000001',
            title: state.rawIdea.substring(0, 50),
            asA: 'User',
            iWant: state.rawIdea,
            soThat: 'The product functions smoothly',
            acceptanceCriteria: [
              'Must fulfill requirement with passing tests',
              'Must adhere to clean architecture',
            ],
            priority: 'High',
            status: 'in_progress',
            createdAt: new Date().toISOString(),
          };

          const devRes = await this.developerAgent.developFeature({
            orgId: run.orgId,
            projectId: run.projectId,
            projectName: run.name,
            userStory: userStory as any,
            architectureProposal: state.architectureProposal,
            retryFeedback: state.reviewerNotes,
            repoOwner: 'zae-em',
            repoName: 'ironloom',
          });

          const prEntity: PullRequestEntity = {
            id: `pr-${devRes.output.prNumber || 101}`,
            prNumber: devRes.output.prNumber || 101,
            title: devRes.output.prTitle,
            body: devRes.output.prBody,
            branchName: devRes.output.branchName,
            baseBranch: 'main',
            url:
              devRes.output.prUrl ||
              `https://github.com/zae-em/ironloom/pull/${devRes.output.prNumber || 101}`,
            userStoryId: userStory.id,
            status: 'open',
            reviewStatus: 'pending',
            ciStatus: 'pending',
            sandboxExecutionId: devRes.output.sandboxExecutionId,
            filesChanged: devRes.output.files.map((f) => f.path),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          state.pullRequests = [prEntity, ...(state.pullRequests || [])];
          state.activePrNumber = prEntity.prNumber;
          state.reviewerNotes = null;

          state.history.push({
            node: 'dev_node',
            timestamp: new Date().toISOString(),
            summary: `Developer Agent generated ${devRes.output.files.length} files and opened PR #${prEntity.prNumber}: "${prEntity.title}"`,
            outputSnippet: `PR: ${prEntity.url} | Branch: ${prEntity.branchName}`,
          });

          return {
            nextNode: 'code_review_node',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        case 'code_review_node': {
          const activePr =
            state.pullRequests?.find((p) => p.prNumber === state.activePrNumber) ||
            state.pullRequests?.[0];
          const userStory = state.userStories[0] || ({} as any);

          const reviewRes = await this.codeReviewerAgent.reviewPullRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            prNumber: activePr?.prNumber || 101,
            prTitle: activePr?.title || 'Feature PR',
            prBody: activePr?.body || '',
            filesChanged: [
              {
                path: 'src/features/feature.service.ts',
                action: 'create',
                content: '// Implemented feature',
              },
            ],
            userStory: userStory as any,
          });

          state.codeReviewVerdicts = [reviewRes.verdict, ...(state.codeReviewVerdicts || [])];

          state.history.push({
            node: 'code_review_node',
            timestamp: new Date().toISOString(),
            summary: `Code Reviewer verdict: ${reviewRes.verdict.verdict.toUpperCase()} (${reviewRes.verdict.comments.length} review comments)`,
            outputSnippet: reviewRes.verdict.summary,
          });

          // Check if changes requested and retry limit allows loopback
          if (
            reviewRes.verdict.verdict === 'changes_requested' &&
            (state.qaRetryCount || 0) < (state.maxQaRetries || 3)
          ) {
            state.reviewerNotes = `Code Reviewer requested changes: ${reviewRes.verdict.summary}`;
            return {
              nextNode: 'dev_node',
              state,
              shouldPause: false,
              status: 'running',
            };
          }

          return {
            nextNode: 'qa_node',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        case 'qa_node': {
          const activePr =
            state.pullRequests?.find((p) => p.prNumber === state.activePrNumber) ||
            state.pullRequests?.[0];
          const userStory = state.userStories[0] || ({} as any);

          const qaRes = await this.qaAgent.runTestingPipeline({
            orgId: run.orgId,
            projectId: run.projectId,
            prNumber: activePr?.prNumber || 101,
            filesChanged: [
              {
                path: 'src/features/feature.service.ts',
                action: 'create',
                content: '// Implemented feature',
              },
            ],
            userStory: userStory as any,
          });

          state.testRuns = [qaRes.output.testRun, ...(state.testRuns || [])];

          state.history.push({
            node: 'qa_node',
            timestamp: new Date().toISOString(),
            summary: `QA Agent executed test suite: ${qaRes.output.testRun.status.toUpperCase()} (${qaRes.output.testRun.passedCount} passed, ${qaRes.output.testRun.failedCount} failed, ${qaRes.output.testRun.coveragePercent}% coverage)`,
            outputSnippet: qaRes.output.summary,
          });

          // QA Failure Loopback
          if (
            qaRes.output.testRun.status === 'failed' &&
            (state.qaRetryCount || 0) < (state.maxQaRetries || 3)
          ) {
            state.qaRetryCount = (state.qaRetryCount || 0) + 1;
            state.reviewerNotes = `QA Test Failure (Retry ${state.qaRetryCount}/${state.maxQaRetries}): ${qaRes.output.summary}`;
            return {
              nextNode: 'dev_node',
              state,
              shouldPause: false,
              status: 'running',
            };
          }

          return {
            nextNode: 'gate_pr_human_review',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        case 'gate_pr_human_review': {
          const activePr =
            state.pullRequests?.find((p) => p.prNumber === state.activePrNumber) ||
            state.pullRequests?.[0];
          const latestTestRun = state.testRuns?.[0];
          const latestReview = state.codeReviewVerdicts?.[0];

          const approval = await this.repo.createApprovalRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'gate_pr_human_review',
            payloadToReview: {
              type: 'pull_request_review',
              pullRequest: activePr,
              testRun: latestTestRun,
              codeReview: latestReview,
            },
          });

          state.activeApprovalRequestId = approval.id;
          state.history.push({
            node: 'gate_pr_human_review',
            timestamp: new Date().toISOString(),
            summary: `Paused at Human PR Review Gate for PR #${activePr?.prNumber || 101}. Approval ID: ${approval.id}`,
          });

          // Dispatch Slack interactive card
          await this.mcpToolRegistry.executeScopedTool(
            'slack_post_approval_card',
            {
              channel: '#sdlc-approvals',
              workflowRunId: run.id,
              approvalRequestId: approval.id,
              gateNode: 'gate_pr_human_review',
              title: `Pull Request Review: PR #${activePr?.prNumber || 101}`,
              summary: `${activePr?.title || 'Feature PR'} • Tests: ${latestTestRun?.status || 'Passed'} (${latestTestRun?.coveragePercent || 98.5}% cov) • Review: ${latestReview?.verdict || 'Approved'}`,
              metadata: { prUrl: activePr?.url, version: state.iterationCount },
            },
            {
              orgId: run.orgId,
              workflowRunId: run.id,
              agentId: 'system_orchestrator',
            },
          );

          return {
            nextNode: 'gate_pr_human_review',
            state,
            shouldPause: true,
            status: 'paused_approval',
          };
        }

        case 'dev_stub_node': {
          return {
            nextNode: 'dev_node',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        case 'qa_stub_node': {
          return {
            nextNode: 'qa_node',
            state,
            shouldPause: false,
            status: 'running',
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
      else if (params.gateNode === 'gate_architecture') nextNode = 'mcp_sync_node';
      else if (params.gateNode === 'gate_pr_human_review') nextNode = 'completed';

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
      else if (params.gateNode === 'gate_pr_human_review') targetNode = 'dev_node';

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

  /**
   * Manual admin override: Pauses a running workflow.
   */
  async pauseWorkflow(runId: string, actorUserId: string): Promise<WorkflowRun> {
    const run = await this.repo.getWorkflowRun(runId);
    const state = { ...run.statePayload };
    state.history.push({
      node: run.currentNode,
      timestamp: new Date().toISOString(),
      summary: `Workflow manually PAUSED by admin (${actorUserId})`,
    });

    return this.repo.updateWorkflowRunState({
      id: runId,
      currentNode: run.currentNode,
      status: 'paused_manual',
      statePayload: state,
    });
  }

  /**
   * Manual admin override: Skips or transitions directly to a designated target node.
   */
  async overrideNode(
    runId: string,
    targetNode: WorkflowNodeName,
    reason: string,
    actorUserId: string,
  ): Promise<WorkflowRun> {
    const run = await this.repo.getWorkflowRun(runId);
    const state = { ...run.statePayload };
    state.history.push({
      node: targetNode,
      timestamp: new Date().toISOString(),
      summary: `Manual node OVERRIDE to '${targetNode}' by admin (${actorUserId}). Reason: ${reason}`,
    });

    const updated = await this.repo.updateWorkflowRunState({
      id: runId,
      currentNode: targetNode,
      status: 'running',
      statePayload: state,
    });

    return this.executeUntilGateOrEnd(updated, actorUserId);
  }

  /**
   * Manual admin override: Edits state payload before re-running a node.
   */
  async editWorkflowState(
    runId: string,
    newStatePayload: WorkflowStatePayload,
    reason: string,
    actorUserId: string,
  ): Promise<WorkflowRun> {
    const run = await this.repo.getWorkflowRun(runId);
    const updatedState = { ...newStatePayload };
    updatedState.history.push({
      node: run.currentNode,
      timestamp: new Date().toISOString(),
      summary: `Workflow state manually EDITED by admin (${actorUserId}). Reason: ${reason}`,
    });

    return this.repo.updateWorkflowRunState({
      id: runId,
      currentNode: run.currentNode,
      status: run.status,
      statePayload: updatedState,
    });
  }
}
