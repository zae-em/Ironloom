import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadConfig } from './config/app.config';
import { RedisModule } from './redis/redis.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { RateLimiterModule } from './rate-limiter/rate-limiter.module';
import { AiGatewayModule } from './ai-gateway/ai-gateway.module';
import { AgentsCoreModule } from './agents/core/agents-core.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectsModule } from './projects/projects.module';
import { RAGModule } from './rag/rag.module';
import { SdlcModule } from './sdlc/sdlc.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { McpModule } from './mcp/mcp.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { DevOpsModule } from './devops/devops.module';
import { EmailModule } from './email/email.module';
import { AuditModule } from './audit/audit.module';
import { AlertingModule } from './alerting/alerting.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
      envFilePath: ['.env', '../../.env'],
    }),
    RedisModule,
    DatabaseModule,
    AuthModule,
    RateLimiterModule,
    AiGatewayModule,
    AgentsCoreModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    RAGModule,
    SdlcModule,
    OrchestrationModule,
    McpModule,
    SandboxModule,
    DevOpsModule,
    EmailModule,
    AuditModule,
    AlertingModule,
  ],
})
export class AppModule {}
