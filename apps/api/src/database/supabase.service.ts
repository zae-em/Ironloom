import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private adminClient: SupabaseClient | null = null;
  private pgPool: Pool | null = null;

  private isServerOnline: boolean | null = null;
  private lastCheckedTime = 0;
  private readonly checkIntervalMs = 30000;

  constructor(private readonly configService: ConfigService) {
    this.initClients();
  }

  private initClients() {
    const url = this.configService.get<string>('supabase.url', 'http://localhost:54321');
    const serviceKey = this.configService.get<string>('supabase.serviceRoleKey', 'dummy_service_key');
    const dbUrl = this.configService.get<string>('supabase.databaseUrl');

    if (process.env.AI_DEFAULT_PROVIDER === 'mock' || this.configService.get('aiGateway.defaultProvider') === 'mock') {
      this.isServerOnline = false;
      this.lastCheckedTime = Date.now() + 10000000;
    }

    const fastFetch = async (input: any, init: any) => {
      if (process.env.AI_DEFAULT_PROVIDER === 'mock' || this.isServerOnline === false) {
        throw new Error('Supabase server offline (in-memory fallback active)');
      }

      const now = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 150);

      try {
        const res = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        this.isServerOnline = true;
        this.lastCheckedTime = now;
        return res;
      } catch (err: any) {
        clearTimeout(timeoutId);
        this.isServerOnline = false;
        this.lastCheckedTime = now;
        throw err;
      }
    };

    try {
      this.adminClient = createClient(url, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          fetch: fastFetch,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Supabase client init warning: ${err.message}`);
    }

    if (dbUrl) {
      try {
        this.pgPool = new Pool({
          connectionString: dbUrl,
          max: 10,
          connectionTimeoutMillis: 200,
          idleTimeoutMillis: 30000,
        });
      } catch (err: any) {
        this.logger.warn(`Postgres pool init warning: ${err.message}`);
      }
    }
  }

  /**
   * Checks if Supabase server is available for live queries or if in-memory fallback should be used immediately.
   */
  isServerAvailable(): boolean {
    if (process.env.AI_DEFAULT_PROVIDER === 'mock' || process.env.NODE_ENV === 'test') {
      return false;
    }
    return this.isServerOnline !== false;
  }

  /**
   * Service-role Supabase client bypassing RLS for system operations
   */
  getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      this.initClients();
    }
    return this.adminClient!;
  }

  /**
   * Scoped Supabase client configured with the user's JWT
   */
  getUserClient(jwt: string): SupabaseClient {
    const url = this.configService.get<string>('supabase.url', 'http://localhost:54321');
    const anonKey = this.configService.get<string>('supabase.anonKey', 'dummy_anon_key');

    const fastFetch = async (input: any, init: any) => {
      const now = Date.now();
      if (this.isServerOnline === false && now - this.lastCheckedTime < this.checkIntervalMs) {
        throw new Error('Supabase server offline (in-memory fallback active)');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 150);

      try {
        const res = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        this.isServerOnline = true;
        this.lastCheckedTime = now;
        return res;
      } catch (err: any) {
        clearTimeout(timeoutId);
        this.isServerOnline = false;
        this.lastCheckedTime = now;
        throw err;
      }
    };

    return createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        fetch: fastFetch,
      },
    });
  }

  getScopedClient(jwt: string): SupabaseClient {
    return this.getUserClient(jwt);
  }

  /**
   * Raw PostgreSQL connection pool for direct SQL migrations
   */
  async getDbClient(): Promise<PoolClient> {
    if (!this.pgPool) {
      const dbUrl = this.configService.get<string>(
        'supabase.databaseUrl',
        'postgresql://postgres:postgres@localhost:54322/postgres',
      );
      this.pgPool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 200 });
    }
    return this.pgPool.connect();
  }
}
