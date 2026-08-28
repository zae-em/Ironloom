import { sanitizeSecrets, sanitizeString } from '../src/common/utils/secret-sanitizer';
import { AuditLogRepository } from '../src/database/repositories/audit-log.repository';
import { SupabaseService } from '../src/database/supabase.service';

describe('Secret Sanitization & Redaction Hardening Suite (Prompt 11)', () => {
  let auditRepo: AuditLogRepository;
  let supabaseService: SupabaseService;

  beforeAll(() => {
    supabaseService = new SupabaseService({
      get: (key: string) => {
        if (key === 'database.supabaseUrl') return 'https://mock.supabase.co';
        if (key === 'database.supabaseServiceKey') return 'mock_key';
        return undefined;
      },
    } as any);
    auditRepo = new AuditLogRepository(supabaseService);
  });

  it('1. should redact Groq, OpenAI, and GitHub API keys from strings', () => {
    const raw =
      'Connect using gsk_mock_testing_sample_key_99999999999999999999 and sk-proj-mocktestkey1234567890abcdef and token ghp_mocktestingpattoken123456789012345678';
    const cleaned = sanitizeString(raw);

    expect(cleaned).not.toContain('gsk_mock_testing_sample_key_99999999999999999999');
    expect(cleaned).not.toContain('sk-proj-mocktestkey1234567890abcdef');
    expect(cleaned).not.toContain('ghp_mocktestingpattoken123456789012345678');
    expect(cleaned).toContain('[REDACTED_SECRET]');
  });

  it('2. should redact Database URLs containing passwords from nested objects', () => {
    const payload = {
      dbConfig: {
        connectionString:
          'postgresql://postgres:super_secret_password_123@db.ironloom.com:5432/main',
        redis: 'redis://default:auth_secret_redis@redis.internal:6379',
      },
      metadata: {
        env: 'production',
      },
    };

    const sanitized = sanitizeSecrets(payload);

    expect(sanitized.dbConfig.connectionString).toBe('[REDACTED_SECRET]');
    expect(sanitized.dbConfig.redis).toBe('[REDACTED_SECRET]');
    expect(sanitized.metadata.env).toBe('production');
  });

  it('3. should automatically sanitize sensitive fields when creating audit log records', async () => {
    const record = await auditRepo.create({
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      actorType: 'user',
      actorId: 'user-1',
      action: 'credentials.rotate',
      input: {
        apiKey: 'gsk_secret_input_groq_key',
        password: 'mySecretPassword99!',
        nested: {
          token: 'ghp_secret_token_1234567890123456789012345678',
        },
      },
      output: {
        rawUri: 'postgres://admin:top_secret_pass@10.0.0.1:5432/db',
        status: 'rotated',
      },
    });

    expect((record.input as any).apiKey).toBe('[REDACTED_SECRET]');
    expect((record.input as any).password).toBe('[REDACTED_SECRET]');
    expect((record.input as any).nested.token).toBe('[REDACTED_SECRET]');
    expect((record.output as any).rawUri).toBe('[REDACTED_SECRET]');
    expect((record.output as any).status).toBe('rotated');
  });
});
