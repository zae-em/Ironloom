import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUserContext, StartWorkflowDto, DecideApprovalDto } from '@ironloom/shared';
import { OrchestrationService } from './orchestration.service';

@Controller('api/v1')
@UseGuards(SupabaseAuthGuard)
export class OrchestrationController {
  constructor(private readonly orchestrationService: OrchestrationService) {}

  @Post('projects/:projectId/workflows/start')
  @UseGuards(OrgMembershipGuard)
  async startWorkflow(
    @Param('projectId') projectId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUserContext,
    @Body() dto: StartWorkflowDto,
  ) {
    return this.orchestrationService.startWorkflow({
      orgId,
      projectId,
      actorUserId: user.userId,
      dto,
    });
  }

  @Get('projects/:projectId/workflows')
  @UseGuards(OrgMembershipGuard)
  async listWorkflows(@Param('projectId') projectId: string) {
    return this.orchestrationService.listWorkflowRuns(projectId);
  }

  @Get('workflows/:id')
  async getWorkflow(@Param('id') id: string) {
    return this.orchestrationService.getWorkflowRun(id);
  }

  @Post('workflows/:id/resume')
  async resumeWorkflow(@Param('id') id: string, @CurrentUser() user: AuthUserContext) {
    return this.orchestrationService.resumeWorkflow(id, user.userId);
  }

  @Post('workflows/:id/pause')
  async pauseWorkflow(@Param('id') id: string, @CurrentUser() user: AuthUserContext) {
    return this.orchestrationService.pauseWorkflow(id, user.userId);
  }

  @Post('workflows/:id/override-node')
  async overrideNode(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserContext,
    @Body() body: { targetNode: any; reason: string },
  ) {
    return this.orchestrationService.overrideNode(id, body.targetNode, body.reason, user.userId);
  }

  @Post('workflows/:id/edit-state')
  async editState(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserContext,
    @Body() body: { statePayload: any; reason: string },
  ) {
    return this.orchestrationService.editWorkflowState(
      id,
      body.statePayload,
      body.reason,
      user.userId,
    );
  }

  @Get('projects/:projectId/approvals')
  @UseGuards(OrgMembershipGuard)
  async listApprovals(@Param('projectId') projectId: string) {
    return this.orchestrationService.listApprovalRequests(projectId);
  }

  @Get('approvals')
  async listUnifiedApprovals(@CurrentOrg() orgId: string) {
    return this.orchestrationService.listAllApprovalRequests(orgId);
  }

  @Post('approvals/:id/decide')
  async decideApproval(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserContext,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.orchestrationService.decideApproval({
      approvalId: id,
      dto,
      actorUserId: user.userId,
    });
  }
}
