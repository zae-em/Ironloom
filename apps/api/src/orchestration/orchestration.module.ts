import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SdlcModule } from '../sdlc/sdlc.module';
import { ProjectsModule } from '../projects/projects.module';
import { RAGModule } from '../rag/rag.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { UsersModule } from '../users/users.module';
import { McpModule } from '../mcp/mcp.module';
import { SandboxModule } from '../sandbox/sandbox.module';
import { DevOpsModule } from '../devops/devops.module';
import { AgentsCoreModule } from '../agents/core/agents-core.module';
import { OrchestrationRepository } from './orchestration.repository';
import { SdlcGraphEngine } from './engine/sdlc-graph.engine';
import { OrchestrationService } from './orchestration.service';
import { OrchestrationController } from './orchestration.controller';
import { McpController } from '../mcp/mcp.controller';
import { WorkflowDecisionService } from './decisions/workflow-decision.service';
import { BusinessAnalystAgent } from '../agents/sdlc/business-analyst.agent';
import { ProductManagerAgent } from '../agents/sdlc/product-manager.agent';
import { RequirementsEngineerAgent } from '../agents/sdlc/requirements-engineer.agent';
import { ArchitectAgent } from '../agents/sdlc/architect.agent';
import { DeveloperAgent } from '../agents/sdlc/developer.agent';
import { CodeReviewerAgent } from '../agents/sdlc/code-reviewer.agent';
import { QaAgent } from '../agents/sdlc/qa.agent';
import { DevOpsAgent } from '../agents/sdlc/devops.agent';
import { MonitoringAgent } from '../agents/sdlc/monitoring.agent';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => SdlcModule),
    ProjectsModule,
    RAGModule,
    AiGatewayModule,
    UsersModule,
    AgentsCoreModule,
    McpModule,
    SandboxModule,
    DevOpsModule,
  ],
  controllers: [OrchestrationController, McpController],
  providers: [
    OrchestrationRepository,
    WorkflowDecisionService,
    SdlcGraphEngine,
    OrchestrationService,
    BusinessAnalystAgent,
    ProductManagerAgent,
    RequirementsEngineerAgent,
    ArchitectAgent,
    DeveloperAgent,
    CodeReviewerAgent,
    QaAgent,
    DevOpsAgent,
    MonitoringAgent,
  ],
  exports: [
    OrchestrationService,
    OrchestrationRepository,
    WorkflowDecisionService,
    SdlcGraphEngine,
  ],
})
export class OrchestrationModule {}
