import { z } from 'zod';
import { AiProviderNameSchema } from './ai-gateway.schema';

export const AgentRoleSchema = z.enum([
  'business_analyst',
  'product_manager',
  'requirements_engineer',
  'architect',
  'developer',
  'code_reviewer',
  'qa',
  'devops',
  'monitoring',
  'system',
]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentConfigSchema = z.object({
  agentId: z.string().min(1),
  role: AgentRoleSchema,
  defaultProvider: AiProviderNameSchema.optional().default('ollama'),
  fallbackProviders: z.array(AiProviderNameSchema).optional().default(['groq']),
  defaultModel: z.string().optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().positive().optional().default(4096),
});
export type AgentConfig = z.input<typeof AgentConfigSchema>;

export const ToolExecutionResultSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
  latencyMs: z.number().int().nonnegative().default(0),
});
export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;

export const AgentTaskInputSchema = z.object({
  taskId: z.string().uuid().optional(),
  taskType: z.string().min(1),
  orgId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  context: z.record(z.any()).optional().default({}),
  userPrompt: z.string().optional(),
  parameters: z.record(z.any()).optional().default({}),
});
export type AgentTaskInput = z.input<typeof AgentTaskInputSchema>;

export const AgentTaskOutputSchema = z.object({
  taskId: z.string().uuid().optional(),
  status: z.enum(['completed', 'failed', 'blocked_on_approval', 'in_progress']),
  result: z.record(z.any()),
  artifacts: z.array(z.record(z.any())).default([]),
  toolCalls: z.array(z.record(z.any())).default([]),
  metrics: z.object({
    totalTokens: z.number().int().default(0),
    totalCostUsd: z.number().default(0),
    latencyMs: z.number().int().default(0),
  }),
});
export type AgentTaskOutput = z.infer<typeof AgentTaskOutputSchema>;
