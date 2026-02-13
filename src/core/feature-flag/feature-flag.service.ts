import { prisma } from '../../infra/database/prisma.js'
import { ConflictError, NotFoundError } from '../../shared/errors.js'
import { cacheGet, cacheSet, cacheDel } from '../../infra/cache/redis.js'

// ─── FEATURE FLAG MANAGEMENT ───────────────────────────────

export interface CreateFeatureFlagInput {
    key: string
    name: string
    description?: string
    isEnabled: boolean
    metadata?: Record<string, unknown>
}

export interface UpdateFeatureFlagInput {
    name?: string
    description?: string
    isEnabled?: boolean
    metadata?: Record<string, unknown>
}

/**
 * Check if a feature is enabled for a tenant (or globally)
 * Uses Redis cache for performance
 */
export async function isFeatureEnabled(key: string, tenantId?: string): Promise<boolean> {
    const cacheKey = `feature:${key}:${tenantId ?? 'global'}`

    // Try cache first
    const cached = await cacheGet<boolean>(cacheKey)
    if (cached !== null) {
        return cached
    }

    // Check tenant-specific flag first, then fall back to global
    const flag = await prisma.featureFlag.findFirst({
        where: {
            key,
            OR: [{ tenantId }, { tenantId: null }],
        },
        orderBy: [
            { tenantId: tenantId ? 'desc' : 'asc' }, // Prioritize tenant-specific
        ],
    })

    const enabled = flag?.isEnabled ?? false

    // Cache for 5 minutes
    await cacheSet(cacheKey, enabled, 300)

    return enabled
}

/**
 * List all feature flags (global or for a specific tenant)
 */
export async function listFeatureFlags(tenantId?: string) {
    const flags = await prisma.featureFlag.findMany({
        where: tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : undefined,
        orderBy: [{ tenantId: 'asc' }, { key: 'asc' }],
    })

    return flags
}

/**
 * Get a single feature flag
 */
export async function getFeatureFlag(flagId: string) {
    const flag = await prisma.featureFlag.findUnique({
        where: { id: flagId },
    })

    if (!flag) {
        throw new NotFoundError('Feature flag not found')
    }

    return flag
}

/**
 * Create a new feature flag
 */
export async function createFeatureFlag(
    input: CreateFeatureFlagInput,
    tenantId?: string,
) {
    const effectiveTenantId = tenantId !== undefined ? tenantId : null

    // Check for duplicates
    const existing = await prisma.featureFlag.findUnique({
        where: {
            key_tenantId: {
                key: input.key,
                tenantId: effectiveTenantId as string,
            },
        },
    })

    if (existing) {
        throw new ConflictError(`Feature flag "${input.key}" already exists for this scope`)
    }

    const flag = await prisma.featureFlag.create({
        data: {
            key: input.key,
            name: input.name,
            description: input.description,
            isEnabled: input.isEnabled,
            metadata: (input.metadata ?? {}) as never,
            tenantId: effectiveTenantId,
        },
    })

    // Invalidate cache
    await cacheDel(`feature:${input.key}:${tenantId ?? 'global'}`)

    return flag
}

/**
 * Update a feature flag
 */
export async function updateFeatureFlag(
    flagId: string,
    input: UpdateFeatureFlagInput,
) {
    const flag = await getFeatureFlag(flagId)

    const updated = await prisma.featureFlag.update({
        where: { id: flagId },
        data: {
            name: input.name,
            description: input.description,
            isEnabled: input.isEnabled,
            metadata: input.metadata !== undefined ? (input.metadata as never) : undefined,
        },
    })

    // Invalidate cache
    await cacheDel(`feature:${flag.key}:${flag.tenantId ?? 'global'}`)

    return updated
}

/**
 * Delete a feature flag
 */
export async function deleteFeatureFlag(flagId: string) {
    const flag = await getFeatureFlag(flagId)

    await prisma.featureFlag.delete({
        where: { id: flagId },
    })

    // Invalidate cache
    await cacheDel(`feature:${flag.key}:${flag.tenantId ?? 'global'}`)
}

/**
 * Toggle a feature flag on/off
 */
export async function toggleFeatureFlag(flagId: string) {
    const flag = await getFeatureFlag(flagId)

    const updated = await prisma.featureFlag.update({
        where: { id: flagId },
        data: { isEnabled: !flag.isEnabled },
    })

    // Invalidate cache
    await cacheDel(`feature:${flag.key}:${flag.tenantId ?? 'global'}`)

    return updated
}
