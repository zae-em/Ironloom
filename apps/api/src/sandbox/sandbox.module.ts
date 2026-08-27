import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ProcessIsolationSandboxDriver } from './drivers/process-isolation.driver';
import { DockerSandboxDriver } from './drivers/docker-sandbox.driver';
import { SandboxService } from './sandbox.service';

@Module({
  imports: [DatabaseModule],
  providers: [ProcessIsolationSandboxDriver, DockerSandboxDriver, SandboxService],
  exports: [SandboxService],
})
export class SandboxModule {}
