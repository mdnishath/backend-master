import type { FastifyInstance } from 'fastify'
import { authGuard } from '../middleware/auth.guard.js'
import { successResponse } from '../../shared/response.js'
import {
    createPageSchema,
    updatePageSchema,
    listPagesSchema,
    pageIdSchema,
    pageSlugSchema,
    publishPageSchema,
    reorderPagesSchema,
} from '../../core/cms/page.schema.js'
import {
    createPage,
    getPageById,
    getPageBySlug,
    getHomePage,
    listPages,
    updatePage,
    publishPage,
    reorderPages,
    deletePage,
    getPageTree,
} from '../../core/cms/page.service.js'

export default async function pageRoutes(app: FastifyInstance) {
    // Public: Get home page
    app.get(
        '/pages/home',
        {
            schema: {
                tags: ['Pages'],
                summary: 'Get home page (public)',
                description: 'Get the page marked as home page',
            },
        },
        async (request, reply) => {
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const page = await getHomePage(tenantId as string)
            return reply.send(successResponse(page))
        }
    )

    // Public: Get page tree (hierarchical structure)
    app.get(
        '/pages/tree',
        {
            schema: {
                tags: ['Pages'],
                summary: 'Get page tree (public)',
                description: 'Get hierarchical page structure',
            },
        },
        async (request, reply) => {
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const pages = await getPageTree(tenantId as string, false)
            return reply.send(successResponse(pages))
        }
    )

    // Public: List pages
    app.get(
        '/pages',
        {
            schema: {
                tags: ['Pages'],
                summary: 'List published pages (public)',
                description: 'Get paginated list of published pages',
                querystring: listPagesSchema,
            },
        },
        async (request, reply) => {
            const query = listPagesSchema.parse(request.query)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const result = await listPages(tenantId as string, query, false)
            return reply.send(successResponse(result))
        }
    )

    // Public: Get page by slug
    app.get(
        '/pages/slug/:slug',
        {
            schema: {
                tags: ['Pages'],
                summary: 'Get page by slug (public)',
                params: pageSlugSchema,
            },
        },
        async (request, reply) => {
            const { slug } = pageSlugSchema.parse(request.params)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const page = await getPageBySlug(tenantId as string, slug, false)
            return reply.send(successResponse(page))
        }
    )

    // Public: Get page by ID
    app.get(
        '/pages/:id',
        {
            schema: {
                tags: ['Pages'],
                summary: 'Get page by ID (public)',
                params: pageIdSchema,
            },
        },
        async (request, reply) => {
            const { id } = pageIdSchema.parse(request.params)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const page = await getPageById(tenantId as string, id, false)
            return reply.send(successResponse(page))
        }
    )

    // ─── PROTECTED ROUTES ─────────────────────────────────────────

    // Protected: List all pages (including drafts)
    app.get(
        '/pages/manage',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Pages'],
                summary: 'List all pages including drafts (protected)',
                description: 'Get all pages for management',
                security: [{ bearerAuth: [] }],
                querystring: listPagesSchema,
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user
            const query = listPagesSchema.parse(request.query)

            const result = await listPages(tenantId, query, true)
            return reply.send(successResponse(result))
        }
    )

    // Protected: Get page tree (including drafts)
    app.get(
        '/pages/manage/tree',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Pages'],
                summary: 'Get page tree including drafts (protected)',
                security: [{ bearerAuth: [] }],
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user

            const pages = await getPageTree(tenantId, true)
            return reply.send(successResponse(pages))
        }
    )

    // Protected: Get page by ID (including drafts)
    app.get(
        '/pages/manage/:id',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Pages'],
                summary: 'Get page by ID including drafts (protected)',
                security: [{ bearerAuth: [] }],
                params: pageIdSchema,
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user
            const { id } = pageIdSchema.parse(request.params)

            const page = await getPageById(tenantId, id, true)
            return reply.send(successResponse(page))
        }
    )

    // Protected: Create page
    app.post(
        '/pages',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Pages'],
                summary: 'Create a new page',
                security: [{ bearerAuth: [] }],
                body: createPageSchema,
            },
        },
        async (request, reply) => {
            const { tenantId, id: authorId } = request.user
            const body = createPageSchema.parse(request.body)

            const page = await createPage(tenantId, authorId, body)
            return reply.code(201).send(successResponse(page))
        }
    )

    // Protected: Update page
    app.patch(
        '/pages/:id',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Pages'],
                summary: 'Update a page',
                security: [{ bearerAuth: [] }],
                params: pageIdSchema,
                body: updatePageSchema,
            },
        },
        async (request, reply) => {
            const { tenantId, id: authorId } = request.user
            const { id } = pageIdSchema.parse(request.params)
            const body = updatePageSchema.parse(request.body)

            const page = await updatePage(tenantId, id, authorId, body)
            return reply.send(successResponse(page))
        }
    )

    // Protected: Publish page
    app.post(
        '/pages/:id/publish',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Pages'],
                summary: 'Publish a page',
                security: [{ bearerAuth: [] }],
                params: pageIdSchema,
                body: publishPageSchema,
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user
            const { id } = pageIdSchema.parse(request.params)
            const body = publishPageSchema.parse(request.body)

            const page = await publishPage(tenantId, id, body)
            return reply.send(successResponse(page))
        }
    )

    // Protected: Reorder pages
    app.post(
        '/pages/reorder',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Pages'],
                summary: 'Reorder pages',
                description: 'Update the order of multiple pages at once',
                security: [{ bearerAuth: [] }],
                body: reorderPagesSchema,
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user
            const body = reorderPagesSchema.parse(request.body)

            const result = await reorderPages(tenantId, body)
            return reply.send(successResponse(result))
        }
    )

    // Protected: Delete page
    app.delete(
        '/pages/:id',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Pages'],
                summary: 'Delete a page',
                security: [{ bearerAuth: [] }],
                params: pageIdSchema,
            },
        },
        async (request, reply) => {
            const { tenantId } = request.user
            const { id } = pageIdSchema.parse(request.params)

            const result = await deletePage(tenantId, id)
            return reply.send(successResponse(result))
        }
    )
}
