import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../infra/database/prisma.js'
import { cacheGet, cacheSet } from '../../infra/cache/redis.js'
import { TooManyRequestsError } from '../../shared/errors.js'

interface RateLimitInfo {
    limit: number
    remaining: number
    reset: number
}

/**
 * Dynamic per-tenant rate limiting based on TenantPlan
 * Uses Redis sliding window algorithm for accurate counting
 */
export async function rateLimitGuard(request: FastifyRequest, _reply: FastifyReply) {
    // Skip rate limiting for non-authenticated requests (handled by global Fastify rate limit)
    if (!request.user?.tenantId) {
        return
    }

    const tenantId = request.user.tenantId
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute window

    // Get tenant's rate limit from plan (cached for 5 minutes)
    const cacheKey = `plan:${tenantId}`
    let rateLimit = await cacheGet<number>(cacheKey)

    if (rateLimit === null) {
        const plan = await prisma.tenantPlan.findUnique({
            where: { tenantId },
            select: { rateLimit: true, isActive: true },
        })

        rateLimit = plan?.isActive ? plan.rateLimit : 100 // Default to 100 if no plan
        await cacheSet(cacheKey, rateLimit, 300) // Cache for 5 minutes
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
 * Create a default plan for a tenant if it doesn't exist
 */
export async function createDefaultPlan(tenantId: string, planType: 'starter' | 'pro' | 'enterprise' = 'starter') {
    const planLimits = {
        starter: {
            rateLimit: 100,
            maxUsers: 10,
            maxStorage: BigInt(1073741824), // 1GB
            maxWebhooks: 5,
            featuresEnabled: ['basic-analytics', 'email-notifications'],
        },
        pro: {
            rateLimit: 500,
            maxUsers: 50,
            maxStorage: BigInt(10737418240), // 10GB
            maxWebhooks: 25,
            featuresEnabled: ['basic-analytics', 'email-notifications', 'advanced-analytics', 'webhooks'],
        },
        enterprise: {
            rateLimit: 2000,
            maxUsers: -1, // Unlimited
            maxStorage: BigInt(107374182400), // 100GB
            maxWebhooks: 100,
            featuresEnabled: ['*'], // All features
        },
    }

    const limits = planLimits[planType]

    return prisma.tenantPlan.upsert({
        where: { tenantId },
        update: limits,
        create: {
            tenantId,
            planType,
            ...limits,
            isActive: true,
        },
    })
}
