import { prisma } from '../../infra/database/prisma.js'
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js'
import crypto from 'node:crypto'

// ─── WEBHOOK SUBSCRIPTION MANAGEMENT ───────────────────────────

export interface CreateWebhookInput {
    url: string
    events: string[]
    description?: string
}

export interface UpdateWebhookInput {
    url?: string
    events?: string[]
    description?: string
    isActive?: boolean
}

/**
 * List all webhook subscriptions for a tenant
 */
export async function listWebhooks(tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit

    const [webhooks, total] = await Promise.all([
        prisma.webhookSubscription.findMany({
            where: { tenantId },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.webhookSubscription.count({ where: { tenantId } }),
    ])

    return { webhooks, total }
}

/**
 * Create a new webhook subscription
 */
export async function createWebhook(
    tenantId: string,
    userId: string,
    input: CreateWebhookInput,
) {
    // Validate URL
    try {
        new URL(input.url)
    } catch {
        throw new ValidationError('Invalid webhook URL')
    }

    // Validate events array
    if (!input.events || input.events.length === 0) {
        throw new ValidationError('At least one event must be specified')
    }

    // Check tenant's webhook limit (from plan)
    const plan = await prisma.tenantPlan.findUnique({
        where: { tenantId },
    })

    if (plan) {
        const existingCount = await prisma.webhookSubscription.count({
            where: { tenantId, isActive: true },
        })

        if (existingCount >= plan.maxWebhooks) {
            throw new ConflictError(
                `Webhook limit reached. Your plan allows ${plan.maxWebhooks} webhooks.`,
            )
        }
    }

    // Generate secure secret for HMAC signing
    const secret = crypto.randomBytes(32).toString('hex')

    return prisma.webhookSubscription.create({
        data: {
            tenantId,
            url: input.url,
            events: input.events,
            description: input.description,
            secret,
            createdBy: userId,
        },
    })
}

/**
 * Get a single webhook by ID
 */
export async function getWebhook(webhookId: string, tenantId: string) {
    const webhook = await prisma.webhookSubscription.findFirst({
        where: { id: webhookId, tenantId },
    })

    if (!webhook) {
        throw new NotFoundError('Webhook not found')
    }

    return webhook
}

/**
 * Update a webhook subscription
 */
export async function updateWebhook(
    webhookId: string,
    tenantId: string,
    input: UpdateWebhookInput,
) {
    const webhook = await getWebhook(webhookId, tenantId)

    if (input.url) {
        try {
            new URL(input.url)
        } catch {
            throw new ValidationError('Invalid webhook URL')
        }
    }

    if (input.events && input.events.length === 0) {
        throw new ValidationError('At least one event must be specified')
    }

    return prisma.webhookSubscription.update({
        where: { id: webhook.id },
        data: input,
    })
}

/**
 * Delete a webhook subscription
 */
export async function deleteWebhook(webhookId: string, tenantId: string) {
    const webhook = await getWebhook(webhookId, tenantId)
    await prisma.webhookSubscription.delete({ where: { id: webhook.id } })
}

/**
 * Get webhook delivery logs
 */
export async function getWebhookDeliveries(
    webhookId: string,
    tenantId: string,
    page = 1,
    limit = 50,
) {
    // Verify webhook belongs to tenant
    await getWebhook(webhookId, tenantId)

    const skip = (page - 1) * limit

    const [deliveries, total] = await Promise.all([
        prisma.webhookDelivery.findMany({
            where: { webhookId },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.webhookDelivery.count({ where: { webhookId } }),
    ])

    return { deliveries, total }
}

// ─── WEBHOOK TRIGGERING ────────────────────────────────────────

export interface WebhookEvent {
    event: string
    tenantId: string
    payload: Record<string, unknown>
}

/**
 * Trigger webhooks for a specific event.
 * This enqueues the webhook delivery to BullMQ for async processing.
 */
export async function triggerWebhooks(eventData: WebhookEvent) {
    const { event, tenantId, payload } = eventData

    // Find all active webhooks subscribed to this event
    const webhooks = await prisma.webhookSubscription.findMany({
        where: {
            tenantId,
            isActive: true,
            events: {
                has: event,
            },
        },
    })

    if (webhooks.length === 0) {
        return { triggered: 0 }
    }

    // Import queue dynamically to avoid circular dependencies
    const { addWebhookJob } = await import('../../infra/queue/queues.js')

    // Enqueue webhook deliveries
    const jobs = webhooks.map((webhook) =>
        addWebhookJob({
            webhookId: webhook.id,
            event,
            url: webhook.url,
            secret: webhook.secret,
            payload,
        }),
    )

    await Promise.all(jobs)

    return { triggered: webhooks.length }
}
