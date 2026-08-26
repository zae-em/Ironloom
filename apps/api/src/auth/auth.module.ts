import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { OrgMembershipGuard } from './guards/org-membership.guard';

@Module({
  providers: [SupabaseAuthGuard, OrgMembershipGuard],
  exports: [SupabaseAuthGuard, OrgMembershipGuard],
})
export class AuthModule {}
