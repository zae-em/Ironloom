import { Injectable, Logger } from '@nestjs/common';
import { ITool } from './tool.interface';
import { ToolExecutionResult } from '@ironloom/shared';

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools = new Map<string, ITool>();

  register(tool: ITool): void {
    this.tools.set(tool.name, tool);
    this.logger.debug(`Registered tool: ${tool.name}`);
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitions(): { name: string; description: string; schema: any }[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      schema: tool.inputSchema,
    }));
  }

  async execute(toolName: string, rawInput: any): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' is not registered`,
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      // Validate input using tool's Zod schema
      const validatedInput = tool.inputSchema.parse(rawInput);
      const result = await tool.execute(validatedInput);

      return {
        success: true,
        result,
        latencyMs: Date.now() - startTime,
      };
    } catch (error: any) {
      this.logger.error(`Error executing tool ${toolName}: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Tool execution failed',
        latencyMs: Date.now() - startTime,
      };
    }
  }
}
