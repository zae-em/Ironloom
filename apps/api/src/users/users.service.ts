import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { User, AuthUserContext, OrgRole } from '@ironloom/shared';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly inMemoryUsers = new Map<string, User>();

  constructor(private readonly supabaseService: SupabaseService) {}

  async getProfile(userId: string, email = 'user@example.com'): Promise<AuthUserContext> {
    const admin = this.supabaseService.getAdminClient();

    try {
      // 1. Get user profile
      const { data: userRecord } = await admin.from('users').select('*').eq('id', userId).single();

      // 2. Get user organizations
      const { data: members } = await admin
        .from('organization_members')
        .select('org_id, role, organizations(name, slug)')
        .eq('user_id', userId);

      const orgMemberships = (members || []).map((m: any) => ({
        orgId: m.org_id,
        orgName: m.organizations?.name || 'Organization',
        orgSlug: m.organizations?.slug || 'org',
        role: m.role as OrgRole,
      }));

      const activeOrg = orgMemberships[0];

      return {
        userId,
        email: userRecord?.email || email,
        name: userRecord?.name || email.split('@')[0],
        orgId: activeOrg?.orgId,
        role: activeOrg?.role,
        orgMemberships,
      };
    } catch (err: any) {
      this.logger.debug(`Supabase getProfile fallback (${err.message})`);
      const existing = this.inMemoryUsers.get(userId);
      return {
        userId,
        email: existing?.email || email,
        name: existing?.name || email.split('@')[0],
        orgMemberships: [],
      };
    }
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string }): Promise<User> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data: updated, error } = await admin
        .from('users')
        .update({
          name: data.name,
          avatar_url: data.avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return updated as User;
    } catch {
      const user: User = {
        id: userId,
        email: `${userId}@ironloom.local`,
        name: data.name,
        avatarUrl: data.avatarUrl,
      };
      this.inMemoryUsers.set(userId, user);
      return user;
    }
  }
}
