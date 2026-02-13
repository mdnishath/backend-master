import { z } from 'zod'

export const createWebhookSchema = z.object({
    url: z.string().url('Invalid URL format'),
    events: z.array(z.string()).min(1, 'At least one event is required'),
    description: z.string().optional(),
})

export const updateWebhookSchema = z.object({
    url: z.string().url('Invalid URL format').optional(),
    events: z.array(z.string()).min(1, 'At least one event is required').optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
})

export const webhookQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
})

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>
export type WebhookQueryInput = z.infer<typeof webhookQuerySchema>
