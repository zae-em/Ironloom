import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { AuditLogRepository } from '../database/repositories/audit-log.repository';
import { CreateProjectDto, Project } from '@ironloom/shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  private readonly memoryProjects = new Map<string, Project[]>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auditRepo: AuditLogRepository,
  ) {
    // Seed initial project for Alpha Robotics
    const defaultAlphaOrg = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    this.memoryProjects.set(defaultAlphaOrg, [
      {
        id: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
        orgId: defaultAlphaOrg,
        name: 'Autonomous Drone Navigation',
        description: 'Next-gen vision guidance and obstacle avoidance system',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  }

  async listProjects(orgId: string): Promise<Project[]> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data, error } = await admin
        .from('projects')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as Project[];
      }
    } catch {}

    return this.memoryProjects.get(orgId) || [];
  }

  async createProject(
    orgId: string,
    actorUserId: string,
    dto: CreateProjectDto,
  ): Promise<Project> {
    const projectId = uuidv4();
    const now = new Date().toISOString();
    const admin = this.supabaseService.getAdminClient();

    const project: Project = {
      id: projectId,
      orgId,
      name: dto.name,
      description: dto.description || null,
      status: dto.status || 'active',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const { error } = await admin.from('projects').insert({
        id: project.id,
        org_id: project.orgId,
        name: project.name,
        description: project.description,
        status: project.status,
        created_at: now,
        updated_at: now,
      });

      if (error) throw error;
      this.logger.log(`Created project ${dto.name} (${projectId}) in org ${orgId}`);
    } catch (err: any) {
      this.logger.debug(`Supabase createProject fallback (${err.message})`);
    }

    const orgProjects = this.memoryProjects.get(orgId) || [];
    orgProjects.unshift(project);
    this.memoryProjects.set(orgId, orgProjects);

    // Audit log
    await this.auditRepo.create({
      orgId,
      projectId,
      actorType: 'user',
      actorId: actorUserId,
      action: 'project.create',
      input: dto as any,
      output: { projectId, name: dto.name },
      status: 'success',
    });

    return project;
  }

  async getProject(projectId: string): Promise<Project> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data, error } = await admin.from('projects').select('*').eq('id', projectId).single();
      if (!error && data) return data as Project;
    } catch {}

    for (const projects of this.memoryProjects.values()) {
      const p = projects.find((proj) => proj.id === projectId);
      if (p) return p;
    }

    throw new NotFoundException(`Project ${projectId} not found`);
  }
}
