import { Injectable, Logger } from '@nestjs/common';
import { CreateAuditLogDto, AuditLogEvent } from '@ironloom/shared';
import { SupabaseService } from '../supabase.service';
import { sanitizeSecrets } from '../../common/utils/secret-sanitizer';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuditLogRepository {
  private readonly logger = new Logger(AuditLogRepository.name);
  // In-memory fallback logs for testing / offline local environments
  private readonly fallbackLogs: AuditLogEvent[] = [];

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(dto: CreateAuditLogDto): Promise<AuditLogEvent> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: AuditLogEvent = {
      id,
      org_id: dto.orgId,
      project_id: dto.projectId || null,
      actor_type: dto.actorType,
      actor_id: dto.actorId,
      action: dto.action,
      input: sanitizeSecrets(dto.input || {}),
      output: sanitizeSecrets(dto.output || {}),
      model: dto.model || null,
      provider: dto.provider || null,
      cost_usd: Number(dto.costUsd || 0),
      latency_ms: Math.round(dto.latencyMs || 0),
      status: dto.status || 'success',
      created_at: now,
    };

    try {
      const client = this.supabaseService.getAdminClient();
      const insertPromise = client
        .from('audit_log')
        .insert({
          id: record.id,
          org_id: record.org_id,
          project_id: record.project_id,
          actor_type: record.actor_type,
          actor_id: record.actor_id,
          action: record.action,
          input: record.input,
          output: record.output,
          model: record.model,
          provider: record.provider,
          cost_usd: record.cost_usd,
          latency_ms: record.latency_ms,
          status: record.status,
          created_at: record.created_at,
        })
        .select()
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase client connection timeout')), 1000),
      );

      const { data, error } = (await Promise.race([insertPromise, timeoutPromise])) as any;

      if (error) {
        throw error;
      }

      this.logger.debug(`Audit log recorded in database: ${record.id} [${record.action}]`);
      this.fallbackLogs.unshift(data as AuditLogEvent);
      return data as AuditLogEvent;
    } catch (err: any) {
      this.logger.debug(
        `Database audit log insert fallback (${err.message}). Storing in local memory buffer.`,
      );
      this.fallbackLogs.unshift(record);
      return record;
    }
  }

  async findByOrg(orgId: string, limit = 50): Promise<AuditLogEvent[]> {
    try {
      const client = this.supabaseService.getAdminClient();
      const fetchPromise = client
        .from('audit_log')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase client connection timeout')), 1000),
      );

      const { data, error } = (await Promise.race([fetchPromise, timeoutPromise])) as any;

      if (error) throw error;
      return (data as AuditLogEvent[]) || [];
    } catch {
      return this.fallbackLogs.filter((log) => log.org_id === orgId).slice(0, limit);
    }
  }

  async findByProject(projectId: string, limit = 50): Promise<AuditLogEvent[]> {
    try {
      const client = this.supabaseService.getAdminClient();
      const fetchPromise = client
        .from('audit_log')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase client connection timeout')), 1000),
      );

      const { data, error } = (await Promise.race([fetchPromise, timeoutPromise])) as any;

      if (error) throw error;
      return (data as AuditLogEvent[]) || [];
    } catch {
      return this.fallbackLogs.filter((log) => log.project_id === projectId).slice(0, limit);
    }
  }

  async findLatest(limit = 10): Promise<AuditLogEvent[]> {
    try {
      const client = this.supabaseService.getAdminClient();
      const fetchPromise = client
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase client connection timeout')), 1000),
      );

      const { data, error } = (await Promise.race([fetchPromise, timeoutPromise])) as any;

      if (error) throw error;
      return (data as AuditLogEvent[]) || [];
    } catch {
      return this.fallbackLogs.slice(0, limit);
    }
  }

  getMemoryLogs(): AuditLogEvent[] {
    return [...this.fallbackLogs];
  }

  clearMemoryLogs(): void {
    this.fallbackLogs.length = 0;
  }
}
