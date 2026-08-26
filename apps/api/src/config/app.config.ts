export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
    databaseUrl?: string;
  };
  aiGateway: {
    defaultProvider: string;
    fallbackProviders: string[];
    maxRetries: number;
    retryDelayMs: number;
    ollama: {
      baseUrl: string;
      defaultModel: string;
      timeoutMs: number;
    };
    groq: {
      apiKey: string;
      baseUrl: string;
      defaultModel: string;
      timeoutMs: number;
    };
  };
  rateLimit: {
    ttl: number;
    max: number;
  };
}

export const loadConfig = (): AppConfig => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  supabase: {
    url: process.env.SUPABASE_URL || 'http://localhost:54321',
    anonKey: process.env.SUPABASE_ANON_KEY || 'dummy_anon_key',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_service_role_key',
    databaseUrl:
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres',
  },
  aiGateway: {
    defaultProvider: process.env.GATEWAY_DEFAULT_PROVIDER || 'ollama',
    fallbackProviders: (process.env.GATEWAY_FALLBACK_PROVIDERS || 'groq')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
    maxRetries: parseInt(process.env.GATEWAY_MAX_RETRIES || '2', 10),
    retryDelayMs: parseInt(process.env.GATEWAY_RETRY_DELAY_MS || '500', 10),
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.1',
      timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '60000', 10),
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      defaultModel: process.env.GROQ_DEFAULT_MODEL || 'llama-3.3-70b-versatile',
      timeoutMs: parseInt(process.env.GROQ_TIMEOUT_MS || '30000', 10),
    },
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
});
