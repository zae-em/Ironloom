import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SdlcService } from './sdlc.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg } from '../auth/decorators/current-org.decorator';
import {
  AuthUserContext,
  BusinessCase,
  CreateBusinessCaseDto,
  Epic,
  ReviewStatus,
  UserStory,
} from '@ironloom/shared';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class SdlcController {
  constructor(private readonly sdlcService: SdlcService) {}

  // --------------------------------------------------------------------------
  // AGENT TRIGGER ENDPOINTS
  // --------------------------------------------------------------------------

  @Post('projects/:projectId/sdlc/idea')
  @UseGuards(OrgMembershipGuard)
  async submitIdea(
    @Param('projectId') projectId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUserContext,
    @Body() body: { rawIdea: string },
  ) {
    return this.sdlcService.submitIdeaAndAnalyze({
      orgId,
      projectId,
      actorUserId: user.userId,
      rawIdea: body.rawIdea,
    });
  }

  @Post('sdlc/business-cases/:id/generate-epics')
  @UseGuards(OrgMembershipGuard)
  async generateEpics(
    @Param('id') businessCaseId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUserContext,
  ) {
    return this.sdlcService.generateEpicsFromBusinessCase({
      orgId,
      businessCaseId,
      actorUserId: user.userId,
    });
  }

  @Post('sdlc/epics/:id/generate-stories')
  @UseGuards(OrgMembershipGuard)
  async generateStories(
    @Param('id') epicId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUserContext,
  ) {
    return this.sdlcService.generateStoriesFromEpic({
      orgId,
      epicId,
      actorUserId: user.userId,
    });
  }

  @Post('projects/:projectId/sdlc/generate-architecture')
  @UseGuards(OrgMembershipGuard)
  async generateArchitecture(
    @Param('projectId') projectId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthUserContext,
  ) {
    return this.sdlcService.generateArchitectureProposal({
      orgId,
      projectId,
      actorUserId: user.userId,
    });
  }

  // --------------------------------------------------------------------------
  // HUMAN-IN-THE-LOOP STATUS & REVIEW ENDPOINTS
  // --------------------------------------------------------------------------

  @Patch('sdlc/business-cases/:id/status')
  @UseGuards(OrgMembershipGuard)
  async updateBusinessCaseStatus(
    @Param('id') id: string,
    @CurrentOrg() orgId: string,
    @Body() body: { status: ReviewStatus },
  ) {
    return this.sdlcService.updateBusinessCaseStatus(id, body.status, orgId);
  }

  @Patch('sdlc/epics/:id/status')
  @UseGuards(OrgMembershipGuard)
  async updateEpicStatus(
    @Param('id') id: string,
    @CurrentOrg() orgId: string,
    @Body() body: { status: ReviewStatus },
  ) {
    return this.sdlcService.updateEpicStatus(id, body.status, orgId);
  }

  @Patch('sdlc/user-stories/:id/status')
  @UseGuards(OrgMembershipGuard)
  async updateUserStoryStatus(
    @Param('id') id: string,
    @CurrentOrg() orgId: string,
    @Body() body: { status: ReviewStatus },
  ) {
    return this.sdlcService.updateUserStoryStatus(id, body.status, orgId);
  }

  @Patch('sdlc/architecture-proposals/:id/status')
  @UseGuards(OrgMembershipGuard)
  async updateArchitectureStatus(
    @Param('id') id: string,
    @CurrentOrg() orgId: string,
    @Body() body: { status: ReviewStatus },
  ) {
    return this.sdlcService.updateArchitectureStatus(id, body.status, orgId);
  }

  // --------------------------------------------------------------------------
  // LISTING ENDPOINTS
  // --------------------------------------------------------------------------

  @Get('projects/:projectId/sdlc/business-cases')
  @UseGuards(OrgMembershipGuard)
  async listBusinessCases(@Param('projectId') projectId: string) {
    return this.sdlcService.listBusinessCases(projectId);
  }

  @Get('projects/:projectId/sdlc/epics')
  @UseGuards(OrgMembershipGuard)
  async listEpics(@Param('projectId') projectId: string) {
    return this.sdlcService.listEpics(projectId);
  }

  @Get('projects/:projectId/sdlc/user-stories')
  @UseGuards(OrgMembershipGuard)
  async listUserStories(@Param('projectId') projectId: string) {
    return this.sdlcService.listUserStories(projectId);
  }

  @Get('projects/:projectId/sdlc/architecture-proposals')
  @UseGuards(OrgMembershipGuard)
  async listArchitectureProposals(@Param('projectId') projectId: string) {
    return this.sdlcService.listArchitectureProposals(projectId);
  }

  // --------------------------------------------------------------------------
  // INLINE FIELD UPDATES
  // --------------------------------------------------------------------------

  @Patch('sdlc/business-cases/:id')
  @UseGuards(OrgMembershipGuard)
  async updateBusinessCase(
    @Param('id') id: string,
    @Body() body: Partial<BusinessCase>,
  ) {
    return this.sdlcService.updateBusinessCase(id, body);
  }

  @Patch('sdlc/epics/:id')
  @UseGuards(OrgMembershipGuard)
  async updateEpic(
    @Param('id') id: string,
    @Body() body: Partial<Epic>,
  ) {
    return this.sdlcService.updateEpic(id, body);
  }

  @Patch('sdlc/user-stories/:id')
  @UseGuards(OrgMembershipGuard)
  async updateUserStory(
    @Param('id') id: string,
    @Body() body: Partial<UserStory>,
  ) {
    return this.sdlcService.updateUserStory(id, body);
  }

  // --------------------------------------------------------------------------
  // AUDIT LOGS
  // --------------------------------------------------------------------------

  @Get('projects/:projectId/sdlc/audit-logs')
  @UseGuards(OrgMembershipGuard)
  async getProjectAuditLogs(@Param('projectId') projectId: string) {
    return this.sdlcService.getProjectAuditLogs(projectId);
  }

  // --------------------------------------------------------------------------
  // TRACEABILITY GRAPH ENDPOINTS
  // --------------------------------------------------------------------------

  @Get('sdlc/traceability/story/:storyId')
  async getStoryLineage(@Param('storyId') storyId: string) {
    return this.sdlcService.getStoryUpstreamTraceability(storyId);
  }

  @Get('sdlc/traceability/business-case/:caseId')
  async getBusinessCaseDownstream(@Param('caseId') caseId: string) {
    return this.sdlcService.getBusinessCaseDownstreamTraceability(caseId);
  }
}
