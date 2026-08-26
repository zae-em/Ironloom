import { Module } from '@nestjs/common';
import { SdlcController } from './sdlc.controller';
import { SdlcService } from './sdlc.service';
import { SdlcRepository } from './sdlc.repository';
import { BusinessAnalystAgent } from '../agents/sdlc/business-analyst.agent';
import { ProductManagerAgent } from '../agents/sdlc/product-manager.agent';
import { RequirementsEngineerAgent } from '../agents/sdlc/requirements-engineer.agent';
import { ArchitectAgent } from '../agents/sdlc/architect.agent';
import { AgentsCoreModule } from '../agents/core/agents-core.module';
import { RAGModule } from '../rag/rag.module';
import { ProjectsModule } from '../projects/projects.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [AgentsCoreModule, RAGModule, ProjectsModule, AiGatewayModule],
  controllers: [SdlcController],
  providers: [
    SdlcRepository,
    SdlcService,
    BusinessAnalystAgent,
    ProductManagerAgent,
    RequirementsEngineerAgent,
    ArchitectAgent,
  ],
  exports: [
    SdlcService,
    SdlcRepository,
    BusinessAnalystAgent,
    ProductManagerAgent,
    RequirementsEngineerAgent,
    ArchitectAgent,
  ],
})
export class SdlcModule {}
