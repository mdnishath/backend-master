import { z } from 'zod'

export const sendEmailSchema = z.object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    subject: z.string().min(1),
    html: z.string().min(1),
    text: z.string().optional(),
    templateName: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
})

export const sendTemplateEmailSchema = z.object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    templateName: z.string().min(1),
    variables: z.record(z.string(), z.unknown()),
    metadata: z.record(z.string(), z.unknown()).optional(),
})

export const createEmailTemplateSchema = z.object({
    name: z.string().min(1),
    subject: z.string().min(1),
    htmlBody: z.string().min(1),
    textBody: z.string().optional(),
    variables: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().default(true),
})

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial()

export const getEmailLogsSchema = z.object({
    status: z.enum(['sent', 'failed', 'bounced', 'delivered', 'opened', 'clicked']).optional(),
    to: z.string().email().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
})

export type SendEmailInput = z.infer<typeof sendEmailSchema>
export type SendTemplateEmailInput = z.infer<typeof sendTemplateEmailSchema>
export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>
export type GetEmailLogsInput = z.infer<typeof getEmailLogsSchema>
