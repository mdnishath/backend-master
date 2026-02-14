import type { FastifyInstance } from 'fastify'
import { prisma } from '../../infra/database/prisma.js'
import { getQueueStats } from '../../infra/queue/queues.js'
import { redis, redisAvailable } from '../../infra/cache/redis.js'
import { authGuard } from '../middleware/auth.guard.js'
import { requirePermission } from '../middleware/rbac.guard.js'
import { successResponse, paginatedResponse } from '../../shared/response.js'

export async function adminRoutes(app: FastifyInstance) {
    // ─── SYSTEM METRICS ────────────────────────────────────────
    app.get('/admin/metrics', {
        schema: {
            description: 'Get system-wide statistics and metrics (admin only)',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: [authGuard, requirePermission('admin:read')],
        handler: async (_request, reply) => {
            // Get counts from database
            const [
                totalTenants,
                activeTenants,
                totalUsers,
                activeUsers,
                totalRoles,
                totalPermissions,
                totalWebhooks,
                totalFeatureFlags,
                totalFiles,
                totalAuditLogs,
            ] = await Promise.all([
                prisma.tenant.count(),
                prisma.tenant.count({ where: { isActive: true } }),
                prisma.user.count(),
                prisma.user.count({ where: { isActive: true } }),
                prisma.role.count(),
                prisma.permission.count(),
                prisma.webhookSubscription.count(),
                prisma.featureFlag.count(),
                prisma.fileUpload.count(),
                prisma.auditLog.count(),
            ])

            // Get storage statistics
            const storageStats = await prisma.fileUpload.aggregate({
                _sum: { size: true },
                _avg: { size: true },
                _max: { size: true },
            })

            // Get recent registrations (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            const recentUsers = await prisma.user.count({
                where: { createdAt: { gte: thirtyDaysAgo } },
            })
            const recentTenants = await prisma.tenant.count({
                where: { createdAt: { gte: thirtyDaysAgo } },
            })

            // Get queue statistics
            let queueStats = null
            try {
                queueStats = await getQueueStats()
            } catch {
                queueStats = { error: 'Queue stats unavailable' }
            }

            // Get Redis status
            let redisStatus = 'disconnected'
            let redisInfo = null
            if (redisAvailable) {
                try {
                    const info = await redis.info('stats')
                    redisStatus = 'connected'
                    const lines = info.split('\r\n')
                    redisInfo = {
                        totalConnectionsReceived: lines.find(l => l.startsWith('total_connections_received')),
                        totalCommandsProcessed: lines.find(l => l.startsWith('total_commands_processed')),
                        instantaneousOpsPerSec: lines.find(l => l.startsWith('instantaneous_ops_per_sec')),
                    }
                } catch {
                    redisStatus = 'error'
                }
            }

            return reply.send(successResponse({
                system: {
                    uptime: process.uptime(),
                    nodeVersion: process.version,
                    platform: process.platform,
                    memory: {
                        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
                    },
                },
                database: {
                    tenants: {
                        total: totalTenants,
                        active: activeTenants,
                        recent30Days: recentTenants,
                    },
                    users: {
                        total: totalUsers,
                        active: activeUsers,
                        recent30Days: recentUsers,
                    },
                    rbac: {
                        roles: totalRoles,
                        permissions: totalPermissions,
                    },
                    features: {
                        webhooks: totalWebhooks,
                        featureFlags: totalFeatureFlags,
                    },
                    files: {
                        count: totalFiles,
                        totalSize: Number(storageStats._sum.size ?? 0),
                        averageSize: Math.round(Number(storageStats._avg.size ?? 0)),
                        largestFile: Number(storageStats._max.size ?? 0),
                    },
                    auditLogs: totalAuditLogs,
                },
                redis: {
                    status: redisStatus,
                    info: redisInfo,
                },
                queues: queueStats,
            }))
        },
    })

    // ─── LIST ALL TENANTS ──────────────────────────────────────
    app.get('/admin/tenants', {
        schema: {
            description: 'List all tenants with pagination (admin only)',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'number', minimum: 1, default: 1 },
                    limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
                    isActive: { type: 'boolean' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('admin:read')],
        handler: async (request, reply) => {
            const { page = 1, limit = 50, isActive } = request.query as {
                page?: number
                limit?: number
                isActive?: boolean
            }

            const skip = (page - 1) * limit
            const where = isActive !== undefined ? { isActive } : undefined

            const [tenants, total] = await Promise.all([
                prisma.tenant.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        _count: {
                            select: {
                                users: true,
                                roles: true,
                            },
                        },
                    },
                }),
                prisma.tenant.count({ where }),
            ])

            return reply.send(paginatedResponse(tenants, total, page, limit))
        },
    })

    // ─── GET TENANT DETAILS ────────────────────────────────────
    app.get('/admin/tenants/:id', {
        schema: {
            description: 'Get detailed tenant information (admin only)',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('admin:read')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }

            const tenant = await prisma.tenant.findUnique({
                where: { id },
                include: {
                    users: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            isActive: true,
                            createdAt: true,
                        },
                    },
                    roles: {
                        select: {
                            id: true,
                            name: true,
                            isSystem: true,
                        },
                    },
                },
            })

            // Get plan info
            const plan = await prisma.tenantPlan.findUnique({
                where: { tenantId: id },
            })

            // Get usage stats
            const [webhookCount, fileCount, fileSize] = await Promise.all([
                prisma.webhookSubscription.count({ where: { tenantId: id } }),
                prisma.fileUpload.count({ where: { tenantId: id } }),
                prisma.fileUpload.aggregate({
                    where: { tenantId: id },
                    _sum: { size: true },
                }),
            ])

            return reply.send(successResponse({
                ...tenant,
                plan,
                usage: {
                    webhooks: webhookCount,
                    files: fileCount,
                    storage: Number(fileSize._sum.size ?? 0),
                },
            }))
        },
    })

    // ─── RECENT ACTIVITY FEED ──────────────────────────────────
    app.get('/admin/activity', {
        schema: {
            description: 'Get recent system-wide activity (admin only)',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
                },
            },
        },
        preHandler: [authGuard, requirePermission('admin:read')],
        handler: async (request, reply) => {
            const { limit = 50 } = request.query as { limit?: number }

            const recentLogs = await prisma.auditLog.findMany({
                take: limit,
                orderBy: { createdAt: 'desc' },
            })

            return reply.send(successResponse(recentLogs))
        },
    })

    // ─── CROSS-TENANT USER SEARCH ──────────────────────────────
    app.get('/admin/users', {
        schema: {
            description: 'Search users across all tenants (admin only)',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    email: { type: 'string' },
                    tenantId: { type: 'string' },
                    page: { type: 'number', minimum: 1, default: 1 },
                    limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
                },
            },
        },
        preHandler: [authGuard, requirePermission('admin:read')],
        handler: async (request, reply) => {
            const { email, tenantId, page = 1, limit = 50 } = request.query as {
                email?: string
                tenantId?: string
                page?: number
                limit?: number
            }

            const skip = (page - 1) * limit
            const where: {
                email?: { contains: string }
                tenantId?: string
            } = {}

            if (email) where.email = { contains: email }
            if (tenantId) where.tenantId = tenantId

            const [users, total] = await Promise.all([
                prisma.user.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        isActive: true,
                        emailVerified: true,
                        tenantId: true,
                        createdAt: true,
                        // Exclude password
                    },
                }),
                prisma.user.count({ where }),
            ])

            return reply.send(paginatedResponse(users, total, page, limit))
        },
    })
}
