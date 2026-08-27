import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AgentsCoreModule } from '../agents/core/agents-core.module';
import { GitHubConnector } from './connectors/github.connector';
import { JiraConnector } from './connectors/jira.connector';
import { FigmaConnector } from './connectors/figma.connector';
import { SlackConnector } from './connectors/slack.connector';
import { McpToolRegistryService } from './mcp-tool-registry.service';

@Module({
  imports: [ConfigModule, DatabaseModule, AgentsCoreModule],
  providers: [
    GitHubConnector,
    JiraConnector,
    FigmaConnector,
    SlackConnector,
    McpToolRegistryService,
  ],
  exports: [McpToolRegistryService, GitHubConnector, JiraConnector, FigmaConnector, SlackConnector],
})
export class McpModule {}
