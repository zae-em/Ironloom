import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AuditExportService } from '../src/audit/audit-export.service';
import { StructuredAlertingService } from '../src/alerting/structured-alerting.service';
import { AuditLogRepository } from '../src/database/repositories/audit-log.repository';
import { DatabaseModule } from '../src/database/database.module';
import { McpModule } from '../src/mcp/mcp.module';

describe('Audit Export & Structured Operational Alerting Suite (Prompt 11)', () => {
  let auditExportService: AuditExportService;
  let alertingService: StructuredAlertingService;
  let auditRepo: AuditLogRepository;

  const PROJ_ID = '11111111-1111-1111-1111-111111111111';
  const ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, McpModule],
      providers: [AuditExportService, StructuredAlertingService],
    }).compile();

    auditExportService = module.get<AuditExportService>(AuditExportService);
    alertingService = module.get<StructuredAlertingService>(StructuredAlertingService);
    auditRepo = module.get<AuditLogRepository>(AuditLogRepository);

    // Seed audit logs
    await auditRepo.create({
      orgId: ORG_ID,
      projectId: PROJ_ID,
      actorType: 'agent',
      actorId: 'developer',
      action: 'code.pull_request_opened',
      model: 'llama3-70b-8192',
      provider: 'groq',
      costUsd: 0.002,
      latencyMs: 850,
      status: 'success',
    });
  });

  it('1. should export project audit trail as valid JSON', async () => {
    const res = await auditExportService.exportProjectAuditTrail(PROJ_ID, 'json');

    expect(res.contentType).toBe('application/json');
    expect(res.filename).toContain('.json');

    const parsed = JSON.parse(res.data);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0].project_id).toBe(PROJ_ID);
  });

  it('2. should export organization audit trail as valid RFC 4180 CSV', async () => {
    const res = await auditExportService.exportOrgAuditTrail(ORG_ID, 'csv');

    expect(res.contentType).toBe('text/csv');
    expect(res.filename).toContain('.csv');

    const lines = res.data.split('\n');
    expect(lines[0]).toBe(
      'id,org_id,project_id,actor_type,actor_id,action,model,provider,cost_usd,latency_ms,status,created_at',
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]).toContain(ORG_ID);
  });

  it('3. should dispatch structured operational alert through Slack MCP connector', async () => {
    const alert = await alertingService.dispatchAlert({
      category: 'gateway_failure',
      severity: 'critical',
      title: 'Groq API Rate Limit Breached',
      message: 'Persistent 429 received across 3 consecutive requests. Failover active.',
      channel: '#sre-critical',
    });

    expect(alert.id).toBeDefined();
    expect(alert.severity).toBe('critical');
    expect(alertingService.getActiveAlerts().length).toBeGreaterThan(0);
  });
});
