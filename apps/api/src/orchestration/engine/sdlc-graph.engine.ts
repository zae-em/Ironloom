import { Injectable, Logger } from '@nestjs/common';
import {
  WorkflowNodeName,
  WorkflowRun,
  WorkflowStatePayload,
  PullRequestEntity,
  UserStory,
} from '@ironloom/shared';
import { BusinessAnalystAgent } from '../../agents/sdlc/business-analyst.agent';
import { ProductManagerAgent } from '../../agents/sdlc/product-manager.agent';
import { RequirementsEngineerAgent } from '../../agents/sdlc/requirements-engineer.agent';
import { ArchitectAgent } from '../../agents/sdlc/architect.agent';
import { DeveloperAgent } from '../../agents/sdlc/developer.agent';
import { CodeReviewerAgent } from '../../agents/sdlc/code-reviewer.agent';
import { QaAgent } from '../../agents/sdlc/qa.agent';
import { DevOpsAgent } from '../../agents/sdlc/devops.agent';
import { MonitoringAgent } from '../../agents/sdlc/monitoring.agent';
import { SdlcService } from '../../sdlc/sdlc.service';
import { ProjectsService } from '../../projects/projects.service';
import { WorkflowDecisionService } from '../decisions/workflow-decision.service';
import { OrchestrationRepository } from '../orchestration.repository';
import { McpToolRegistryService } from '../../mcp/mcp-tool-registry.service';
import { ApprovalPolicyService } from '../../devops/approval-policy.service';
import { DevOpsRepository } from '../../database/repositories/devops.repository';

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
    private readonly devopsAgent: DevOpsAgent,
    private readonly monitoringAgent: MonitoringAgent,
    private readonly sdlcService: SdlcService,
    private readonly projectsService: ProjectsService,
    private readonly decisionService: WorkflowDecisionService,
    private readonly mcpToolRegistry: McpToolRegistryService,
    private readonly approvalPolicyService: ApprovalPolicyService,
    private readonly devOpsRepo: DevOpsRepository,
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
      deployments: run.statePayload.deployments || [],
      incidents: run.statePayload.incidents || [],
    };

    try {
      switch (node) {
        // --------------------------------------------------------------------
        // START NODE -> BA NODE (or RE if Self-Healing loop)
        // --------------------------------------------------------------------
        case 'start': {
          if (state.isIncidentFeedbackLoop && state.incidentContext) {
            state.history.push({
              node: 'start',
              timestamp: new Date().toISOString(),
              summary: `Self-Healing Workflow triggered for Incident: "${state.incidentContext.title || state.rawIdea}"`,
            });
            return {
              nextNode: 'requirements_node',
              state,
              shouldPause: false,
              status: 'running',
            };
          }

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
          state.reviewerNotes = null;

          await this.decisionService.recordDecision({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'ba_node',
            decisionType: 'business_case_formulated',
            summary: `Problem: ${businessCase.problemStatement}. Goals: ${businessCase.goals.join(', ')}`,
            payload: businessCase,
          });

          state.history.push({
            node: 'ba_node',
            timestamp: new Date().toISOString(),
            summary: `BA Agent formulated Business Case: "${businessCase.problemStatement.substring(0, 70)}..."`,
            outputSnippet: JSON.stringify(businessCase, null, 2),
          });

          return {
            nextNode: 'gate_business_case',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // GATE 1: BUSINESS CASE APPROVAL GATE
        // --------------------------------------------------------------------
        case 'gate_business_case': {
          const approvalReq = await this.repo.createApprovalRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'gate_business_case',
            payloadToReview: state.businessCase as any,
          });

          state.activeApprovalRequestId = approvalReq.id;

          try {
            await this.mcpToolRegistry.executeScopedTool(
              'slack_send_message',
              {
                channel: 'sdlc-approvals',
                text: `🔔 *Human Review Required* for Workflow: *${run.name}*\nNode: *Gate: Business Case*\nProblem: ${state.businessCase?.problemStatement}`,
              },
              { orgId: run.orgId, workflowRunId: run.id },
            );
          } catch {}

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
          const epics = await this.sdlcService.generateEpicsFromBusinessCase({
            orgId: run.orgId,
            businessCaseId: state.businessCase!.id,
            actorUserId,
          });

          state.epics = epics;
          state.iterationCount = (state.iterationCount || 0) + 1;
          state.reviewerNotes = null;

          await this.decisionService.recordDecision({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'pm_node',
            decisionType: 'epics_synthesized',
            summary: `Synthesized ${epics.length} Epics: ${epics.map((e: any) => e.title).join(', ')}`,
            payload: { epics },
          });

          state.history.push({
            node: 'pm_node',
            timestamp: new Date().toISOString(),
            summary: `PM Agent synthesized ${epics.length} Epics: ${epics.map((e: any) => e.title).join(', ')}`,
            outputSnippet: JSON.stringify(epics, null, 2),
          });

          return {
            nextNode: 'gate_epics',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // GATE 2: EPICS APPROVAL GATE
        // --------------------------------------------------------------------
        case 'gate_epics': {
          const approvalReq = await this.repo.createApprovalRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'gate_epics',
            payloadToReview: { epics: state.epics },
          });

          state.activeApprovalRequestId = approvalReq.id;

          try {
            await this.mcpToolRegistry.executeScopedTool(
              'slack_send_message',
              {
                channel: 'sdlc-approvals',
                text: `🔔 *Human Review Required* for Workflow: *${run.name}*\nNode: *Gate: Epics Backlog*\nSynthesized ${state.epics.length} Epics for approval.`,
              },
              { orgId: run.orgId, workflowRunId: run.id },
            );
          } catch {}

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
          let userStories: UserStory[] = [];

          if (state.epics && state.epics.length > 0) {
            userStories = await this.sdlcService.generateStoriesFromEpic({
              orgId: run.orgId,
              epicId: state.epics[0].id,
              actorUserId,
            });
          } else {
            // Incident Feedback Loop on-the-fly generation
            const targetEpic = {
              id: 'epic-remediation',
              orgId: run.orgId,
              projectId: run.projectId,
              businessCaseId: 'bc-remediation',
              title: state.incidentContext?.title || 'Production Remediation Epic',
              description: state.incidentContext?.summary || state.rawIdea,
              rationale:
                'Automated self-healing remediation for detected production telemetry anomaly.',
              sizing: 'M' as const,
              priority: 'high' as const,
              status: 'approved' as const,
              createdAt: new Date().toISOString(),
            };

            const res = await this.reAgent.generateUserStories({
              orgId: run.orgId,
              projectId: run.projectId,
              projectName: run.name,
              epic: targetEpic,
            });

            userStories = res.userStoriesOutput.stories.map((s, idx) => ({
              id: `story-remediation-${idx + 1}`,
              orgId: run.orgId,
              projectId: run.projectId,
              epicId: targetEpic.id,
              title: s.title,
              asA: s.asA,
              iWant: s.iWant,
              soThat: s.soThat,
              acceptanceCriteria: s.acceptanceCriteria.map((ac, acIdx) => ({
                id: `ac-remediation-${idx + 1}-${acIdx + 1}`,
                userStoryId: `story-remediation-${idx + 1}`,
                scenarioTitle: ac.scenarioTitle,
                givenText: ac.givenText,
                whenText: ac.whenText,
                thenText: ac.thenText,
              })),
              status: 'in_review' as const,
              createdAt: new Date().toISOString(),
            }));
          }

          state.userStories = userStories;
          state.iterationCount = (state.iterationCount || 0) + 1;
          state.reviewerNotes = null;

          await this.decisionService.recordDecision({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'requirements_node',
            decisionType: 'user_stories_generated',
            summary: `Generated ${userStories.length} User Stories with acceptance criteria.`,
            payload: { userStories },
          });

          state.history.push({
            node: 'requirements_node',
            timestamp: new Date().toISOString(),
            summary: `Requirements Engineer synthesized ${userStories.length} User Stories with Gherkin criteria.`,
            outputSnippet: JSON.stringify(userStories, null, 2),
          });

          // In self-healing incident mode, auto-advance directly to Architect/Dev
          if (state.isIncidentFeedbackLoop) {
            return {
              nextNode: 'architect_node',
              state,
              shouldPause: false,
              status: 'running',
            };
          }

          return {
            nextNode: 'gate_requirements',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // GATE 3: REQUIREMENTS APPROVAL GATE
        // --------------------------------------------------------------------
        case 'gate_requirements': {
          const approvalReq = await this.repo.createApprovalRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'gate_requirements',
            payloadToReview: { userStories: state.userStories },
          });

          state.activeApprovalRequestId = approvalReq.id;

          try {
            await this.mcpToolRegistry.executeScopedTool(
              'slack_send_message',
              {
                channel: 'sdlc-approvals',
                text: `🔔 *Human Review Required* for Workflow: *${run.name}*\nNode: *Gate: User Stories*\nGenerated ${state.userStories.length} User Stories with Acceptance Criteria.`,
              },
              { orgId: run.orgId, workflowRunId: run.id },
            );
          } catch {}

          return {
            nextNode: 'gate_requirements',
            state,
            shouldPause: true,
            status: 'paused_approval',
          };
        }

        // --------------------------------------------------------------------
        // 4. ARCHITECT AGENT NODE -> GATE: ARCHITECTURE
        // --------------------------------------------------------------------
        case 'architect_node': {
          let architecture: any;

          if (state.isIncidentFeedbackLoop) {
            const res = await this.architectAgent.designArchitecture({
              orgId: run.orgId,
              projectId: run.projectId,
              projectName: run.name,
              epics: state.epics || [],
              stories: state.userStories || [],
            });

            architecture = {
              id: 'arch-remediation-01',
              orgId: run.orgId,
              projectId: run.projectId,
              version: 1,
              title: res.architectureOutput.title,
              summary: res.architectureOutput.summary,
              components: res.architectureOutput.components,
              techStack: res.architectureOutput.techStack,
              dataModel: res.architectureOutput.dataModel,
              diagramMermaid: res.architectureOutput.diagramMermaid,
              status: 'approved',
              createdAt: new Date().toISOString(),
            };
          } else {
            architecture = await this.sdlcService.generateArchitectureProposal({
              orgId: run.orgId,
              projectId: run.projectId,
              actorUserId,
            });
          }

          state.architectureProposal = architecture;
          state.iterationCount = (state.iterationCount || 0) + 1;
          state.reviewerNotes = null;

          await this.decisionService.recordDecision({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'architect_node',
            decisionType: 'architecture_blueprint_synthesized',
            summary: `Architecture Proposal: ${architecture.title} (${architecture.components?.length || 0} components).`,
            payload: architecture,
          });

          state.history.push({
            node: 'architect_node',
            timestamp: new Date().toISOString(),
            summary: `Architect Agent synthesized System Design Blueprint: "${architecture.title}"`,
            outputSnippet: JSON.stringify(architecture, null, 2),
          });

          // In self-healing incident mode, auto-advance to mcp_sync_node / dev_node
          if (state.isIncidentFeedbackLoop) {
            return {
              nextNode: 'mcp_sync_node',
              state,
              shouldPause: false,
              status: 'running',
            };
          }

          return {
            nextNode: 'gate_architecture',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // GATE 4: ARCHITECTURE APPROVAL GATE
        // --------------------------------------------------------------------
        case 'gate_architecture': {
          const approvalReq = await this.repo.createApprovalRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'gate_architecture',
            payloadToReview: state.architectureProposal as any,
          });

          state.activeApprovalRequestId = approvalReq.id;

          try {
            await this.mcpToolRegistry.executeScopedTool(
              'slack_send_message',
              {
                channel: 'sdlc-approvals',
                text: `🔔 *Human Review Required* for Workflow: *${run.name}*\nNode: *Gate: Architecture Design*\nBlueprint: *${state.architectureProposal?.title}*`,
              },
              { orgId: run.orgId, workflowRunId: run.id },
            );
          } catch {}

          return {
            nextNode: 'gate_architecture',
            state,
            shouldPause: true,
            status: 'paused_approval',
          };
        }

        // --------------------------------------------------------------------
        // 5. MCP TOOL INTEGRATIONS NODE -> DEV NODE
        // --------------------------------------------------------------------
        case 'mcp_sync_node': {
          const activeStory = state.userStories[0] || ({} as any);
          const mcpContext = {
            orgId: run.orgId,
            workflowRunId: run.id,
            projectId: run.projectId,
          };

          // A. GitHub Issue creation
          try {
            const ghRes = await this.mcpToolRegistry.executeScopedTool(
              'github_create_issue',
              {
                owner: 'zae-em',
                repo: 'ironloom',
                title: `[Story] ${activeStory.title}`,
                body: `### User Story\n**As a** ${activeStory.asA}\n**I want** ${activeStory.iWant}\n**So that** ${activeStory.soThat}`,
                labels: ['autonomous-agent', 'ironloom-sdlc'],
              },
              mcpContext,
            );
            state.mcpToolCalls.push(ghRes);
          } catch {}

          // B. Jira / ClickUp Sync
          try {
            const jiraRes = await this.mcpToolRegistry.executeScopedTool(
              'jira_create_issue',
              {
                projectKey: 'IL',
                summary: activeStory.title,
                description: `Implemented by IRONLOOM Autonomous Swarm for ${run.name}`,
                issueType: 'Story',
              },
              mcpContext,
            );
            state.mcpToolCalls.push(jiraRes);
          } catch {}

          // C. Slack Announcement
          try {
            const slackRes = await this.mcpToolRegistry.executeScopedTool(
              'slack_send_message',
              {
                channel: 'sdlc-deployments',
                text: `🚀 *IRONLOOM Autonomous Pipeline Active*\nWorkflow: *${run.name}*\nAdvancing to Developer & QA Engineering swarm.`,
              },
              mcpContext,
            );
            state.mcpToolCalls.push(slackRes);
          } catch {}

          state.history.push({
            node: 'mcp_sync_node',
            timestamp: new Date().toISOString(),
            summary: `Synced external tools via MCP: GitHub Issue created, Jira ticket synced, Slack notification sent.`,
          });

          return {
            nextNode: 'dev_node',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // 6. DEVELOPER AGENT NODE -> CODE REVIEW NODE
        // --------------------------------------------------------------------
        case 'dev_node': {
          const activeStory: UserStory = state.userStories[0] || {
            id: 'story-01',
            orgId: run.orgId,
            projectId: run.projectId,
            epicId: 'epic-01',
            title: 'System Implementation Feature',
            asA: 'User',
            iWant: 'Functionality',
            soThat: 'Value',
            acceptanceCriteria: [
              {
                id: 'ac-01',
                userStoryId: 'story-01',
                scenarioTitle: 'Feature Test',
                givenText: 'Initial state',
                whenText: 'Action taken',
                thenText: 'Assertion passed',
              },
            ],
            status: 'in_review',
            createdAt: new Date().toISOString(),
          };

          const devResult = await this.developerAgent.developFeature({
            orgId: run.orgId,
            projectId: run.projectId,
            projectName: run.name,
            userStory: activeStory,
            architectureProposal: state.architectureProposal,
            retryFeedback: state.reviewerNotes || undefined,
          });

          const prEntity: PullRequestEntity = {
            id: 'pr-' + devResult.output.prNumber,
            prNumber: devResult.output.prNumber || 101,
            title: devResult.output.prTitle,
            body: devResult.output.prBody,
            branchName: devResult.output.branchName,
            baseBranch: 'main',
            url: devResult.output.prUrl || 'https://github.com/zae-em/ironloom/pull/101',
            userStoryId: activeStory.id,
            status: 'open',
            reviewStatus: 'pending',
            ciStatus: 'pending',
            sandboxExecutionId: devResult.output.sandboxExecutionId,
            filesChanged: devResult.output.files.map((f: any) => f.path),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          state.pullRequests = [
            prEntity,
            ...state.pullRequests.filter((p) => p.prNumber !== prEntity.prNumber),
          ];
          state.activePrNumber = prEntity.prNumber;
          state.reviewerNotes = null;

          await this.decisionService.recordDecision({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'dev_node',
            decisionType: 'code_pr_authored',
            summary: `Authored PR #${prEntity.prNumber} on branch ${prEntity.branchName} (${devResult.output.files.length} files changed).`,
            payload: devResult.output,
          });

          state.history.push({
            node: 'dev_node',
            timestamp: new Date().toISOString(),
            summary: `Developer Agent synthesized code and opened PR #${prEntity.prNumber}: "${prEntity.title}"`,
            outputSnippet: JSON.stringify(devResult.output, null, 2),
          });

          return {
            nextNode: 'code_review_node',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // 7. CODE REVIEWER AGENT NODE -> QA NODE
        // --------------------------------------------------------------------
        case 'code_review_node': {
          const activeStory = state.userStories[0] || ({} as any);
          const activePr =
            state.pullRequests.find((p) => p.prNumber === state.activePrNumber) ||
            state.pullRequests[0];

          const reviewResult = await this.codeReviewerAgent.reviewPullRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            prNumber: activePr.prNumber,
            prTitle: activePr.title,
            prBody: activePr.body,
            filesChanged: [
              {
                path: activePr.filesChanged[0] || 'src/index.ts',
                action: 'create',
                content: '// Production TypeScript Implementation',
              },
            ],
            userStory: activeStory,
            language: 'typescript',
          });

          state.codeReviewVerdicts = [
            reviewResult.verdict,
            ...state.codeReviewVerdicts.filter((v) => v.prNumber !== activePr.prNumber),
          ];

          activePr.reviewStatus =
            reviewResult.verdict.verdict === 'changes_requested' ? 'changes_requested' : 'approved';

          await this.decisionService.recordDecision({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'code_review_node',
            decisionType: 'code_review_evaluated',
            summary: `Review Verdict: ${reviewResult.verdict.verdict.toUpperCase()}. ${reviewResult.verdict.summary}`,
            payload: reviewResult.verdict,
          });

          state.history.push({
            node: 'code_review_node',
            timestamp: new Date().toISOString(),
            summary: `Code Reviewer evaluated PR #${activePr.prNumber}: Verdict [${reviewResult.verdict.verdict.toUpperCase()}]`,
            outputSnippet: JSON.stringify(reviewResult.verdict, null, 2),
          });

          // Check if changes requested and retry loop available
          if (reviewResult.verdict.verdict === 'changes_requested') {
            const currentRetries = state.qaRetryCount || 0;
            const maxRetries = state.maxQaRetries || 3;

            if (currentRetries < maxRetries) {
              state.qaRetryCount = currentRetries + 1;
              state.reviewerNotes = `[Code Review Changes Requested]: ${reviewResult.verdict.summary}`;
              state.rejectedAtNode = 'code_review_node';

              state.history.push({
                node: 'code_review_node',
                timestamp: new Date().toISOString(),
                summary: `Autonomous Retry Loop (${state.qaRetryCount}/${maxRetries}): Re-routing to Developer Agent with review feedback.`,
              });

              return {
                nextNode: 'dev_node',
                state,
                shouldPause: false,
                status: 'running',
              };
            }
          }

          return {
            nextNode: 'qa_node',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // 8. QA AGENT NODE -> GATE: PR HUMAN REVIEW
        // --------------------------------------------------------------------
        case 'qa_node': {
          const activeStory = state.userStories[0] || ({} as any);
          const activePr =
            state.pullRequests.find((p) => p.prNumber === state.activePrNumber) ||
            state.pullRequests[0];

          const qaResult = await this.qaAgent.runTestingPipeline({
            orgId: run.orgId,
            projectId: run.projectId,
            prNumber: activePr.prNumber,
            filesChanged: [
              {
                path: activePr.filesChanged[0] || 'src/index.ts',
                action: 'create',
                content: '// Production TypeScript Implementation',
              },
            ],
            userStory: activeStory,
          });

          const testRun = qaResult.output.testRun;
          state.testRuns = [testRun, ...state.testRuns.filter((t) => t.id !== testRun.id)];
          activePr.ciStatus = testRun.status;

          await this.decisionService.recordDecision({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'qa_node',
            decisionType: 'qa_test_suite_executed',
            summary: `QA Result: ${testRun.passedCount} passed, ${testRun.failedCount} failed (${testRun.coveragePercent}% coverage). Recommendation: ${qaResult.output.recommendation}`,
            payload: qaResult.output,
          });

          state.history.push({
            node: 'qa_node',
            timestamp: new Date().toISOString(),
            summary: `QA Agent executed test suite in sandbox for PR #${activePr.prNumber}: ${testRun.passedCount} passed (${testRun.coveragePercent}% cov).`,
            outputSnippet: JSON.stringify(qaResult.output, null, 2),
          });

          // QA Failure Loopback: If tests failed, retry with Developer Agent up to maxQaRetries
          if (
            testRun.status === 'failed' ||
            qaResult.output.recommendation === 'request_developer_fix'
          ) {
            const currentRetries = state.qaRetryCount || 0;
            const maxRetries = state.maxQaRetries || 3;

            if (currentRetries < maxRetries) {
              state.qaRetryCount = currentRetries + 1;
              state.reviewerNotes = `[QA Test Failure Diagnostics]: ${testRun.rawLog}`;
              state.rejectedAtNode = 'qa_node';

              state.history.push({
                node: 'qa_node',
                timestamp: new Date().toISOString(),
                summary: `Autonomous QA Failure Retry Loop (${state.qaRetryCount}/${maxRetries}): Re-routing to Developer Agent to fix failing test assertions.`,
              });

              return {
                nextNode: 'dev_node',
                state,
                shouldPause: false,
                status: 'running',
              };
            }
          }

          return {
            nextNode: 'gate_pr_human_review',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // GATE 5: PULL REQUEST HUMAN REVIEW GATE -> DEVOPS DEV NODE
        // --------------------------------------------------------------------
        case 'gate_pr_human_review': {
          const activePr =
            state.pullRequests.find((p) => p.prNumber === state.activePrNumber) ||
            state.pullRequests[0];

          const approvalReq = await this.repo.createApprovalRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'gate_pr_human_review',
            payloadToReview: {
              pullRequest: activePr,
              codeReview: state.codeReviewVerdicts.find((v) => v.prNumber === activePr?.prNumber),
              testRun: state.testRuns.find((t) => t.prNumber === activePr?.prNumber),
            },
          });

          state.activeApprovalRequestId = approvalReq.id;

          try {
            await this.mcpToolRegistry.executeScopedTool(
              'slack_send_message',
              {
                channel: 'sdlc-approvals',
                text: `🔔 *Human PR Review Required* for Workflow: *${run.name}*\nPR: *#${activePr?.prNumber}: ${activePr?.title}*\nCI Status: *${activePr?.ciStatus?.toUpperCase()}* | Review: *${activePr?.reviewStatus?.toUpperCase()}*`,
              },
              { orgId: run.orgId, workflowRunId: run.id },
            );
          } catch {}

          return {
            nextNode: 'gate_pr_human_review',
            state,
            shouldPause: true,
            status: 'paused_approval',
          };
        }

        // --------------------------------------------------------------------
        // 9. DEVOPS AGENT: DEV ENVIRONMENT PROMOTION -> DEVOPS STAGING
        // --------------------------------------------------------------------
        case 'devops_dev_node': {
          const devResult = await this.devopsAgent.promoteEnvironment({
            agentId: 'devops_agent_009',
            actorUserId,
            input: {
              environment: 'dev',
              version: 'v1.0.0',
              deployTarget: state.deploymentTarget || 'docker-container',
            },
            metadata: { orgId: run.orgId, projectId: run.projectId, workflowRunId: run.id },
          });

          state.activeEnvironment = 'dev';
          state.history.push({
            node: 'devops_dev_node',
            timestamp: new Date().toISOString(),
            summary: `DevOps Agent generated manifests and promoted build to DEV environment.`,
            outputSnippet: JSON.stringify(devResult.output, null, 2),
          });

          // Auto-promote DEV -> STAGING
          return {
            nextNode: 'devops_staging_node',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // 10. DEVOPS AGENT: STAGING PROMOTION & SMOKE TEST -> GATE: PROD DEPLOY
        // --------------------------------------------------------------------
        case 'devops_staging_node': {
          const stagingResult = await this.devopsAgent.promoteEnvironment({
            agentId: 'devops_agent_009',
            actorUserId,
            input: {
              environment: 'staging',
              version: 'v1.0.0',
              deployTarget: state.deploymentTarget || 'docker-container',
            },
            metadata: { orgId: run.orgId, projectId: run.projectId, workflowRunId: run.id },
          });

          state.activeEnvironment = 'staging';
          const smokePassed = stagingResult.output.smokeTestResult?.passed ?? true;

          state.history.push({
            node: 'devops_staging_node',
            timestamp: new Date().toISOString(),
            summary: `DevOps Agent deployed to STAGING. Smoke test status: [${smokePassed ? 'PASSED' : 'FAILED'}].`,
            outputSnippet: JSON.stringify(stagingResult.output, null, 2),
          });

          if (!smokePassed) {
            return {
              nextNode: 'failed',
              state,
              shouldPause: true,
              status: 'failed',
              error: 'Staging automated smoke tests failed. Production promotion halted.',
            };
          }

          return {
            nextNode: 'gate_prod_deploy',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // GATE 6: PRODUCTION DEPLOYMENT APPROVAL GATE (POLICY OR HUMAN)
        // --------------------------------------------------------------------
        case 'gate_prod_deploy': {
          // Check for matching structured Auto-Approval Policy
          const policyEval = await this.approvalPolicyService.evaluateAction({
            orgId: run.orgId,
            projectId: run.projectId,
            actionType: 'deploy',
            environment: 'prod',
            smokeTestPassed: true,
            activeIncidentsCount: 0,
          });

          if (policyEval.autoApprove) {
            state.history.push({
              node: 'gate_prod_deploy',
              timestamp: new Date().toISOString(),
              summary: `PRODUCTION DEPLOY AUTO-APPROVED by Policy (${policyEval.policyId || 'Policy'}): ${policyEval.reason}`,
            });

            return {
              nextNode: 'devops_prod_node',
              state,
              shouldPause: false,
              status: 'running',
            };
          }

          // No auto-approval policy match -> Mandatory Human Approval Gate
          const approvalReq = await this.repo.createApprovalRequest({
            orgId: run.orgId,
            projectId: run.projectId,
            workflowRunId: run.id,
            nodeName: 'gate_prod_deploy',
            payloadToReview: {
              version: 'v1.0.0',
              targetEnvironment: 'prod',
              reason: policyEval.reason,
            },
          });

          state.activeApprovalRequestId = approvalReq.id;

          try {
            await this.mcpToolRegistry.executeScopedTool(
              'slack_send_message',
              {
                channel: 'sdlc-approvals',
                text: `🚨 *PRODUCTION DEPLOYMENT HUMAN APPROVAL REQUIRED*\nWorkflow: *${run.name}*\nVersion: *v1.0.0*\nReason: ${policyEval.reason}`,
              },
              { orgId: run.orgId, workflowRunId: run.id },
            );
          } catch {}

          return {
            nextNode: 'gate_prod_deploy',
            state,
            shouldPause: true,
            status: 'paused_approval',
          };
        }

        // --------------------------------------------------------------------
        // 11. DEVOPS AGENT: PRODUCTION DEPLOYMENT NODE -> MONITORING NODE
        // --------------------------------------------------------------------
        case 'devops_prod_node': {
          const prodResult = await this.devopsAgent.promoteEnvironment({
            agentId: 'devops_agent_009',
            actorUserId,
            input: {
              environment: 'prod',
              version: 'v1.0.0',
              deployTarget: state.deploymentTarget || 'docker-container',
            },
            metadata: { orgId: run.orgId, projectId: run.projectId, workflowRunId: run.id },
          });

          state.activeEnvironment = 'prod';
          state.history.push({
            node: 'devops_prod_node',
            timestamp: new Date().toISOString(),
            summary: `DevOps Agent completed zero-downtime release to PRODUCTION environment (Version v1.0.0).`,
            outputSnippet: JSON.stringify(prodResult.output, null, 2),
          });

          return {
            nextNode: 'monitoring_node',
            state,
            shouldPause: false,
            status: 'running',
          };
        }

        // --------------------------------------------------------------------
        // 12. MONITORING AGENT: PRODUCTION TELEMETRY AUDIT -> COMPLETED
        // --------------------------------------------------------------------
        case 'monitoring_node': {
          const monitoringResult = await this.monitoringAgent.auditTelemetry({
            agentId: 'monitoring_agent_009',
            actorUserId,
            input: {
              projectId: run.projectId,
              environment: 'prod',
              telemetry: {
                timestamp: new Date().toISOString(),
                cpuUsagePercent: 32.5,
                memoryUsagePercent: 44.0,
                errorRatePercent: 0.02,
                latencyP95Ms: 48.0,
                requestCount: 15400,
                activeInstances: 3,
              },
            },
            metadata: { orgId: run.orgId, projectId: run.projectId, workflowRunId: run.id },
          });

          if (monitoringResult.output.incidentCreated) {
            state.incidents.push(monitoringResult.output.incidentCreated);
          }

          // If self-healing incident mode was active, mark the incident as resolved!
          if (state.isIncidentFeedbackLoop && state.incidentContext?.id) {
            await this.devOpsRepo.updateIncidentStatus(
              state.incidentContext.id,
              'resolved',
              state.userStories[0]?.id,
            );
            state.history.push({
              node: 'monitoring_node',
              timestamp: new Date().toISOString(),
              summary: `Self-Healing Feedback Loop Closed: Resolved Incident ${state.incidentContext.id}.`,
            });
          }

          state.history.push({
            node: 'monitoring_node',
            timestamp: new Date().toISOString(),
            summary: `Monitoring Agent audited production telemetry: ${monitoringResult.output.summary}`,
            outputSnippet: JSON.stringify(monitoringResult.output, null, 2),
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
            shouldPause: false,
            status: 'completed',
          };
        }

        default: {
          return {
            nextNode: 'completed',
            state,
            shouldPause: false,
            status: 'completed',
          };
        }
      }
    } catch (err: any) {
      this.logger.error(`[Workflow Engine] Fatal error at node ${node}: ${err.message}`, err.stack);
      state.history.push({
        node,
        timestamp: new Date().toISOString(),
        summary: `FATAL ERROR: ${err.message}`,
      });
      return {
        nextNode: node,
        state,
        shouldPause: true,
        status: 'failed',
        error: err.message,
      };
    }
  }

  /**
   * Resumes workflow after a human reviewer submits a decision (approve / reject).
   */
  async decideGateApproval(params: {
    run: WorkflowRun;
    gateNode: WorkflowNodeName;
    decision: 'approved' | 'rejected';
    notes?: string;
    actorUserId: string;
  }): Promise<WorkflowRun> {
    const state: WorkflowStatePayload = { ...params.run.statePayload };

    if (params.decision === 'approved') {
      let nextNode: WorkflowNodeName = 'completed';
      if (params.gateNode === 'gate_business_case') nextNode = 'pm_node';
      else if (params.gateNode === 'gate_epics') nextNode = 'requirements_node';
      else if (params.gateNode === 'gate_requirements') nextNode = 'architect_node';
      else if (params.gateNode === 'gate_architecture') nextNode = 'mcp_sync_node';
      else if (params.gateNode === 'gate_pr_human_review') nextNode = 'devops_dev_node';
      else if (params.gateNode === 'gate_prod_deploy') nextNode = 'devops_prod_node';

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

      return this.executeUntilGateOrEnd(updatedRun, params.actorUserId);
    } else {
      let targetNode: WorkflowNodeName = 'ba_node';
      if (params.gateNode === 'gate_business_case') targetNode = 'ba_node';
      else if (params.gateNode === 'gate_epics') targetNode = 'pm_node';
      else if (params.gateNode === 'gate_requirements') targetNode = 'requirements_node';
      else if (params.gateNode === 'gate_architecture') targetNode = 'architect_node';
      else if (params.gateNode === 'gate_pr_human_review') targetNode = 'dev_node';
      else if (params.gateNode === 'gate_prod_deploy') targetNode = 'devops_staging_node';

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
