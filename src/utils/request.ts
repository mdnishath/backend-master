import type { FastifyRequest } from 'fastify'

/**
 * Extract client IP address from request.
 * Handles proxy headers (X-Forwarded-For, X-Real-IP) and direct connections.
 */
export function getClientIp(request: FastifyRequest): string | undefined {
    // Check proxy headers first
    const xForwardedFor = request.headers['x-forwarded-for']
    if (xForwardedFor) {
        const ips = typeof xForwardedFor === 'string'
            ? xForwardedFor.split(',')
            : xForwardedFor
        return ips[0]?.trim()
    }

    const xRealIp = request.headers['x-real-ip']
    if (xRealIp) {
        return typeof xRealIp === 'string' ? xRealIp : xRealIp[0]
    }

    // Fallback to direct connection IP
    return request.ip
}

/**
 * Extract User-Agent from request headers
 */
export function getUserAgent(request: FastifyRequest): string | undefined {
    const userAgent = request.headers['user-agent']
    return typeof userAgent === 'string' ? userAgent : userAgent?.[0]
}
