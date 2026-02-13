import type { FastifyInstance } from 'fastify'
import * as webhookService from '../../core/webhook/webhook.service.js'
import {
    createWebhookSchema,
    updateWebhookSchema,
    webhookQuerySchema,
} from '../../core/webhook/webhook.schema.js'
import { authGuard } from '../middleware/auth.guard.js'
import { requirePermission } from '../middleware/rbac.guard.js'
import { successResponse, paginatedResponse } from '../../shared/response.js'
import { ValidationError } from '../../shared/errors.js'
import { z } from 'zod'

export async function webhookRoutes(app: FastifyInstance) {
    // ─── LIST WEBHOOKS ─────────────────────────────────────────
    app.get('/webhooks', {
        schema: {
            description: 'List all webhook subscriptions for the tenant',
            tags: ['Webhooks'],
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'number', minimum: 1, default: 1 },
                    limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
                },
            },
        },
        preHandler: [authGuard, requirePermission('webhooks:read')],
        handler: async (request, reply) => {
            const result = webhookQuerySchema.safeParse(request.query)
            if (!result.success) {
                throw new ValidationError('Invalid query parameters', z.prettifyError(result.error))
            }

            const { page, limit } = result.data
            const { webhooks, total } = await webhookService.listWebhooks(
                request.user.tenantId,
                page,
                limit,
            )

            return reply.send(paginatedResponse(webhooks, total, page, limit))
        },
    })

    // ─── CREATE WEBHOOK ────────────────────────────────────────
    app.post('/webhooks', {
        schema: {
            description: 'Create a new webhook subscription',
            tags: ['Webhooks'],
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['url', 'events'],
                properties: {
                    url: { type: 'string', format: 'uri' },
                    events: { type: 'array', items: { type: 'string' }, minItems: 1 },
                    description: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('webhooks:write')],
        handler: async (request, reply) => {
            const result = createWebhookSchema.safeParse(request.body)
            if (!result.success) {
                throw new ValidationError('Validation failed', z.prettifyError(result.error))
            }

            const webhook = await webhookService.createWebhook(
                request.user.tenantId,
                request.user.id,
                result.data,
            )

            return reply.status(201).send(successResponse(webhook, 'Webhook created successfully'))
        },
    })

    // ─── GET WEBHOOK ───────────────────────────────────────────
    app.get('/webhooks/:id', {
        schema: {
            description: 'Get a single webhook by ID',
            tags: ['Webhooks'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('webhooks:read')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const webhook = await webhookService.getWebhook(id, request.user.tenantId)
            return reply.send(successResponse(webhook))
        },
    })

    // ─── UPDATE WEBHOOK ────────────────────────────────────────
    app.patch('/webhooks/:id', {
        schema: {
            description: 'Update a webhook subscription',
            tags: ['Webhooks'],
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
                    url: { type: 'string', format: 'uri' },
                    events: { type: 'array', items: { type: 'string' } },
                    description: { type: 'string' },
                    isActive: { type: 'boolean' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('webhooks:write')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const result = updateWebhookSchema.safeParse(request.body)
            if (!result.success) {
                throw new ValidationError('Validation failed', z.prettifyError(result.error))
            }

            const webhook = await webhookService.updateWebhook(
                id,
                request.user.tenantId,
                result.data,
            )

            return reply.send(successResponse(webhook, 'Webhook updated successfully'))
        },
    })

    // ─── DELETE WEBHOOK ────────────────────────────────────────
    app.delete('/webhooks/:id', {
        schema: {
            description: 'Delete a webhook subscription',
            tags: ['Webhooks'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('webhooks:delete')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            await webhookService.deleteWebhook(id, request.user.tenantId)
            return reply.send(successResponse(null, 'Webhook deleted successfully'))
        },
    })

    // ─── GET WEBHOOK DELIVERIES ────────────────────────────────
    app.get('/webhooks/:id/deliveries', {
        schema: {
            description: 'Get delivery logs for a webhook',
            tags: ['Webhooks'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'number', minimum: 1, default: 1 },
                    limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
                },
            },
        },
        preHandler: [authGuard, requirePermission('webhooks:read')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const result = webhookQuerySchema.safeParse(request.query)
            if (!result.success) {
                throw new ValidationError('Invalid query parameters', z.prettifyError(result.error))
            }

            const { page, limit } = result.data
            const { deliveries, total } = await webhookService.getWebhookDeliveries(
                id,
                request.user.tenantId,
                page,
                limit,
            )

            return reply.send(paginatedResponse(deliveries, total, page, limit))
        },
    })
}
