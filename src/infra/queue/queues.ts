import { Queue } from 'bullmq'
import { env } from '../../config/env.js'

// ─── EMAIL QUEUE ────────────────────────────────────────────

interface EmailJobData {
    to: string
    subject: string
    template: 'welcome' | 'password-reset' | 'email-verification' | 'invitation'
    variables: Record<string, string>
}

const redisConnection = { url: env.REDIS_URL, maxRetriesPerRequest: null }

export const emailQueue = new Queue<EmailJobData, unknown, string>('email', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
    },
})

// ─── CLEANUP QUEUE ──────────────────────────────────────────

interface CleanupJobData {
    type: 'expired-tokens' | 'expired-sessions' | 'old-audit-logs'
}

export const cleanupQueue = new Queue<CleanupJobData, unknown, string>('cleanup', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 2,
    },
})

// ─── WEBHOOK QUEUE (Phase 3) ────────────────────────────────

export interface WebhookJobData {
    webhookId: string
    event: string
    url: string
    secret: string
    payload: Record<string, unknown>
}

export const webhookQueue = new Queue<WebhookJobData, unknown, string>('webhooks', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 5000, // Start with 5s, then 10s, 20s, 40s, 80s
        },
    },
})

// ─── QUEUE HELPERS ──────────────────────────────────────────

export async function addEmailJob(data: EmailJobData) {
    return emailQueue.add(`email-${data.template}`, data)
}

export async function addCleanupJob(data: CleanupJobData, delay?: number) {
    return cleanupQueue.add(`cleanup-${data.type}`, data, { delay })
}

export async function addWebhookJob(data: WebhookJobData) {
    return webhookQueue.add(`webhook-${data.event}`, data)
}

export async function getQueueStats() {
    const [emailWaiting, emailActive, emailCompleted, emailFailed] = await Promise.all([
        emailQueue.getWaitingCount(),
        emailQueue.getActiveCount(),
        emailQueue.getCompletedCount(),
        emailQueue.getFailedCount(),
    ])

    const [cleanupWaiting, cleanupActive, cleanupCompleted, cleanupFailed] = await Promise.all([
        cleanupQueue.getWaitingCount(),
        cleanupQueue.getActiveCount(),
        cleanupQueue.getCompletedCount(),
        cleanupQueue.getFailedCount(),
    ])

    const [webhookWaiting, webhookActive, webhookCompleted, webhookFailed] = await Promise.all([
        webhookQueue.getWaitingCount(),
        webhookQueue.getActiveCount(),
        webhookQueue.getCompletedCount(),
        webhookQueue.getFailedCount(),
    ])

    return {
        email: { waiting: emailWaiting, active: emailActive, completed: emailCompleted, failed: emailFailed },
        cleanup: { waiting: cleanupWaiting, active: cleanupActive, completed: cleanupCompleted, failed: cleanupFailed },
        webhooks: { waiting: webhookWaiting, active: webhookActive, completed: webhookCompleted, failed: webhookFailed },
    }
}
