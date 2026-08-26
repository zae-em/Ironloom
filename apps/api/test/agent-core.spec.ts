import { ToolRegistry } from '../src/agents/core/tools/tool.registry';
import { EchoTool } from '../src/agents/core/tools/stubs/echo.tool';
import { PromptTemplateService } from '../src/agents/core/prompts/prompt-template.service';
import { BaseAgent } from '../src/agents/core/base.agent';
import { AgentTaskInput, AgentTaskOutput } from '@ironloom/shared';

class TestDeveloperAgent extends BaseAgent {
  async execute(input: AgentTaskInput): Promise<AgentTaskOutput> {
    const toolRes = await this.invokeTool('echo', {
      message: `Working on task ${input.taskType}`,
      repetitions: 2,
    });

    return {
      taskId: input.taskId,
      status: 'completed',
      result: {
        toolEcho: toolRes.result?.echo,
        summary: 'Task executed successfully',
      },
      artifacts: [],
      toolCalls: [{ tool: 'echo', result: toolRes }],
      metrics: { totalTokens: 100, totalCostUsd: 0, latencyMs: 25 },
    };
  }
}

describe('Agent Framework Skeleton Unit Tests', () => {
  let toolRegistry: ToolRegistry;
  let echoTool: EchoTool;
  let promptService: PromptTemplateService;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    echoTool = new EchoTool();
    toolRegistry.register(echoTool);
    promptService = new PromptTemplateService();
  });

  it('should register and execute EchoTool through ToolRegistry with schema validation', async () => {
    expect(toolRegistry.has('echo')).toBe(true);

    const result = await toolRegistry.execute('echo', {
      message: 'Hello Agent Framework',
      repetitions: 3,
      prefix: 'TEST:',
    });

    expect(result.success).toBe(true);
    expect(result.result?.echo).toBe(
      'TEST: Hello Agent Framework | Hello Agent Framework | Hello Agent Framework',
    );
    expect(result.result?.count).toBe(3);
  });

  it('should reject invalid tool input failing Zod schema validation', async () => {
    const result = await toolRegistry.execute('echo', {
      message: '', // fails .min(1)
      repetitions: -5, // fails .positive()
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should interpolate variables and compose system and user prompts correctly', async () => {
    const composed = await promptService.compose({
      role: 'developer',
      taskType: 'code_generation',
      context: {
        projectName: 'Telemetry Core',
        moduleName: 'DataIngestion',
        taskDescription: 'Implement Kafka partition consumer',
      },
      fewShotKey: 'code_generation',
    });

    expect(composed.systemPrompt).toContain('IRONLOOM');
    expect(composed.systemPrompt).toContain('Developer');
    expect(composed.userPrompt).toContain('Telemetry Core');
    expect(composed.userPrompt).toContain('DataIngestion');
    expect(composed.userPrompt).toContain('Implement Kafka partition consumer');
    expect(composed.userPrompt).toContain('calculateBackoffWithJitter');
  });

  it('should execute concrete agent lifecycle with tool invocation', async () => {
    const agent = new TestDeveloperAgent(
      'dev_agent_007',
      'developer',
      { defaultProvider: 'mock' },
      toolRegistry,
      promptService,
      {} as any,
    );

    const output = await agent.execute({
      taskType: 'build_feature',
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      context: {},
      parameters: {},
    });

    expect(output.status).toBe('completed');
    expect(output.result.toolEcho).toContain('Working on task build_feature');
    expect(output.toolCalls.length).toBe(1);
  });
});
