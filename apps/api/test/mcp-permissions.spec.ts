import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { DatabaseModule } from '../src/database/database.module';
import { AgentsCoreModule } from '../src/agents/core/agents-core.module';
import { McpModule } from '../src/mcp/mcp.module';
import { McpToolRegistryService } from '../src/mcp/mcp-tool-registry.service';

describe('MCP Scoped Permissions Test Suite', () => {
  let module: TestingModule;
  let mcpRegistry: McpToolRegistryService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        AgentsCoreModule,
        McpModule,
      ],
    }).compile();

    mcpRegistry = module.get<McpToolRegistryService>(McpToolRegistryService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should scope tools strictly based on agent role', () => {
    const baTools = mcpRegistry.getScopedTools('business_analyst').map((t) => t.name);
    expect(baTools).toContain('figma_get_file');
    expect(baTools).toContain('slack_post_message');
    expect(baTools).not.toContain('github_create_pull_request');
    expect(baTools).not.toContain('jira_create_epic');

    const devTools = mcpRegistry.getScopedTools('developer').map((t) => t.name);
    expect(devTools).toContain('github_create_pull_request');
    expect(devTools).toContain('github_create_issue');
    expect(devTools).toContain('jira_update_issue_status');
    expect(devTools).not.toContain('figma_get_component_styles');

    const archTools = mcpRegistry.getScopedTools('architect').map((t) => t.name);
    expect(archTools).toContain('github_get_repo');
    expect(archTools).toContain('jira_create_epic');
    expect(archTools).not.toContain('github_create_pull_request');
  });

  it('should successfully execute an authorized tool for a role', async () => {
    const record = await mcpRegistry.executeScopedTool(
      'jira_create_epic',
      {
        projectKey: 'IRON',
        name: 'Architecture Epic',
        summary: 'Cloud Native Swarm Pipeline',
        description: 'Detailed description',
      },
      {
        role: 'architect',
        agentId: 'architect_agent_01',
        orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      },
    );

    expect(record.status).toBe('success');
    expect(record.toolName).toBe('jira_create_epic');
    expect(record.serverType).toBe('jira');
  });

  it('should throw ForbiddenException when an agent role attempts an unauthorized tool', async () => {
    await expect(
      mcpRegistry.executeScopedTool(
        'github_create_pull_request',
        {
          owner: 'zae-em',
          repo: 'ironloom',
          title: 'Unauthorized PR',
          body: 'Attempted PR',
          head: 'feature',
        },
        {
          role: 'business_analyst', // BA is not authorized to create PRs
          agentId: 'ba_agent_01',
          orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
