import { Module, OnModuleInit } from '@nestjs/common';
import { ToolRegistry } from './tools/tool.registry';
import { EchoTool } from './tools/stubs/echo.tool';
import { PromptTemplateService } from './prompts/prompt-template.service';

@Module({
  providers: [ToolRegistry, EchoTool, PromptTemplateService],
  exports: [ToolRegistry, EchoTool, PromptTemplateService],
})
export class AgentsCoreModule implements OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly echoTool: EchoTool,
  ) {}

  onModuleInit() {
    // Register initial stub tools
    this.toolRegistry.register(this.echoTool);
  }
}
