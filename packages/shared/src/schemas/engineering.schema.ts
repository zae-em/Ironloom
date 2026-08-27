import { z } from 'zod';

export const CodeFileChangeSchema = z.object({
  path: z.string().min(1),
  action: z.enum(['create', 'modify', 'delete']),
  content: z.string(),
  previousContent: z.string().optional(),
});
export type CodeFileChange = z.infer<typeof CodeFileChangeSchema>;

export const PullRequestEntitySchema = z.object({
  id: z.string().uuid(),
  prNumber: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  branchName: z.string(),
  baseBranch: z.string().default('main'),
  url: z.string().url(),
  userStoryId: z.string().uuid(),
  status: z.enum(['open', 'merged', 'closed']).default('open'),
  reviewStatus: z.enum(['pending', 'approved', 'changes_requested']).default('pending'),
  ciStatus: z.enum(['pending', 'passed', 'failed']).default('pending'),
  sandboxExecutionId: z.string().optional(),
  filesChanged: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PullRequestEntity = z.infer<typeof PullRequestEntitySchema>;

export const CodeReviewCommentSchema = z.object({
  file: z.string(),
  line: z.number().int().positive().optional(),
  comment: z.string(),
  severity: z.enum(['suggestion', 'warning', 'error']).default('suggestion'),
});
export type CodeReviewComment = z.infer<typeof CodeReviewCommentSchema>;

export const CodeReviewVerdictSchema = z.object({
  prNumber: z.number().int().positive(),
  verdict: z.enum(['approved', 'changes_requested', 'comment']),
  summary: z.string(),
  comments: z.array(CodeReviewCommentSchema).default([]),
  linterOutput: z.string().optional(),
  reviewedAt: z.string().datetime(),
});
export type CodeReviewVerdict = z.infer<typeof CodeReviewVerdictSchema>;

export const TestRunEntitySchema = z.object({
  id: z.string().uuid(),
  prNumber: z.number().int().positive(),
  passedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative().default(0),
  durationMs: z.number().nonnegative(),
  coveragePercent: z.number().min(0).max(100),
  rawLog: z.string(),
  sandboxExecutionId: z.string(),
  status: z.enum(['passed', 'failed']),
  executedAt: z.string().datetime(),
});
export type TestRunEntity = z.infer<typeof TestRunEntitySchema>;

export const SandboxResourceLimitsSchema = z.object({
  memoryMb: z.number().int().positive().default(512),
  cpuQuota: z.number().positive().default(1.0),
  timeoutMs: z.number().int().positive().default(30000),
});
export type SandboxResourceLimits = z.input<typeof SandboxResourceLimitsSchema>;

export const SandboxTaskRequestSchema = z.object({
  taskId: z.string().optional(),
  repoUrl: z.string().optional(),
  branch: z.string().optional(),
  files: z.record(z.string()).default({}),
  commands: z.array(z.string()).min(1),
  resourceLimits: SandboxResourceLimitsSchema.default({}),
  networkPolicy: z.enum(['none', 'registry_only', 'full']).default('none'),
  env: z.record(z.string()).optional().default({}),
});
export type SandboxTaskRequest = z.input<typeof SandboxTaskRequestSchema>;
export type SandboxTaskRequestParsed = z.output<typeof SandboxTaskRequestSchema>;

export const SandboxTaskResultSchema = z.object({
  sandboxId: z.string(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int(),
  durationMs: z.number().nonnegative(),
  artifacts: z.record(z.string()).optional(),
  timedOut: z.boolean().default(false),
  oomKilled: z.boolean().default(false),
  networkViolations: z.array(z.string()).default([]),
});
export type SandboxTaskResult = z.infer<typeof SandboxTaskResultSchema>;

export const DeveloperAgentInputSchema = z.object({
  userStory: z.any(),
  architectureProposal: z.any().optional().nullable(),
  ragContext: z.array(z.string()).default([]),
  retryFeedback: z.string().optional().nullable(),
});
export type DeveloperAgentInput = z.infer<typeof DeveloperAgentInputSchema>;

export const DeveloperAgentOutputSchema = z.object({
  summary: z.string(),
  files: z.array(CodeFileChangeSchema),
  branchName: z.string(),
  prTitle: z.string(),
  prBody: z.string(),
  prNumber: z.number().int().optional(),
  prUrl: z.string().optional(),
  sandboxExecutionId: z.string().optional(),
});
export type DeveloperAgentOutput = z.infer<typeof DeveloperAgentOutputSchema>;

export const CodeReviewerInputSchema = z.object({
  prNumber: z.number().int().positive(),
  prTitle: z.string(),
  prBody: z.string(),
  filesChanged: z.array(CodeFileChangeSchema),
  userStory: z.any(),
  language: z.string().default('typescript'),
});
export type CodeReviewerInput = z.infer<typeof CodeReviewerInputSchema>;

export const CodeReviewerOutputSchema = CodeReviewVerdictSchema;
export type CodeReviewerOutput = z.infer<typeof CodeReviewerOutputSchema>;

export const QaAgentInputSchema = z.object({
  prNumber: z.number().int().positive(),
  filesChanged: z.array(CodeFileChangeSchema),
  userStory: z.any(),
  existingTests: z.string().optional(),
});
export type QaAgentInput = z.infer<typeof QaAgentInputSchema>;

export const QaAgentOutputSchema = z.object({
  generatedTests: z.array(CodeFileChangeSchema),
  testRun: TestRunEntitySchema,
  recommendation: z.enum(['approve_for_merge', 'request_developer_fix']),
  summary: z.string(),
});
export type QaAgentOutput = z.infer<typeof QaAgentOutputSchema>;
