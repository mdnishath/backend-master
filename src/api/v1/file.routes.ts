import type { FastifyInstance } from 'fastify'
import { authGuard } from '../middleware/auth.guard.js'
import { requirePermission } from '../middleware/rbac.guard.js'
import { storeFile } from '../../infra/storage/storage.service.js'
import { prisma } from '../../infra/database/prisma.js'
import { createAuditLog } from '../../core/audit/audit.service.js'
import { successResponse } from '../../shared/response.js'

export async function fileRoutes(app: FastifyInstance) {
    // ─── UPLOAD FILE ──────────────────────────────────────────
    app.post('/files/upload', {
        schema: {
            description: 'Upload a file',
            tags: ['Files'],
            security: [{ bearerAuth: [] }],
            consumes: ['multipart/form-data'],
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const data = await request.file()
            if (!data) {
                return reply.status(400).send({ success: false, error: 'No file uploaded' })
            }

            const stored = await storeFile(data.file, data.filename, data.mimetype)

            const record = await prisma.fileUpload.create({
                data: {
                    id: stored.id,
                    originalName: stored.originalName,
                    storagePath: stored.storagePath,
                    mimeType: stored.mimeType,
                    size: stored.size,
                    url: stored.url,
                    uploadedBy: request.user.id,
                    tenantId: request.user.tenantId,
                },
            })

            await createAuditLog({
                action: 'upload',
                resource: 'file',
                resourceId: record.id,
                userId: request.user.id,
                tenantId: request.user.tenantId,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
            })

            return reply.status(201).send(successResponse(record, 'File uploaded successfully'))
        },
    })

    // ─── LIST FILES ───────────────────────────────────────────
    app.get('/files', {
        schema: {
            description: 'List uploaded files for current tenant',
            tags: ['Files'],
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 20 },
                },
            },
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number }
            const skip = (page - 1) * limit

            const [files, total] = await Promise.all([
                prisma.fileUpload.findMany({
                    where: { tenantId: request.user.tenantId },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                prisma.fileUpload.count({ where: { tenantId: request.user.tenantId } }),
            ])

            return reply.send(successResponse({
                files,
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            }))
        },
    })

    // ─── DELETE FILE ──────────────────────────────────────────
    app.delete('/files/:id', {
        schema: {
            description: 'Delete a file',
            tags: ['Files'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } },
            },
        },
        preHandler: [authGuard],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }

            const file = await prisma.fileUpload.findFirst({
                where: { id, tenantId: request.user.tenantId },
            })

            if (!file) {
                return reply.status(404).send({ success: false, error: 'File not found' })
            }

            const { deleteFile } = await import('../../infra/storage/storage.service.js')
            await deleteFile(file.storagePath)
            await prisma.fileUpload.delete({ where: { id } })

            await createAuditLog({
                action: 'delete',
                resource: 'file',
                resourceId: id,
                userId: request.user.id,
                tenantId: request.user.tenantId,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
            })

            return reply.send(successResponse(null, 'File deleted'))
        },
    })
}
