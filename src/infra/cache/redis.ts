import { Redis } from 'ioredis'
import { env } from '../../config/env.js'

const globalForRedis = globalThis as unknown as { redis: Redis | undefined }

function createRedisClient(): Redis {
    const client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: true,
        retryStrategy(times: number) {
            if (times > 10) return null
            return Math.min(times * 200, 2000)
        },
    })

    client.on('error', (err: Error) => {
        if (err.message.includes('ECONNREFUSED')) return
        console.error('❌ Redis error:', err.message)
    })

    client.on('connect', () => {
        console.log('✅ Redis connected')
    })

    client.connect().catch(() => {
        console.warn('⚠️  Redis not available — features requiring Redis will be degraded')
    })

    return client
}

export const redis = globalForRedis.redis ?? createRedisClient()

if (env.NODE_ENV !== 'production') {
    globalForRedis.redis = redis
}

// ─── CACHE HELPERS ──────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
    try {
        const raw = await redis.get(key)
        if (!raw) return null
        return JSON.parse(raw) as T
    } catch {
        return null
    }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value)
        await redis.set(key, serialized, 'EX', ttlSeconds)
    } catch { /* Redis unavailable — silently skip */ }
}

export async function cacheDel(key: string): Promise<void> {
    try { await redis.del(key) } catch { /* noop */ }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
    try {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) await redis.del(...keys)
    } catch { /* noop */ }
}

// ─── TOKEN BLACKLIST ────────────────────────────────────────

export async function blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    try {
        await redis.set(`blacklist:${token}`, '1', 'EX', ttlSeconds)
    } catch { /* noop */ }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
    try {
        const result = await redis.get(`blacklist:${token}`)
        return result === '1'
    } catch {
        return false
    }
}
