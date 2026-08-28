import { Injectable, Logger } from '@nestjs/common';
import { AuditLogRepository } from '../database/repositories/audit-log.repository';
import { AuditLogEvent } from '@ironloom/shared';

@Injectable()
export class AuditExportService {
  private readonly logger = new Logger(AuditExportService.name);

  constructor(private readonly auditRepo: AuditLogRepository) {}

  async exportProjectAuditTrail(
    projectId: string,
    format: 'json' | 'csv' = 'json',
  ): Promise<{ data: string; contentType: string; filename: string }> {
    const logs = await this.auditRepo.findByProject(projectId, 500);
    return this.formatExport(logs, `audit-export-project-${projectId}`, format);
  }

  async exportOrgAuditTrail(
    orgId: string,
    format: 'json' | 'csv' = 'json',
  ): Promise<{ data: string; contentType: string; filename: string }> {
    const logs = await this.auditRepo.findByOrg(orgId, 500);
    return this.formatExport(logs, `audit-export-org-${orgId}`, format);
  }

  private formatExport(
    logs: AuditLogEvent[],
    baseFilename: string,
    format: 'json' | 'csv',
  ): { data: string; contentType: string; filename: string } {
    if (format === 'csv') {
      const headers = [
        'id',
        'org_id',
        'project_id',
        'actor_type',
        'actor_id',
        'action',
        'model',
        'provider',
        'cost_usd',
        'latency_ms',
        'status',
        'created_at',
      ];

      const rows = logs.map((log) => [
        `"${log.id}"`,
        `"${log.org_id}"`,
        `"${log.project_id || ''}"`,
        `"${log.actor_type}"`,
        `"${log.actor_id}"`,
        `"${log.action}"`,
        `"${log.model || ''}"`,
        `"${log.provider || ''}"`,
        log.cost_usd,
        log.latency_ms,
        `"${log.status}"`,
        `"${log.created_at}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      return {
        data: csvContent,
        contentType: 'text/csv',
        filename: `${baseFilename}.csv`,
      };
    }

    // Default: JSON
    return {
      data: JSON.stringify(logs, null, 2),
      contentType: 'application/json',
      filename: `${baseFilename}.json`,
    };
  }
}
