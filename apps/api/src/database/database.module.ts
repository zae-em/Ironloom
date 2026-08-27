import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { DevOpsRepository } from './repositories/devops.repository';

@Global()
@Module({
  providers: [SupabaseService, AuditLogRepository, DevOpsRepository],
  exports: [SupabaseService, AuditLogRepository, DevOpsRepository],
})
export class DatabaseModule {}
