import { Injectable, Logger } from '@nestjs/common';
import { SandboxTaskRequest, SandboxTaskResult } from '@ironloom/shared';
import { ProcessIsolationSandboxDriver } from './drivers/process-isolation.driver';
import { DockerSandboxDriver } from './drivers/docker-sandbox.driver';
import { AuditLogRepository } from '../database/repositories/audit-log.repository';
import { v4 as uuidv4 } from 'uuid';

export interface SandboxExecutionContext {
  orgId?: string;
  projectId?: string;
  agentId?: string;
  workflowRunId?: string;
}

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);

  constructor(
    private readonly processDriver: ProcessIsolationSandboxDriver,
    private readonly dockerDriver: DockerSandboxDriver,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async executeTask(
    req: SandboxTaskRequest,
    context?: SandboxExecutionContext,
  ): Promise<SandboxTaskResult> {
    const taskId = req.taskId || `task-${uuidv4()}`;
    const startTime = Date.now();

    // 1. Scoped Credential Sanitization
    // Strip ambient secrets and inject only explicitly requested scoped tokens
    const scopedEnv: Record<string, string> = {
      ...(req.env || {}),
      IRONLOOM_SANDBOX_ID: taskId,
      IRONLOOM_EXECUTION_MODE: 'isolated',
    };

    const sanitizedReq: SandboxTaskRequest = {
      ...req,
      taskId,
      env: scopedEnv,
    };

    // 2. Select Driver
    const isDocker = await this.dockerDriver.isAvailable();
    const activeDriver = isDocker ? this.dockerDriver : this.processDriver;

    this.logger.debug(
      `Executing sandbox task ${taskId} using driver '${activeDriver.name}' (${sanitizedReq.commands.length} commands)`,
    );

    // 3. Execute
    const result = await activeDriver.executeTask(sanitizedReq);

    // 4. Audit Log
    try {
      await this.auditRepo.create({
        orgId: context?.orgId || '00000000-0000-0000-0000-000000000000',
        projectId: context?.projectId || null,
        actorType: 'agent',
        actorId: context?.agentId || 'sandbox_engine',
        action: 'sandbox.execute_task',
        status:
          result.exitCode === 0 && !result.timedOut && !result.oomKilled ? 'success' : 'failure',
        input: {
          commands: sanitizedReq.commands,
          resourceLimits: sanitizedReq.resourceLimits,
          networkPolicy: sanitizedReq.networkPolicy,
          filesProvided: Object.keys(sanitizedReq.files || {}),
        },
        output: {
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          timedOut: result.timedOut,
          oomKilled: result.oomKilled,
          networkViolations: result.networkViolations,
          stdoutSnippet: result.stdout.slice(0, 500),
          stderrSnippet: result.stderr.slice(0, 500),
        },
        costUsd: 0.0,
        latencyMs: result.durationMs,
      });
    } catch (auditErr: any) {
      this.logger.warn(`Failed to write sandbox audit log: ${auditErr.message}`);
    }

    return result;
  }
}
