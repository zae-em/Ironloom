import { z } from 'zod';
import { AiProviderNameSchema } from './ai-gateway.schema';

export const OrgRoleSchema = z.enum(['owner', 'admin', 'member']);
export type OrgRole = z.infer<typeof OrgRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Organization name is required'),
  slug: z.string().min(1, 'Slug is required'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const CreateOrganizationDtoSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
});
export type CreateOrganizationDto = z.input<typeof CreateOrganizationDtoSchema>;

export const OrganizationMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  orgId: z.string().uuid(),
  role: OrgRoleSchema,
  createdAt: z.string().optional(),
});
export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

export const OrganizationMemberWithUserSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  orgId: z.string().uuid(),
  role: OrgRoleSchema,
  createdAt: z.string().optional(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
  }),
});
export type OrganizationMemberWithUser = z.infer<typeof OrganizationMemberWithUserSchema>;

export const InviteMemberDtoSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: OrgRoleSchema.default('member'),
});
export type InviteMemberDto = z.input<typeof InviteMemberDtoSchema>;

export const UpdateMemberRoleDtoSchema = z.object({
  role: OrgRoleSchema,
});
export type UpdateMemberRoleDto = z.input<typeof UpdateMemberRoleDtoSchema>;

export const OrganizationInviteSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  email: z.string().email(),
  role: OrgRoleSchema,
  token: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type OrganizationInvite = z.infer<typeof OrganizationInviteSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string().min(1, 'Project name is required'),
  description: z.string().nullable().optional(),
  status: z.enum(['active', 'archived', 'draft']).default('active'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectDtoSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  description: z.string().optional(),
  status: z.enum(['active', 'archived', 'draft']).optional().default('active'),
});
export type CreateProjectDto = z.input<typeof CreateProjectDtoSchema>;

export const UpdateProviderSettingsDtoSchema = z.object({
  defaultProvider: AiProviderNameSchema.optional(),
  fallbackProviders: z.array(AiProviderNameSchema).optional(),
  groqApiKey: z.string().optional(),
  ollamaBaseUrl: z.string().url().optional(),
});
export type UpdateProviderSettingsDto = z.input<typeof UpdateProviderSettingsDtoSchema>;

export const ProviderSettingsSchema = z.object({
  orgId: z.string().uuid(),
  defaultProvider: AiProviderNameSchema,
  fallbackProviders: z.array(AiProviderNameSchema),
  hasGroqApiKey: z.boolean(),
  ollamaBaseUrl: z.string(),
  updatedAt: z.string().optional(),
});
export type ProviderSettings = z.infer<typeof ProviderSettingsSchema>;

export const AuthUserContextSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  orgId: z.string().uuid().optional(),
  role: OrgRoleSchema.optional(),
  orgMemberships: z
    .array(
      z.object({
        orgId: z.string().uuid(),
        orgName: z.string().optional(),
        orgSlug: z.string().optional(),
        role: OrgRoleSchema,
      }),
    )
    .default([]),
});
export type AuthUserContext = z.infer<typeof AuthUserContextSchema>;
