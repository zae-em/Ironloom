import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AuthUserContext,
  CreateApprovalPolicyDto,
  CreateIncidentDto,
  PromoteEnvironmentDto,
  RollbackEnvironmentDto,
} from '@ironloom/shared';
import { DevOpsService } from './devops.service';

@Controller('api/v1/devops')
@UseGuards(SupabaseAuthGuard)
export class DevOpsController {
  constructor(private readonly devOpsService: DevOpsService) {}

  @Get('command-center')
  async getCommandCenter(@CurrentOrg() orgId: string) {
    return this.devOpsService.getCommandCenterSummary(orgId);
  }

  @Get('environments')
  async listEnvironments(@Query('projectId') projectId: string) {
    return this.devOpsService.getEnvironments(projectId);
  }

  @Get('deployments')
  async listDeployments(
    @Query('projectId') projectId: string,
    @Query('environmentId') environmentId?: string,
  ) {
    return this.devOpsService.getDeployments(projectId, environmentId);
  }

  @Post('projects/:projectId/promote')
  @UseGuards(OrgMembershipGuard)
  async promoteEnvironment(
    @Param('projectId') projectId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUserContext,
    @Body() dto: PromoteEnvironmentDto,
  ) {
    return this.devOpsService.promoteEnvironment({
      projectId,
      orgId,
      actorUserId: user.userId,
      dto,
    });
  }

  @Post('projects/:projectId/rollback')
  @UseGuards(OrgMembershipGuard)
  async rollbackEnvironment(
    @Param('projectId') projectId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUserContext,
    @Body() dto: RollbackEnvironmentDto,
  ) {
    return this.devOpsService.rollbackEnvironment({
      projectId,
      orgId,
      actorUserId: user.userId,
      dto,
    });
  }

  @Get('incidents')
  async listIncidents(@Query('projectId') projectId?: string) {
    return this.devOpsService.getIncidents(projectId);
  }

  @Post('incidents')
  async createIncident(@Body() dto: CreateIncidentDto & { projectId: string }) {
    return this.devOpsService.createIncident(dto);
  }

  @Post('incidents/:id/remediate')
  async remediateIncident(
    @Param('id') incidentId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUserContext,
  ) {
    return this.devOpsService.remediateIncident({
      incidentId,
      orgId,
      actorUserId: user.userId,
    });
  }

  @Get('telemetry')
  async getTelemetry(
    @Query('projectId') projectId: string,
    @Query('environment') environment: 'dev' | 'staging' | 'prod' = 'prod',
  ) {
    return this.devOpsService.getTelemetry(projectId, environment);
  }

  @Get('policies')
  async listPolicies(@CurrentOrg() orgId: string) {
    return this.devOpsService.listPolicies(orgId);
  }

  @Post('policies')
  async createPolicy(@CurrentOrg() orgId: string, @Body() dto: CreateApprovalPolicyDto) {
    return this.devOpsService.createPolicy(orgId, dto);
  }

  @Put('policies/:id')
  async updatePolicy(@Param('id') id: string, @Body() dto: Partial<CreateApprovalPolicyDto>) {
    return this.devOpsService.updatePolicy(id, dto);
  }

  @Delete('policies/:id')
  async deletePolicy(@Param('id') id: string) {
    return this.devOpsService.deletePolicy(id);
  }
}
