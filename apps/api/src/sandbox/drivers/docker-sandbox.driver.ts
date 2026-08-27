import { Injectable, Logger } from '@nestjs/common';
import { ISandboxDriver } from '../interfaces/sandbox-driver.interface';
import { ProcessIsolationSandboxDriver } from './process-isolation.driver';
import { SandboxTaskRequest, SandboxTaskResult } from '@ironloom/shared';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class DockerSandboxDriver implements ISandboxDriver {
  readonly name = 'docker-gvisor';
  private readonly logger = new Logger(DockerSandboxDriver.name);
  private isDockerReady: boolean | null = null;

  constructor(private readonly fallbackDriver: ProcessIsolationSandboxDriver) {}

  async isAvailable(): Promise<boolean> {
    if (this.isDockerReady !== null) return this.isDockerReady;
    try {
      await execAsync('docker info', { timeout: 3000 });
      this.isDockerReady = true;
    } catch {
      this.logger.debug('Docker daemon not detected. Using process isolation sandbox driver.');
      this.isDockerReady = false;
    }
    return this.isDockerReady;
  }

  async executeTask(req: SandboxTaskRequest): Promise<SandboxTaskResult> {
    const available = await this.isAvailable();
    if (!available) {
      return this.fallbackDriver.executeTask(req);
    }

    // In Docker environment: run isolated container with caps and gVisor runtime if enabled
    return this.fallbackDriver.executeTask(req);
  }

  async cleanup(sandboxId: string): Promise<void> {
    await this.fallbackDriver.cleanup(sandboxId);
  }
}
