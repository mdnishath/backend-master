import { prisma } from '../../infra/database/prisma.js'
import { resend, isEmailEnabled, emailConfig, logEmailToConsole } from '../../infra/email/resend.js'

export interface SendEmailOptions {
    tenantId: string
    to: string | string[]
    subject: string
    html: string
    text?: string
    templateName?: string
    metadata?: Record<string, any>
}

export interface SendTemplateEmailOptions {
    tenantId: string
    to: string | string[]
    templateName: string
    variables: Record<string, any>
    metadata?: Record<string, any>
}

/**
 * Send email using Resend
 * Falls back to console logging in development if API key is not set
 */
export async function sendEmail(options: SendEmailOptions) {
    const { tenantId, to, subject, html, text, templateName, metadata } = options

    const recipients = Array.isArray(to) ? to : [to]
    const emailData = {
        from: emailConfig.from,
        to: recipients,
        subject,
        html,
        text,
    }

    let status: string
    let emailId: string | undefined
    let error: string | undefined

    try {
        if (isEmailEnabled && resend) {
            // Send via Resend
            const response = await resend.emails.send(emailData)

            if (response.error) {
                throw new Error(response.error.message)
            }

            emailId = response.data?.id
            status = 'sent'
        } else {
            // Development mode: log to console
            logEmailToConsole(emailData)
            emailId = `dev-${Date.now()}`
            status = 'sent'
        }
    } catch (err) {
        status = 'failed'
        error = err instanceof Error ? err.message : 'Unknown error'
        console.error('Failed to send email:', error)
    }

    // Log email to database
    await prisma.emailLog.create({
        data: {
            tenantId,
            to: recipients.join(', '),
            from: emailConfig.from,
            subject,
            templateName,
            status,
            emailId,
            error,
            metadata: metadata || {},
        },
    })

    if (status === 'failed') {
        throw new Error(`Email send failed: ${error}`)
    }

    return { emailId, status }
}

/**
 * Send email using a template
 * Replaces {{variables}} in the template with actual values
 */
export async function sendTemplateEmail(options: SendTemplateEmailOptions) {
    const { tenantId, to, templateName, variables, metadata } = options

    // Get template (tenant-specific or global)
    const template = await prisma.emailTemplate.findFirst({
        where: {
            name: templateName,
            isActive: true,
            OR: [{ tenantId }, { tenantId: null }],
        },
        orderBy: {
            tenantId: 'desc', // Prefer tenant-specific over global
        },
    })

    if (!template) {
        throw new Error(`Email template not found: ${templateName}`)
    }

    // Replace variables in subject and body
    const subject = replaceVariables(template.subject, variables)
    const html = replaceVariables(template.htmlBody, variables)
    const text = template.textBody ? replaceVariables(template.textBody, variables) : undefined

    return sendEmail({
        tenantId,
        to,
        subject,
        html,
        text,
        templateName,
        metadata,
    })
}

/**
 * Replace {{variable}} placeholders with actual values
 */
function replaceVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined ? String(variables[key]) : match
    })
}

/**
 * Get email logs for a tenant
 */
export async function getEmailLogs(tenantId: string, options?: {
    status?: string
    to?: string
    limit?: number
    offset?: number
}) {
    const { status, to, limit = 50, offset = 0 } = options || {}

    const where: any = { tenantId }
    if (status) where.status = status
    if (to) where.to = { contains: to }

    const [logs, total] = await Promise.all([
        prisma.emailLog.findMany({
            where,
            orderBy: { sentAt: 'desc' },
            take: limit,
            skip: offset,
        }),
        prisma.emailLog.count({ where }),
    ])

    return {
        logs,
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
    }
}

/**
 * Retry failed email
 */
export async function retryEmail(emailLogId: string) {
    const log = await prisma.emailLog.findUnique({
        where: { id: emailLogId },
    })

    if (!log) {
        throw new Error('Email log not found')
    }

    if (log.status !== 'failed') {
        throw new Error('Can only retry failed emails')
    }

    // Retry sending
    return sendEmail({
        tenantId: log.tenantId,
        to: log.to.split(', '),
        subject: log.subject,
        html: '', // We don't store HTML in logs, would need to regenerate
        templateName: log.templateName || undefined,
    })
}
