import { z } from 'zod';

export const AiProviderNameSchema = z.enum([
  'ollama',
  'groq',
  'openrouter',
  'gemini',
  'anthropic',
  'openai',
  'mock',
]);
export type AiProviderName = z.infer<typeof AiProviderNameSchema>;

export const ChatMessageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

export const ChatMessageSchema = z.object({
  role: ChatMessageRoleSchema,
  content: z.string(),
  name: z.string().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const AiGatewayRequestSchema = z.object({
  prompt: z.string().optional(),
  messages: z.array(ChatMessageSchema).optional(),
  agentId: z.string().min(1).default('system'),
  taskType: z.string().min(1).default('general_completion'),
  preferredProvider: AiProviderNameSchema.optional(),
  fallbackProviders: z.array(AiProviderNameSchema).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().positive().optional().default(2048),
  orgId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional().default({}),
}).refine((data) => data.prompt !== undefined || (data.messages !== undefined && data.messages.length > 0), {
  message: 'Either prompt or non-empty messages array must be provided',
});

export type AiGatewayRequest = z.input<typeof AiGatewayRequestSchema>;
export type AiGatewayRequestParsed = z.output<typeof AiGatewayRequestSchema>;

export const TokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const AiGatewayResponseSchema = z.object({
  id: z.string(),
  text: z.string(),
  provider: AiProviderNameSchema,
  model: z.string(),
  usage: TokenUsageSchema,
  latencyMs: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  status: z.enum(['success', 'fallback_success', 'failure']),
  attempts: z.number().int().positive(),
  auditLogId: z.string().uuid().optional(),
  rawResponse: z.any().optional(),
});
export type AiGatewayResponse = z.infer<typeof AiGatewayResponseSchema>;

export const ProviderQuotaStatusSchema = z.object({
  provider: AiProviderNameSchema,
  isAvailable: z.boolean(),
  remainingRPM: z.number().int(),
  remainingTPM: z.number().int(),
  estimatedResetMs: z.number().int(),
});
export type ProviderQuotaStatus = z.infer<typeof ProviderQuotaStatusSchema>;
