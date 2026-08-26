import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SdlcRepository } from './sdlc.repository';
import { BusinessAnalystAgent } from '../agents/sdlc/business-analyst.agent';
import { ProductManagerAgent } from '../agents/sdlc/product-manager.agent';
import { RequirementsEngineerAgent } from '../agents/sdlc/requirements-engineer.agent';
import { ArchitectAgent } from '../agents/sdlc/architect.agent';
import { RAGService } from '../rag/rag.service';
import { ProjectsService } from '../projects/projects.service';
import {
  ArchitectureProposal,
  BusinessCase,
  Epic,
  ReviewStatus,
  UserStory,
} from '@ironloom/shared';
import { AuditLogRepository } from '../database/repositories/audit-log.repository';

@Injectable()
export class SdlcService {
  private readonly logger = new Logger(SdlcService.name);

  constructor(
    private readonly repo: SdlcRepository,
    private readonly baAgent: BusinessAnalystAgent,
    private readonly pmAgent: ProductManagerAgent,
    private readonly reAgent: RequirementsEngineerAgent,
    private readonly architectAgent: ArchitectAgent,
    private readonly ragService: RAGService,
    private readonly projectsService: ProjectsService,
    private readonly auditLogRepo: AuditLogRepository,
  ) {}

  // --------------------------------------------------------------------------
  // AGENT TRIGGER PIPELINES
  // --------------------------------------------------------------------------

  /**
   * 1. Submit raw idea -> Business Analyst Agent -> Structured BusinessCase
   */
  async submitIdeaAndAnalyze(params: {
    orgId: string;
    projectId: string;
    actorUserId: string;
    rawIdea: string;
  }): Promise<BusinessCase> {
    const project = await this.projectsService.getProject(params.projectId);

    const result = await this.baAgent.analyzeIdea({
      orgId: params.orgId,
      projectId: params.projectId,
      projectName: project.name,
      rawIdea: params.rawIdea,
    });

    const businessCase = await this.repo.createBusinessCase({
      orgId: params.orgId,
      projectId: params.projectId,
      rawIdea: params.rawIdea,
      problemStatement: result.businessCase.problemStatement,
      goals: result.businessCase.goals,
      targetUsers: result.businessCase.targetUsers,
      successMetrics: result.businessCase.successMetrics,
      assumptions: result.businessCase.assumptions,
      risks: result.businessCase.risks,
      status: 'in_review',
      version: 1,
    });

    this.logger.log(`Created Business Case ${businessCase.id} from idea submission`);
    return businessCase;
  }

  /**
   * 2. Business Case -> Product Manager Agent -> Epics Backlog
   */
  async generateEpicsFromBusinessCase(params: {
    orgId: string;
    businessCaseId: string;
    actorUserId: string;
  }): Promise<Epic[]> {
    const businessCase = await this.repo.getBusinessCase(params.businessCaseId);
    const project = await this.projectsService.getProject(businessCase.projectId);

    const result = await this.pmAgent.decomposeBusinessCase({
      orgId: params.orgId,
      projectId: businessCase.projectId,
      projectName: project.name,
      businessCase,
    });

    const createdEpics: Epic[] = [];
    for (const epicData of result.epicsOutput.epics) {
      const epic = await this.repo.createEpic({
        orgId: params.orgId,
        projectId: businessCase.projectId,
        businessCaseId: businessCase.id,
        title: epicData.title,
        description: epicData.description,
        rationale: epicData.rationale,
        priority: epicData.priority,
        sizing: epicData.sizing,
        status: 'in_review',
      });
      createdEpics.push(epic);
    }

    this.logger.log(`Generated ${createdEpics.length} epics for Business Case ${params.businessCaseId}`);
    return createdEpics;
  }

  /**
   * 3. Epic -> Requirements Engineer Agent -> User Stories with Gherkin Acceptance Criteria
   */
  async generateStoriesFromEpic(params: {
    orgId: string;
    epicId: string;
    actorUserId: string;
  }): Promise<UserStory[]> {
    const epic = await this.repo.getEpic(params.epicId);
    const project = await this.projectsService.getProject(epic.projectId);

    const result = await this.reAgent.generateUserStories({
      orgId: params.orgId,
      projectId: epic.projectId,
      projectName: project.name,
      epic,
    });

    const createdStories: UserStory[] = [];
    for (const storyData of result.userStoriesOutput.stories) {
      const story = await this.repo.createUserStory(
        {
          orgId: params.orgId,
          projectId: epic.projectId,
          epicId: epic.id,
          title: storyData.title,
          asA: storyData.asA,
          iWant: storyData.iWant,
          soThat: storyData.soThat,
          status: 'in_review',
        },
        storyData.acceptanceCriteria,
      );
      createdStories.push(story);
    }

    this.logger.log(`Generated ${createdStories.length} user stories for Epic ${params.epicId}`);
    return createdStories;
  }

  /**
   * 4. Requirements Set -> Architect Agent -> Versioned Architecture Proposal
   */
  async generateArchitectureProposal(params: {
    orgId: string;
    projectId: string;
    actorUserId: string;
  }): Promise<ArchitectureProposal> {
    const project = await this.projectsService.getProject(params.projectId);
    const epics = await this.repo.listEpics(params.projectId);
    const stories = await this.repo.listUserStories(params.projectId);

    const existingProposals = await this.repo.listArchitectureProposals(params.projectId);
    const nextVersion = existingProposals.length > 0 ? existingProposals[0].version + 1 : 1;

    const result = await this.architectAgent.designArchitecture({
      orgId: params.orgId,
      projectId: params.projectId,
      projectName: project.name,
      epics,
      stories,
    });

    const proposal = await this.repo.createArchitectureProposal({
      orgId: params.orgId,
      projectId: params.projectId,
      version: nextVersion,
      title: result.architectureOutput.title,
      summary: result.architectureOutput.summary,
      components: result.architectureOutput.components,
      techStack: result.architectureOutput.techStack,
      dataModel: result.architectureOutput.dataModel,
      diagramMermaid: result.architectureOutput.diagramMermaid,
      status: 'in_review',
    });

    this.logger.log(`Generated Architecture Proposal v${nextVersion} (${proposal.id}) for project ${params.projectId}`);
    return proposal;
  }

  // --------------------------------------------------------------------------
  // HUMAN-IN-THE-LOOP STATUS UPDATES & AUTO-RAG INGESTION
  // --------------------------------------------------------------------------

  async updateBusinessCaseStatus(
    id: string,
    status: ReviewStatus,
    orgId: string,
  ): Promise<BusinessCase> {
    const updated = await this.repo.updateBusinessCaseStatus(id, status);

    // If approved, ingest into RAG knowledge base for downstream agent memory
    if (status === 'approved') {
      const content = `Business Case Problem Statement: ${updated.problemStatement}\nGoals: ${updated.goals.join('; ')}\nTarget Users: ${updated.targetUsers.join(', ')}`;
      await this.ragService.ingestDocument({
        orgId,
        projectId: updated.projectId,
        documentType: 'business_case',
        documentId: updated.id,
        content,
        metadata: { version: updated.version },
      });
    }

    return updated;
  }

  async updateEpicStatus(id: string, status: ReviewStatus, orgId: string): Promise<Epic> {
    const updated = await this.repo.updateEpicStatus(id, status);
    return updated;
  }

  async updateUserStoryStatus(
    id: string,
    status: ReviewStatus,
    orgId: string,
  ): Promise<UserStory> {
    const updated = await this.repo.updateUserStoryStatus(id, status);

    // If approved, ingest into RAG
    if (status === 'approved') {
      const criteriaStr = updated.acceptanceCriteria
        .map((c) => `Scenario: ${c.scenarioTitle} | Given ${c.givenText} When ${c.whenText} Then ${c.thenText}`)
        .join('\n');
      const content = `User Story: ${updated.title}\nAs a ${updated.asA}, I want ${updated.iWant} so that ${updated.soThat}\nAcceptance Criteria:\n${criteriaStr}`;

      await this.ragService.ingestDocument({
        orgId,
        projectId: updated.projectId,
        documentType: 'user_story',
        documentId: updated.id,
        content,
        metadata: { epicId: updated.epicId },
      });
    }

    return updated;
  }

  async updateArchitectureStatus(
    id: string,
    status: ReviewStatus,
    orgId: string,
  ): Promise<ArchitectureProposal> {
    const updated = await this.repo.updateArchitectureStatus(id, status);

    if (status === 'approved') {
      const componentsStr = updated.components.map((c) => `${c.name}: ${c.description} [Tech: ${c.techChoice}]`).join('\n');
      const content = `Architecture Proposal v${updated.version}: ${updated.title}\nSummary: ${updated.summary}\nComponents:\n${componentsStr}`;

      await this.ragService.ingestDocument({
        orgId,
        projectId: updated.projectId,
        documentType: 'architecture_proposal',
        documentId: updated.id,
        content,
        metadata: { version: updated.version },
      });
    }

    return updated;
  }

  // --------------------------------------------------------------------------
  // BI-DIRECTIONAL TRACEABILITY GRAPH TRAVERSAL
  // --------------------------------------------------------------------------

  /**
   * Given a User Story ID -> Traverses upstream to Epic -> Business Case -> Project -> Raw Idea
   */
  async getStoryUpstreamTraceability(storyId: string): Promise<{
    story: UserStory;
    epic: Epic;
    businessCase: BusinessCase;
    project: any;
  }> {
    const story = await this.repo.getUserStory(storyId);
    const epic = await this.repo.getEpic(story.epicId);
    const businessCase = await this.repo.getBusinessCase(epic.businessCaseId);
    const project = await this.projectsService.getProject(story.projectId);

    return {
      story,
      epic,
      businessCase,
      project,
    };
  }

  /**
   * Given a Business Case ID -> Traverses downstream to all Epics, Stories, Criteria, and Architecture Proposals
   */
  async getBusinessCaseDownstreamTraceability(businessCaseId: string): Promise<{
    businessCase: BusinessCase;
    epics: Array<Epic & { userStories: UserStory[] }>;
    architectureProposals: ArchitectureProposal[];
  }> {
    const businessCase = await this.repo.getBusinessCase(businessCaseId);
    const allEpics = await this.repo.listEpics(businessCase.projectId);
    const allStories = await this.repo.listUserStories(businessCase.projectId);
    const architectureProposals = await this.repo.listArchitectureProposals(businessCase.projectId);

    const relevantEpics = allEpics.filter((e) => e.businessCaseId === businessCase.id);
    const epicsWithStories = relevantEpics.map((epic) => ({
      ...epic,
      userStories: allStories.filter((s) => s.epicId === epic.id),
    }));

    return {
      businessCase,
      epics: epicsWithStories,
      architectureProposals,
    };
  }

  // Listing Queries
  async listBusinessCases(projectId: string) {
    return this.repo.listBusinessCases(projectId);
  }

  async listEpics(projectId: string) {
    return this.repo.listEpics(projectId);
  }

  async listUserStories(projectId: string) {
    return this.repo.listUserStories(projectId);
  }

  async listArchitectureProposals(projectId: string) {
    return this.repo.listArchitectureProposals(projectId);
  }

  async updateBusinessCase(id: string, updates: Partial<BusinessCase>): Promise<BusinessCase> {
    return this.repo.updateBusinessCase(id, updates);
  }

  async updateEpic(id: string, updates: Partial<Epic>): Promise<Epic> {
    return this.repo.updateEpic(id, updates);
  }

  async updateUserStory(id: string, updates: Partial<UserStory>): Promise<UserStory> {
    return this.repo.updateUserStory(id, updates);
  }

  async getProjectAuditLogs(projectId: string, limit = 50) {
    return this.auditLogRepo.findByProject(projectId, limit);
  }
}
