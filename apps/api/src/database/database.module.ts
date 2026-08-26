import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { AuditLogRepository } from './repositories/audit-log.repository';

@Global()
@Module({
  providers: [SupabaseService, AuditLogRepository],
  exports: [SupabaseService, AuditLogRepository],
})
export class DatabaseModule {}
