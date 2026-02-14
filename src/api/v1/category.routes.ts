import type { FastifyInstance } from 'fastify'
import { authGuard } from '../middleware/auth.guard.js'
import { successResponse } from '../../shared/response.js'
import {
    createCategorySchema,
    updateCategorySchema,
    listCategoriesSchema,
    categoryIdSchema,
    categorySlugSchema,
} from '../../core/cms/category.schema.js'
import {
    createCategory,
    getCategoryById,
    getCategoryBySlug,
    listCategories,
    updateCategory,
    deleteCategory,
    getCategoryStats,
} from '../../core/cms/category.service.js'

export default async function categoryRoutes(app: FastifyInstance) {
    // Public: List categories
    app.get(
        '/categories',
        {
            schema: {
                tags: ['Categories'],
                summary: 'List all categories (public)',
                description: 'Get paginated list of categories for a tenant',
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'object',
                                properties: {
                                    categories: { type: 'array' },
                                    pagination: { type: 'object' },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const query = listCategoriesSchema.parse(request.query)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const result = await listCategories(tenantId as string, query)
            return reply.send(successResponse(result))
        }
    )

    // Public: Get category by slug
    app.get(
        '/categories/slug/:slug',
        {
            schema: {
                tags: ['Categories'],
                summary: 'Get category by slug (public)',
                params: categorySlugSchema,
            },
        },
        async (request, reply) => {
            const { slug } = categorySlugSchema.parse(request.params)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                return reply.status(400).send({
                    success: false,
                    message: 'tenantId is required (query param or X-Tenant-Id header)',
                })
            }

            const category = await getCategoryBySlug(tenantId as string, slug)
            return reply.send(successResponse(category))
        }
    )

    // Public: Get category by ID
    app.get(
        '/categories/:id',
        {
            schema: {
                tags: ['Categories'],
                summary: 'Get category by ID (public)',
                params: categoryIdSchema,
            },
        },
        async (request, reply) => {
            const { id } = categoryIdSchema.parse(request.params)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                return reply.status(400).send({
                    success: false,
                    message: 'tenantId is required (query param or X-Tenant-Id header)',
                })
            }

            const category = await getCategoryById(tenantId as string, id)
            return reply.send(successResponse(category))
        }
    )

    // Public: Get category stats
    app.get(
        '/categories/:id/stats',
        {
            schema: {
                tags: ['Categories'],
                summary: 'Get category statistics (public)',
                params: categoryIdSchema,
            },
        },
        async (request, reply) => {
            const { id } = categoryIdSchema.parse(request.params)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                return reply.status(400).send({
                    success: false,
                    message: 'tenantId is required (query param or X-Tenant-Id header)',
                })
            }

            const stats = await getCategoryStats(tenantId as string, id)
            return reply.send(successResponse(stats))
        }
    )

    // Protected: Create category
    app.post(
        '/categories',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Categories'],
                summary: 'Create a new category',
                security: [{ bearerAuth: [] }],
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user
            const body = createCategorySchema.parse(request.body)

            const category = await createCategory(tenantId, body)
            return reply.code(201).send(successResponse(category))
        }
    )

    // Protected: Update category
    app.patch(
        '/categories/:id',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Categories'],
                summary: 'Update a category',
                security: [{ bearerAuth: [] }],
                params: categoryIdSchema,
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user
            const { id } = categoryIdSchema.parse(request.params)
            const body = updateCategorySchema.parse(request.body)

            const category = await updateCategory(tenantId, id, body)
            return reply.send(successResponse(category))
        }
    )

    // Protected: Delete category
    app.delete(
        '/categories/:id',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Categories'],
                summary: 'Delete a category',
                security: [{ bearerAuth: [] }],
                params: categoryIdSchema,
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user
            const { id } = categoryIdSchema.parse(request.params)

            const result = await deleteCategory(tenantId, id)
            return reply.send(successResponse(result))
        }
    )
}
