import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { join } from 'node:path'
import { env } from './config/env.js'
import { errorHandlerPlugin } from './api/plugins/error-handler.js'
import { authRoutes } from './api/v1/auth.routes.js'
import { rbacRoutes } from './api/v1/rbac.routes.js'
import { passwordResetRoutes } from './api/v1/password-reset.routes.js'
import { fileRoutes } from './api/v1/file.routes.js'
import { auditRoutes } from './api/v1/audit.routes.js'
import { jobRoutes } from './api/v1/job.routes.js'
import { webhookRoutes } from './api/v1/webhook.routes.js'
import { featureFlagRoutes } from './api/v1/feature-flag.routes.js'
import { adminRoutes } from './api/v1/admin.routes.js'
import { prisma } from './infra/database/prisma.js'
import { successResponse } from './shared/response.js'

export async function buildApp() {
    const app = Fastify({
        logger: {
            level: env.LOG_LEVEL,
            transport: env.NODE_ENV === 'development'
                ? { target: 'pino-pretty', options: { colorize: true } }
                : undefined,
        },
    })

    // ─── GLOBAL PLUGINS ────────────────────────────────────────
    await app.register(cors, {
        origin: env.NODE_ENV === 'production' ? false : true,
        credentials: true,
    })

    await app.register(helmet, {
        contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    })

    await app.register(cookie)

    // Multipart for file uploads
    await app.register(multipart, {
        limits: { fileSize: env.MAX_FILE_SIZE },
    })

    // Rate limiting
    await app.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    })

    // Serve uploaded files statically
    await app.register(fastifyStatic, {
        root: join(process.cwd(), env.UPLOAD_DIR),
        prefix: '/uploads/',
        decorateReply: false,
    })

    // ─── SWAGGER ─────────────────────────────────────────────
    await app.register(fastifySwagger, {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'Enterprise SaaS Backend API',
                description: 'White-label enterprise backend — Auth, RBAC, Multi-tenancy, File Upload, Audit Logging, Background Jobs',
                version: '2.0.0',
            },
            servers: [{ url: `http://localhost:${env.PORT}`, description: 'Development' }],
            components: {
                securitySchemes: {
                    bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
                },
            },
            tags: [
                { name: 'Health', description: 'Health check' },
                { name: 'Auth', description: 'Authentication' },
                { name: 'RBAC', description: 'Role-based access control' },
                { name: 'Files', description: 'File upload & management' },
                { name: 'Audit', description: 'Audit logging' },
                { name: 'Jobs', description: 'Background jobs' },
                { name: 'Webhooks', description: 'Webhook subscriptions & delivery' },
                { name: 'Features', description: 'Feature flags management' },
                { name: 'Plans', description: 'Tenant plans & usage limits' },
                { name: 'Admin', description: 'Admin dashboard & system management' },
            ],
        },
    })

    await app.register(fastifySwaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
            persistAuthorization: true,
        },
    })

    // ─── ERROR HANDLER ─────────────────────────────────────────
    await app.register(errorHandlerPlugin)

    // ─── ENHANCED HEALTH CHECK ─────────────────────────────────
    app.get('/health', {
        schema: {
            description: 'Enhanced health check endpoint with all service status',
            tags: ['Health'],
        },
        handler: async (_request, reply) => {
            const checks: Record<string, { status: string; latency?: number; details?: unknown }> = {}

            // Database check
            const dbStart = Date.now()
            try {
                await prisma.$queryRaw`SELECT 1`
                checks.database = {
                    status: 'healthy',
                    latency: Date.now() - dbStart,
                }
            } catch (error) {
                checks.database = {
                    status: 'unhealthy',
                    details: error instanceof Error ? error.message : 'Unknown error',
                }
            }

            // Redis check
            const redisStart = Date.now()
            try {
                const { redis, redisAvailable } = await import('./infra/cache/redis.js')
                if (redisAvailable) {
                    await redis.ping()
                    checks.redis = {
                        status: 'healthy',
                        latency: Date.now() - redisStart,
                    }
                } else {
                    checks.redis = { status: 'disabled' }
                }
            } catch (error) {
                checks.redis = {
                    status: 'unhealthy',
                    details: error instanceof Error ? error.message : 'Unknown error',
                }
            }

            // Queue check
            try {
                const { getQueueStats } = await import('./infra/queue/queues.js')
                const queueStats = await getQueueStats()
                const totalFailed = queueStats.email.failed + queueStats.cleanup.failed + queueStats.webhooks.failed
                checks.queues = {
                    status: totalFailed > 100 ? 'degraded' : 'healthy',
                    details: queueStats,
                }
            } catch (error) {
                checks.queues = {
                    status: 'unhealthy',
                    details: error instanceof Error ? error.message : 'Unknown error',
                }
            }

            // Overall status
            const isHealthy = Object.values(checks).every(
                check => check.status === 'healthy' || check.status === 'disabled'
            )
            const isDegraded = Object.values(checks).some(check => check.status === 'degraded')

            return reply.status(isHealthy ? 200 : 503).send(successResponse({
                status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                environment: env.NODE_ENV,
                version: '3.0.0',
                checks,
            }))
        },
    })

    // ─── API ROUTES (v1) ──────────────────────────────────────
    await app.register(authRoutes, { prefix: '/api/v1/auth' })
    await app.register(passwordResetRoutes, { prefix: '/api/v1/auth' })
    await app.register(rbacRoutes, { prefix: '/api/v1' })
    await app.register(fileRoutes, { prefix: '/api/v1' })
    await app.register(auditRoutes, { prefix: '/api/v1' })
    await app.register(jobRoutes, { prefix: '/api/v1' })
    await app.register(webhookRoutes, { prefix: '/api/v1' })
    await app.register(featureFlagRoutes, { prefix: '/api/v1' })
    await app.register(adminRoutes, { prefix: '/api/v1' })

    return app
}
