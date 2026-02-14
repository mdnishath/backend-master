import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../infra/database/prisma.js'
import { cacheGet, cacheSet } from '../../infra/cache/redis.js'
import { TooManyRequestsError } from '../../shared/errors.js'

interface RateLimitInfo {
    limit: number
    remaining: number
    reset: number
}

interface TenantSettings {
    rateLimit?: number // requests per minute (-1 = unlimited)
    maxUsers?: number // -1 = unlimited
    maxStorage?: number // bytes, -1 = unlimited
    maxWebhooks?: number // -1 = unlimited
    features?: string[] // enabled features: ["posts", "ecommerce", "notifications"]
}

const DEFAULT_SETTINGS: TenantSettings = {
    rateLimit: 100,
    maxUsers: -1, // unlimited (open source!)
    maxStorage: -1, // unlimited
    maxWebhooks: -1, // unlimited
    features: ['*'], // all features enabled
}

/**
 * Dynamic per-tenant rate limiting based on Tenant settings
 * Uses Redis sliding window algorithm for accurate counting
 *
 * Settings stored in Tenant.settings JSON field (no paid plans!)
 */
export async function rateLimitGuard(request: FastifyRequest, _reply: FastifyReply) {
    // Skip rate limiting for non-authenticated requests (handled by global Fastify rate limit)
    if (!request.user?.tenantId) {
        return
    }

    const tenantId = request.user.tenantId
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute window

    // Get tenant's rate limit from settings (cached for 5 minutes)
    const cacheKey = `tenant:settings:${tenantId}`
    let settings = await cacheGet<TenantSettings>(cacheKey)

    if (settings === null) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { settings: true, isActive: true },
        })

        if (!tenant || !tenant.isActive) {
            throw new TooManyRequestsError('Tenant is not active')
        }

        // Merge with defaults
        settings = { ...DEFAULT_SETTINGS, ...(tenant.settings as TenantSettings || {}) }
        await cacheSet(cacheKey, settings, 300) // Cache for 5 minutes
    }

    const rateLimit = settings.rateLimit || DEFAULT_SETTINGS.rateLimit!

    // -1 means unlimited (skip rate limiting)
    if (rateLimit === -1) {
        return
    }

    // Redis key for sliding window
    const key = `ratelimit:${tenantId}:${Math.floor(now / windowMs)}`
    const previousKey = `ratelimit:${tenantId}:${Math.floor((now - windowMs) / windowMs)}`

    try {
        // Get current and previous window counts from Redis
        const [current, previous] = await Promise.all([
            cacheGet<number>(key),
            cacheGet<number>(previousKey),
        ])

        const currentCount = current ?? 0
        const previousCount = previous ?? 0

        // Calculate weighted count using sliding window
        const percentageInCurrent = (now % windowMs) / windowMs
        const weightedCount = Math.floor(
            currentCount + previousCount * (1 - percentageInCurrent)
        )

        if (weightedCount >= rateLimit) {
            const resetTime = Math.ceil((Math.floor(now / windowMs) + 1) * windowMs / 1000)

            throw new TooManyRequestsError(
                `Rate limit exceeded. Limit: ${rateLimit} requests/min. Try again in ${Math.ceil((resetTime * 1000 - now) / 1000)}s`,
                {
                    limit: rateLimit,
                    remaining: 0,
                    reset: resetTime,
                }
            )
        }

        // Increment current window counter
        const newCount = currentCount + 1
        await cacheSet(key, newCount, Math.ceil(windowMs / 1000 * 2)) // TTL = 2 windows

        // Add rate limit headers to response
        const remaining = Math.max(0, rateLimit - weightedCount - 1)
        const resetTime = Math.ceil((Math.floor(now / windowMs) + 1) * windowMs / 1000)

        request.headers['x-ratelimit-limit'] = rateLimit.toString()
        request.headers['x-ratelimit-remaining'] = remaining.toString()
        request.headers['x-ratelimit-reset'] = resetTime.toString()

    } catch (error) {
        // If Redis fails, allow the request (graceful degradation)
        if (error instanceof TooManyRequestsError) {
            throw error
        }

        request.log.warn({ error }, 'Rate limiting failed, allowing request')
    }
}

/**
 * Get tenant settings (with defaults)
 */
export async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
    const cacheKey = `tenant:settings:${tenantId}`
    let settings = await cacheGet<TenantSettings>(cacheKey)

    if (settings === null) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { settings: true },
        })

        settings = { ...DEFAULT_SETTINGS, ...(tenant?.settings as TenantSettings || {}) }
        await cacheSet(cacheKey, settings, 300)
    }

    return settings
}

/**
 * Update tenant settings
 */
export async function updateTenantSettings(tenantId: string, newSettings: Partial<TenantSettings>): Promise<TenantSettings> {
    const currentSettings = await getTenantSettings(tenantId)
    const updatedSettings = { ...currentSettings, ...newSettings }

    await prisma.tenant.update({
        where: { id: tenantId },
        data: { settings: updatedSettings as any },
    })

    // Invalidate cache
    const cacheKey = `tenant:settings:${tenantId}`
    await cacheSet(cacheKey, updatedSettings, 300)

    return updatedSettings
}
