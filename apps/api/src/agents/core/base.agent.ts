import { Logger } from '@nestjs/common';
import {
  AgentConfig,
  AgentRole,
  AgentTaskInput,
  AgentTaskOutput,
  AiGatewayRequest,
  AiGatewayResponse,
  ChatMessage,
  ToolExecutionResult,
} from '@ironloom/shared';
import { ToolRegistry } from './tools/tool.registry';
import { PromptTemplateService } from './prompts/prompt-template.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';

export abstract class BaseAgent {
  protected readonly logger: Logger;
  readonly agentId: string;
  readonly role: AgentRole;
  readonly config: AgentConfig;

  constructor(
    agentId: string,
    role: AgentRole,
    config: Partial<AgentConfig> = {},
    protected readonly toolRegistry: ToolRegistry,
    protected readonly promptService: PromptTemplateService,
    protected readonly aiGateway: AiGatewayService,
  ) {
    this.agentId = agentId;
    this.role = role;
    this.logger = new Logger(`Agent:${role}:${agentId}`);

    this.config = {
      agentId,
      role,
      defaultProvider: config.defaultProvider || 'ollama',
      fallbackProviders: config.fallbackProviders || ['groq'],
      defaultModel: config.defaultModel,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
    };
  }

  /**
   * Main task execution lifecycle implemented by concrete specialized agents in future phases.
   */
  abstract execute(input: AgentTaskInput): Promise<AgentTaskOutput>;

  /**
   * Execute an available tool through the agent's ToolRegistry with schema validation.
   */
  async invokeTool(toolName: string, input: any): Promise<ToolExecutionResult> {
    this.logger.log(`Invoking tool: ${toolName}`);
    return this.toolRegistry.execute(toolName, input);
  }

  /**
   * Compose prompt from versioned system prompts, role directives, and task context.
   */
  async buildPrompt(params: {
    taskType: string;
    context: Record<string, any>;
    fewShotKey?: string;
    version?: string;
  }) {
    return this.promptService.compose({
      role: this.role,
      taskType: params.taskType,
      context: params.context,
      fewShotKey: params.fewShotKey,
      version: params.version,
    });
  }

  /**
   * Send completion request through the provider-agnostic AI Gateway using this agent's configured routing.
   */
  async callLlm(params: {
    prompt?: string;
    messages?: ChatMessage[];
    taskType?: string;
    orgId?: string;
    projectId?: string;
    temperature?: number;
    maxTokens?: number;
    preferredProvider?: any;
    fallbackProviders?: any[];
  }): Promise<AiGatewayResponse> {
    const request: AiGatewayRequest = {
      agentId: this.agentId,
      taskType: params.taskType || 'agent_execution',
      prompt: params.prompt,
      messages: params.messages,
      preferredProvider: params.preferredProvider,
      fallbackProviders: params.fallbackProviders,
      model: this.config.defaultModel,
      temperature: params.temperature ?? this.config.temperature,
      maxTokens: params.maxTokens ?? this.config.maxTokens,
      orgId: params.orgId,
      projectId: params.projectId,
    };

    return this.aiGateway.complete(request, {
      agentDefaultProvider: this.config.defaultProvider,
      customFallbackChain: this.config.fallbackProviders,
    });
  }
}
