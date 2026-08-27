import { z } from 'zod';
import {
  BusinessCaseSchema,
  EpicSchema,
  UserStorySchema,
  ArchitectureProposalSchema,
} from './sdlc.schema';
import { McpToolCallRecordSchema } from './mcp.schema';

export const WorkflowRunStatusSchema = z.enum([
  'running',
  'paused_approval',
  'paused_manual',
  'completed',
  'failed',
  'rejected',
]);
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusSchema>;

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const WorkflowNodeNameSchema = z.enum([
  'start',
  'ba_node',
  'gate_business_case',
  'pm_node',
  'gate_epics',
  'requirements_node',
  'gate_requirements',
  'architect_node',
  'gate_architecture',
  'mcp_sync_node',
  'dev_stub_node',
  'qa_stub_node',
  'completed',
  'failed',
]);
export type WorkflowNodeName = z.infer<typeof WorkflowNodeNameSchema>;

export const WorkflowStatePayloadSchema = z.object({
  rawIdea: z.string(),
  businessCase: BusinessCaseSchema.optional().nullable(),
  epics: z.array(EpicSchema).default([]),
  userStories: z.array(UserStorySchema).default([]),
  architectureProposal: ArchitectureProposalSchema.optional().nullable(),
  reviewerNotes: z.string().optional().nullable(),
  rejectedAtNode: WorkflowNodeNameSchema.optional().nullable(),
  iterationCount: z.number().default(0),
  activeApprovalRequestId: z.string().uuid().optional().nullable(),
  mcpToolCalls: z.array(McpToolCallRecordSchema).default([]),
  history: z
    .array(
      z.object({
        node: WorkflowNodeNameSchema,
        timestamp: z.string(),
        summary: z.string().optional(),
        outputSnippet: z.string().optional(),
      }),
    )
    .default([]),
});
export type WorkflowStatePayload = z.infer<typeof WorkflowStatePayloadSchema>;

export const WorkflowRunSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  currentNode: WorkflowNodeNameSchema,
  status: WorkflowRunStatusSchema,
  statePayload: WorkflowStatePayloadSchema,
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional().nullable(),
  error: z.string().optional().nullable(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  projectId: z.string().uuid(),
  workflowRunId: z.string().uuid(),
  nodeName: WorkflowNodeNameSchema,
  payloadToReview: z.record(z.any()),
  status: ApprovalStatusSchema,
  decidedBy: z.string().uuid().optional().nullable(),
  decidedAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string().datetime(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const WorkflowDecisionSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  projectId: z.string().uuid(),
  workflowRunId: z.string().uuid(),
  nodeName: WorkflowNodeNameSchema,
  decisionType: z.string(),
  summary: z.string(),
  payload: z.record(z.any()),
  createdAt: z.string().datetime(),
});
export type WorkflowDecision = z.infer<typeof WorkflowDecisionSchema>;

export const StartWorkflowDtoSchema = z.object({
  name: z.string().min(1).default('Autonomous SDLC Pipeline Run'),
  rawIdea: z.string().min(5, 'Raw idea prompt must be at least 5 characters'),
});
export type StartWorkflowDto = z.infer<typeof StartWorkflowDtoSchema>;

export const DecideApprovalDtoSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().optional(),
});
export type DecideApprovalDto = z.infer<typeof DecideApprovalDtoSchema>;

export const OverrideNodeDtoSchema = z.object({
  targetNode: WorkflowNodeNameSchema,
  reason: z.string().min(1, 'Reason for manual override is required'),
});
export type OverrideNodeDto = z.infer<typeof OverrideNodeDtoSchema>;

export const EditWorkflowStateDtoSchema = z.object({
  statePayload: WorkflowStatePayloadSchema,
  reason: z.string().min(1, 'Reason for manual state edit is required'),
});
export type EditWorkflowStateDto = z.infer<typeof EditWorkflowStateDtoSchema>;
