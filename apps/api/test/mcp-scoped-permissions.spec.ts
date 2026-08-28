import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { McpModule } from '../src/mcp/mcp.module';
import { McpToolRegistryService } from '../src/mcp/mcp-tool-registry.service';
import { DatabaseModule } from '../src/database/database.module';
import { ForbiddenException } from '@nestjs/common';

describe('MCP Scoped Permissions & Tool Authorization Suite (Prompt 11)', () => {
  let mcpService: McpToolRegistryService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, McpModule],
    }).compile();

    mcpService = module.get<McpToolRegistryService>(McpToolRegistryService);
  });

  it('1. should allow Developer agent to invoke github_create_pull_request tool', async () => {
    const result = await mcpService.executeScopedTool(
      'github_create_pull_request',
      {
        owner: 'zae-em',
        repo: 'Ironloom',
        title: 'feat: valid pull request',
        body: 'Implements feature story acceptance criteria',
        head: 'feat/test-branch',
        base: 'main',
      },
      {
        role: 'developer',
        agentId: 'dev-agent-1',
      },
    );

    expect(result.status).toBe('success');
    expect(result.output).toHaveProperty('prNumber');
  });

  it('2. should reject Business Analyst agent from invoking github_create_pull_request (ForbiddenException)', async () => {
    await expect(
      mcpService.executeScopedTool(
        'github_create_pull_request',
        {
          owner: 'zae-em',
          repo: 'Ironloom',
          title: 'unauthorized PR attempt',
          body: 'Malicious body',
          head: 'feat/malicious-branch',
          base: 'main',
        },
        {
          role: 'business_analyst',
          agentId: 'ba-agent-1',
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('3. should reject Monitoring agent from invoking figma_get_file (ForbiddenException)', async () => {
    await expect(
      mcpService.executeScopedTool(
        'figma_get_file',
        { fileKey: 'unauthorized_figma_key' },
        {
          role: 'monitoring',
          agentId: 'sre-monitoring-1',
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('4. should allow Monitoring agent to invoke slack_post_notification', async () => {
    const result = await mcpService.executeScopedTool(
      'slack_post_notification',
      {
        channel: '#ops-alerts',
        title: 'Telemetry Status',
        message: 'System latency is normal.',
      },
      {
        role: 'monitoring',
        agentId: 'sre-monitoring-1',
      },
    );

    expect(result.status).toBe('success');
  });
});
