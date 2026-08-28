import { Injectable, Logger } from '@nestjs/common';
import { McpToolRegistryService } from '../mcp/mcp-tool-registry.service';

export interface OperationalAlert {
  id: string;
  category: 'gateway_failure' | 'sandbox_failure' | 'approval_backlog' | 'security_breach';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  channel?: string;
}

@Injectable()
export class StructuredAlertingService {
  private readonly logger = new Logger(StructuredAlertingService.name);
  private readonly activeAlerts: OperationalAlert[] = [];

  constructor(private readonly mcpToolRegistry: McpToolRegistryService) {}

  /**
   * Dispatch an operational alert to Slack / Pager channels.
   */
  async dispatchAlert(
    alert: Omit<OperationalAlert, 'id' | 'timestamp'>,
  ): Promise<OperationalAlert> {
    const record: OperationalAlert = {
      id: `alert-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...alert,
    };

    this.activeAlerts.unshift(record);
    if (this.activeAlerts.length > 100) this.activeAlerts.pop();

    this.logger.warn(
      `[OPERATIONAL ALERT] [${record.severity.toUpperCase()}] ${record.title}: ${record.message}`,
    );

    // Route alert through the Slack MCP tool
    try {
      await this.mcpToolRegistry.executeScopedTool(
        'slack_post_notification',
        {
          channel: alert.channel || '#ops-alerts',
          title: `[IRONLOOM ${record.severity.toUpperCase()} ALERT]: ${record.title}`,
          message: `${record.message}\n_Timestamp: ${record.timestamp}_`,
        },
        { role: 'monitoring' },
      );
    } catch (err: any) {
      this.logger.debug(`Slack MCP tool dispatch fallback (${err.message})`);
    }

    return record;
  }

  getActiveAlerts(): OperationalAlert[] {
    return [...this.activeAlerts];
  }

  clearAlerts(): void {
    this.activeAlerts.length = 0;
  }
}
