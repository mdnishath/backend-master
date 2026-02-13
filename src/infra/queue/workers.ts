import { Worker, type Job } from 'bullmq'
import { env } from '../../config/env.js'
import { prisma } from '../database/prisma.js'
import crypto from 'node:crypto'
import type { WebhookJobData } from './queues.js'

const redisConnection = { url: env.REDIS_URL, maxRetriesPerRequest: null }

// ─── EMAIL WORKER ───────────────────────────────────────────

export function startEmailWorker() {
    const worker = new Worker(
        'email',
        async (job: Job) => {
            const { to, subject, template, variables } = job.data

            // In production: integrate with SendGrid, SES, Resend, etc.
            console.log(`📧 [EMAIL] Sending "${template}" email:`)
            console.log(`   To: ${to}`)
            console.log(`   Subject: ${subject}`)
            console.log(`   Variables:`, variables)

            await new Promise((resolve) => setTimeout(resolve, 500))

            return { sent: true, to, template }
        },
        {
            connection: redisConnection,
            concurrency: 5,
        },
    )

    worker.on('completed', (job) => {
        console.log(`✅ Email job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
        console.error(`❌ Email job ${job?.id} failed:`, err.message)
    })

    return worker
}

// ─── CLEANUP WORKER ─────────────────────────────────────────

export function startCleanupWorker() {
    const worker = new Worker(
        'cleanup',
        async (job: Job) => {
            const { type } = job.data

            switch (type) {
                case 'expired-tokens': {
                    const deleted = await prisma.refreshToken.deleteMany({
                        where: { expiresAt: { lt: new Date() } },
                    })
                    console.log(`🧹 Cleaned up ${deleted.count} expired refresh tokens`)
                    return { type, deleted: deleted.count }
                }

                case 'expired-sessions': {
                    console.log('🧹 Session cleanup — no session store yet')
                    return { type, deleted: 0 }
                }

                case 'old-audit-logs': {
                    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                    const deleted = await prisma.auditLog.deleteMany({
                        where: { createdAt: { lt: cutoff } },
                    })
                    console.log(`🧹 Cleaned up ${deleted.count} old audit logs`)
                    return { type, deleted: deleted.count }
                }

                default:
                    console.warn(`⚠️ Unknown cleanup type: ${type}`)
            }
        },
        {
            connection: redisConnection,
            concurrency: 2,
        },
    )

    worker.on('completed', (job) => {
        console.log(`✅ Cleanup job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
        console.error(`❌ Cleanup job ${job?.id} failed:`, err.message)
    })

    return worker
}

// ─── WEBHOOK WORKER (Phase 3) ──────────────────────────────

export function startWebhookWorker() {
    const worker = new Worker(
        'webhooks',
        async (job: Job<WebhookJobData>) => {
            const { webhookId, event, url, secret, payload } = job.data

            const attemptNumber = job.attemptsMade + 1

            try {
                // Create HMAC signature for security
                const timestamp = Date.now()
                const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`
                const signature = crypto
                    .createHmac('sha256', secret)
                    .update(signaturePayload)
                    .digest('hex')

                // Send webhook HTTP POST
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Webhook-Event': event,
                        'X-Webhook-Signature': signature,
                        'X-Webhook-Timestamp': timestamp.toString(),
                        'User-Agent': 'Enterprise-SaaS-Webhook/1.0',
                    },
                    body: JSON.stringify(payload),
                })

                const statusCode = response.status
                const responseBody = await response.text().catch(() => '')

                // Log delivery attempt
                await prisma.webhookDelivery.create({
                    data: {
                        webhookId,
                        event,
                        url,
                        payload: payload as never,
                        statusCode,
                        responseBody: responseBody.slice(0, 1000), // Truncate to 1000 chars
                        attempts: attemptNumber,
                        deliveredAt: response.ok ? new Date() : null,
                        error: response.ok ? null : `HTTP ${statusCode}`,
                    },
                })

                if (!response.ok) {
                    throw new Error(`Webhook delivery failed with status ${statusCode}`)
                }

                console.log(`✅ Webhook delivered: ${event} → ${url} (${statusCode})`)

                return { success: true, statusCode }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'

                // Log failed delivery
                await prisma.webhookDelivery.create({
                    data: {
                        webhookId,
                        event,
                        url,
                        payload: payload as never,
                        statusCode: null,
                        error: errorMessage,
                        attempts: attemptNumber,
                    },
                })

                console.error(`❌ Webhook delivery failed: ${event} → ${url}`, errorMessage)

                throw error // Re-throw to trigger retry
            }
        },
        {
            connection: redisConnection,
            concurrency: 10,
        },
    )

    worker.on('completed', (job) => {
        console.log(`✅ Webhook job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
        if (job && job.attemptsMade >= 5) {
            console.error(`❌ Webhook job ${job.id} exhausted all retries:`, err.message)
        }
    })

    return worker
}

// ─── START ALL WORKERS ──────────────────────────────────────

export function startAllWorkers() {
    const emailWorker = startEmailWorker()
    const cleanupWorker = startCleanupWorker()
    const webhookWorker = startWebhookWorker()

    console.log('🔧 Background workers started (email, cleanup, webhooks)')

    return { emailWorker, cleanupWorker, webhookWorker }
}
