import type { FastifyInstance } from 'fastify'
import { authGuard } from '../middleware/auth.guard.js'
import { requirePermission } from '../middleware/rbac.guard.js'
import { getAuditLogs } from '../../core/audit/audit.service.js'
import { successResponse } from '../../shared/response.js'

export async function auditRoutes(app: FastifyInstance) {
    // ─── GET AUDIT LOGS ───────────────────────────────────────
    app.get('/audit-logs', {
        schema: {
            description: 'Query audit logs (admin only)',
            tags: ['Audit'],
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    userId: { type: 'string' },
                    resource: { type: 'string' },
                    action: { type: 'string' },
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 50 },
                },
            },
        },
        preHandler: [authGuard],
        handler: async (request, reply) => {
            const { userId, resource, action, page, limit } = request.query as {
                userId?: string
                resource?: string
                action?: string
                page?: number
                limit?: number
            }

            const result = await getAuditLogs({
                tenantId: request.user.tenantId,
                userId,
                resource,
                action,
                page,
                limit,
            })

            return reply.send(successResponse(result))
        },
    })
}
