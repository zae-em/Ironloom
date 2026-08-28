import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuditExportService } from './audit-export.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditExportService: AuditExportService) {}

  @Get('projects/:projectId/export')
  async exportProjectAuditTrail(
    @Param('projectId') projectId: string,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Res() res: Response,
  ) {
    const result = await this.auditExportService.exportProjectAuditTrail(projectId, format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.data);
  }

  @Get('organizations/:orgId/export')
  async exportOrgAuditTrail(
    @Param('orgId') orgId: string,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Res() res: Response,
  ) {
    const result = await this.auditExportService.exportOrgAuditTrail(orgId, format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.data);
  }
}
