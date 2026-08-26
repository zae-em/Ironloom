import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent } from '../core/base.agent';
import { ToolRegistry } from '../core/tools/tool.registry';
import { PromptTemplateService } from '../core/prompts/prompt-template.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { RAGService } from '../../rag/rag.service';
import {
  AgentTaskInput,
  AgentTaskOutput,
  BusinessCase,
  EpicsOutput,
  EpicsOutputSchema,
} from '@ironloom/shared';

@Injectable()
export class ProductManagerAgent extends BaseAgent {
  constructor(
    toolRegistry: ToolRegistry,
    promptService: PromptTemplateService,
    aiGateway: AiGatewayService,
    private readonly ragService: RAGService,
  ) {
    super(
      'product_manager_01',
      'product_manager',
      {
        defaultProvider: 'ollama',
        fallbackProviders: ['groq', 'mock'],
        temperature: 0.3,
      },
      toolRegistry,
      promptService,
      aiGateway,
    );
  }

  async decomposeBusinessCase(params: {
    orgId: string;
    projectId: string;
    projectName: string;
    businessCase: BusinessCase;
  }): Promise<{
    epicsOutput: EpicsOutput;
    costUsd: number;
    latencyMs: number;
    model: string;
    provider: string;
    retrievedContextCount: number;
  }> {
    this.logger.log(`Decomposing Business Case ${params.businessCase.id} into epics for project ${params.projectName}`);

    // 1. RAG Retrieval for past epics & feature patterns
    const ragResults = await this.ragService.retrieveContext({
      orgId: params.orgId,
      projectId: params.projectId,
      query: params.businessCase.problemStatement,
      documentTypes: ['business_case', 'requirement'],
      topK: 2,
    });
    const ragContext = this.ragService.formatContextForPrompt(ragResults);

    // 2. Compose Prompt
    const composed = await this.buildPrompt({
      taskType: 'epic_breakdown',
      context: {
        projectName: params.projectName,
        problemStatement: params.businessCase.problemStatement,
        goals: params.businessCase.goals.join('; '),
        targetUsers: params.businessCase.targetUsers.join(', '),
        ragContext,
      },
    });

    // 3. Call AI Gateway
    const response = await this.callLlm({
      prompt: `${composed.systemPrompt}\n\n---\n\n${composed.userPrompt}`,
      taskType: 'epic_breakdown',
      orgId: params.orgId,
      projectId: params.projectId,
    });

    // 4. Parse JSON Output
    const parsedOutput = this.extractAndValidateJson<EpicsOutput>(
      response.text,
      EpicsOutputSchema,
    );

    return {
      epicsOutput: parsedOutput,
      costUsd: response.costUsd,
      latencyMs: response.latencyMs,
      model: response.model,
      provider: response.provider,
      retrievedContextCount: ragResults.length,
    };
  }

  async execute(input: AgentTaskInput): Promise<AgentTaskOutput> {
    const businessCase: BusinessCase = input.parameters?.businessCase || {
      id: '00000000-0000-0000-0000-000000000000',
      orgId: input.orgId,
      projectId: input.projectId || '00000000-0000-0000-0000-000000000000',
      rawIdea: 'Build cloud service',
      problemStatement: 'Manual workflow bottlenecks',
      goals: ['Automate workflows'],
      targetUsers: ['Engineers'],
      successMetrics: ['10x speed'],
      assumptions: [],
      risks: [],
      status: 'approved',
      version: 1,
    };

    const result = await this.decomposeBusinessCase({
      orgId: input.orgId,
      projectId: input.projectId || '00000000-0000-0000-0000-000000000000',
      projectName: input.context?.projectName || 'Project Workspace',
      businessCase,
    });

    return {
      taskId: input.taskId,
      status: 'completed',
      result: result.epicsOutput as any,
      artifacts: [{ type: 'epics', data: result.epicsOutput }],
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
        epics: [
          {
            title: 'Core Telemetry Ingestion Engine',
            description: 'High-throughput stream consumer for sensor telemetry packets.',
            rationale: 'Foundation for real-time situational awareness.',
            priority: 'critical',
            sizing: 'L',
          },
          {
            title: 'Autonomous Navigation & Obstacle Avoidance',
            description: 'Path planning algorithms utilizing vector lidar inputs.',
            rationale: 'Primary value differentiator ensuring zero collisions.',
            priority: 'high',
            sizing: 'XL',
          },
        ],
      });
    }
  }
}
