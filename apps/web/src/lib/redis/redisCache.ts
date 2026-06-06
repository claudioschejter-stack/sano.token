export const MARKETPLACE_FEED_CACHE_KEY = 'sanova:marketplace:feed';
export const BORROW_RATES_CACHE_KEY = 'sanova:lending:borrow-rates';

type MemoryEntry = {
  expiresAt: number;
  value: string;
};

const memoryCache = new Map<string, MemoryEntry>();

let redisClientPromise: Promise<import('ioredis').default | null> | null = null;

function redisCacheEnabled(): boolean {
  return process.env.MARKETPLACE_CACHE_REDIS === 'true' && Boolean(process.env.REDIS_URL?.trim());
}

function resolveTtlSeconds(input: {
  ttlSeconds?: number;
  ttlEnvKey?: string;
  fallbackTtlSeconds: number;
}): number {
  if (Number.isInteger(input.ttlSeconds) && (input.ttlSeconds as number) > 0) {
    return input.ttlSeconds as number;
  }

  if (input.ttlEnvKey) {
    const parsed = Number.parseInt(process.env[input.ttlEnvKey] ?? '', 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }

  return input.fallbackTtlSeconds;
}

async function getRedisClient(): Promise<import('ioredis').default | null> {
  if (!redisCacheEnabled()) return null;
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const { default: IORedis } = await import('ioredis');
        return new IORedis(process.env.REDIS_URL!.trim(), {
          maxRetriesPerRequest: 1,
          lazyConnect: true
        });
      } catch (error) {
        console.warn('[redisCache] Redis unavailable:', error);
        return null;
      }
    })();
  }
  return redisClientPromise;
}

function readMemory<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  try {
    return JSON.parse(entry.value) as T;
  } catch {
    memoryCache.delete(key);
    return null;
  }
}

function writeMemory(key: string, value: unknown, ttlSeconds: number): void {
  memoryCache.set(key, {
    expiresAt: Date.now() + ttlSeconds * 1000,
    value: JSON.stringify(value)
  });
}

async function readRedis<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    if (client.status !== 'ready') {
      await client.connect();
    }
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('[redisCache] read failed:', error);
    return null;
  }
}

async function writeRedis(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    if (client.status !== 'ready') {
      await client.connect();
    }
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    console.warn('[redisCache] write failed:', error);
  }
}

export async function getOrSetCachedJson<T>(input: {
  key: string;
  factory: () => Promise<T>;
  ttlSeconds?: number;
  ttlEnvKey?: string;
  fallbackTtlSeconds: number;
}): Promise<T> {
  const ttlSeconds = resolveTtlSeconds(input);

  const memoryHit = readMemory<T>(input.key);
  if (memoryHit !== null) return memoryHit;

  if (redisCacheEnabled()) {
    const redisHit = await readRedis<T>(input.key);
    if (redisHit !== null) {
      writeMemory(input.key, redisHit, ttlSeconds);
      return redisHit;
    }
  }

  const fresh = await input.factory();
  writeMemory(input.key, fresh, ttlSeconds);
  void writeRedis(input.key, fresh, ttlSeconds);
  return fresh;
}
