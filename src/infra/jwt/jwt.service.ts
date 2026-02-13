import { SignJWT, jwtVerify } from 'jose'
import crypto from 'node:crypto'
import { env } from '../../config/env.js'
import type { JwtPayload } from '../../shared/types.js'
import { UnauthorizedError } from '../../shared/errors.js'

const secret = new TextEncoder().encode(env.JWT_SECRET)

function parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/)
    if (!match) throw new Error(`Invalid expiry format: ${expiry}`)

    const value = parseInt(match[1])
    const unit = match[2]

    const multipliers: Record<string, number> = {
        s: 1,
        m: 60,
        h: 3600,
        d: 86400,
    }

    return value * multipliers[unit]
}

export async function createAccessToken(payload: JwtPayload): Promise<string> {
    const expirySeconds = parseExpiry(env.JWT_ACCESS_EXPIRY)

    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${expirySeconds}s`)
        .setSubject(payload.sub)
        .setJti(crypto.randomUUID())
        .sign(secret)
}

export async function createRefreshToken(payload: Pick<JwtPayload, 'sub'>): Promise<string> {
    const expirySeconds = parseExpiry(env.JWT_REFRESH_EXPIRY)

    return new SignJWT({ sub: payload.sub })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${expirySeconds}s`)
        .setJti(crypto.randomUUID())
        .sign(secret)
}

export async function verifyToken(token: string): Promise<JwtPayload> {
    try {
        const { payload } = await jwtVerify(token, secret)
        return payload as unknown as JwtPayload
    } catch {
        throw new UnauthorizedError('Invalid or expired token')
    }
}

export function getRefreshTokenExpiry(): Date {
    const seconds = parseExpiry(env.JWT_REFRESH_EXPIRY)
    return new Date(Date.now() + seconds * 1000)
}
