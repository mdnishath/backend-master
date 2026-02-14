import type { FastifyInstance } from 'fastify'
import { authGuard } from '../middleware/auth.guard.js'
import { requirePermission } from '../middleware/rbac.guard.js'
import { successResponse } from '../../shared/response.js'
import {
    createPost,
    getPostById,
    getPostBySlug,
    listPosts,
    updatePost,
    publishPost,
    deletePost,
} from '../../core/cms/post.service.js'
import {
    createPostSchema,
    updatePostSchema,
    publishPostSchema,
    listPostsSchema,
} from '../../core/cms/post.schema.js'

export async function postRoutes(app: FastifyInstance) {
    // ─── CREATE POST ───────────────────────────────────────────
    app.post('/posts', {
        schema: {
            description: 'Create a new post',
            tags: ['Posts'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: [authGuard, requirePermission('posts:write')],
        handler: async (request, reply) => {
            const body = createPostSchema.parse(request.body)
            const { tenantId, id } = request.user

            const post = await createPost(tenantId, id, body)

            return reply.status(201).send(successResponse(post, 'Post created successfully'))
        },
    })

    // ─── LIST POSTS ────────────────────────────────────────────
    app.get('/posts', {
        schema: {
            description: 'List posts with filters and pagination',
            tags: ['Posts'],
        },
        handler: async (request, reply) => {
            const query = listPostsSchema.parse(request.query)
            // Public endpoint - only show published posts
            const includeUnpublished = false

            // For public, must have tenantId in query or header
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id'] as string

            if (!tenantId) {
                return reply.status(400).send({
                    success: false,
                    message: 'tenantId is required',
                })
            }

            const result = await listPosts(tenantId, query, includeUnpublished)

            return reply.send(successResponse(result))
        },
    })

    // ─── LIST POSTS (AUTHENTICATED) ────────────────────────────
    app.get('/posts/manage', {
        schema: {
            description: 'List all posts (including drafts) for management',
            tags: ['Posts'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const query = listPostsSchema.parse(request.query)
            const { tenantId } = request.user
            const includeUnpublished = true

            const result = await listPosts(tenantId, query, includeUnpublished)

            return reply.send(successResponse(result))
        },
    })

    // ─── GET POST BY SLUG ──────────────────────────────────────
    app.get('/posts/slug/:slug', {
        schema: {
            description: 'Get post by slug (public)',
            tags: ['Posts'],
            params: {
                type: 'object',
                properties: {
                    slug: { type: 'string' },
                },
            },
        },
        handler: async (request, reply) => {
            const { slug } = request.params as { slug: string }
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id'] as string

            if (!tenantId) {
                return reply.status(400).send({
                    success: false,
                    message: 'tenantId is required',
                })
            }

            const post = await getPostBySlug(tenantId, slug, false)

            return reply.send(successResponse(post))
        },
    })

    // ─── GET POST BY ID ────────────────────────────────────────
    app.get('/posts/:id', {
        schema: {
            description: 'Get post by ID',
            tags: ['Posts'],
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
            const includeUnpublished = true

            const post = await getPostById(id, includeUnpublished)

            return reply.send(successResponse(post))
        },
    })

    // ─── UPDATE POST ───────────────────────────────────────────
    app.put('/posts/:id', {
        schema: {
            description: 'Update a post',
            tags: ['Posts'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('posts:write')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const body = updatePostSchema.parse(request.body)

            const post = await updatePost(id, body)

            return reply.send(successResponse(post, 'Post updated successfully'))
        },
    })

    // ─── PUBLISH POST ──────────────────────────────────────────
    app.post('/posts/:id/publish', {
        schema: {
            description: 'Publish a post',
            tags: ['Posts'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('posts:write')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }
            const body = publishPostSchema.parse(request.body)

            const publishedAt = body.publishedAt ? new Date(body.publishedAt) : undefined

            const post = await publishPost(id, publishedAt)

            return reply.send(successResponse(post, 'Post published successfully'))
        },
    })

    // ─── DELETE POST ───────────────────────────────────────────
    app.delete('/posts/:id', {
        schema: {
            description: 'Delete a post',
            tags: ['Posts'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
        },
        preHandler: [authGuard, requirePermission('posts:delete')],
        handler: async (request, reply) => {
            const { id } = request.params as { id: string }

            await deletePost(id)

            return reply.send(successResponse(null, 'Post deleted successfully'))
        },
    })
}
