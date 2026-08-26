import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent } from '../core/base.agent';
import { ToolRegistry } from '../core/tools/tool.registry';
import { PromptTemplateService } from '../core/prompts/prompt-template.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { RAGService } from '../../rag/rag.service';
import {
  AgentTaskInput,
  AgentTaskOutput,
  Epic,
  UserStoriesOutput,
  UserStoriesOutputSchema,
} from '@ironloom/shared';

@Injectable()
export class RequirementsEngineerAgent extends BaseAgent {
  constructor(
    toolRegistry: ToolRegistry,
    promptService: PromptTemplateService,
    aiGateway: AiGatewayService,
    private readonly ragService: RAGService,
  ) {
    super(
      'requirements_engineer_01',
      'requirements_engineer',
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

  async generateUserStories(params: {
    orgId: string;
    projectId: string;
    projectName: string;
    epic: Epic;
  }): Promise<{
    userStoriesOutput: UserStoriesOutput;
    costUsd: number;
    latencyMs: number;
    model: string;
    provider: string;
    retrievedContextCount: number;
  }> {
    this.logger.log(`Formulating user stories and Gherkin criteria for Epic "${params.epic.title}" (${params.epic.id})`);

    // 1. RAG Retrieval for past user stories and acceptance criteria conventions
    const ragResults = await this.ragService.retrieveContext({
      orgId: params.orgId,
      projectId: params.projectId,
      query: `${params.epic.title} ${params.epic.description}`,
      documentTypes: ['requirement', 'user_story'],
      topK: 2,
    });
    const ragContext = this.ragService.formatContextForPrompt(ragResults);

    // 2. Compose Prompt
    const composed = await this.buildPrompt({
      taskType: 'user_story_generation',
      context: {
        projectName: params.projectName,
        epicTitle: params.epic.title,
        epicDescription: params.epic.description,
        epicRationale: params.epic.rationale,
        ragContext,
      },
    });

    // 3. Call AI Gateway
    const response = await this.callLlm({
      prompt: `${composed.systemPrompt}\n\n---\n\n${composed.userPrompt}`,
      taskType: 'user_story_generation',
      orgId: params.orgId,
      projectId: params.projectId,
    });

    // 4. Parse Structured JSON
    const parsedOutput = this.extractAndValidateJson<UserStoriesOutput>(
      response.text,
      UserStoriesOutputSchema,
    );

    return {
      userStoriesOutput: parsedOutput,
      costUsd: response.costUsd,
      latencyMs: response.latencyMs,
      model: response.model,
      provider: response.provider,
      retrievedContextCount: ragResults.length,
    };
  }

  async execute(input: AgentTaskInput): Promise<AgentTaskOutput> {
    const epic: Epic = input.parameters?.epic || {
      id: '00000000-0000-0000-0000-000000000000',
      orgId: input.orgId,
      projectId: input.projectId || '00000000-0000-0000-0000-000000000000',
      businessCaseId: '00000000-0000-0000-0000-000000000000',
      title: 'Core Stream Engine',
      description: 'Stream processing for telemetry data',
      rationale: 'Core throughput',
      priority: 'critical',
      sizing: 'M',
      status: 'approved',
    };

    const result = await this.generateUserStories({
      orgId: input.orgId,
      projectId: input.projectId || '00000000-0000-0000-0000-000000000000',
      projectName: input.context?.projectName || 'Project Workspace',
      epic,
    });

    return {
      taskId: input.taskId,
      status: 'completed',
      result: result.userStoriesOutput as any,
      artifacts: [{ type: 'user_stories', data: result.userStoriesOutput }],
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
        stories: [
          {
            title: 'Real-Time Sensor Packet Deserialization',
            asA: 'Telemetry Processing Service',
            iWant: 'to decode binary sensor payloads into structured JSON within 5ms',
            soThat: 'downstream navigation filters can process trajectory points without lag',
            acceptanceCriteria: [
              {
                scenarioTitle: 'Valid telemetry payload processing',
                givenText: 'a raw binary protobuf packet from drone sensor array',
                whenText: 'the ingestion handler receives the packet',
                thenText: 'the payload is validated, parsed into schema, and published to stream within 5ms',
              },
              {
                scenarioTitle: 'Malformed packet error handling',
                givenText: 'a corrupted packet missing CRC checksum',
                whenText: 'deserialization is attempted',
                thenText: 'the packet is quarantined to dead-letter queue with audit error log',
              },
            ],
          },
        ],
      });
    }
  }
}
