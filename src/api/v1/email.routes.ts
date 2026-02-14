import type { FastifyInstance } from 'fastify'
import { authGuard } from '../middleware/auth.guard.js'
import { requirePermission } from '../middleware/rbac.guard.js'
import { successResponse } from '../../shared/response.js'
import {
    sendEmail,
    sendTemplateEmail,
    getEmailLogs,
    retryEmail,
} from '../../core/email/email.service.js'
import {
    sendEmailSchema,
    sendTemplateEmailSchema,
    createEmailTemplateSchema,
    updateEmailTemplateSchema,
    getEmailLogsSchema,
} from '../../core/email/email.schema.js'
import { prisma } from '../../infra/database/prisma.js'
import { NotFoundError } from '../../shared/errors.js'

export async function emailRoutes(app: FastifyInstance) {
    // ─── SEND EMAIL ────────────────────────────────────────────
    app.post('/emails/send', {
        schema: {
            description: 'Send an email',
            tags: ['Emails'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const body = sendEmailSchema.parse(request.body)
            const tenantId = request.user.tenantId

            const result = await sendEmail({
                tenantId,
                ...body,
            })

            return reply.send(successResponse(result, 'Email sent successfully'))
        },
    })

    // ─── SEND TEMPLATE EMAIL ───────────────────────────────────
    app.post('/emails/send-template', {
        schema: {
            description: 'Send an email using a template',
            tags: ['Emails'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const body = sendTemplateEmailSchema.parse(request.body)
            const tenantId = request.user.tenantId

            const result = await sendTemplateEmail({
                tenantId,
                ...body,
            })

            return reply.send(successResponse(result, 'Template email sent successfully'))
        },
    })

    // ─── GET EMAIL LOGS ────────────────────────────────────────
    app.get('/emails/logs', {
        schema: {
            description: 'Get email logs',
            tags: ['Emails'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const query = getEmailLogsSchema.parse(request.query)
            const tenantId = request.user.tenantId

            const result = await getEmailLogs(tenantId, query)

            return reply.send(successResponse(result))
        },
    })

    // ─── RETRY EMAIL ───────────────────────────────────────────
    app.post('/emails/logs/:id/retry', {
        schema: {
            description: 'Retry a failed email',
            tags: ['Emails'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }

            const result = await retryEmail(id)

            return reply.send(successResponse(result, 'Email retry initiated'))
        },
    })

    // ─── CREATE EMAIL TEMPLATE ─────────────────────────────────
    app.post('/emails/templates', {
        schema: {
            description: 'Create an email template',
            tags: ['Emails'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: [authGuard, requirePermission('emails:write')],
        handler: async (request, reply) => {
            const body = createEmailTemplateSchema.parse(request.body)
            const tenantId = request.user.tenantId

            const template = await prisma.emailTemplate.create({
                data: {
                    tenantId,
                    name: body.name,
                    subject: body.subject,
                    htmlBody: body.htmlBody,
                    textBody: body.textBody,
                    variables: body.variables as any || {},
                    isActive: body.isActive,
                },
            })

            return reply.status(201).send(successResponse(template, 'Template created successfully'))
        },
    })

    // ─── LIST EMAIL TEMPLATES ──────────────────────────────────
    app.get('/emails/templates', {
        schema: {
            description: 'List email templates',
            tags: ['Emails'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const tenantId = request.user.tenantId

            const templates = await prisma.emailTemplate.findMany({
                where: {
                    OR: [{ tenantId }, { tenantId: null }],
                },
                orderBy: [{ tenantId: 'desc' }, { name: 'asc' }],
            })

            return reply.send(successResponse({ templates }))
        },
    })

    // ─── UPDATE EMAIL TEMPLATE ─────────────────────────────────
    app.put('/emails/templates/:id', {
        schema: {
            description: 'Update an email template',
            tags: ['Emails'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('emails:write')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const body = updateEmailTemplateSchema.parse(request.body)
            const tenantId = request.user.tenantId

            // Only allow updating tenant-specific templates
            const existing = await prisma.emailTemplate.findFirst({
                where: { id, tenantId },
            })

            if (!existing) {
                throw new NotFoundError('Template not found or not owned by tenant')
            }

            const template = await prisma.emailTemplate.update({
                where: { id },
                data: {
                    ...body,
                    variables: body.variables as any,
                },
            })

            return reply.send(successResponse(template, 'Template updated successfully'))
        },
    })

    // ─── DELETE EMAIL TEMPLATE ─────────────────────────────────
    app.delete('/emails/templates/:id', {
        schema: {
            description: 'Delete an email template',
            tags: ['Emails'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('emails:delete')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const tenantId = request.user.tenantId

            // Only allow deleting tenant-specific templates
            const existing = await prisma.emailTemplate.findFirst({
                where: { id, tenantId },
            })

            if (!existing) {
                throw new NotFoundError('Template not found or not owned by tenant')
            }

            await prisma.emailTemplate.delete({ where: { id } })

            return reply.send(successResponse(null, 'Template deleted successfully'))
        },
    })
}
