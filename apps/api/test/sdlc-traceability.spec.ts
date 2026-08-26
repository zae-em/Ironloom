process.env.AI_DEFAULT_PROVIDER = 'mock';
process.env.GROQ_API_KEY = 'mock_key';

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SdlcService } from '../src/sdlc/sdlc.service';
import { SdlcRepository } from '../src/sdlc/sdlc.repository';
import { ProjectsService } from '../src/projects/projects.service';
import { BusinessAnalystAgent } from '../src/agents/sdlc/business-analyst.agent';
import { ProductManagerAgent } from '../src/agents/sdlc/product-manager.agent';
import { RequirementsEngineerAgent } from '../src/agents/sdlc/requirements-engineer.agent';
import { ArchitectAgent } from '../src/agents/sdlc/architect.agent';
import { ToolRegistry } from '../src/agents/core/tools/tool.registry';
import { PromptTemplateService } from '../src/agents/core/prompts/prompt-template.service';
import { AiGatewayService } from '../src/ai-gateway/ai-gateway.service';
import { RAGService } from '../src/rag/rag.service';
import { EmbeddingService } from '../src/rag/embedding.service';
import { SupabaseService } from '../src/database/supabase.service';
import { AuditLogRepository } from '../src/database/repositories/audit-log.repository';
import { ProviderRegistryService } from '../src/ai-gateway/adapters/provider-registry.service';
import { CostCalculatorService } from '../src/ai-gateway/cost/cost-calculator.service';
import { QuotaTrackerService } from '../src/ai-gateway/quota/quota-tracker.service';
import { RedisService } from '../src/redis/redis.service';
import { MockAdapter } from '../src/ai-gateway/adapters/mock.adapter';
import { OllamaAdapter } from '../src/ai-gateway/adapters/ollama.adapter';
import { GroqAdapter } from '../src/ai-gateway/adapters/groq.adapter';
import { ArchitectureProposal, BusinessCase, Epic, UserStory } from '@ironloom/shared';

describe('SDLC Full Pipeline & Bi-Directional Traceability Integration Tests', () => {
  let sdlcService: SdlcService;
  let projectsService: ProjectsService;

  const ORG_ALPHA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ACTOR_ALICE = '11111111-1111-1111-1111-111111111111';
  let testProjectId: string;

  const rawIdea =
    'Build a high-reliability drone collision avoidance system that alerts operators in under 100ms.';
  let businessCase: BusinessCase;
  let primaryEpic: Epic;
  let primaryStory: UserStory;
  let architectureProposal: ArchitectureProposal;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              aiGateway: {
                defaultProvider: 'mock',
                fallbackProviders: [],
                maxRetries: 1,
                retryDelayMs: 10,
                ollama: {
                  baseUrl: 'http://localhost:11434',
                  defaultModel: 'llama3.1',
                  timeoutMs: 1000,
                },
                groq: {
                  apiKey: 'mock_key',
                  baseUrl: 'https://api.groq.com',
                  defaultModel: 'llama-3.3-70b-versatile',
                  timeoutMs: 1000,
                },
              },
              supabase: { url: 'http://localhost:54321', serviceRoleKey: 'test_key' },
            }),
          ],
        }),
      ],
      providers: [
        ToolRegistry,
        PromptTemplateService,
        AiGatewayService,
        ProviderRegistryService,
        CostCalculatorService,
        QuotaTrackerService,
        RedisService,
        AuditLogRepository,
        SupabaseService,
        MockAdapter,
        OllamaAdapter,
        GroqAdapter,
        EmbeddingService,
        RAGService,
        BusinessAnalystAgent,
        ProductManagerAgent,
        RequirementsEngineerAgent,
        ArchitectAgent,
        SdlcRepository,
        ProjectsService,
        SdlcService,
      ],
    }).compile();

    await module.init();

    sdlcService = module.get<SdlcService>(SdlcService);
    projectsService = module.get<ProjectsService>(ProjectsService);

    const proj = await projectsService.createProject(ORG_ALPHA, ACTOR_ALICE, {
      name: 'Autonomous Flight Controller',
      description: 'Vision guidance and real-time obstacle avoidance telemetry.',
    });
    testProjectId = proj.id;
  });

  it('Step 1: Submit Raw Idea -> BA Agent generates structured BusinessCase', async () => {
    businessCase = await sdlcService.submitIdeaAndAnalyze({
      orgId: ORG_ALPHA,
      projectId: testProjectId,
      actorUserId: ACTOR_ALICE,
      rawIdea,
    });

    expect(businessCase).toBeDefined();
    expect(businessCase.id).toBeDefined();
    expect(businessCase.status).toBe('in_review');
    expect(businessCase.problemStatement).toBeDefined();
    expect(businessCase.goals.length).toBeGreaterThan(0);
  }, 60000);

  it('Step 2: Human Approves BusinessCase -> PM Agent generates Epics Backlog', async () => {
    const approvedCase = await sdlcService.updateBusinessCaseStatus(
      businessCase.id,
      'approved',
      ORG_ALPHA,
    );
    expect(approvedCase.status).toBe('approved');

    const epics = await sdlcService.generateEpicsFromBusinessCase({
      orgId: ORG_ALPHA,
      businessCaseId: businessCase.id,
      actorUserId: ACTOR_ALICE,
    });

    expect(epics.length).toBeGreaterThan(0);
    primaryEpic = epics[0];
    expect(primaryEpic.businessCaseId).toBe(businessCase.id);
    expect(primaryEpic.projectId).toBe(testProjectId);
  }, 60000);

  it('Step 3: Human Approves Epic -> RE Agent generates User Stories & Gherkin Criteria', async () => {
    await sdlcService.updateEpicStatus(primaryEpic.id, 'approved', ORG_ALPHA);

    const stories = await sdlcService.generateStoriesFromEpic({
      orgId: ORG_ALPHA,
      epicId: primaryEpic.id,
      actorUserId: ACTOR_ALICE,
    });

    expect(stories.length).toBeGreaterThan(0);
    primaryStory = stories[0];
    expect(primaryStory.epicId).toBe(primaryEpic.id);
    expect(primaryStory.asA).toBeDefined();
    expect(primaryStory.iWant).toBeDefined();
    expect(primaryStory.soThat).toBeDefined();
    expect(primaryStory.acceptanceCriteria.length).toBeGreaterThan(0);

    const firstCriteria = primaryStory.acceptanceCriteria[0];
    expect(firstCriteria.givenText).toBeDefined();
    expect(firstCriteria.whenText).toBeDefined();
    expect(firstCriteria.thenText).toBeDefined();
  }, 60000);

  it('Step 4a: Human Approves User Story (Auto-Ingests into RAG Knowledge Store)', async () => {
    const updatedStory = await sdlcService.updateUserStoryStatus(
      primaryStory.id,
      'approved',
      ORG_ALPHA,
    );
    expect(updatedStory.status).toBe('approved');
  }, 60000);

  it('Step 4b: Architect Agent generates Versioned Architecture Proposal', async () => {
    architectureProposal = await sdlcService.generateArchitectureProposal({
      orgId: ORG_ALPHA,
      projectId: testProjectId,
      actorUserId: ACTOR_ALICE,
    });

    expect(architectureProposal).toBeDefined();
    expect(architectureProposal.version).toBe(1);
    expect(architectureProposal.components.length).toBeGreaterThan(0);
    expect(architectureProposal.techStack.length).toBeGreaterThan(0);
    expect(architectureProposal.dataModel.entities.length).toBeGreaterThan(0);
    expect(architectureProposal.diagramMermaid).toContain('graph');
  }, 60000);

  it('Step 5: Verify Upstream Traceability (Story -> Epic -> Business Case -> Project -> Raw Idea)', async () => {
    const upstream = await sdlcService.getStoryUpstreamTraceability(primaryStory.id);
    expect(upstream.story.id).toBe(primaryStory.id);
    expect(upstream.epic.id).toBe(primaryEpic.id);
    expect(upstream.businessCase.id).toBe(businessCase.id);
    expect(upstream.businessCase.rawIdea).toBe(rawIdea);
    expect(upstream.project.id).toBe(testProjectId);
  }, 60000);

  it('Step 6: Verify Downstream Traceability (Business Case -> Epics -> Stories -> Proposals)', async () => {
    const downstream = await sdlcService.getBusinessCaseDownstreamTraceability(businessCase.id);
    expect(downstream.businessCase.id).toBe(businessCase.id);
    expect(downstream.epics.length).toBeGreaterThan(0);
    expect(downstream.epics[0].userStories.length).toBeGreaterThan(0);
    expect(downstream.architectureProposals.length).toBeGreaterThan(0);
  }, 60000);
});
