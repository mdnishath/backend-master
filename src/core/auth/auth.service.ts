import { prisma } from '../../infra/database/prisma.js'
import { hashPassword, verifyPassword } from '../../utils/hash.js'
import {
    createAccessToken,
    createRefreshToken,
    getRefreshTokenExpiry,
    verifyToken,
} from '../../infra/jwt/jwt.service.js'
import { ConflictError, UnauthorizedError, NotFoundError } from '../../shared/errors.js'
import type { RegisterInput, LoginInput } from './auth.schema.js'
import type { JwtPayload } from '../../shared/types.js'
import { nanoid } from 'nanoid'

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
}

export async function register(input: RegisterInput) {
    const { email, password, firstName, lastName, tenantName } = input

    // Create tenant + user in a transaction
    const result = await prisma.$transaction(async (tx) => {
        // Create tenant
        const slug = `${slugify(tenantName)}-${nanoid(6)}`
        const tenant = await tx.tenant.create({
            data: {
                name: tenantName,
                slug,
            },
        })

        // Check if user already exists in this tenant
        const existingUser = await tx.user.findUnique({
            where: { email_tenantId: { email, tenantId: tenant.id } },
        })

        if (existingUser) {
            throw new ConflictError('User with this email already exists')
        }

        // Hash password
        const hashedPassword = await hashPassword(password)

        // Create user
        const user = await tx.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                tenantId: tenant.id,
            },
        })

        // Create default roles for tenant
        const adminRole = await tx.role.create({
            data: {
                name: 'admin',
                description: 'Full access administrator',
                isSystem: true,
                tenantId: tenant.id,
            },
        })

        await tx.role.create({
            data: {
                name: 'member',
                description: 'Regular member',
                isSystem: true,
                tenantId: tenant.id,
            },
        })

        // Assign admin role to the first user
        await tx.userRole.create({
            data: {
                userId: user.id,
                roleId: adminRole.id,
            },
        })

        // Assign all permissions to admin role
        const allPermissions = await tx.permission.findMany()
        if (allPermissions.length > 0) {
            await tx.rolePermission.createMany({
                data: allPermissions.map((p) => ({
                    roleId: adminRole.id,
                    permissionId: p.id,
                })),
            })
        }

        return { user, tenant }
    })

    // Generate tokens
    const userWithRoles = await prisma.user.findUnique({
        where: { id: result.user.id },
        include: {
            roles: {
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: { permission: true },
                            },
                        },
                    },
                },
            },
        },
    })

    const roles = userWithRoles?.roles.map((ur) => ur.role.name) ?? []
    const permissions = userWithRoles?.roles.flatMap((ur) =>
        ur.role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`),
    ) ?? []

    const jwtPayload: JwtPayload = {
        sub: result.user.id,
        email: result.user.email,
        tenantId: result.tenant.id,
        roles,
        permissions,
    }

    const accessToken = await createAccessToken(jwtPayload)
    const refreshToken = await createRefreshToken({ sub: result.user.id })

    // Store refresh token
    await prisma.refreshToken.create({
        data: {
            token: refreshToken,
            userId: result.user.id,
            expiresAt: getRefreshTokenExpiry(),
        },
    })

    const { password: _, ...safeUser } = result.user

    return {
        user: safeUser,
        tenant: result.tenant,
        accessToken,
        refreshToken,
    }
}

export async function login(input: LoginInput, tenantId?: string) {
    const { email, password } = input

    // Find user — if no tenantId, find the first matching user
    const whereClause = tenantId
        ? { email_tenantId: { email, tenantId } }
        : undefined

    let user
    if (whereClause) {
        user = await prisma.user.findUnique({ where: whereClause })
    } else {
        user = await prisma.user.findFirst({ where: { email } })
    }

    if (!user) {
        throw new UnauthorizedError('Invalid credentials')
    }

    if (!user.isActive) {
        throw new UnauthorizedError('Account is deactivated')
    }

    // Verify password
    const isValid = await verifyPassword(user.password, password)
    if (!isValid) {
        throw new UnauthorizedError('Invalid credentials')
    }

    // Get roles and permissions
    const userWithRoles = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
            roles: {
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: { permission: true },
                            },
                        },
                    },
                },
            },
        },
    })

    const roles = userWithRoles?.roles.map((ur) => ur.role.name) ?? []
    const permissions = userWithRoles?.roles.flatMap((ur) =>
        ur.role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`),
    ) ?? []

    const jwtPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roles,
        permissions,
    }

    const accessToken = await createAccessToken(jwtPayload)
    const refreshToken = await createRefreshToken({ sub: user.id })

    // Store refresh token
    await prisma.refreshToken.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt: getRefreshTokenExpiry(),
        },
    })

    const { password: _, ...safeUser } = user

    return {
        user: safeUser,
        accessToken,
        refreshToken,
    }
}

export async function refreshAccessToken(token: string) {
    // Find the refresh token in DB
    const storedToken = await prisma.refreshToken.findUnique({
        where: { token },
        include: { user: true },
    })

    if (!storedToken) {
        throw new UnauthorizedError('Invalid refresh token')
    }

    if (storedToken.expiresAt < new Date()) {
        // Clean up expired token
        await prisma.refreshToken.delete({ where: { id: storedToken.id } })
        throw new UnauthorizedError('Refresh token expired')
    }

    // Get user roles and permissions
    const userWithRoles = await prisma.user.findUnique({
        where: { id: storedToken.userId },
        include: {
            roles: {
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: { permission: true },
                            },
                        },
                    },
                },
            },
        },
    })

    if (!userWithRoles || !userWithRoles.isActive) {
        throw new UnauthorizedError('User not found or deactivated')
    }

    const roles = userWithRoles.roles.map((ur) => ur.role.name)
    const permissions = userWithRoles.roles.flatMap((ur) =>
        ur.role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`),
    )

    const jwtPayload: JwtPayload = {
        sub: userWithRoles.id,
        email: userWithRoles.email,
        tenantId: userWithRoles.tenantId,
        roles,
        permissions,
    }

    // Rotate: delete old refresh token, create new one
    await prisma.refreshToken.delete({ where: { id: storedToken.id } })

    const newAccessToken = await createAccessToken(jwtPayload)
    const newRefreshToken = await createRefreshToken({ sub: userWithRoles.id })

    await prisma.refreshToken.create({
        data: {
            token: newRefreshToken,
            userId: userWithRoles.id,
            expiresAt: getRefreshTokenExpiry(),
        },
    })

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
    }
}

export async function logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
    })
}

export async function getProfile(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            tenant: {
                select: { id: true, name: true, slug: true },
            },
            roles: {
                include: {
                    role: {
                        select: { id: true, name: true, description: true },
                    },
                },
            },
        },
    })

    if (!user) {
        throw new NotFoundError('User not found')
    }

    const { password: _, ...safeUser } = user

    return {
        ...safeUser,
        roles: user.roles.map((ur) => ur.role),
    }
}
