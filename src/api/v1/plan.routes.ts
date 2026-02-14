import type { FastifyInstance } from 'fastify'
import { prisma } from '../../infra/database/prisma.js'
import { createDefaultPlan } from '../middleware/rate-limit.guard.js'
import { authGuard } from '../middleware/auth.guard.js'
import { requirePermission } from '../middleware/rbac.guard.js'
import { successResponse } from '../../shared/response.js'
import { NotFoundError } from '../../shared/errors.js'

export async function planRoutes(app: FastifyInstance) {
    // ─── GET CURRENT TENANT'S PLAN ────────────────────────────
    app.get('/plan', {
        schema: {
            description: 'Get current tenant plan details',
            tags: ['Plans'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const plan = await prisma.tenantPlan.findUnique({
                where: { tenantId: request.user.tenantId },
            })

            if (!plan) {
                // Create default starter plan if none exists
                const newPlan = await createDefaultPlan(request.user.tenantId, 'starter')
                return reply.send(successResponse(newPlan))
            }

            return reply.send(successResponse(plan))
        },
    })

    // ─── GET PLAN USAGE STATISTICS ─────────────────────────────
    app.get('/plan/usage', {
        schema: {
            description: 'Get current usage vs plan limits',
            tags: ['Plans'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const tenantId = request.user.tenantId

            const [plan, userCount, webhookCount, storageUsed] = await Promise.all([
                prisma.tenantPlan.findUnique({ where: { tenantId } }),
                prisma.user.count({ where: { tenantId } }),
                prisma.webhookSubscription.count({ where: { tenantId, isActive: true } }),
                prisma.fileUpload.aggregate({
                    where: { tenantId },
                    _sum: { size: true },
                }),
            ])

            if (!plan) {
                throw new NotFoundError('No plan found for this tenant')
            }

            const storage = storageUsed._sum.size ?? BigInt(0)

            return reply.send(successResponse({
                plan: {
                    type: plan.planType,
                    isActive: plan.isActive,
                    validUntil: plan.validUntil,
                },
                usage: {
                    users: {
                        current: userCount,
                        limit: plan.maxUsers,
                        percentage: plan.maxUsers === -1 ? 0 : Math.round((userCount / plan.maxUsers) * 100),
                    },
                    webhooks: {
                        current: webhookCount,
                        limit: plan.maxWebhooks,
                        percentage: Math.round((webhookCount / plan.maxWebhooks) * 100),
                    },
                    storage: {
                        current: Number(storage),
                        limit: Number(plan.maxStorage),
                        percentage: Math.round((Number(storage) / Number(plan.maxStorage)) * 100),
                    },
                    rateLimit: {
                        limit: plan.rateLimit,
                        window: '1 minute',
                    },
                },
                features: plan.featuresEnabled,
            }))
        },
    })

    // ─── UPDATE PLAN (ADMIN ONLY) ──────────────────────────────
    app.patch('/plan/:tenantId', {
        schema: {
            description: 'Update a tenant plan (admin only)',
            tags: ['Plans'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    tenantId: { type: 'string' },
                },
            },
            body: {
                type: 'object',
                properties: {
                    planType: { type: 'string', enum: ['starter', 'pro', 'enterprise'] },
                    rateLimit: { type: 'number' },
                    maxUsers: { type: 'number' },
                    maxStorage: { type: 'number' },
                    maxWebhooks: { type: 'number' },
                    featuresEnabled: { type: 'array', items: { type: 'string' } },
                    validUntil: { type: 'string', format: 'date-time' },
                    isActive: { type: 'boolean' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('plans:write')],
        handler: async (request, reply) => {
            const { tenantId } = request.params as { tenantId: string }
            const body = request.body as {
                planType?: string
                rateLimit?: number
                maxUsers?: number
                maxStorage?: number
                maxWebhooks?: number
                featuresEnabled?: string[]
                validUntil?: string
                isActive?: boolean
            }

            const plan = await prisma.tenantPlan.update({
                where: { tenantId },
                data: {
                    planType: body.planType,
                    rateLimit: body.rateLimit,
                    maxUsers: body.maxUsers,
                    maxStorage: body.maxStorage !== undefined ? BigInt(body.maxStorage) : undefined,
                    maxWebhooks: body.maxWebhooks,
                    featuresEnabled: body.featuresEnabled,
                    validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
                    isActive: body.isActive,
                },
            })

            return reply.send(successResponse(plan, 'Plan updated successfully'))
        },
    })
}
