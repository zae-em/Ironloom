import { SandboxTaskRequest, SandboxTaskResult } from '@ironloom/shared';

export interface ISandboxDriver {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  executeTask(req: SandboxTaskRequest): Promise<SandboxTaskResult>;
  cleanup(sandboxId: string): Promise<void>;
}
