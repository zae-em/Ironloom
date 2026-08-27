import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AgentRole, SlackInteractionPayload } from '@ironloom/shared';
import { McpToolRegistryService } from './mcp-tool-registry.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcpRegistry: McpToolRegistryService,
    private readonly orchestrationService: OrchestrationService,
  ) {}

  /**
   * Health and connectivity status for all 4 MCP connectors.
   */
  @Get('status')
  async getStatus() {
    return this.mcpRegistry.getConnectorsStatus();
  }

  /**
   * Returns all available MCP tools, optionally filtered by agent role scope.
   */
  @Get('tools')
  async listTools(@Query('role') role?: AgentRole) {
    if (role) {
      const tools = this.mcpRegistry.getScopedTools(role);
      return tools.map((t) => ({
        name: t.name,
        description: t.description,
        authorizedRole: role,
      }));
    }

    return this.mcpRegistry.getAllMcpTools();
  }

  /**
   * Slack Interactive Button Webhook.
   * Handles Approve / Reject button clicks originating directly from Slack cards,
   * resolving the approval request and advancing the workflow run.
   */
  @Post('slack/interactions')
  @HttpCode(HttpStatus.OK)
  async handleSlackInteraction(@Body() payload: any) {
    this.logger.log(`Received Slack interactive payload: ${JSON.stringify(payload)}`);

    let parsedPayload: SlackInteractionPayload;

    // Support both direct JSON body and Slack URL-encoded block kit payload wrappers
    if (payload.payload && typeof payload.payload === 'string') {
      const slackBlockKit = JSON.parse(payload.payload);
      const action = slackBlockKit.actions?.[0];
      const actionVal = action?.value ? JSON.parse(action.value) : {};

      parsedPayload = {
        action: actionVal.action || (action?.action_id?.includes('approve') ? 'approve' : 'reject'),
        workflowRunId: actionVal.workflowRunId,
        approvalRequestId: actionVal.approvalRequestId,
        actorUserId: slackBlockKit.user?.id || 'slack_user',
        notes:
          actionVal.notes ||
          `Decided via Slack interactive card by ${slackBlockKit.user?.name || 'reviewer'}`,
      };
    } else {
      parsedPayload = {
        action: payload.action,
        workflowRunId: payload.workflowRunId,
        approvalRequestId: payload.approvalRequestId,
        actorUserId: payload.actorUserId || 'slack_user',
        notes: payload.notes || 'Decided via Slack webhook',
      };
    }

    const result = await this.orchestrationService.decideApproval({
      approvalId: parsedPayload.approvalRequestId,
      dto: {
        decision: parsedPayload.action === 'approve' ? 'approved' : 'rejected',
        notes: parsedPayload.notes,
      },
      actorUserId: parsedPayload.actorUserId || 'slack-bot',
    });

    return {
      text: `✅ Successfully processed ${parsedPayload.action.toUpperCase()} for approval request ${parsedPayload.approvalRequestId}. Workflow status is now ${result.workflowRun.status}.`,
      status: 'success',
      workflowRunId: result.workflowRun.id,
      workflowStatus: result.workflowRun.status,
      currentNode: result.workflowRun.currentNode,
    };
  }

  /**
   * Execute an MCP tool directly (useful for UI debugging or manual triggers).
   */
  @Post('execute')
  @UseGuards(SupabaseAuthGuard)
  async executeTool(
    @Body() body: { toolName: string; input: any; role?: AgentRole; workflowRunId?: string },
    @CurrentUser() user: any,
  ) {
    return this.mcpRegistry.executeScopedTool(body.toolName, body.input, {
      userId: user.id,
      orgId: user.org_id,
      role: body.role,
      workflowRunId: body.workflowRunId,
    });
  }
}
