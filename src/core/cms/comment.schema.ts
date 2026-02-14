import { z } from 'zod'

// ─── COMMENT SCHEMAS ──────────────────────────────────────────
export const createCommentSchema = z.object({
    postId: z.string().min(1),
    content: z.string().min(1).max(5000),
    parentId: z.string().optional(), // For nested replies
    // For guest comments
    authorName: z.string().min(1).max(100).optional(),
    authorEmail: z.string().email().optional(),
})

export const updateCommentSchema = z.object({
    content: z.string().min(1).max(5000).optional(),
    status: z.enum(['pending', 'approved', 'spam']).optional(),
})

export const listCommentsSchema = z.object({
    postId: z.string().optional(),
    authorId: z.string().optional(),
    status: z.enum(['pending', 'approved', 'spam']).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const commentIdSchema = z.object({
    id: z.string().min(1),
})

export const approveCommentSchema = z.object({
    status: z.enum(['approved', 'spam']),
})

export const bulkApproveCommentsSchema = z.object({
    commentIds: z.array(z.string()).min(1).max(100),
    status: z.enum(['approved', 'spam']),
})

// ─── TYPES ────────────────────────────────────────────────────
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>
export type ListCommentsInput = z.infer<typeof listCommentsSchema>
export type ApproveCommentInput = z.infer<typeof approveCommentSchema>
export type BulkApproveCommentsInput = z.infer<typeof bulkApproveCommentsSchema>
