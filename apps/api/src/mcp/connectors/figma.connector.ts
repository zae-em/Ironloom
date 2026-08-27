import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  McpServerType,
  FigmaGetFileInput,
  FigmaGetFileInputSchema,
  FigmaGetCommentsInput,
  FigmaGetCommentsInputSchema,
  FigmaGetComponentStylesInput,
  FigmaGetComponentStylesInputSchema,
} from '@ironloom/shared';
import { ITool } from '../../agents/core/tools/tool.interface';
import { ConnectorHealthStatus, IMcpConnector } from '../interfaces/mcp-connector.interface';

@Injectable()
export class FigmaConnector implements IMcpConnector {
  readonly type: McpServerType = 'figma';
  private readonly logger = new Logger(FigmaConnector.name);

  constructor(private readonly configService: ConfigService) {}

  private getToken(): string | undefined {
    return this.configService.get<string>('FIGMA_ACCESS_TOKEN') || process.env.FIGMA_ACCESS_TOKEN;
  }

  private isSandboxed(): boolean {
    const token = this.getToken();
    return !token || token.startsWith('mock_') || token === 'dummy_figma_token';
  }

  async testConnection(): Promise<ConnectorHealthStatus> {
    if (this.isSandboxed()) {
      return {
        serverType: this.type,
        healthy: true,
        isSandboxed: true,
        message: 'Figma connector operating in sandboxed emulation mode (free-tier / mock).',
      };
    }

    try {
      const token = this.getToken();
      await axios.get('https://api.figma.com/v1/me', {
        headers: { 'X-Figma-Token': token },
        timeout: 5000,
      });

      return {
        serverType: this.type,
        healthy: true,
        isSandboxed: false,
        message: 'Figma authenticated connection verified.',
      };
    } catch (err: any) {
      return {
        serverType: this.type,
        healthy: false,
        isSandboxed: false,
        message: `Figma connection failed: ${err.message}`,
      };
    }
  }

  getTools(): ITool[] {
    return [
      this.createGetFileTool(),
      this.createGetCommentsTool(),
      this.createGetComponentStylesTool(),
    ];
  }

  private createGetFileTool(): ITool<FigmaGetFileInput> {
    return {
      name: 'figma_get_file',
      description: 'Fetch design file document tree, frames, and design specs from Figma.',
      inputSchema: FigmaGetFileInputSchema,
      execute: async (input: FigmaGetFileInput) => {
        if (this.isSandboxed()) {
          return {
            name: 'IRONLOOM Design System & Dashboard Specs',
            lastModified: new Date().toISOString(),
            version: '1.4.0',
            document: {
              id: '0:0',
              name: 'Document',
              type: 'DOCUMENT',
              children: [
                {
                  id: '1:2',
                  name: 'Workflow Graph Canvas Frame',
                  type: 'CANVAS',
                  backgroundColor: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
                },
                {
                  id: '1:3',
                  name: 'Node Detail Slide-over Inspector',
                  type: 'FRAME',
                },
              ],
            },
            sandboxed: true,
          };
        }

        const token = this.getToken();
        const res = await axios.get(
          `https://api.figma.com/v1/files/${input.fileKey}?depth=${input.depth}`,
          { headers: { 'X-Figma-Token': token } },
        );
        return {
          name: res.data.name,
          lastModified: res.data.lastModified,
          version: res.data.version,
          document: res.data.document,
          sandboxed: false,
        };
      },
    };
  }

  private createGetCommentsTool(): ITool<FigmaGetCommentsInput> {
    return {
      name: 'figma_get_comments',
      description: 'Retrieve user feedback and design review comments left on a Figma file.',
      inputSchema: FigmaGetCommentsInputSchema,
      execute: async (input: FigmaGetCommentsInput) => {
        if (this.isSandboxed()) {
          return {
            comments: [
              {
                id: 'cm_101',
                message: 'Ensure the rejection loopback line uses clear red accent styling.',
                user: { handle: 'Design Lead' },
                createdAt: new Date().toISOString(),
              },
              {
                id: 'cm_102',
                message: 'Approval cards need distinct CTA buttons for Approve vs Reject.',
                user: { handle: 'Product Designer' },
                createdAt: new Date().toISOString(),
              },
            ],
            total: 2,
            sandboxed: true,
          };
        }

        const token = this.getToken();
        const res = await axios.get(`https://api.figma.com/v1/files/${input.fileKey}/comments`, {
          headers: { 'X-Figma-Token': token },
        });
        return {
          comments: res.data.comments,
          total: res.data.comments?.length || 0,
          sandboxed: false,
        };
      },
    };
  }

  private createGetComponentStylesTool(): ITool<FigmaGetComponentStylesInput> {
    return {
      name: 'figma_get_component_styles',
      description:
        'Extract published component styles, color tokens, and typography definitions from Figma.',
      inputSchema: FigmaGetComponentStylesInputSchema,
      execute: async (input: FigmaGetComponentStylesInput) => {
        if (this.isSandboxed()) {
          return {
            fileKey: input.fileKey,
            styles: [
              {
                key: 'style_primary',
                name: 'Color/Indigo-600',
                styleType: 'FILL',
                value: '#4f46e5',
              },
              { key: 'style_surface', name: 'Color/Dark-950', styleType: 'FILL', value: '#030712' },
              {
                key: 'style_accent',
                name: 'Color/Emerald-500',
                styleType: 'FILL',
                value: '#10b981',
              },
            ],
            sandboxed: true,
          };
        }

        const token = this.getToken();
        const res = await axios.get(`https://api.figma.com/v1/files/${input.fileKey}/styles`, {
          headers: { 'X-Figma-Token': token },
        });
        return {
          fileKey: input.fileKey,
          styles: res.data.meta?.styles || [],
          sandboxed: false,
        };
      },
    };
  }
}
