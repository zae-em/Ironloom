import { McpServerType } from '@ironloom/shared';
import { ITool } from '../../agents/core/tools/tool.interface';

export interface ConnectorHealthStatus {
  serverType: McpServerType;
  healthy: boolean;
  isSandboxed: boolean;
  message: string;
}

export interface IMcpConnector {
  readonly type: McpServerType;
  testConnection(): Promise<ConnectorHealthStatus>;
  getTools(): ITool[];
}
