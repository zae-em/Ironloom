import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SdlcModule } from '../sdlc/sdlc.module';
import { ProjectsModule } from '../projects/projects.module';
import { RAGModule } from '../rag/rag.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { UsersModule } from '../users/users.module';
import { OrchestrationRepository } from './orchestration.repository';
import { SdlcGraphEngine } from './engine/sdlc-graph.engine';
import { OrchestrationService } from './orchestration.service';
import { OrchestrationController } from './orchestration.controller';
import { WorkflowDecisionService } from './decisions/workflow-decision.service';
import { BusinessAnalystAgent } from '../agents/sdlc/business-analyst.agent';
import { ProductManagerAgent } from '../agents/sdlc/product-manager.agent';
import { RequirementsEngineerAgent } from '../agents/sdlc/requirements-engineer.agent';
import { ArchitectAgent } from '../agents/sdlc/architect.agent';
import { ToolRegistry } from '../agents/core/tools/tool.registry';
import { PromptTemplateService } from '../agents/core/prompts/prompt-template.service';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => SdlcModule),
    ProjectsModule,
    RAGModule,
    AiGatewayModule,
    UsersModule,
  ],
  controllers: [OrchestrationController],
  providers: [
    OrchestrationRepository,
    WorkflowDecisionService,
    SdlcGraphEngine,
    OrchestrationService,
    BusinessAnalystAgent,
    ProductManagerAgent,
    RequirementsEngineerAgent,
    ArchitectAgent,
    ToolRegistry,
    PromptTemplateService,
  ],
  exports: [
    OrchestrationService,
    OrchestrationRepository,
    WorkflowDecisionService,
    SdlcGraphEngine,
  ],
})
export class OrchestrationModule {}
