import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
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
import { BusinessCase, Epic } from '@ironloom/shared';

describe('SDLC Specialized Agents Unit Tests', () => {
  let baAgent: BusinessAnalystAgent;
  let pmAgent: ProductManagerAgent;
  let reAgent: RequirementsEngineerAgent;
  let architectAgent: ArchitectAgent;

  beforeEach(async () => {
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
      ],
    }).compile();

    await module.init();

    baAgent = module.get<BusinessAnalystAgent>(BusinessAnalystAgent);
    pmAgent = module.get<ProductManagerAgent>(ProductManagerAgent);
    reAgent = module.get<RequirementsEngineerAgent>(RequirementsEngineerAgent);
    architectAgent = module.get<ArchitectAgent>(ArchitectAgent);
  });

  it('BusinessAnalystAgent should analyze raw idea and emit structured BusinessCase', async () => {
    const result = await baAgent.analyzeIdea({
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      projectId: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
      projectName: 'Telemetry Core',
      rawIdea: 'Build an autonomous real-time drone anomaly detector that alerts flight operators.',
    });

    expect(result).toBeDefined();
    expect(result.businessCase.problemStatement).toBeDefined();
    expect(result.businessCase.goals.length).toBeGreaterThan(0);
    expect(result.businessCase.targetUsers.length).toBeGreaterThan(0);
    expect(result.businessCase.successMetrics.length).toBeGreaterThan(0);
  });

  it('ProductManagerAgent should decompose business case into prioritized Epics with T-shirt sizing', async () => {
    const mockCase: BusinessCase = {
      id: 'case-123',
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      projectId: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
      rawIdea: 'Build drone anomaly detector',
      problemStatement: 'Manual monitoring causes delayed flight alerts',
      goals: ['Real-time telemetry evaluation', 'Sub-second emergency triggers'],
      targetUsers: ['Flight Operators', 'Fleet Managers'],
      successMetrics: ['Reduce incident response time by 80%'],
      assumptions: ['Sensors stream UDP protobufs'],
      risks: ['Network dropouts'],
      status: 'approved',
      version: 1,
    };

    const result = await pmAgent.decomposeBusinessCase({
      orgId: mockCase.orgId,
      projectId: mockCase.projectId,
      projectName: 'Telemetry Core',
      businessCase: mockCase,
    });

    expect(result.epicsOutput.epics.length).toBeGreaterThan(0);
    const epic = result.epicsOutput.epics[0];
    expect(epic.title).toBeDefined();
    expect(epic.description).toBeDefined();
    expect(epic.rationale).toBeDefined();
    expect(['critical', 'high', 'medium', 'low']).toContain(epic.priority);
    expect(['XS', 'S', 'M', 'L', 'XL']).toContain(epic.sizing);
  });

  it('RequirementsEngineerAgent should generate User Stories and Gherkin Acceptance Criteria', async () => {
    const mockEpic: Epic = {
      id: 'epic-123',
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      projectId: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
      businessCaseId: 'case-123',
      title: 'Sensor Telemetry Processing',
      description: 'Stream ingestion for sensor telemetry packets',
      rationale: 'Core foundation for anomaly detection',
      priority: 'critical',
      sizing: 'L',
      status: 'approved',
    };

    const result = await reAgent.generateUserStories({
      orgId: mockEpic.orgId,
      projectId: mockEpic.projectId,
      projectName: 'Telemetry Core',
      epic: mockEpic,
    });

    expect(result.userStoriesOutput.stories.length).toBeGreaterThan(0);
    const story = result.userStoriesOutput.stories[0];
    expect(story.title).toBeDefined();
    expect(story.asA).toBeDefined();
    expect(story.iWant).toBeDefined();
    expect(story.soThat).toBeDefined();
    expect(story.acceptanceCriteria.length).toBeGreaterThan(0);

    const criterion = story.acceptanceCriteria[0];
    expect(criterion.scenarioTitle).toBeDefined();
    expect(criterion.givenText).toBeDefined();
    expect(criterion.whenText).toBeDefined();
    expect(criterion.thenText).toBeDefined();
  });

  it('ArchitectAgent should design versioned Architecture Proposal with components and data model', async () => {
    const result = await architectAgent.designArchitecture({
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      projectId: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
      projectName: 'Telemetry Core',
      epics: [],
      stories: [
        {
          id: 'story-1',
          orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          projectId: 'a1a1a1a1-a1a1-a1a1-a1a1a1a1a1a1',
          epicId: 'epic-1',
          title: 'Ingest Telemetry',
          asA: 'Service',
          iWant: 'to process packets',
          soThat: 'detect anomalies',
          status: 'approved',
          acceptanceCriteria: [],
        },
      ],
    });

    expect(result.architectureOutput.title).toBeDefined();
    expect(result.architectureOutput.summary).toBeDefined();
    expect(result.architectureOutput.components.length).toBeGreaterThan(0);
    expect(result.architectureOutput.techStack.length).toBeGreaterThan(0);
    expect(result.architectureOutput.dataModel.entities.length).toBeGreaterThan(0);
    expect(result.architectureOutput.diagramMermaid).toContain('graph');
  });
});
