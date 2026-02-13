import type { FastifyInstance } from 'fastify'
import * as rbacService from '../../core/rbac/rbac.service.js'
import {
    createRoleSchema,
    updateRoleSchema,
    assignPermissionsSchema,
    assignRoleSchema,
    paginationSchema,
} from '../../core/rbac/rbac.schema.js'
import { authGuard } from '../middleware/auth.guard.js'
import { requirePermission } from '../middleware/rbac.guard.js'
import { successResponse, paginatedResponse } from '../../shared/response.js'
import { ValidationError } from '../../shared/errors.js'
import { z } from 'zod'

export async function rbacRoutes(app: FastifyInstance) {
    // All RBAC routes require authentication
    app.addHook('preHandler', authGuard)

    // ─── LIST ROLES ────────────────────────────────────────────
    app.get('/roles', {
        schema: {
            description: 'List all roles for the current tenant',
            tags: ['RBAC'],
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'number', default: 1 },
                    limit: { type: 'number', default: 20 },
                },
            },
        },
        handler: async (request, reply) => {
            const pagination = paginationSchema.parse(request.query)
            const { roles, total } = await rbacService.listRoles(
                request.user.tenantId,
                pagination.page,
                pagination.limit,
            )
            return reply.send(paginatedResponse(roles, total, pagination.page, pagination.limit))
        },
    })

    // ─── CREATE ROLE ───────────────────────────────────────────
    app.post('/roles', {
        schema: {
            description: 'Create a new role',
            tags: ['RBAC'],
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', minLength: 2 },
                    description: { type: 'string' },
                },
            },
        },
        preHandler: requirePermission('role:create'),
        handler: async (request, reply) => {
            const result = createRoleSchema.safeParse(request.body)
            if (!result.success) {
                throw new ValidationError('Validation failed', z.prettifyError(result.error))
            }

            const role = await rbacService.createRole(request.user.tenantId, result.data)
            return reply.status(201).send(successResponse(role, 'Role created'))
        },
    })

    // ─── UPDATE ROLE ───────────────────────────────────────────
    app.patch('/roles/:id', {
        schema: {
            description: 'Update a role',
            tags: ['RBAC'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } },
            },
        },
        preHandler: requirePermission('role:update'),
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const result = updateRoleSchema.safeParse(request.body)
            if (!result.success) {
                throw new ValidationError('Validation failed', z.prettifyError(result.error))
            }

            const role = await rbacService.updateRole(id, request.user.tenantId, result.data)
            return reply.send(successResponse(role, 'Role updated'))
        },
    })

    // ─── DELETE ROLE ───────────────────────────────────────────
    app.delete('/roles/:id', {
        schema: {
            description: 'Delete a role',
            tags: ['RBAC'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } },
            },
        },
        preHandler: requirePermission('role:delete'),
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            await rbacService.deleteRole(id, request.user.tenantId)
            return reply.send(successResponse(null, 'Role deleted'))
        },
    })

    // ─── ASSIGN PERMISSIONS TO ROLE ────────────────────────────
    app.post('/roles/:id/permissions', {
        schema: {
            description: 'Assign permissions to a role (replaces existing)',
            tags: ['RBAC'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } },
            },
            body: {
                type: 'object',
                required: ['permissionIds'],
                properties: {
                    permissionIds: { type: 'array', items: { type: 'string' } },
                },
            },
        },
        preHandler: requirePermission('role:update'),
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const result = assignPermissionsSchema.safeParse(request.body)
            if (!result.success) {
                throw new ValidationError('Validation failed', z.prettifyError(result.error))
            }

            const role = await rbacService.assignPermissionsToRole(
                id,
                request.user.tenantId,
                result.data.permissionIds,
            )
            return reply.send(successResponse(role, 'Permissions assigned'))
        },
    })

    // ─── LIST PERMISSIONS ──────────────────────────────────────
    app.get('/permissions', {
        schema: {
            description: 'List all available permissions',
            tags: ['RBAC'],
            security: [{ bearerAuth: [] }],
        },
        handler: async (_request, reply) => {
            const permissions = await rbacService.listPermissions()
            return reply.send(successResponse(permissions))
        },
    })

    // ─── ASSIGN ROLE TO USER ──────────────────────────────────
    app.post('/users/:userId/roles', {
        schema: {
            description: 'Assign a role to a user',
            tags: ['RBAC'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['userId'],
                properties: { userId: { type: 'string' } },
            },
            body: {
                type: 'object',
                required: ['roleId'],
                properties: { roleId: { type: 'string' } },
            },
        },
        preHandler: requirePermission('user:update'),
        handler: async (request, reply) => {
            const { userId } = request.params as { userId: string }
            const result = assignRoleSchema.safeParse(request.body)
            if (!result.success) {
                throw new ValidationError('Validation failed', z.prettifyError(result.error))
            }

            const user = await rbacService.assignRoleToUser(
                userId,
                result.data.roleId,
                request.user.tenantId,
            )
            return reply.send(successResponse(user, 'Role assigned to user'))
        },
    })

    // ─── REMOVE ROLE FROM USER ─────────────────────────────────
    app.delete('/users/:userId/roles/:roleId', {
        schema: {
            description: 'Remove a role from a user',
            tags: ['RBAC'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['userId', 'roleId'],
                properties: {
                    userId: { type: 'string' },
                    roleId: { type: 'string' },
                },
            },
        },
        preHandler: requirePermission('user:update'),
        handler: async (request, reply) => {
            const { userId, roleId } = request.params as { userId: string; roleId: string }
            await rbacService.removeRoleFromUser(userId, roleId, request.user.tenantId)
            return reply.send(successResponse(null, 'Role removed from user'))
        },
    })
}
