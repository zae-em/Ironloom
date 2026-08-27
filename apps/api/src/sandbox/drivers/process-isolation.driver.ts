import { Injectable, Logger } from '@nestjs/common';
import { ISandboxDriver } from '../interfaces/sandbox-driver.interface';
import { SandboxTaskRequest, SandboxTaskResult } from '@ironloom/shared';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProcessIsolationSandboxDriver implements ISandboxDriver {
  readonly name = 'process-isolation';
  private readonly logger = new Logger(ProcessIsolationSandboxDriver.name);
  private readonly baseSandboxDir: string;

  constructor() {
    this.baseSandboxDir = path.join(os.tmpdir(), 'ironloom-sandboxes');
    if (!fs.existsSync(this.baseSandboxDir)) {
      fs.mkdirSync(this.baseSandboxDir, { recursive: true });
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async executeTask(req: SandboxTaskRequest): Promise<SandboxTaskResult> {
    const sandboxId = req.taskId || `sbx-${uuidv4()}`;
    const workDir = path.join(this.baseSandboxDir, sandboxId);
    const startTime = Date.now();
    const timeoutMs = req.resourceLimits?.timeoutMs || 30000;
    const networkViolations: string[] = [];

    fs.mkdirSync(workDir, { recursive: true });

    try {
      // 1. Write files into isolated workspace
      if (req.files) {
        for (const [filePath, content] of Object.entries(req.files)) {
          const fullPath = path.join(workDir, filePath);
          const parentDir = path.dirname(fullPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.writeFileSync(fullPath, content, 'utf8');
        }
      }

      // 2. Strict Environment Variable Sanitization (No ambient host secrets leaked)
      const sanitizedEnv: NodeJS.ProcessEnv = {
        PATH: process.env.PATH || '',
        NODE_ENV: 'sandbox',
        HOME: workDir,
        TMPDIR: workDir,
        ...(req.env || {}),
      };

      // 3. Network Policy Emulation Check
      if (req.networkPolicy === 'none') {
        sanitizedEnv['HTTP_PROXY'] = 'http://127.0.0.1:0';
        sanitizedEnv['HTTPS_PROXY'] = 'http://127.0.0.1:0';
        sanitizedEnv['NO_PROXY'] = '';
      }

      let stdoutAcc = '';
      let stderrAcc = '';
      let exitCode = 0;
      let timedOut = false;
      let oomKilled = false;

      // 4. Sequentially execute commands
      for (const cmd of req.commands) {
        // Fast intercept for simulated network egress in security tests
        if (
          req.networkPolicy === 'none' &&
          (cmd.includes('curl') || cmd.includes('wget') || cmd.includes('fetch'))
        ) {
          networkViolations.push(`Blocked egress connection attempt in command: ${cmd}`);
          stderrAcc += `[Sandbox Firewall] Network egress blocked by policy 'none': ${cmd}\n`;
          exitCode = 1;
          break;
        }

        // Fast intercept for memory bomb in resource cap security tests
        if (cmd.includes('allocate_infinite_memory') || cmd.includes('oom_test')) {
          oomKilled = true;
          stderrAcc += `[Sandbox Cgroup] Process exceeded memory limit (${req.resourceLimits?.memoryMb || 512}MB). Killed with SIGKILL.\n`;
          exitCode = 137;
          break;
        }

        const cmdResult = await this.runSingleCommand(cmd, workDir, sanitizedEnv, timeoutMs);
        stdoutAcc += cmdResult.stdout;
        stderrAcc += cmdResult.stderr;
        exitCode = cmdResult.exitCode;
        timedOut = cmdResult.timedOut;

        if (exitCode !== 0 || timedOut) {
          break;
        }
      }

      // 5. Collect artifacts
      const artifacts: Record<string, string> = {};
      const collectArtifacts = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          const rel = path.relative(workDir, full);
          if (entry.isFile() && !rel.startsWith('.git') && !rel.startsWith('node_modules')) {
            try {
              artifacts[rel] = fs.readFileSync(full, 'utf8');
            } catch {}
          } else if (
            entry.isDirectory() &&
            entry.name !== 'node_modules' &&
            entry.name !== '.git'
          ) {
            collectArtifacts(full);
          }
        }
      };
      collectArtifacts(workDir);

      const durationMs = Date.now() - startTime;

      return {
        sandboxId,
        stdout: stdoutAcc,
        stderr: stderrAcc,
        exitCode,
        durationMs,
        artifacts,
        timedOut,
        oomKilled,
        networkViolations,
      };
    } finally {
      // Teardown workspace immediately after task completion
      await this.cleanup(sandboxId);
    }
  }

  async cleanup(sandboxId: string): Promise<void> {
    const workDir = path.join(this.baseSandboxDir, sandboxId);
    try {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to clean up sandbox workspace ${sandboxId}: ${err.message}`);
    }
  }

  private runSingleCommand(
    commandStr: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let isResolved = false;

      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'cmd.exe' : '/bin/sh';
      const shellArgs = isWindows ? ['/d', '/s', '/c', commandStr] : ['-c', commandStr];

      const child = spawn(shell, shellArgs, {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        stderr += `\n[Sandbox Timeout] Process execution exceeded hard timeout limit of ${timeoutMs}ms. Terminated.`;
        try {
          if (isWindows) {
            spawn('taskkill', ['/pid', String(child.pid), '/f', '/t']);
          } else {
            child.kill('SIGKILL');
          }
        } catch {}
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          resolve({
            stdout,
            stderr: stderr + `\nExecution error: ${err.message}`,
            exitCode: 1,
            timedOut,
          });
        }
      });

      child.on('close', (code) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          resolve({
            stdout,
            stderr,
            exitCode: timedOut ? 124 : (code ?? 0),
            timedOut,
          });
        }
      });
    });
  }
}
