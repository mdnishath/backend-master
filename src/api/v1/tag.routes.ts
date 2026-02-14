import type { FastifyInstance } from 'fastify'
import { authGuard } from '../middleware/auth.guard.js'
import { successResponse } from '../../shared/response.js'
import {
    createTagSchema,
    updateTagSchema,
    listTagsSchema,
    tagIdSchema,
    tagSlugSchema,
} from '../../core/cms/category.schema.js'
import {
    createTag,
    getTagById,
    getTagBySlug,
    listTags,
    updateTag,
    deleteTag,
    getTagStats,
    getPopularTags,
} from '../../core/cms/tag.service.js'

export default async function tagRoutes(app: FastifyInstance) {
    // Public: List tags
    app.get(
        '/tags',
        {
            schema: {
                tags: ['Tags'],
                summary: 'List all tags (public)',
                description: 'Get paginated list of tags for a tenant',
                querystring: listTagsSchema,
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'object',
                                properties: {
                                    tags: { type: 'array' },
                                    pagination: { type: 'object' },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const query = listTagsSchema.parse(request.query)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const result = await listTags(tenantId as string, query)
            return reply.send(successResponse(result))
        }
    )

    // Public: Get popular tags
    app.get(
        '/tags/popular',
        {
            schema: {
                tags: ['Tags'],
                summary: 'Get popular tags (public)',
                description: 'Get most used tags ordered by post count',
                querystring: {
                    type: 'object',
                    properties: {
                        tenantId: { type: 'string' },
                        limit: { type: 'number', default: 20 },
                    },
                },
            },
        },
        async (request, reply) => {
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']
            const limit = (request.query as any).limit || 20

            if (!tenantId) {
                return reply.status(400).send({
                    success: false,
                    message: 'tenantId is required (query param or X-Tenant-Id header)',
                })
            }

            const tags = await getPopularTags(tenantId as string, limit)
            return reply.send(successResponse(tags))
        }
    )

    // Public: Get tag by slug
    app.get(
        '/tags/slug/:slug',
        {
            schema: {
                tags: ['Tags'],
                summary: 'Get tag by slug (public)',
                params: tagSlugSchema,
            },
        },
        async (request, reply) => {
            const { slug } = tagSlugSchema.parse(request.params)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const tag = await getTagBySlug(tenantId as string, slug)
            return reply.send(successResponse(tag))
        }
    )

    // Public: Get tag by ID
    app.get(
        '/tags/:id',
        {
            schema: {
                tags: ['Tags'],
                summary: 'Get tag by ID (public)',
                params: tagIdSchema,
            },
        },
        async (request, reply) => {
            const { id } = tagIdSchema.parse(request.params)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const tag = await getTagById(tenantId as string, id)
            return reply.send(successResponse(tag))
        }
    )

    // Public: Get tag stats
    app.get(
        '/tags/:id/stats',
        {
            schema: {
                tags: ['Tags'],
                summary: 'Get tag statistics (public)',
                params: tagIdSchema,
            },
        },
        async (request, reply) => {
            const { id } = tagIdSchema.parse(request.params)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const stats = await getTagStats(tenantId as string, id)
            return reply.send(successResponse(stats))
        }
    )

    // Protected: Create tag
    app.post(
        '/tags',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Tags'],
                summary: 'Create a new tag',
                security: [{ bearerAuth: [] }],
                body: createTagSchema,
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user
            const body = createTagSchema.parse(request.body)

            const tag = await createTag(tenantId, body)
            return reply.code(201).send(successResponse(tag))
        }
    )

    // Protected: Update tag
    app.patch(
        '/tags/:id',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Tags'],
                summary: 'Update a tag',
                security: [{ bearerAuth: [] }],
                params: tagIdSchema,
                body: updateTagSchema,
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user
            const { id } = tagIdSchema.parse(request.params)
            const body = updateTagSchema.parse(request.body)

            const tag = await updateTag(tenantId, id, body)
            return reply.send(successResponse(tag))
        }
    )

    // Protected: Delete tag
    app.delete(
        '/tags/:id',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Tags'],
                summary: 'Delete a tag',
                security: [{ bearerAuth: [] }],
                params: tagIdSchema,
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user
            const { id } = tagIdSchema.parse(request.params)

            const result = await deleteTag(tenantId, id)
            return reply.send(successResponse(result))
        }
    )
}
