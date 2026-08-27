import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  McpServerType,
  SlackPostMessageInput,
  SlackPostMessageInputSchema,
  SlackPostNotificationInput,
  SlackPostNotificationInputSchema,
  SlackPostApprovalCardInput,
  SlackPostApprovalCardInputSchema,
} from '@ironloom/shared';
import { ITool } from '../../agents/core/tools/tool.interface';
import { ConnectorHealthStatus, IMcpConnector } from '../interfaces/mcp-connector.interface';

@Injectable()
export class SlackConnector implements IMcpConnector {
  readonly type: McpServerType = 'slack';
  private readonly logger = new Logger(SlackConnector.name);

  constructor(private readonly configService: ConfigService) {}

  private getWebhookUrl(): string | undefined {
    return this.configService.get<string>('SLACK_WEBHOOK_URL') || process.env.SLACK_WEBHOOK_URL;
  }

  private isSandboxed(): boolean {
    const webhook = this.getWebhookUrl();
    return (
      !webhook ||
      webhook.startsWith('mock_') ||
      webhook === 'dummy_slack_webhook' ||
      webhook.includes('localhost')
    );
  }

  async testConnection(): Promise<ConnectorHealthStatus> {
    if (this.isSandboxed()) {
      return {
        serverType: this.type,
        healthy: true,
        isSandboxed: true,
        message: 'Slack connector operating in sandboxed emulation mode (free-tier / mock).',
      };
    }

    return {
      serverType: this.type,
      healthy: true,
      isSandboxed: false,
      message: 'Slack Webhook integration endpoint ready.',
    };
  }

  getTools(): ITool[] {
    return [
      this.createPostMessageTool(),
      this.createPostNotificationTool(),
      this.createPostApprovalCardTool(),
    ];
  }

  private createPostMessageTool(): ITool<SlackPostMessageInput> {
    return {
      name: 'slack_post_message',
      description: 'Post a markdown message to a designated Slack channel.',
      inputSchema: SlackPostMessageInputSchema,
      execute: async (input: SlackPostMessageInput) => {
        if (this.isSandboxed()) {
          return {
            channel: input.channel,
            ts: `${Date.now()}.000100`,
            delivered: true,
            sandboxed: true,
          };
        }

        const webhook = this.getWebhookUrl();
        await axios.post(webhook!, { text: input.text });
        return {
          channel: input.channel,
          ts: `${Date.now()}.000100`,
          delivered: true,
          sandboxed: false,
        };
      },
    };
  }

  private createPostNotificationTool(): ITool<SlackPostNotificationInput> {
    return {
      name: 'slack_post_notification',
      description: 'Post a formatted rich status notification card with fields to Slack.',
      inputSchema: SlackPostNotificationInputSchema,
      execute: async (input: SlackPostNotificationInput) => {
        const payload = {
          channel: input.channel,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: `🚀 ${input.title}` },
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: input.message },
            },
            ...(input.fields.length > 0
              ? [
                  {
                    type: 'section',
                    fields: input.fields.map((f) => ({
                      type: 'mrkdwn',
                      text: `*${f.title}*\n${f.value}`,
                    })),
                  },
                ]
              : []),
          ],
        };

        if (this.isSandboxed()) {
          return {
            channel: input.channel,
            delivered: true,
            status: input.status,
            sandboxed: true,
            payloadSnapshot: payload,
          };
        }

        const webhook = this.getWebhookUrl();
        await axios.post(webhook!, payload);
        return {
          channel: input.channel,
          delivered: true,
          status: input.status,
          sandboxed: false,
        };
      },
    };
  }

  private createPostApprovalCardTool(): ITool<SlackPostApprovalCardInput> {
    return {
      name: 'slack_post_approval_card',
      description:
        'Post an interactive approval card with Approve/Reject callback buttons to Slack.',
      inputSchema: SlackPostApprovalCardInputSchema,
      execute: async (input: SlackPostApprovalCardInput) => {
        const payload = {
          channel: input.channel,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: `⚡ Approval Required: ${input.title}` },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Workflow Run:* \`${input.workflowRunId}\`\n*Gate:* \`${input.gateNode}\`\n\n${input.summary}`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: '✅ Approve' },
                  style: 'primary',
                  value: JSON.stringify({
                    action: 'approve',
                    workflowRunId: input.workflowRunId,
                    approvalRequestId: input.approvalRequestId,
                  }),
                  action_id: 'workflow_approve_action',
                },
                {
                  type: 'button',
                  text: { type: 'plain_text', text: '❌ Reject' },
                  style: 'danger',
                  value: JSON.stringify({
                    action: 'reject',
                    workflowRunId: input.workflowRunId,
                    approvalRequestId: input.approvalRequestId,
                  }),
                  action_id: 'workflow_reject_action',
                },
              ],
            },
          ],
        };

        if (this.isSandboxed()) {
          return {
            channel: input.channel,
            delivered: true,
            approvalRequestId: input.approvalRequestId,
            workflowRunId: input.workflowRunId,
            interactiveCardSent: true,
            sandboxed: true,
            payloadSnapshot: payload,
          };
        }

        const webhook = this.getWebhookUrl();
        await axios.post(webhook!, payload);
        return {
          channel: input.channel,
          delivered: true,
          approvalRequestId: input.approvalRequestId,
          workflowRunId: input.workflowRunId,
          interactiveCardSent: true,
          sandboxed: false,
        };
      },
    };
  }
}
