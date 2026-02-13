import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../infra/database/prisma.js'
import { ForbiddenError } from '../../shared/errors.js'

/**
 * Tenant isolation middleware — ensures all database operations
 * are scoped to the authenticated user's tenant.
 * 
 * This guard validates that resource IDs belong to the user's tenant
 * before allowing access.
 */
export async function tenantGuard(request: FastifyRequest, _reply: FastifyReply) {
    const tenantId = request.user?.tenantId

    if (!tenantId) {
        throw new ForbiddenError('Tenant context is required')
    }

    // Attach tenant context for downstream use
    request.tenantId = tenantId
}

// Extend Fastify request with tenantId
declare module 'fastify' {
    interface FastifyRequest {
        tenantId: string
    }
}

/**
 * Validates that a given resource belongs to the user's tenant.
 * Use this for operations on specific resources (e.g., updating a role).
 */
export function tenantResourceValidator(resourceType: 'role' | 'user') {
    return async function (request: FastifyRequest, _reply: FastifyReply) {
        const tenantId = request.user?.tenantId
        const resourceId = (request.params as Record<string, string>)['id'] ??
            (request.params as Record<string, string>)['userId'] ??
            (request.params as Record<string, string>)['roleId']

        if (!resourceId || !tenantId) return

        let belongs = false

        if (resourceType === 'role') {
            const role = await prisma.role.findUnique({
                where: { id: resourceId },
                select: { tenantId: true },
            })
            belongs = role?.tenantId === tenantId
        } else if (resourceType === 'user') {
            const user = await prisma.user.findUnique({
                where: { id: resourceId },
                select: { tenantId: true },
            })
            belongs = user?.tenantId === tenantId
        }

        if (!belongs) {
            throw new ForbiddenError('Resource does not belong to your tenant')
        }
    }
}
