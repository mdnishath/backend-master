import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from '../../infra/jwt/jwt.service.js'
import { isTokenBlacklisted } from '../../infra/cache/redis.js'
import { UnauthorizedError } from '../../shared/errors.js'
import type { AuthenticatedUser } from '../../shared/types.js'

declare module 'fastify' {
    interface FastifyRequest {
        user: AuthenticatedUser
    }
}

export async function authGuard(request: FastifyRequest, _reply: FastifyReply) {
    const authHeader = request.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or invalid authorization header')
    }

    const token = authHeader.slice(7)

    // Check if token is blacklisted (after logout or password change)
    const blacklisted = await isTokenBlacklisted(token)
    if (blacklisted) {
        throw new UnauthorizedError('Token has been revoked')
    }

    const payload = await verifyToken(token)

    request.user = {
        id: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        roles: payload.roles,
        permissions: payload.permissions,
    }
}
