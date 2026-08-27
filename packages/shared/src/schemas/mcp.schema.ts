import { z } from 'zod';

export const McpServerTypeSchema = z.enum(['github', 'jira', 'figma', 'slack']);
export type McpServerType = z.infer<typeof McpServerTypeSchema>;

export const McpPermissionLevelSchema = z.enum(['read', 'write', 'admin']);
export type McpPermissionLevel = z.infer<typeof McpPermissionLevelSchema>;

// ----------------------------------------------------------------------------
// 1. GITHUB TOOL SCHEMAS
// ----------------------------------------------------------------------------

export const GitHubGetRepoInputSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});
export type GitHubGetRepoInput = z.infer<typeof GitHubGetRepoInputSchema>;

export const GitHubListIssuesInputSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  state: z.enum(['open', 'closed', 'all']).default('open'),
  limit: z.number().int().positive().max(100).default(20),
});
export type GitHubListIssuesInput = z.infer<typeof GitHubListIssuesInputSchema>;

export const GitHubCreateIssueInputSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  labels: z.array(z.string()).default([]),
});
export type GitHubCreateIssueInput = z.infer<typeof GitHubCreateIssueInputSchema>;

export const GitHubCreatePullRequestInputSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  head: z.string().min(1),
  base: z.string().min(1).default('main'),
});
export type GitHubCreatePullRequestInput = z.infer<typeof GitHubCreatePullRequestInputSchema>;

export const GitHubPostCommentInputSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  issueNumber: z.number().int().positive(),
  body: z.string().min(1),
});
export type GitHubPostCommentInput = z.infer<typeof GitHubPostCommentInputSchema>;

// ----------------------------------------------------------------------------
// 2. JIRA TOOL SCHEMAS
// ----------------------------------------------------------------------------

export const JiraCreateIssueInputSchema = z.object({
  projectKey: z.string().min(1).default('IRON'),
  summary: z.string().min(1),
  description: z.string(),
  issueType: z.enum(['Epic', 'Story', 'Task', 'Bug']).default('Task'),
  priority: z.enum(['Lowest', 'Low', 'Medium', 'High', 'Highest']).default('Medium'),
  parentKey: z.string().optional(),
});
export type JiraCreateIssueInput = z.infer<typeof JiraCreateIssueInputSchema>;

export const JiraCreateEpicInputSchema = z.object({
  projectKey: z.string().min(1).default('IRON'),
  name: z.string().min(1),
  summary: z.string().min(1),
  description: z.string(),
});
export type JiraCreateEpicInput = z.infer<typeof JiraCreateEpicInputSchema>;

export const JiraUpdateStatusInputSchema = z.object({
  issueKey: z.string().min(1),
  status: z.enum(['To Do', 'In Progress', 'In Review', 'Done']),
});
export type JiraUpdateStatusInput = z.infer<typeof JiraUpdateStatusInputSchema>;

export const JiraSearchIssuesInputSchema = z.object({
  jql: z.string().min(1),
  maxResults: z.number().int().positive().max(50).default(10),
});
export type JiraSearchIssuesInput = z.infer<typeof JiraSearchIssuesInputSchema>;

// ----------------------------------------------------------------------------
// 3. FIGMA TOOL SCHEMAS
// ----------------------------------------------------------------------------

export const FigmaGetFileInputSchema = z.object({
  fileKey: z.string().min(1),
  depth: z.number().int().positive().max(5).default(2),
});
export type FigmaGetFileInput = z.infer<typeof FigmaGetFileInputSchema>;

export const FigmaGetCommentsInputSchema = z.object({
  fileKey: z.string().min(1),
});
export type FigmaGetCommentsInput = z.infer<typeof FigmaGetCommentsInputSchema>;

export const FigmaGetComponentStylesInputSchema = z.object({
  fileKey: z.string().min(1),
});
export type FigmaGetComponentStylesInput = z.infer<typeof FigmaGetComponentStylesInputSchema>;

// ----------------------------------------------------------------------------
// 4. SLACK TOOL SCHEMAS
// ----------------------------------------------------------------------------

export const SlackPostMessageInputSchema = z.object({
  channel: z.string().default('#engineering-sdlc'),
  text: z.string().min(1),
});
export type SlackPostMessageInput = z.infer<typeof SlackPostMessageInputSchema>;

export const SlackPostNotificationInputSchema = z.object({
  channel: z.string().default('#engineering-sdlc'),
  title: z.string().min(1),
  message: z.string().min(1),
  status: z.enum(['info', 'success', 'warning', 'danger']).default('info'),
  fields: z.array(z.object({ title: z.string(), value: z.string() })).default([]),
});
export type SlackPostNotificationInput = z.infer<typeof SlackPostNotificationInputSchema>;

export const SlackPostApprovalCardInputSchema = z.object({
  channel: z.string().default('#sdlc-approvals'),
  workflowRunId: z.string().uuid(),
  approvalRequestId: z.string().uuid(),
  gateNode: z.string(),
  title: z.string().min(1),
  summary: z.string().min(1),
  metadata: z.record(z.any()).default({}),
});
export type SlackPostApprovalCardInput = z.infer<typeof SlackPostApprovalCardInputSchema>;

export const SlackInteractionPayloadSchema = z.object({
  action: z.enum(['approve', 'reject']),
  workflowRunId: z.string().uuid(),
  approvalRequestId: z.string().uuid(),
  actorUserId: z.string().optional().default('slack-user'),
  notes: z.string().optional(),
});
export type SlackInteractionPayload = z.infer<typeof SlackInteractionPayloadSchema>;

// ----------------------------------------------------------------------------
// 5. MCP TOOL CALL LOG SCHEMA
// ----------------------------------------------------------------------------

export const McpToolCallRecordSchema = z.object({
  id: z.string().uuid(),
  serverType: McpServerTypeSchema,
  toolName: z.string(),
  agentId: z.string().optional(),
  workflowRunId: z.string().optional(),
  input: z.record(z.any()),
  output: z.record(z.any()),
  status: z.enum(['success', 'failed']),
  latencyMs: z.number(),
  timestamp: z.string().datetime(),
  error: z.string().optional(),
});
export type McpToolCallRecord = z.infer<typeof McpToolCallRecordSchema>;
