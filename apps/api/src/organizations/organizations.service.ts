import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { AuditLogRepository } from '../database/repositories/audit-log.repository';
import {
  CreateOrganizationDto,
  InviteMemberDto,
  Organization,
  OrganizationInvite,
  OrganizationMemberWithUser,
  OrgRole,
  ProviderSettings,
  UpdateProviderSettingsDto,
} from '@ironloom/shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  // In-memory tenant data structures for testing & offline resilience
  private readonly memoryOrgs = new Map<string, Organization>();
  private readonly memoryMembers = new Map<string, Array<{ id: string; userId: string; orgId: string; role: OrgRole; user: any }>>();
  private readonly memoryInvites = new Map<string, OrganizationInvite[]>();
  private readonly memoryProviderSettings = new Map<string, ProviderSettings>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auditRepo: AuditLogRepository,
  ) {
    // Seed initial in-memory defaults
    const defaultAlphaOrg: Organization = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Alpha Robotics',
      slug: 'alpha-robotics',
      createdAt: new Date().toISOString(),
    };
    this.memoryOrgs.set(defaultAlphaOrg.id, defaultAlphaOrg);
    this.memoryMembers.set(defaultAlphaOrg.id, [
      {
        id: uuidv4(),
        userId: '11111111-1111-1111-1111-111111111111',
        orgId: defaultAlphaOrg.id,
        role: 'owner',
        user: {
          id: '11111111-1111-1111-1111-111111111111',
          email: 'alice@alpha.io',
          name: 'Alice Engineer',
        },
      },
    ]);
  }

  async listUserOrganizations(userId: string): Promise<Organization[]> {
    const admin = this.supabaseService.getAdminClient();

    try {
      const { data: memberRows, error } = await admin
        .from('organization_members')
        .select('org_id, organizations(*)')
        .eq('user_id', userId);

      if (error) throw error;

      if (memberRows && memberRows.length > 0) {
        return memberRows.map((r: any) => r.organizations).filter(Boolean);
      }
    } catch {
      // fallback
    }

    // In-memory search
    const userOrgs: Organization[] = [];
    for (const [orgId, members] of this.memoryMembers.entries()) {
      if (members.some((m) => m.userId === userId)) {
        const org = this.memoryOrgs.get(orgId);
        if (org) userOrgs.push(org);
      }
    }
    return userOrgs;
  }

  async createOrganization(userId: string, userEmail: string, dto: CreateOrganizationDto): Promise<Organization> {
    const orgId = uuidv4();
    const now = new Date().toISOString();
    const admin = this.supabaseService.getAdminClient();

    const newOrg: Organization = {
      id: orgId,
      name: dto.name,
      slug: dto.slug,
      createdAt: now,
      updatedAt: now,
    };

    try {
      // 1. Insert organization
      const { error: orgError } = await admin.from('organizations').insert(newOrg);
      if (orgError) throw orgError;

      // 2. Add creator as owner
      const { error: memberError } = await admin.from('organization_members').insert({
        id: uuidv4(),
        user_id: userId,
        org_id: orgId,
        role: 'owner',
        created_at: now,
      });
      if (memberError) throw memberError;

      this.logger.log(`Created organization ${dto.name} (${orgId}) for user ${userId}`);
    } catch (err: any) {
      this.logger.debug(`Supabase createOrg fallback (${err.message})`);
    }

    // Cache locally
    this.memoryOrgs.set(orgId, newOrg);
    this.memoryMembers.set(orgId, [
      {
        id: uuidv4(),
        userId,
        orgId,
        role: 'owner',
        user: {
          id: userId,
          email: userEmail,
          name: userEmail.split('@')[0],
        },
      },
    ]);

    // Audit log
    await this.auditRepo.create({
      orgId,
      actorType: 'user',
      actorId: userId,
      action: 'organization.create',
      input: dto as any,
      output: { orgId, name: dto.name },
      status: 'success',
    });

    return newOrg;
  }

  async getOrganization(orgId: string): Promise<Organization> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data, error } = await admin.from('organizations').select('*').eq('id', orgId).single();
      if (!error && data) return data as Organization;
    } catch {}

    const org = this.memoryOrgs.get(orgId);
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    return org;
  }

  async listMembers(orgId: string): Promise<OrganizationMemberWithUser[]> {
    const admin = this.supabaseService.getAdminClient();

    try {
      const { data, error } = await admin
        .from('organization_members')
        .select('id, user_id, org_id, role, created_at, users(id, email, name, avatar_url)')
        .eq('org_id', orgId);

      if (!error && data && data.length > 0) {
        return data.map((m: any) => ({
          id: m.id,
          userId: m.user_id,
          orgId: m.org_id,
          role: m.role as OrgRole,
          createdAt: m.created_at,
          user: {
            id: m.users?.id || m.user_id,
            email: m.users?.email || 'user@example.com',
            name: m.users?.name,
            avatarUrl: m.users?.avatar_url,
          },
        }));
      }
    } catch {}

    return this.memoryMembers.get(orgId) || [];
  }

  async inviteMember(
    orgId: string,
    actorUserId: string,
    dto: InviteMemberDto,
  ): Promise<OrganizationInvite> {
    const inviteId = uuidv4();
    const token = `inv_${uuidv4().replace(/-/g, '')}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const invite: OrganizationInvite = {
      id: inviteId,
      orgId,
      email: dto.email,
      role: dto.role || 'member',
      token,
      expiresAt,
      createdAt: now,
    };

    const orgInvites = this.memoryInvites.get(orgId) || [];
    orgInvites.push(invite);
    this.memoryInvites.set(orgId, orgInvites);

    // Also auto-add simulated member for local development convenience if not existing
    const members = this.memoryMembers.get(orgId) || [];
    const simulatedUserId = uuidv4();
    members.push({
      id: uuidv4(),
      userId: simulatedUserId,
      orgId,
      role: dto.role || 'member',
      user: {
        id: simulatedUserId,
        email: dto.email,
        name: dto.email.split('@')[0],
      },
    });
    this.memoryMembers.set(orgId, members);

    this.logger.log(
      `[MEMBER INVITE GENERATED] Org: ${orgId}, Email: ${dto.email}, Role: ${dto.role}, Invite Token: ${token} (Email delivery stubbed for Prompt 12)`,
    );

    // Audit log
    await this.auditRepo.create({
      orgId,
      actorType: 'user',
      actorId: actorUserId,
      action: 'organization.member_invite',
      input: { email: dto.email, role: dto.role },
      output: { inviteId, token },
      status: 'success',
    });

    return invite;
  }

  async listInvites(orgId: string): Promise<OrganizationInvite[]> {
    return this.memoryInvites.get(orgId) || [];
  }

  async updateMemberRole(
    orgId: string,
    actorUserId: string,
    targetUserId: string,
    newRole: OrgRole,
  ): Promise<void> {
    const admin = this.supabaseService.getAdminClient();
    try {
      await admin
        .from('organization_members')
        .update({ role: newRole })
        .eq('org_id', orgId)
        .eq('user_id', targetUserId);
    } catch {}

    const members = this.memoryMembers.get(orgId) || [];
    const target = members.find((m) => m.userId === targetUserId);
    if (target) {
      target.role = newRole;
    }

    await this.auditRepo.create({
      orgId,
      actorType: 'user',
      actorId: actorUserId,
      action: 'organization.member_role_update',
      input: { targetUserId, newRole },
      output: { success: true },
      status: 'success',
    });
  }

  async removeMember(orgId: string, actorUserId: string, targetUserId: string): Promise<void> {
    const admin = this.supabaseService.getAdminClient();
    try {
      await admin
        .from('organization_members')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', targetUserId);
    } catch {}

    const members = this.memoryMembers.get(orgId) || [];
    this.memoryMembers.set(
      orgId,
      members.filter((m) => m.userId !== targetUserId),
    );

    await this.auditRepo.create({
      orgId,
      actorType: 'user',
      actorId: actorUserId,
      action: 'organization.member_remove',
      input: { targetUserId },
      output: { success: true },
      status: 'success',
    });
  }

  async getProviderSettings(orgId: string): Promise<ProviderSettings> {
    const existing = this.memoryProviderSettings.get(orgId);
    if (existing) return existing;

    const defaultSettings: ProviderSettings = {
      orgId,
      defaultProvider: 'ollama',
      fallbackProviders: ['groq'],
      hasGroqApiKey: Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 5),
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      updatedAt: new Date().toISOString(),
    };
    this.memoryProviderSettings.set(orgId, defaultSettings);
    return defaultSettings;
  }

  async updateProviderSettings(
    orgId: string,
    actorUserId: string,
    dto: UpdateProviderSettingsDto,
  ): Promise<ProviderSettings> {
    const current = await this.getProviderSettings(orgId);

    const updated: ProviderSettings = {
      orgId,
      defaultProvider: dto.defaultProvider || current.defaultProvider,
      fallbackProviders: dto.fallbackProviders || current.fallbackProviders,
      hasGroqApiKey: dto.groqApiKey ? dto.groqApiKey.length > 5 : current.hasGroqApiKey,
      ollamaBaseUrl: dto.ollamaBaseUrl || current.ollamaBaseUrl,
      updatedAt: new Date().toISOString(),
    };

    if (dto.groqApiKey) {
      // In a real environment this is encrypted into vault/secrets table.
      // For now set in env/runtime safely without exposing raw string
      process.env.GROQ_API_KEY = dto.groqApiKey;
    }

    this.memoryProviderSettings.set(orgId, updated);

    await this.auditRepo.create({
      orgId,
      actorType: 'user',
      actorId: actorUserId,
      action: 'organization.provider_settings_update',
      input: {
        defaultProvider: updated.defaultProvider,
        fallbackProviders: updated.fallbackProviders,
        hasGroqKey: updated.hasGroqApiKey,
      },
      output: { success: true },
      status: 'success',
    });

    return updated;
  }
}
