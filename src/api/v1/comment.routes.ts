import type { FastifyInstance } from 'fastify'
import { authGuard } from '../middleware/auth.guard.js'
import { successResponse } from '../../shared/response.js'
import {
    createCommentSchema,
    updateCommentSchema,
    listCommentsSchema,
    commentIdSchema,
    approveCommentSchema,
    bulkApproveCommentsSchema,
} from '../../core/cms/comment.schema.js'
import {
    createComment,
    getCommentById,
    listComments,
    updateComment,
    approveComment,
    bulkApproveComments,
    deleteComment,
    getCommentStats,
    getPendingComments,
} from '../../core/cms/comment.service.js'

export default async function commentRoutes(app: FastifyInstance) {
    // Public: List approved comments for a post
    app.get(
        '/comments',
        {
            schema: {
                tags: ['Comments'],
                summary: 'List approved comments (public)',
                description: 'Get paginated list of approved comments for a post',
            },
        },
        async (request, reply) => {
            const query = listCommentsSchema.parse(request.query)
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const result = await listComments(tenantId as string, query, false)
            return reply.send(successResponse(result))
        }
    )

    // Public: Get comment by ID
    app.get(
        '/comments/:id',
        {
            schema: {
                tags: ['Comments'],
                summary: 'Get comment by ID (public)',
            },
        },
        async (request, reply) => {
            const { id } = commentIdSchema.parse(request.params)
            const comment = await getCommentById(id)
            return reply.send(successResponse(comment))
        }
    )

    // Public: Get comment statistics for a post
    app.get(
        '/comments/stats/:postId',
        {
            schema: {
                tags: ['Comments'],
                summary: 'Get comment statistics for a post (public)',
            },
        },
        async (request, reply) => {
            const { postId } = request.params as { postId: string }
            const tenantId = (request.query as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (query param or X-Tenant-Id header)')
            }

            const stats = await getCommentStats(postId, tenantId as string)
            return reply.send(successResponse(stats))
        }
    )

    // Public/Protected: Create comment (can be guest or authenticated)
    app.post(
        '/comments',
        {
            schema: {
                tags: ['Comments'],
                summary: 'Create a new comment',
                description: 'Create a comment as authenticated user or guest. All comments start as pending.',
            },
        },
        async (request, reply) => {
            const body = createCommentSchema.parse(request.body)
            const tenantId = (request.body as any).tenantId || request.headers['x-tenant-id']

            if (!tenantId) {
                throw new Error('tenantId is required (body or X-Tenant-Id header)')
            }

            // Check if user is authenticated (optional for comments)
            const userId = (request as any).user?.id

            const comment = await createComment(tenantId as string, body, userId)
            return reply.code(201).send(successResponse(comment))
        }
    )

    // Protected: Update comment (author or admin)
    app.patch(
        '/comments/:id',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Comments'],
                summary: 'Update a comment',
                description: 'Update comment content (author only) or status (admin only)',
                security: [{ bearerAuth: [] }],
            },
        },
        async (request, reply) => {
            const { id: userId, roles } = request.user
            const { id } = commentIdSchema.parse(request.params)
            const body = updateCommentSchema.parse(request.body)

            const isAdmin = roles.includes('admin') || roles.includes('super_admin')

            const comment = await updateComment(id, body, userId, isAdmin)
            return reply.send(successResponse(comment))
        }
    )

    // Protected: Delete comment (author or admin)
    app.delete(
        '/comments/:id',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Comments'],
                summary: 'Delete a comment',
                description: 'Delete your own comment or any comment (admin). Comments with replies are soft-deleted.',
                security: [{ bearerAuth: [] }],
            },
        },
        async (request, reply) => {
            const { id: userId, roles } = request.user
            const { id } = commentIdSchema.parse(request.params)

            const isAdmin = roles.includes('admin') || roles.includes('super_admin')

            const result = await deleteComment(id, userId, isAdmin)
            return reply.send(successResponse(result))
        }
    )

    // ─── ADMIN ROUTES ─────────────────────────────────────────────

    // Protected: List all comments (including pending) for management
    app.get(
        '/comments/manage',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Comments'],
                summary: 'List all comments for management (admin)',
                description: 'Get all comments including pending and spam (admin only)',
                security: [{ bearerAuth: [] }],
            },
        },
        async (request, reply) => {
            const { tenantId, roles } = request.user

            if (!roles.includes('admin') && !roles.includes('super_admin')) {
                throw new Error('Only admins can manage comments')
            }

            const query = listCommentsSchema.parse(request.query)
            const result = await listComments(tenantId, query, true)
            return reply.send(successResponse(result))
        }
    )

    // Protected: Get pending comments for moderation
    app.get(
        '/comments/pending',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Comments'],
                summary: 'Get pending comments for moderation (admin)',
                description: 'Get all pending comments that need approval',
                security: [{ bearerAuth: [] }],
            },
        },
        async (request, reply) => {
            const { tenantId, roles } = request.user

            if (!roles.includes('admin') && !roles.includes('super_admin')) {
                throw new Error('Only admins can view pending comments')
            }

            const limit = (request.query as any).limit || 50
            const comments = await getPendingComments(tenantId, limit)
            return reply.send(successResponse(comments))
        }
    )

    // Protected: Approve/reject a comment
    app.post(
        '/comments/:id/approve',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Comments'],
                summary: 'Approve or reject a comment (admin)',
                description: 'Change comment status to approved or spam',
                security: [{ bearerAuth: [] }],
            },
        },
        async (request, reply) => {
            const { roles } = request.user

            if (!roles.includes('admin') && !roles.includes('super_admin')) {
                throw new Error('Only admins can approve comments')
            }

            const { id } = commentIdSchema.parse(request.params)
            const body = approveCommentSchema.parse(request.body)

            const comment = await approveComment(id, body)
            return reply.send(successResponse(comment))
        }
    )

    // Protected: Bulk approve/reject comments
    app.post(
        '/comments/bulk-approve',
        {
            preHandler: authGuard,
            schema: {
                tags: ['Comments'],
                summary: 'Bulk approve or reject comments (admin)',
                description: 'Change status of multiple comments at once',
                security: [{ bearerAuth: [] }],
            },
        },
        async (request, reply) => {
            const { roles } = request.user

            if (!roles.includes('admin') && !roles.includes('super_admin')) {
                throw new Error('Only admins can bulk approve comments')
            }

            const body = bulkApproveCommentsSchema.parse(request.body)
            const result = await bulkApproveComments(body)
            return reply.send(successResponse(result))
        }
    )
}
