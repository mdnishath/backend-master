import type { FastifyInstance } from 'fastify'
import * as featureFlagService from '../../core/feature-flag/feature-flag.service.js'
import {
    createFeatureFlagSchema,
    updateFeatureFlagSchema,
    checkFeatureSchema,
} from '../../core/feature-flag/feature-flag.schema.js'
import { authGuard } from '../middleware/auth.guard.js'
import { requirePermission } from '../middleware/rbac.guard.js'
import { successResponse } from '../../shared/response.js'
import { ValidationError } from '../../shared/errors.js'
import { z } from 'zod'

export async function featureFlagRoutes(app: FastifyInstance) {
    // ─── CHECK FEATURE ─────────────────────────────────────────
    app.get('/features/check/:key', {
        schema: {
            description: 'Check if a feature is enabled for the current tenant',
            tags: ['Features'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    key: { type: 'string' },
                },
            },
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const { key } = request.params as { key: string }
            const isEnabled = await featureFlagService.isFeatureEnabled(key, request.user.tenantId)

            return reply.send(successResponse({ key, isEnabled }))
        },
    })

    // ─── LIST FEATURE FLAGS ────────────────────────────────────
    app.get('/features', {
        schema: {
            description: 'List all feature flags (global + tenant-specific)',
            tags: ['Features'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: [authGuard, requirePermission('features:read')],
        handler: async (request, reply) => {
            const flags = await featureFlagService.listFeatureFlags(request.user.tenantId)
            return reply.send(successResponse(flags))
        },
    })

    // ─── CREATE FEATURE FLAG ───────────────────────────────────
    app.post('/features', {
        schema: {
            description: 'Create a new feature flag (admin only)',
            tags: ['Features'],
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['key', 'name'],
                properties: {
                    key: { type: 'string', pattern: '^[a-z0-9-]+$' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    isEnabled: { type: 'boolean', default: false },
                    metadata: { type: 'object' },
                    tenantSpecific: { type: 'boolean', default: false },
                },
            },
        },
        preHandler: [authGuard, requirePermission('features:write')],
        handler: async (request, reply) => {
            const body = request.body as { tenantSpecific?: boolean }
            const result = createFeatureFlagSchema.safeParse(request.body)
            if (!result.success) {
                throw new ValidationError('Validation failed', z.prettifyError(result.error))
            }

            // If tenantSpecific is true, create for this tenant, else global (null)
            const tenantId = body.tenantSpecific ? request.user.tenantId : undefined

            const flag = await featureFlagService.createFeatureFlag(result.data, tenantId)

            return reply.status(201).send(successResponse(flag, 'Feature flag created'))
        },
    })

    // ─── GET FEATURE FLAG ──────────────────────────────────────
    app.get('/features/:id', {
        schema: {
            description: 'Get a single feature flag by ID',
            tags: ['Features'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('features:read')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const flag = await featureFlagService.getFeatureFlag(id)
            return reply.send(successResponse(flag))
        },
    })

    // ─── UPDATE FEATURE FLAG ───────────────────────────────────
    app.patch('/features/:id', {
        schema: {
            description: 'Update a feature flag',
            tags: ['Features'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    isEnabled: { type: 'boolean' },
                    metadata: { type: 'object' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('features:write')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const result = updateFeatureFlagSchema.safeParse(request.body)
            if (!result.success) {
                throw new ValidationError('Validation failed', z.prettifyError(result.error))
            }

            const flag = await featureFlagService.updateFeatureFlag(id, result.data)

            return reply.send(successResponse(flag, 'Feature flag updated'))
        },
    })

    // ─── TOGGLE FEATURE FLAG ───────────────────────────────────
    app.post('/features/:id/toggle', {
        schema: {
            description: 'Toggle a feature flag on/off',
            tags: ['Features'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('features:write')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const flag = await featureFlagService.toggleFeatureFlag(id)

            return reply.send(successResponse(flag, 'Feature flag toggled'))
        },
    })

    // ─── DELETE FEATURE FLAG ───────────────────────────────────
    app.delete('/features/:id', {
        schema: {
            description: 'Delete a feature flag',
            tags: ['Features'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('features:delete')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            await featureFlagService.deleteFeatureFlag(id)

            return reply.send(successResponse(null, 'Feature flag deleted'))
        },
    })
}
