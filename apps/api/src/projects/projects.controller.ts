import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUserContext, CreateProjectDto } from '@ironloom/shared';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('organizations/:orgId/projects')
  @UseGuards(OrgMembershipGuard)
  async listOrgProjects(@Param('orgId') orgId: string) {
    return this.projectsService.listProjects(orgId);
  }

  @Post('organizations/:orgId/projects')
  @UseGuards(OrgMembershipGuard)
  async createOrgProject(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthUserContext,
    @Body() body: CreateProjectDto,
  ) {
    return this.projectsService.createProject(orgId, user.userId, body);
  }

  @Get('projects/:id')
  async getProject(@Param('id') id: string) {
    return this.projectsService.getProject(id);
  }
}
