import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import {
  AcceptanceCriterion,
  ArchitectureProposal,
  BusinessCase,
  Epic,
  ReviewStatus,
  UserStory,
} from '@ironloom/shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SdlcRepository {
  private readonly logger = new Logger(SdlcRepository.name);

  // In-memory data structures for fast fallback & tests
  private readonly memoryBusinessCases = new Map<string, BusinessCase>();
  private readonly memoryEpics = new Map<string, Epic>();
  private readonly memoryStories = new Map<string, UserStory>();
  private readonly memoryCriteria = new Map<string, AcceptanceCriterion>();
  private readonly memoryArchitecture = new Map<string, ArchitectureProposal>();

  constructor(private readonly supabaseService: SupabaseService) {}

  // --------------------------------------------------------------------------
  // BUSINESS CASES
  // --------------------------------------------------------------------------
  async createBusinessCase(
    item: Omit<BusinessCase, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BusinessCase> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: BusinessCase = {
      id,
      ...item,
      createdAt: now,
      updatedAt: now,
    };

    const admin = this.supabaseService.getAdminClient();
    try {
      await admin.from('business_cases').insert({
        id: record.id,
        org_id: record.orgId,
        project_id: record.projectId,
        raw_idea: record.rawIdea,
        problem_statement: record.problemStatement,
        goals: record.goals,
        target_users: record.targetUsers,
        success_metrics: record.successMetrics,
        assumptions: record.assumptions,
        risks: record.risks,
        status: record.status,
        version: record.version,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      });
    } catch {}

    this.memoryBusinessCases.set(id, record);
    return record;
  }

  async getBusinessCase(id: string): Promise<BusinessCase> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data, error } = await admin.from('business_cases').select('*').eq('id', id).single();
      if (!error && data) {
        return {
          id: data.id,
          orgId: data.org_id,
          projectId: data.project_id,
          rawIdea: data.raw_idea,
          problemStatement: data.problem_statement,
          goals: data.goals || [],
          targetUsers: data.target_users || [],
          successMetrics: data.success_metrics || [],
          assumptions: data.assumptions || [],
          risks: data.risks || [],
          status: data.status,
          version: data.version,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    } catch {}

    const memory = this.memoryBusinessCases.get(id);
    if (!memory) throw new NotFoundException(`Business Case ${id} not found`);
    return memory;
  }

  async listBusinessCases(projectId: string): Promise<BusinessCase[]> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data, error } = await admin
        .from('business_cases')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          orgId: d.org_id,
          projectId: d.project_id,
          rawIdea: d.raw_idea,
          problemStatement: d.problem_statement,
          goals: d.goals || [],
          targetUsers: d.target_users || [],
          successMetrics: d.success_metrics || [],
          assumptions: d.assumptions || [],
          risks: d.risks || [],
          status: d.status,
          version: d.version,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch {}

    return Array.from(this.memoryBusinessCases.values()).filter((bc) => bc.projectId === projectId);
  }

  async updateBusinessCaseStatus(id: string, status: ReviewStatus): Promise<BusinessCase> {
    return this.updateBusinessCase(id, { status });
  }

  async updateBusinessCase(id: string, updates: Partial<BusinessCase>): Promise<BusinessCase> {
    const current = await this.getBusinessCase(id);
    const updated: BusinessCase = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const admin = this.supabaseService.getAdminClient();
    try {
      await admin
        .from('business_cases')
        .update({
          problem_statement: updated.problemStatement,
          goals: updated.goals,
          target_users: updated.targetUsers,
          success_metrics: updated.successMetrics,
          assumptions: updated.assumptions,
          risks: updated.risks,
          status: updated.status,
          updated_at: updated.updatedAt,
        })
        .eq('id', id);
    } catch {}

    this.memoryBusinessCases.set(id, updated);
    return updated;
  }

  // --------------------------------------------------------------------------
  // EPICS
  // --------------------------------------------------------------------------
  async createEpic(item: Omit<Epic, 'id' | 'createdAt' | 'updatedAt'>): Promise<Epic> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: Epic = {
      id,
      ...item,
      createdAt: now,
      updatedAt: now,
    };

    const admin = this.supabaseService.getAdminClient();
    try {
      await admin.from('epics').insert({
        id: record.id,
        org_id: record.orgId,
        project_id: record.projectId,
        business_case_id: record.businessCaseId,
        title: record.title,
        description: record.description,
        rationale: record.rationale,
        priority: record.priority,
        sizing: record.sizing,
        status: record.status,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      });
    } catch {}

    this.memoryEpics.set(id, record);
    return record;
  }

  async getEpic(id: string): Promise<Epic> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data, error } = await admin.from('epics').select('*').eq('id', id).single();
      if (!error && data) {
        return {
          id: data.id,
          orgId: data.org_id,
          projectId: data.project_id,
          businessCaseId: data.business_case_id,
          title: data.title,
          description: data.description,
          rationale: data.rationale,
          priority: data.priority,
          sizing: data.sizing,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    } catch {}

    const memory = this.memoryEpics.get(id);
    if (!memory) throw new NotFoundException(`Epic ${id} not found`);
    return memory;
  }

  async listEpics(projectId: string): Promise<Epic[]> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data, error } = await admin
        .from('epics')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          orgId: d.org_id,
          projectId: d.project_id,
          businessCaseId: d.business_case_id,
          title: d.title,
          description: d.description,
          rationale: d.rationale,
          priority: d.priority,
          sizing: d.sizing,
          status: d.status,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch {}

    return Array.from(this.memoryEpics.values()).filter((e) => e.projectId === projectId);
  }

  async updateEpicStatus(id: string, status: ReviewStatus): Promise<Epic> {
    return this.updateEpic(id, { status });
  }

  async updateEpic(id: string, updates: Partial<Epic>): Promise<Epic> {
    const current = await this.getEpic(id);
    const updated: Epic = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const admin = this.supabaseService.getAdminClient();
    try {
      await admin
        .from('epics')
        .update({
          title: updated.title,
          description: updated.description,
          rationale: updated.rationale,
          priority: updated.priority,
          sizing: updated.sizing,
          status: updated.status,
          updated_at: updated.updatedAt,
        })
        .eq('id', id);
    } catch {}

    this.memoryEpics.set(id, updated);
    return updated;
  }

  // --------------------------------------------------------------------------
  // USER STORIES & ACCEPTANCE CRITERIA
  // --------------------------------------------------------------------------
  async createUserStory(
    item: Omit<UserStory, 'id' | 'createdAt' | 'updatedAt' | 'acceptanceCriteria'>,
    criteria: Array<Omit<AcceptanceCriterion, 'id' | 'userStoryId' | 'createdAt'>>,
  ): Promise<UserStory> {
    const storyId = uuidv4();
    const now = new Date().toISOString();

    const createdCriteria: AcceptanceCriterion[] = criteria.map((c) => {
      const critId = uuidv4();
      const critRecord: AcceptanceCriterion = {
        id: critId,
        userStoryId: storyId,
        scenarioTitle: c.scenarioTitle,
        givenText: c.givenText,
        whenText: c.whenText,
        thenText: c.thenText,
        createdAt: now,
      };
      this.memoryCriteria.set(critId, critRecord);
      return critRecord;
    });

    const storyRecord: UserStory = {
      id: storyId,
      ...item,
      status: item.status || 'draft',
      acceptanceCriteria: createdCriteria,
      createdAt: now,
      updatedAt: now,
    };

    const admin = this.supabaseService.getAdminClient();
    try {
      await admin.from('user_stories').insert({
        id: storyRecord.id,
        org_id: storyRecord.orgId,
        project_id: storyRecord.projectId,
        epic_id: storyRecord.epicId,
        title: storyRecord.title,
        as_a: storyRecord.asA,
        i_want: storyRecord.iWant,
        so_that: storyRecord.soThat,
        status: storyRecord.status,
        created_at: storyRecord.createdAt,
        updated_at: storyRecord.updatedAt,
      });

      for (const crit of createdCriteria) {
        await admin.from('acceptance_criteria').insert({
          id: crit.id,
          org_id: storyRecord.orgId,
          project_id: storyRecord.projectId,
          user_story_id: storyId,
          scenario_title: crit.scenarioTitle,
          given_text: crit.givenText,
          when_text: crit.whenText,
          then_text: crit.thenText,
          created_at: now,
        });
      }
    } catch {}

    this.memoryStories.set(storyId, storyRecord);
    return storyRecord;
  }

  async getUserStory(id: string): Promise<UserStory> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data: s, error } = await admin
        .from('user_stories')
        .select('*, acceptance_criteria(*)')
        .eq('id', id)
        .single();

      if (!error && s) {
        const critList = (s.acceptance_criteria || []).map((c: any) => ({
          id: c.id,
          userStoryId: c.user_story_id,
          scenarioTitle: c.scenario_title,
          givenText: c.given_text,
          whenText: c.when_text,
          thenText: c.then_text,
          createdAt: c.created_at,
        }));

        return {
          id: s.id,
          orgId: s.org_id,
          projectId: s.project_id,
          epicId: s.epic_id,
          title: s.title,
          asA: s.as_a,
          iWant: s.i_want,
          soThat: s.so_that,
          status: s.status,
          acceptanceCriteria: critList,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        };
      }
    } catch {}

    const memory = this.memoryStories.get(id);
    if (!memory) throw new NotFoundException(`User Story ${id} not found`);
    return memory;
  }

  async listUserStories(projectId: string): Promise<UserStory[]> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data, error } = await admin
        .from('user_stories')
        .select('*, acceptance_criteria(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((s: any) => ({
          id: s.id,
          orgId: s.org_id,
          projectId: s.project_id,
          epicId: s.epic_id,
          title: s.title,
          asA: s.as_a,
          iWant: s.i_want,
          soThat: s.so_that,
          status: s.status,
          acceptanceCriteria: (s.acceptance_criteria || []).map((c: any) => ({
            id: c.id,
            userStoryId: c.user_story_id,
            scenarioTitle: c.scenario_title,
            givenText: c.given_text,
            whenText: c.when_text,
            thenText: c.then_text,
            createdAt: c.created_at,
          })),
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        }));
      }
    } catch {}

    return Array.from(this.memoryStories.values()).filter((s) => s.projectId === projectId);
  }

  async updateUserStoryStatus(id: string, status: ReviewStatus): Promise<UserStory> {
    return this.updateUserStory(id, { status });
  }

  async updateUserStory(id: string, updates: Partial<UserStory>): Promise<UserStory> {
    const current = await this.getUserStory(id);
    const updated: UserStory = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const admin = this.supabaseService.getAdminClient();
    try {
      await admin
        .from('user_stories')
        .update({
          title: updated.title,
          as_a: updated.asA,
          i_want: updated.iWant,
          so_that: updated.soThat,
          status: updated.status,
          updated_at: updated.updatedAt,
        })
        .eq('id', id);
    } catch {}

    this.memoryStories.set(id, updated);
    return updated;
  }

  // --------------------------------------------------------------------------
  // ARCHITECTURE PROPOSALS
  // --------------------------------------------------------------------------
  async createArchitectureProposal(
    item: Omit<ArchitectureProposal, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ArchitectureProposal> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: ArchitectureProposal = {
      id,
      ...item,
      createdAt: now,
      updatedAt: now,
    };

    const admin = this.supabaseService.getAdminClient();
    try {
      await admin.from('architecture_proposals').insert({
        id: record.id,
        org_id: record.orgId,
        project_id: record.projectId,
        version: record.version,
        title: record.title,
        summary: record.summary,
        components: record.components,
        tech_stack: record.techStack,
        data_model: record.dataModel,
        diagram_mermaid: record.diagramMermaid,
        status: record.status,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      });
    } catch {}

    this.memoryArchitecture.set(id, record);
    return record;
  }

  async getArchitectureProposal(id: string): Promise<ArchitectureProposal> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data, error } = await admin
        .from('architecture_proposals')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        return {
          id: data.id,
          orgId: data.org_id,
          projectId: data.project_id,
          version: data.version,
          title: data.title,
          summary: data.summary,
          components: data.components || [],
          techStack: data.tech_stack || [],
          dataModel: data.data_model || { entities: [], relationships: [] },
          diagramMermaid: data.diagram_mermaid || '',
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    } catch {}

    const memory = this.memoryArchitecture.get(id);
    if (!memory) throw new NotFoundException(`Architecture Proposal ${id} not found`);
    return memory;
  }

  async listArchitectureProposals(projectId: string): Promise<ArchitectureProposal[]> {
    const admin = this.supabaseService.getAdminClient();
    try {
      const { data, error } = await admin
        .from('architecture_proposals')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          orgId: d.org_id,
          projectId: d.project_id,
          version: d.version,
          title: d.title,
          summary: d.summary,
          components: d.components || [],
          techStack: d.tech_stack || [],
          dataModel: d.data_model || { entities: [], relationships: [] },
          diagramMermaid: d.diagram_mermaid || '',
          status: d.status,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch {}

    return Array.from(this.memoryArchitecture.values())
      .filter((ap) => ap.projectId === projectId)
      .sort((a, b) => b.version - a.version);
  }

  async updateArchitectureStatus(id: string, status: ReviewStatus): Promise<ArchitectureProposal> {
    const current = await this.getArchitectureProposal(id);
    current.status = status;
    current.updatedAt = new Date().toISOString();

    const admin = this.supabaseService.getAdminClient();
    try {
      await admin
        .from('architecture_proposals')
        .update({ status, updated_at: current.updatedAt })
        .eq('id', id);
    } catch {}

    this.memoryArchitecture.set(id, current);
    return current;
  }
}
