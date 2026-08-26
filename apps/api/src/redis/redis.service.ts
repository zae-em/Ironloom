import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface MemoryEntry {
  value: any;
  expiresAt?: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  // In-memory fallback if Redis daemon is not reachable
  private readonly memoryStore = new Map<string, MemoryEntry>();
  private readonly memoryTimestamps = new Map<string, number[]>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    if (process.env.AI_DEFAULT_PROVIDER === 'mock' || process.env.NODE_ENV === 'test') {
      this.isConnected = false;
      return;
    }

    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password');

    try {
      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop retrying, use memory fallback
          }
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Connected to Redis at ${host}:${port}`);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(
          `Redis connection error: ${err.message}. Operating in resilient memory-fallback mode.`,
        );
      });

      await this.client.connect().catch((err) => {
        this.isConnected = false;
        this.logger.warn(
          `Could not connect to Redis: ${err.message}. Defaulting to in-memory store.`,
        );
      });
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(`Redis initialization failed: ${err.message}. Using in-memory fallback.`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.get(key);
      } catch (err) {
        this.logger.debug(`Redis get failed for key ${key}, falling back to memory`);
      }
    }

    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        if (ttlSeconds) {
          await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch (err) {
        this.logger.debug(`Redis set failed for key ${key}, falling back to memory`);
      }
    }

    this.memoryStore.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
        return;
      } catch (err) {
        this.logger.debug(`Redis del failed for key ${key}`);
      }
    }
    this.memoryStore.delete(key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (this.isConnected && this.client) {
      try {
        const val = await this.client.incr(key);
        if (val === 1 && ttlSeconds) {
          await this.client.expire(key, ttlSeconds);
        }
        return val;
      } catch (err) {
        this.logger.debug(`Redis incr failed for key ${key}, falling back to memory`);
      }
    }

    const current = await this.get(key);
    const nextVal = (current ? parseInt(current, 10) : 0) + 1;
    await this.set(key, nextVal.toString(), ttlSeconds);
    return nextVal;
  }

  async incrementSlidingWindow(
    key: string,
    windowSeconds = 60,
  ): Promise<{ count: number; resetMs: number }> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    if (this.isConnected && this.client) {
      try {
        const multi = this.client.multi();
        multi.zremrangebyscore(key, '-inf', windowStart);
        multi.zadd(key, now, `${now}-${Math.random()}`);
        multi.zcard(key);
        multi.expire(key, windowSeconds);

        const results = await multi.exec();
        const count = (results?.[2]?.[1] as number) || 1;
        return { count, resetMs: windowSeconds * 1000 };
      } catch (err) {
        this.logger.debug(`Redis sliding window failed for ${key}, using memory`);
      }
    }

    // In-memory sliding window
    let timestamps = this.memoryTimestamps.get(key) || [];
    timestamps = timestamps.filter((ts) => ts > windowStart);
    timestamps.push(now);
    this.memoryTimestamps.set(key, timestamps);

    return {
      count: timestamps.length,
      resetMs: windowSeconds * 1000,
    };
  }

  async recordProviderCall(provider: string, tokens: number): Promise<void> {
    const minuteKey = `quota:${provider}:rpm:${Math.floor(Date.now() / 60000)}`;
    const tpmKey = `quota:${provider}:tpm:${Math.floor(Date.now() / 60000)}`;

    await this.incr(minuteKey, 120);

    if (this.isConnected && this.client) {
      try {
        await this.client.incrby(tpmKey, tokens);
        await this.client.expire(tpmKey, 120);
        return;
      } catch (err) {
        // fallback
      }
    }

    const currentTokens = parseInt((await this.get(tpmKey)) || '0', 10);
    await this.set(tpmKey, (currentTokens + tokens).toString(), 120);
  }

  async getProviderCurrentUsage(provider: string): Promise<{ rpm: number; tpm: number }> {
    const minuteKey = `quota:${provider}:rpm:${Math.floor(Date.now() / 60000)}`;
    const tpmKey = `quota:${provider}:tpm:${Math.floor(Date.now() / 60000)}`;

    const [rpmStr, tpmStr] = await Promise.all([this.get(minuteKey), this.get(tpmKey)]);

    return {
      rpm: parseInt(rpmStr || '0', 10),
      tpm: parseInt(tpmStr || '0', 10),
    };
  }
}
