import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditExportService } from './audit-export.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditController],
  providers: [AuditExportService],
  exports: [AuditExportService],
})
export class AuditModule {}
