import { Module } from '@nestjs/common';
import { StructuredAlertingService } from './structured-alerting.service';
import { McpModule } from '../mcp/mcp.module';

@Module({
  imports: [McpModule],
  providers: [StructuredAlertingService],
  exports: [StructuredAlertingService],
})
export class AlertingModule {}
