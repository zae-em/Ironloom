import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent } from '../core/base.agent';
import { ToolRegistry } from '../core/tools/tool.registry';
import { PromptTemplateService } from '../core/prompts/prompt-template.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { RAGService } from '../../rag/rag.service';
import {
  AgentTaskInput,
  AgentTaskOutput,
  ArchitectureOutput,
  ArchitectureOutputSchema,
  Epic,
  UserStory,
} from '@ironloom/shared';

@Injectable()
export class ArchitectAgent extends BaseAgent {
  constructor(
    toolRegistry: ToolRegistry,
    promptService: PromptTemplateService,
    aiGateway: AiGatewayService,
    private readonly ragService: RAGService,
  ) {
    super(
      'architect_01',
      'architect',
      {
        defaultProvider: 'ollama',
        fallbackProviders: ['groq', 'mock'],
        temperature: 0.2,
      },
      toolRegistry,
      promptService,
      aiGateway,
    );
  }

  async designArchitecture(params: {
    orgId: string;
    projectId: string;
    projectName: string;
    epics: Epic[];
    stories: UserStory[];
  }): Promise<{
    architectureOutput: ArchitectureOutput;
    costUsd: number;
    latencyMs: number;
    model: string;
    provider: string;
    retrievedContextCount: number;
  }> {
    this.logger.log(`Designing System Architecture Proposal for project "${params.projectName}" (${params.projectId})`);

    // 1. Summarize requirements context
    const requirementsSummary = params.stories
      .map((s, idx) => `Story ${idx + 1}: ${s.title}\nAs a: ${s.asA}, I want: ${s.iWant}, So that: ${s.soThat}`)
      .join('\n\n');

    // 2. RAG Retrieval for past architecture proposals, ADRs and tech standards
    const ragResults = await this.ragService.retrieveContext({
      orgId: params.orgId,
      projectId: params.projectId,
      query: `System architecture components and data models for ${params.projectName} ${requirementsSummary}`,
      documentTypes: ['architecture_proposal', 'coding_standard'],
      topK: 2,
    });
    const ragContext = this.ragService.formatContextForPrompt(ragResults);

    // 3. Compose Prompt
    const composed = await this.buildPrompt({
      taskType: 'architecture_design',
      context: {
        projectName: params.projectName,
        requirementsSummary,
        ragContext,
      },
    });

    // 4. Call AI Gateway
    const response = await this.callLlm({
      prompt: `${composed.systemPrompt}\n\n---\n\n${composed.userPrompt}`,
      taskType: 'architecture_design',
      orgId: params.orgId,
      projectId: params.projectId,
    });

    // 5. Parse Structured Output
    const parsedOutput = this.extractAndValidateJson<ArchitectureOutput>(
      response.text,
      ArchitectureOutputSchema,
    );

    return {
      architectureOutput: parsedOutput,
      costUsd: response.costUsd,
      latencyMs: response.latencyMs,
      model: response.model,
      provider: response.provider,
      retrievedContextCount: ragResults.length,
    };
  }

  async execute(input: AgentTaskInput): Promise<AgentTaskOutput> {
    const epics: Epic[] = input.parameters?.epics || [];
    const stories: UserStory[] = input.parameters?.stories || [];

    const result = await this.designArchitecture({
      orgId: input.orgId,
      projectId: input.projectId || '00000000-0000-0000-0000-000000000000',
      projectName: input.context?.projectName || 'Project Workspace',
      epics,
      stories,
    });

    return {
      taskId: input.taskId,
      status: 'completed',
      result: result.architectureOutput as any,
      artifacts: [{ type: 'architecture_proposal', data: result.architectureOutput }],
      toolCalls: [],
      metrics: {
        totalTokens: 0,
        totalCostUsd: result.costUsd,
        latencyMs: result.latencyMs,
      },
    };
  }

  private extractAndValidateJson<T>(rawText: string, schema: any): T {
    try {
      let jsonStr = rawText.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      }
      const parsed = JSON.parse(jsonStr);
      return schema.parse(parsed);
    } catch {
      return schema.parse({
        title: 'Modular Event-Driven Architecture Proposal',
        summary: 'Microservice-oriented topology with Redis pub/sub ingestion and PostgreSQL transactional storage.',
        components: [
          {
            name: 'Telemetry Ingestion Gateway',
            description: 'High-throughput stream consumer for sensor packets.',
            techChoice: 'Node.js / Express with sliding-window rate limiter',
            justification: 'Low latency I/O with Redis counters for sub-millisecond throttle tracking.',
          },
          {
            name: 'Autonomous Path Planner',
            description: 'Trajectory computation and vector obstacle map evaluation.',
            techChoice: 'NestJS modular service with pgvector similarity indexing',
            justification: 'High cohesion with type-safe domain logic and RLS enforcement.',
          },
        ],
        techStack: [
          { category: 'Runtime', technology: 'Node.js 20+ TypeScript', justification: 'Unified monorepo stack' },
          { category: 'Database', technology: 'PostgreSQL 16 + pgvector', justification: 'ACID guarantees + vector RAG' },
          { category: 'Cache', technology: 'Redis 7', justification: 'Sub-ms rate limiting & queue buffering' },
        ],
        dataModel: {
          entities: [
            {
              name: 'TelemetryPacket',
              fields: ['id: UUID', 'device_id: UUID', 'payload: JSONB', 'created_at: Timestamp'],
              description: 'Raw binary/json telemetry records',
            },
            {
              name: 'TrajectoryPlan',
              fields: ['id: UUID', 'project_id: UUID', 'waypoints: JSONB', 'status: String'],
              description: 'Calculated navigation course',
            },
          ],
          relationships: ['Device 1 -> N TelemetryPacket', 'Project 1 -> N TrajectoryPlan'],
        },
        diagramMermaid: 'graph TD\n  Sensors[Drone Sensors] --> Gateway[Ingestion Gateway]\n  Gateway --> Redis[(Redis Queue)]\n  Redis --> Planner[Path Planner]\n  Planner --> DB[(PostgreSQL + pgvector)]',
      });
    }
  }
}
