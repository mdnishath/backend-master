import type { FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError } from '../../shared/errors.js'

export function requirePermission(...requiredPermissions: string[]) {
    return async function (request: FastifyRequest, _reply: FastifyReply) {
        const userPermissions = request.user?.permissions ?? []

        const hasPermission = requiredPermissions.every((perm) =>
            userPermissions.includes(perm),
        )

        if (!hasPermission) {
            throw new ForbiddenError(
                `Missing required permission(s): ${requiredPermissions.join(', ')}`,
            )
        }
    }
}

export function requireRole(...requiredRoles: string[]) {
    return async function (request: FastifyRequest, _reply: FastifyReply) {
        const userRoles = request.user?.roles ?? []

        const hasRole = requiredRoles.some((role) => userRoles.includes(role))

        if (!hasRole) {
            throw new ForbiddenError(
                `Required role(s): ${requiredRoles.join(' or ')}`,
            )
        }
    }
}
