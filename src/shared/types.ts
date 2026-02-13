import type { User, Tenant, Role, Permission } from '@prisma/client'

export interface JwtPayload {
    sub: string
    email: string
    tenantId: string
    roles: string[]
    permissions: string[]
}

export interface AuthenticatedUser {
    id: string
    email: string
    tenantId: string
    roles: string[]
    permissions: string[]
}

export type SafeUser = Omit<User, 'password'>

export type { User, Tenant, Role, Permission }
