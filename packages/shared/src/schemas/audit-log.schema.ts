import { z } from 'zod';

export const AuditLogActorTypeSchema = z.enum(['user', 'agent']);
export type AuditLogActorType = z.infer<typeof AuditLogActorTypeSchema>;

export const AuditLogStatusSchema = z.enum(['success', 'failure', 'pending', 'fallback']);
export type AuditLogStatus = z.infer<typeof AuditLogStatusSchema>;

export const CreateAuditLogDtoSchema = z.object({
  orgId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  actorType: AuditLogActorTypeSchema,
  actorId: z.string().min(1),
  action: z.string().min(1),
  input: z.record(z.any()).optional().default({}),
  output: z.record(z.any()).optional().default({}),
  model: z.string().optional().nullable(),
  provider: z.string().optional().nullable(),
  costUsd: z.number().nonnegative().optional().default(0),
  latencyMs: z.number().int().nonnegative().optional().default(0),
  status: AuditLogStatusSchema.optional().default('success'),
});
export type CreateAuditLogDto = z.input<typeof CreateAuditLogDtoSchema>;

export const AuditLogEventSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  project_id: z.string().uuid().nullable().optional(),
  actor_type: AuditLogActorTypeSchema,
  actor_id: z.string(),
  action: z.string(),
  input: z.record(z.any()).nullable().optional(),
  output: z.record(z.any()).nullable().optional(),
  model: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  cost_usd: z.number(),
  latency_ms: z.number().int(),
  status: AuditLogStatusSchema,
  created_at: z.string(),
});
export type AuditLogEvent = z.infer<typeof AuditLogEventSchema>;
