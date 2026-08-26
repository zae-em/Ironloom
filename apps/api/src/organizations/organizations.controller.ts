import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  AuthUserContext,
  CreateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  UpdateProviderSettingsDto,
} from '@ironloom/shared';

@Controller('organizations')
@UseGuards(SupabaseAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get()
  async listUserOrgs(@CurrentUser() user: AuthUserContext) {
    return this.orgsService.listUserOrganizations(user.userId);
  }

  @Post()
  async createOrg(@CurrentUser() user: AuthUserContext, @Body() body: CreateOrganizationDto) {
    return this.orgsService.createOrganization(user.userId, user.email, body);
  }

  @Get(':orgId')
  @UseGuards(OrgMembershipGuard)
  async getOrg(@Param('orgId') orgId: string) {
    return this.orgsService.getOrganization(orgId);
  }

  @Get(':orgId/members')
  @UseGuards(OrgMembershipGuard)
  async listMembers(@Param('orgId') orgId: string) {
    return this.orgsService.listMembers(orgId);
  }

  @Post(':orgId/invites')
  @UseGuards(OrgMembershipGuard)
  @Roles('owner', 'admin')
  async inviteMember(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthUserContext,
    @Body() body: InviteMemberDto,
  ) {
    return this.orgsService.inviteMember(orgId, user.userId, body);
  }

  @Get(':orgId/invites')
  @UseGuards(OrgMembershipGuard)
  @Roles('owner', 'admin')
  async listInvites(@Param('orgId') orgId: string) {
    return this.orgsService.listInvites(orgId);
  }

  @Patch(':orgId/members/:userId')
  @UseGuards(OrgMembershipGuard)
  @Roles('owner', 'admin')
  async updateRole(
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthUserContext,
    @Body() body: UpdateMemberRoleDto,
  ) {
    await this.orgsService.updateMemberRole(orgId, user.userId, targetUserId, body.role);
    return { success: true };
  }

  @Delete(':orgId/members/:userId')
  @UseGuards(OrgMembershipGuard)
  @Roles('owner', 'admin')
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthUserContext,
  ) {
    await this.orgsService.removeMember(orgId, user.userId, targetUserId);
    return { success: true };
  }

  @Get(':orgId/provider-settings')
  @UseGuards(OrgMembershipGuard)
  async getProviderSettings(@Param('orgId') orgId: string) {
    return this.orgsService.getProviderSettings(orgId);
  }

  @Post(':orgId/provider-settings')
  @UseGuards(OrgMembershipGuard)
  @Roles('owner', 'admin')
  async updateProviderSettings(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthUserContext,
    @Body() body: UpdateProviderSettingsDto,
  ) {
    return this.orgsService.updateProviderSettings(orgId, user.userId, body);
  }
}
