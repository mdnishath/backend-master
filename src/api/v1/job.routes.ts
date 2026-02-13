import type { FastifyInstance } from 'fastify'
import { authGuard } from '../middleware/auth.guard.js'
import { getQueueStats, addCleanupJob } from '../../infra/queue/queues.js'
import { successResponse } from '../../shared/response.js'

export async function jobRoutes(app: FastifyInstance) {
    // ─── QUEUE STATS ──────────────────────────────────────────
    app.get('/jobs/stats', {
        schema: {
            description: 'Get background job queue statistics',
            tags: ['Jobs'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: authGuard,
        handler: async (_request, reply) => {
            try {
                const stats = await getQueueStats()
                return reply.send(successResponse(stats))
            } catch {
                return reply.send(successResponse({
                    email: { waiting: 0, active: 0, completed: 0, failed: 0 },
                    cleanup: { waiting: 0, active: 0, completed: 0, failed: 0 },
                    status: 'Redis unavailable — queue stats not available',
                }))
            }
        },
    })

    // ─── TRIGGER CLEANUP ──────────────────────────────────────
    app.post('/jobs/cleanup', {
        schema: {
            description: 'Trigger cleanup of expired tokens',
            tags: ['Jobs'],
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                properties: {
                    type: {
                        type: 'string',
                        enum: ['expired-tokens', 'expired-sessions', 'old-audit-logs'],
                        default: 'expired-tokens',
                    },
                },
            },
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const { type = 'expired-tokens' } = request.body as {
                type?: 'expired-tokens' | 'expired-sessions' | 'old-audit-logs'
            }
            try {
                const job = await addCleanupJob({ type })
                return reply.send(successResponse({ jobId: job.id, type }, 'Cleanup job queued'))
            } catch {
                return reply.status(503).send({
                    success: false,
                    error: 'Redis unavailable — cannot queue jobs',
                })
            }
        },
    })
}
