import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  McpServerType,
  GitHubGetRepoInput,
  GitHubGetRepoInputSchema,
  GitHubListIssuesInput,
  GitHubListIssuesInputSchema,
  GitHubCreateIssueInput,
  GitHubCreateIssueInputSchema,
  GitHubCreatePullRequestInput,
  GitHubCreatePullRequestInputSchema,
  GitHubPostCommentInput,
  GitHubPostCommentInputSchema,
} from '@ironloom/shared';
import { ITool } from '../../agents/core/tools/tool.interface';
import { ConnectorHealthStatus, IMcpConnector } from '../interfaces/mcp-connector.interface';

@Injectable()
export class GitHubConnector implements IMcpConnector {
  readonly type: McpServerType = 'github';
  private readonly logger = new Logger(GitHubConnector.name);

  constructor(private readonly configService: ConfigService) {}

  private getToken(): string | undefined {
    return this.configService.get<string>('GITHUB_TOKEN') || process.env.GITHUB_TOKEN;
  }

  private isSandboxed(): boolean {
    const token = this.getToken();
    return !token || token.startsWith('mock_') || token === 'dummy_github_token';
  }

  async testConnection(): Promise<ConnectorHealthStatus> {
    if (this.isSandboxed()) {
      return {
        serverType: this.type,
        healthy: true,
        isSandboxed: true,
        message: 'GitHub connector operating in sandboxed emulation mode (free-tier / mock).',
      };
    }

    try {
      const token = this.getToken();
      await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
        timeout: 5000,
      });

      return {
        serverType: this.type,
        healthy: true,
        isSandboxed: false,
        message: 'GitHub authenticated connection verified.',
      };
    } catch (err: any) {
      return {
        serverType: this.type,
        healthy: false,
        isSandboxed: false,
        message: `GitHub connection failed: ${err.message}`,
      };
    }
  }

  getTools(): ITool[] {
    return [
      this.createGetRepoTool(),
      this.createListIssuesTool(),
      this.createCreateIssueTool(),
      this.createCreatePullRequestTool(),
      this.createPostCommentTool(),
    ];
  }

  private createGetRepoTool(): ITool<GitHubGetRepoInput> {
    return {
      name: 'github_get_repo',
      description: 'Get repository details, default branch, language, and topics from GitHub.',
      inputSchema: GitHubGetRepoInputSchema,
      execute: async (input: GitHubGetRepoInput) => {
        if (this.isSandboxed()) {
          return {
            id: 8192301,
            name: input.repo,
            fullName: `${input.owner}/${input.repo}`,
            description: 'IRONLOOM Auto-generated Repository',
            defaultBranch: 'main',
            openIssuesCount: 3,
            starsCount: 42,
            isPrivate: false,
            url: `https://github.com/${input.owner}/${input.repo}`,
            sandboxed: true,
          };
        }

        const token = this.getToken();
        const res = await axios.get(`https://api.github.com/repos/${input.owner}/${input.repo}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        });
        return {
          id: res.data.id,
          name: res.data.name,
          fullName: res.data.full_name,
          description: res.data.description,
          defaultBranch: res.data.default_branch,
          openIssuesCount: res.data.open_issues_count,
          starsCount: res.data.stargazers_count,
          isPrivate: res.data.private,
          url: res.data.html_url,
          sandboxed: false,
        };
      },
    };
  }

  private createListIssuesTool(): ITool<GitHubListIssuesInput> {
    return {
      name: 'github_list_issues',
      description: 'List issues in a GitHub repository with optional state filtering.',
      inputSchema: GitHubListIssuesInputSchema,
      execute: async (input: GitHubListIssuesInput) => {
        if (this.isSandboxed()) {
          return {
            issues: [
              {
                number: 101,
                title: 'Architecture Blueprint: Multi-tenant RLS Isolation',
                state: 'open',
                labels: ['architecture', 'security'],
                author: 'ironloom-agent',
                createdAt: new Date().toISOString(),
              },
              {
                number: 102,
                title: 'User Story: Fast Failover Rate Limiter',
                state: 'open',
                labels: ['feature', 'backend'],
                author: 'ironloom-agent',
                createdAt: new Date().toISOString(),
              },
            ],
            total: 2,
            sandboxed: true,
          };
        }

        const token = this.getToken();
        const res = await axios.get(
          `https://api.github.com/repos/${input.owner}/${input.repo}/issues?state=${input.state}&per_page=${input.limit}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
        );
        return {
          issues: res.data.map((item: any) => ({
            number: item.number,
            title: item.title,
            state: item.state,
            labels: item.labels.map((l: any) => (typeof l === 'string' ? l : l.name)),
            author: item.user?.login,
            createdAt: item.created_at,
          })),
          total: res.data.length,
          sandboxed: false,
        };
      },
    };
  }

  private createCreateIssueTool(): ITool<GitHubCreateIssueInput> {
    return {
      name: 'github_create_issue',
      description: 'Create a new issue in a GitHub repository.',
      inputSchema: GitHubCreateIssueInputSchema,
      execute: async (input: GitHubCreateIssueInput) => {
        if (this.isSandboxed()) {
          const issueNum = Math.floor(Math.random() * 800) + 100;
          return {
            issueNumber: issueNum,
            title: input.title,
            state: 'open',
            labels: input.labels,
            url: `https://github.com/${input.owner}/${input.repo}/issues/${issueNum}`,
            createdAt: new Date().toISOString(),
            sandboxed: true,
          };
        }

        const token = this.getToken();
        const res = await axios.post(
          `https://api.github.com/repos/${input.owner}/${input.repo}/issues`,
          {
            title: input.title,
            body: input.body,
            labels: input.labels,
          },
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
        );
        return {
          issueNumber: res.data.number,
          title: res.data.title,
          state: res.data.state,
          labels: res.data.labels.map((l: any) => (typeof l === 'string' ? l : l.name)),
          url: res.data.html_url,
          createdAt: res.data.created_at,
          sandboxed: false,
        };
      },
    };
  }

  private createCreatePullRequestTool(): ITool<GitHubCreatePullRequestInput> {
    return {
      name: 'github_create_pull_request',
      description: 'Open a new Pull Request between branches in a repository.',
      inputSchema: GitHubCreatePullRequestInputSchema,
      execute: async (input: GitHubCreatePullRequestInput) => {
        if (this.isSandboxed()) {
          const prNumber = Math.floor(Math.random() * 200) + 10;
          return {
            prNumber,
            title: input.title,
            head: input.head,
            base: input.base,
            state: 'open',
            url: `https://github.com/${input.owner}/${input.repo}/pull/${prNumber}`,
            sandboxed: true,
          };
        }

        const token = this.getToken();
        const res = await axios.post(
          `https://api.github.com/repos/${input.owner}/${input.repo}/pulls`,
          {
            title: input.title,
            body: input.body,
            head: input.head,
            base: input.base,
          },
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
        );
        return {
          prNumber: res.data.number,
          title: res.data.title,
          head: res.data.head.ref,
          base: res.data.base.ref,
          state: res.data.state,
          url: res.data.html_url,
          sandboxed: false,
        };
      },
    };
  }

  private createPostCommentTool(): ITool<GitHubPostCommentInput> {
    return {
      name: 'github_post_comment',
      description: 'Post a markdown comment to a GitHub issue or pull request.',
      inputSchema: GitHubPostCommentInputSchema,
      execute: async (input: GitHubPostCommentInput) => {
        if (this.isSandboxed()) {
          const commentId = Math.floor(Math.random() * 90000) + 10000;
          return {
            commentId,
            issueNumber: input.issueNumber,
            body: input.body,
            url: `https://github.com/${input.owner}/${input.repo}/issues/${input.issueNumber}#issuecomment-${commentId}`,
            createdAt: new Date().toISOString(),
            sandboxed: true,
          };
        }

        const token = this.getToken();
        const res = await axios.post(
          `https://api.github.com/repos/${input.owner}/${input.repo}/issues/${input.issueNumber}/comments`,
          { body: input.body },
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
        );
        return {
          commentId: res.data.id,
          issueNumber: input.issueNumber,
          body: res.data.body,
          url: res.data.html_url,
          createdAt: res.data.created_at,
          sandboxed: false,
        };
      },
    };
  }
}
