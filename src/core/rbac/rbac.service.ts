import { prisma } from '../../infra/database/prisma.js'
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js'
import type { CreateRoleInput, UpdateRoleInput } from './rbac.schema.js'

// ─── ROLES ─────────────────────────────────────────────────

export async function listRoles(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit

    const [roles, total] = await Promise.all([
        prisma.role.findMany({
            where: { tenantId },
            include: {
                permissions: {
                    include: { permission: true },
                },
                _count: { select: { users: true } },
            },
            skip,
            take: limit,
            orderBy: { createdAt: 'asc' },
        }),
        prisma.role.count({ where: { tenantId } }),
    ])

    const mapped = roles.map((role) => ({
        ...role,
        permissions: role.permissions.map((rp) => rp.permission),
        userCount: role._count.users,
        _count: undefined,
    }))

    return { roles: mapped, total }
}

export async function createRole(tenantId: string, input: CreateRoleInput) {
    const existing = await prisma.role.findUnique({
        where: { name_tenantId: { name: input.name, tenantId } },
    })

    if (existing) {
        throw new ConflictError(`Role "${input.name}" already exists`)
    }

    return prisma.role.create({
        data: {
            name: input.name,
            description: input.description,
            tenantId,
        },
        include: {
            permissions: {
                include: { permission: true },
            },
        },
    })
}

export async function updateRole(roleId: string, tenantId: string, input: UpdateRoleInput) {
    const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId },
    })

    if (!role) {
        throw new NotFoundError('Role not found')
    }

    if (role.isSystem) {
        throw new ForbiddenError('Cannot modify system roles')
    }

    if (input.name) {
        const existing = await prisma.role.findUnique({
            where: { name_tenantId: { name: input.name, tenantId } },
        })
        if (existing && existing.id !== roleId) {
            throw new ConflictError(`Role "${input.name}" already exists`)
        }
    }

    return prisma.role.update({
        where: { id: roleId },
        data: input,
        include: {
            permissions: {
                include: { permission: true },
            },
        },
    })
}

export async function deleteRole(roleId: string, tenantId: string) {
    const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId },
    })

    if (!role) {
        throw new NotFoundError('Role not found')
    }

    if (role.isSystem) {
        throw new ForbiddenError('Cannot delete system roles')
    }

    await prisma.role.delete({ where: { id: roleId } })
}

// ─── PERMISSIONS ───────────────────────────────────────────

export async function listPermissions() {
    return prisma.permission.findMany({
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    })
}

export async function assignPermissionsToRole(
    roleId: string,
    tenantId: string,
    permissionIds: string[],
) {
    const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId },
    })

    if (!role) {
        throw new NotFoundError('Role not found')
    }

    // Clear existing permissions and assign new ones
    await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId } }),
        prisma.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
                roleId,
                permissionId,
            })),
            skipDuplicates: true,
        }),
    ])

    return prisma.role.findUnique({
        where: { id: roleId },
        include: {
            permissions: {
                include: { permission: true },
            },
        },
    })
}

// ─── USER ROLES ────────────────────────────────────────────

export async function assignRoleToUser(userId: string, roleId: string, tenantId: string) {
    // Verify user belongs to same tenant
    const user = await prisma.user.findFirst({
        where: { id: userId, tenantId },
    })

    if (!user) {
        throw new NotFoundError('User not found in this tenant')
    }

    // Verify role belongs to same tenant
    const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId },
    })

    if (!role) {
        throw new NotFoundError('Role not found in this tenant')
    }

    // Check if already assigned
    const existing = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId, roleId } },
    })

    if (existing) {
        throw new ConflictError('Role already assigned to user')
    }

    await prisma.userRole.create({
        data: { userId, roleId },
    })

    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            roles: {
                include: {
                    role: {
                        select: { id: true, name: true, description: true },
                    },
                },
            },
        },
    })
}

export async function removeRoleFromUser(userId: string, roleId: string, tenantId: string) {
    const user = await prisma.user.findFirst({
        where: { id: userId, tenantId },
    })

    if (!user) {
        throw new NotFoundError('User not found in this tenant')
    }

    const existing = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId, roleId } },
    })

    if (!existing) {
        throw new NotFoundError('Role not assigned to user')
    }

    await prisma.userRole.delete({
        where: { userId_roleId: { userId, roleId } },
    })
}
