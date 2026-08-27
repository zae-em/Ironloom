import { Injectable, Logger, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AgentRole, McpToolCallRecord, McpServerType } from '@ironloom/shared';
import { ToolRegistry } from '../agents/core/tools/tool.registry';
import { ITool } from '../agents/core/tools/tool.interface';
import { GitHubConnector } from './connectors/github.connector';
import { JiraConnector } from './connectors/jira.connector';
import { FigmaConnector } from './connectors/figma.connector';
import { SlackConnector } from './connectors/slack.connector';
import { isToolAllowedForRole, MCP_ROLE_PERMISSIONS } from './permissions/mcp-permission.matrix';
import { AuditLogRepository } from '../database/repositories/audit-log.repository';
import { ConnectorHealthStatus } from './interfaces/mcp-connector.interface';

@Injectable()
export class McpToolRegistryService implements OnModuleInit {
  private readonly logger = new Logger(McpToolRegistryService.name);
  private readonly toolConnectorMap = new Map<string, McpServerType>();

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly githubConnector: GitHubConnector,
    private readonly jiraConnector: JiraConnector,
    private readonly figmaConnector: FigmaConnector,
    private readonly slackConnector: SlackConnector,
    private readonly auditRepo: AuditLogRepository,
  ) {
    this.registerAllConnectors();
  }

  onModuleInit() {
    this.registerAllConnectors();
  }

  private registerAllConnectors() {
    const connectors = [
      this.githubConnector,
      this.jiraConnector,
      this.figmaConnector,
      this.slackConnector,
    ];

    for (const connector of connectors) {
      const tools = connector.getTools();
      for (const tool of tools) {
        this.toolRegistry.register(tool);
        this.toolConnectorMap.set(tool.name, connector.type);
      }
      this.logger.log(`Registered ${tools.length} MCP tools for connector [${connector.type}]`);
    }
  }

  getScopedTools(role: AgentRole): ITool[] {
    const allowedToolNames = MCP_ROLE_PERMISSIONS[role] || [];
    return allowedToolNames
      .map((name) => this.toolRegistry.get(name))
      .filter((tool): tool is ITool => Boolean(tool));
  }

  getAllMcpTools(): Array<{ name: string; description: string; serverType: McpServerType }> {
    return Array.from(this.toolConnectorMap.entries()).map(([name, serverType]) => {
      const tool = this.toolRegistry.get(name);
      return {
        name,
        description: tool?.description || '',
        serverType,
      };
    });
  }

  async getConnectorsStatus(): Promise<ConnectorHealthStatus[]> {
    return Promise.all([
      this.githubConnector.testConnection(),
      this.jiraConnector.testConnection(),
      this.figmaConnector.testConnection(),
      this.slackConnector.testConnection(),
    ]);
  }

  async executeScopedTool(
    toolName: string,
    rawInput: any,
    context?: {
      agentId?: string;
      role?: AgentRole;
      workflowRunId?: string;
      orgId?: string;
      userId?: string;
    },
  ): Promise<McpToolCallRecord> {
    const startTime = Date.now();
    const serverType = this.toolConnectorMap.get(toolName) || 'github';

    // 1. Enforce Role Permissions
    if (context?.role && !isToolAllowedForRole(context.role, toolName)) {
      const errorMsg = `Permission Denied: Agent role '${context.role}' is not authorized to call MCP tool '${toolName}'`;
      this.logger.warn(errorMsg);
      throw new ForbiddenException(errorMsg);
    }

    // 2. Execute tool through ToolRegistry
    const execution = await this.toolRegistry.execute(toolName, rawInput);
    const latencyMs = Date.now() - startTime;

    const record: McpToolCallRecord = {
      id: uuidv4(),
      serverType,
      toolName,
      agentId: context?.agentId,
      workflowRunId: context?.workflowRunId,
      input: rawInput || {},
      output: execution.success ? execution.result : { error: execution.error },
      status: execution.success ? 'success' : 'failed',
      latencyMs,
      timestamp: new Date().toISOString(),
      error: execution.error,
    };

    // 3. Centralized Audit Log
    try {
      await this.auditRepo.create({
        orgId: context?.orgId || '00000000-0000-0000-0000-000000000000',
        actorType: 'agent',
        actorId: context?.agentId || 'mcp_tool',
        action: `mcp.${toolName}`,
        status: record.status === 'success' ? 'success' : 'failure',
        projectId: null,
        input: rawInput || {},
        output: record.output || {},
        costUsd: 0.0,
        latencyMs,
      });
    } catch (auditErr: any) {
      this.logger.warn(`Failed to write MCP audit log: ${auditErr.message}`);
    }

    return record;
  }
}
