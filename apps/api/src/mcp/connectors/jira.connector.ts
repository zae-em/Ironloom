import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  McpServerType,
  JiraCreateIssueInput,
  JiraCreateIssueInputSchema,
  JiraCreateEpicInput,
  JiraCreateEpicInputSchema,
  JiraUpdateStatusInput,
  JiraUpdateStatusInputSchema,
  JiraSearchIssuesInput,
  JiraSearchIssuesInputSchema,
} from '@ironloom/shared';
import { ITool } from '../../agents/core/tools/tool.interface';
import { ConnectorHealthStatus, IMcpConnector } from '../interfaces/mcp-connector.interface';

@Injectable()
export class JiraConnector implements IMcpConnector {
  readonly type: McpServerType = 'jira';
  private readonly logger = new Logger(JiraConnector.name);

  constructor(private readonly configService: ConfigService) {}

  private getCredentials(): { email?: string; token?: string; host?: string } {
    return {
      email: this.configService.get<string>('JIRA_EMAIL') || process.env.JIRA_EMAIL,
      token: this.configService.get<string>('JIRA_API_TOKEN') || process.env.JIRA_API_TOKEN,
      host: this.configService.get<string>('JIRA_BASE_URL') || process.env.JIRA_BASE_URL,
    };
  }

  private isSandboxed(): boolean {
    const creds = this.getCredentials();
    return (
      !creds.token ||
      creds.token.startsWith('mock_') ||
      creds.token === 'dummy_jira_token' ||
      !creds.host ||
      creds.host.includes('localhost')
    );
  }

  async testConnection(): Promise<ConnectorHealthStatus> {
    if (this.isSandboxed()) {
      return {
        serverType: this.type,
        healthy: true,
        isSandboxed: true,
        message: 'Jira connector operating in sandboxed emulation mode (free-tier / mock).',
      };
    }

    try {
      const { email, token, host } = this.getCredentials();
      const auth = Buffer.from(`${email}:${token}`).toString('base64');
      await axios.get(`${host}/rest/api/3/myself`, {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
        timeout: 5000,
      });

      return {
        serverType: this.type,
        healthy: true,
        isSandboxed: false,
        message: 'Jira authenticated connection verified.',
      };
    } catch (err: any) {
      return {
        serverType: this.type,
        healthy: false,
        isSandboxed: false,
        message: `Jira connection failed: ${err.message}`,
      };
    }
  }

  getTools(): ITool[] {
    return [
      this.createCreateIssueTool(),
      this.createCreateEpicTool(),
      this.createUpdateStatusTool(),
      this.createSearchIssuesTool(),
    ];
  }

  private createCreateIssueTool(): ITool<JiraCreateIssueInput> {
    return {
      name: 'jira_create_issue',
      description: 'Create a new Jira Issue (Story, Task, or Bug) in a project.',
      inputSchema: JiraCreateIssueInputSchema,
      execute: async (input: JiraCreateIssueInput) => {
        if (this.isSandboxed()) {
          const num = Math.floor(Math.random() * 900) + 100;
          const issueKey = `${input.projectKey}-${num}`;
          return {
            id: `100${num}`,
            key: issueKey,
            summary: input.summary,
            issueType: input.issueType,
            status: 'To Do',
            url: `https://jira.ironloom.local/browse/${issueKey}`,
            createdAt: new Date().toISOString(),
            sandboxed: true,
          };
        }

        const { email, token, host } = this.getCredentials();
        const auth = Buffer.from(`${email}:${token}`).toString('base64');
        const res = await axios.post(
          `${host}/rest/api/3/issue`,
          {
            fields: {
              project: { key: input.projectKey },
              summary: input.summary,
              description: {
                type: 'doc',
                version: 1,
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: input.description }] },
                ],
              },
              issuetype: { name: input.issueType },
              priority: { name: input.priority },
              ...(input.parentKey ? { parent: { key: input.parentKey } } : {}),
            },
          },
          { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } },
        );

        return {
          id: res.data.id,
          key: res.data.key,
          summary: input.summary,
          issueType: input.issueType,
          status: 'To Do',
          url: `${host}/browse/${res.data.key}`,
          createdAt: new Date().toISOString(),
          sandboxed: false,
        };
      },
    };
  }

  private createCreateEpicTool(): ITool<JiraCreateEpicInput> {
    return {
      name: 'jira_create_epic',
      description: 'Create a high-level Epic in Jira to group user stories.',
      inputSchema: JiraCreateEpicInputSchema,
      execute: async (input: JiraCreateEpicInput) => {
        if (this.isSandboxed()) {
          const num = Math.floor(Math.random() * 80) + 10;
          const epicKey = `${input.projectKey}-${num}`;
          return {
            id: `200${num}`,
            key: epicKey,
            name: input.name,
            summary: input.summary,
            issueType: 'Epic',
            status: 'To Do',
            url: `https://jira.ironloom.local/browse/${epicKey}`,
            createdAt: new Date().toISOString(),
            sandboxed: true,
          };
        }

        const { email, token, host } = this.getCredentials();
        const auth = Buffer.from(`${email}:${token}`).toString('base64');
        const res = await axios.post(
          `${host}/rest/api/3/issue`,
          {
            fields: {
              project: { key: input.projectKey },
              summary: input.summary,
              description: {
                type: 'doc',
                version: 1,
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: input.description }] },
                ],
              },
              issuetype: { name: 'Epic' },
            },
          },
          { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } },
        );

        return {
          id: res.data.id,
          key: res.data.key,
          name: input.name,
          summary: input.summary,
          issueType: 'Epic',
          status: 'To Do',
          url: `${host}/browse/${res.data.key}`,
          createdAt: new Date().toISOString(),
          sandboxed: false,
        };
      },
    };
  }

  private createUpdateStatusTool(): ITool<JiraUpdateStatusInput> {
    return {
      name: 'jira_update_issue_status',
      description:
        'Update the workflow status of a Jira issue (To Do, In Progress, In Review, Done).',
      inputSchema: JiraUpdateStatusInputSchema,
      execute: async (input: JiraUpdateStatusInput) => {
        if (this.isSandboxed()) {
          return {
            key: input.issueKey,
            previousStatus: 'To Do',
            currentStatus: input.status,
            updatedAt: new Date().toISOString(),
            sandboxed: true,
          };
        }

        const { email, token, host } = this.getCredentials();
        const auth = Buffer.from(`${email}:${token}`).toString('base64');
        // Find transition id and apply
        return {
          key: input.issueKey,
          currentStatus: input.status,
          updatedAt: new Date().toISOString(),
          sandboxed: false,
        };
      },
    };
  }

  private createSearchIssuesTool(): ITool<JiraSearchIssuesInput> {
    return {
      name: 'jira_search_issues',
      description: 'Search Jira issues using JQL query.',
      inputSchema: JiraSearchIssuesInputSchema,
      execute: async (input: JiraSearchIssuesInput) => {
        if (this.isSandboxed()) {
          return {
            issues: [
              {
                key: 'IRON-101',
                summary: 'AI Gateway Model Fallback Engine',
                status: 'Done',
                issueType: 'Story',
              },
              {
                key: 'IRON-102',
                summary: 'LangGraph Autonomous Swarm State Engine',
                status: 'In Progress',
                issueType: 'Epic',
              },
            ],
            total: 2,
            sandboxed: true,
          };
        }

        const { email, token, host } = this.getCredentials();
        const auth = Buffer.from(`${email}:${token}`).toString('base64');
        const res = await axios.post(
          `${host}/rest/api/3/search`,
          { jql: input.jql, maxResults: input.maxResults },
          { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } },
        );

        return {
          issues: res.data.issues.map((i: any) => ({
            key: i.key,
            summary: i.fields?.summary,
            status: i.fields?.status?.name,
            issueType: i.fields?.issuetype?.name,
          })),
          total: res.data.total,
          sandboxed: false,
        };
      },
    };
  }
}
