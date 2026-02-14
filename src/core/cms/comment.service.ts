import { prisma } from '../../infra/database/prisma.js'
import { cacheGet, cacheSet, cacheDel } from '../../infra/cache/redis.js'
import { NotFoundError, BadRequestError, UnauthorizedError } from '../../shared/errors.js'
import type {
    CreateCommentInput,
    UpdateCommentInput,
    ListCommentsInput,
    ApproveCommentInput,
    BulkApproveCommentsInput,
} from './comment.schema.js'

/**
 * Create a new comment (authenticated or guest)
 */
export async function createComment(
    tenantId: string,
    data: CreateCommentInput,
    userId?: string
) {
    // Verify post exists and belongs to tenant
    const post = await prisma.post.findFirst({
        where: { id: data.postId, tenantId },
    })

    if (!post) {
        throw new NotFoundError('Post not found')
    }

    // Verify parent comment exists if provided
    if (data.parentId) {
        const parent = await prisma.comment.findFirst({
            where: { id: data.parentId, postId: data.postId },
        })

        if (!parent) {
            throw new NotFoundError('Parent comment not found')
        }
    }

    // Guest comment validation
    if (!userId) {
        if (!data.authorName || !data.authorEmail) {
            throw new BadRequestError('Guest comments require authorName and authorEmail')
        }
    }

    const comment = await prisma.comment.create({
        data: {
            postId: data.postId,
            authorId: userId,
            authorName: !userId ? data.authorName : undefined,
            authorEmail: !userId ? data.authorEmail : undefined,
            content: data.content,
            parentId: data.parentId,
            status: 'pending', // All comments start as pending
        },
        include: {
            parent: true,
        },
    })

    // Invalidate cache
    await invalidateCommentCache(data.postId)

    return comment
}

/**
 * Get comment by ID
 */
export async function getCommentById(commentId: string) {
    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
            parent: true,
            replies: {
                where: { status: 'approved' },
                orderBy: { createdAt: 'asc' },
            },
        },
    })

    if (!comment) {
        throw new NotFoundError('Comment not found')
    }

    return comment
}

/**
 * List comments with pagination and filtering
 */
export async function listComments(
    tenantId: string,
    query: ListCommentsInput,
    includeAll = false
) {
    const {
        postId,
        authorId,
        status,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
    } = query

    const cacheKey = `comments:${tenantId}:${JSON.stringify(query)}:${includeAll}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const where: any = {}

    // Filter by post
    if (postId) {
        // Verify post belongs to tenant
        const post = await prisma.post.findFirst({
            where: { id: postId, tenantId },
        })

        if (!post) {
            throw new NotFoundError('Post not found')
        }

        where.postId = postId
    }

    // Filter by author
    if (authorId) {
        where.authorId = authorId
    }

    // Filter by status (only for authenticated users managing comments)
    if (includeAll && status) {
        where.status = status
    } else if (!includeAll) {
        // Public view: only approved comments
        where.status = 'approved'
    }

    // Only show top-level comments (no replies in main list)
    where.parentId = null

    const [comments, total] = await Promise.all([
        prisma.comment.findMany({
            where,
            include: {
                replies: {
                    where: { status: 'approved' },
                    orderBy: { createdAt: 'asc' },
                    include: {
                        replies: {
                            where: { status: 'approved' },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.comment.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)
    const hasMore = page < totalPages

    const result = {
        comments,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore,
        },
    }

    // Cache for 1 minute (shorter for comments due to moderation)
    await cacheSet(cacheKey, result, 60)

    return result
}

/**
 * Update comment (only by author or admin)
 */
export async function updateComment(
    commentId: string,
    data: UpdateCommentInput,
    userId: string,
    isAdmin = false
) {
    const existing = await prisma.comment.findUnique({
        where: { id: commentId },
    })

    if (!existing) {
        throw new NotFoundError('Comment not found')
    }

    // Only comment author can edit content
    if (data.content && existing.authorId !== userId && !isAdmin) {
        throw new UnauthorizedError('You can only edit your own comments')
    }

    // Only admins can change status
    if (data.status && !isAdmin) {
        throw new UnauthorizedError('Only admins can change comment status')
    }

    const comment = await prisma.comment.update({
        where: { id: commentId },
        data: {
            content: data.content,
            status: data.status,
        },
        include: {
            parent: true,
            replies: {
                where: { status: 'approved' },
                orderBy: { createdAt: 'asc' },
            },
        },
    })

    // Invalidate cache
    await invalidateCommentCache(existing.postId)

    return comment
}

/**
 * Approve or reject a comment (admin only)
 */
export async function approveComment(commentId: string, data: ApproveCommentInput) {
    const existing = await prisma.comment.findUnique({
        where: { id: commentId },
    })

    if (!existing) {
        throw new NotFoundError('Comment not found')
    }

    const comment = await prisma.comment.update({
        where: { id: commentId },
        data: { status: data.status },
        include: {
            parent: true,
            replies: true,
        },
    })

    // Invalidate cache
    await invalidateCommentCache(existing.postId)

    return comment
}

/**
 * Bulk approve/reject comments (admin only)
 */
export async function bulkApproveComments(data: BulkApproveCommentsInput) {
    const { commentIds, status } = data

    // Get all comments to invalidate cache
    const comments = await prisma.comment.findMany({
        where: { id: { in: commentIds } },
        select: { id: true, postId: true },
    })

    if (comments.length !== commentIds.length) {
        throw new BadRequestError('Some comments not found')
    }

    // Update all comments
    await prisma.comment.updateMany({
        where: { id: { in: commentIds } },
        data: { status },
    })

    // Invalidate cache for all affected posts
    const postIds = [...new Set(comments.map((c) => c.postId))]
    await Promise.all(postIds.map((postId) => invalidateCommentCache(postId)))

    return { success: true, updated: comments.length }
}

/**
 * Delete comment (only by author or admin)
 * If comment has replies, only hide it (soft delete)
 */
export async function deleteComment(commentId: string, userId: string, isAdmin = false) {
    const existing = await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
            replies: true,
        },
    })

    if (!existing) {
        throw new NotFoundError('Comment not found')
    }

    // Check authorization
    if (existing.authorId !== userId && !isAdmin) {
        throw new UnauthorizedError('You can only delete your own comments')
    }

    // If has replies, mark as deleted instead of removing
    if (existing.replies.length > 0) {
        await prisma.comment.update({
            where: { id: commentId },
            data: {
                content: '[deleted]',
                status: 'spam',
            },
        })
    } else {
        // No replies, safe to delete
        await prisma.comment.delete({
            where: { id: commentId },
        })
    }

    // Invalidate cache
    await invalidateCommentCache(existing.postId)

    return { success: true }
}

/**
 * Get comment statistics for a post
 */
export async function getCommentStats(postId: string, tenantId: string) {
    // Verify post belongs to tenant
    const post = await prisma.post.findFirst({
        where: { id: postId, tenantId },
    })

    if (!post) {
        throw new NotFoundError('Post not found')
    }

    const [total, approved, pending, spam] = await Promise.all([
        prisma.comment.count({ where: { postId } }),
        prisma.comment.count({ where: { postId, status: 'approved' } }),
        prisma.comment.count({ where: { postId, status: 'pending' } }),
        prisma.comment.count({ where: { postId, status: 'spam' } }),
    ])

    return {
        postId,
        total,
        approved,
        pending,
        spam,
    }
}

/**
 * Get pending comments for moderation (admin only)
 */
export async function getPendingComments(tenantId: string, limit = 50) {
    const cacheKey = `comments:${tenantId}:pending:${limit}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const comments = await prisma.comment.findMany({
        where: {
            status: 'pending',
            post: { tenantId },
        },
        include: {
            post: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                },
            },
            parent: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    })

    // Cache for 30 seconds (very short for moderation queue)
    await cacheSet(cacheKey, comments, 30)

    return comments
}

/**
 * Invalidate comment cache for a post
 */
async function invalidateCommentCache(postId: string) {
    // This is a simple implementation
    // In production, you'd want to track all cache keys more systematically
    await cacheDel(`comments:*:${postId}:*`)
}
