import { z } from 'zod'

// ─── PAGE SCHEMAS ─────────────────────────────────────────────
export const createPageSchema = z.object({
    title: z.string().min(1).max(200),
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-\/]+$/).optional(),
    content: z.any(), // JSON content from rich text editor (TipTap/Lexical)
    htmlContent: z.string().optional(),
    template: z.enum(['default', 'landing', 'blank']).default('default'),
    status: z.enum(['draft', 'published']).default('draft'),
    publishedAt: z.string().datetime().optional(),
    isHomePage: z.boolean().default(false),
    parentId: z.string().optional(),
    order: z.number().int().min(0).default(0),

    // SEO
    metaTitle: z.string().max(60).optional(),
    metaDescription: z.string().max(160).optional(),
    ogImage: z.string().url().optional(),
})

export const updatePageSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-\/]+$/).optional(),
    content: z.any().optional(),
    htmlContent: z.string().optional(),
    template: z.enum(['default', 'landing', 'blank']).optional(),
    status: z.enum(['draft', 'published']).optional(),
    publishedAt: z.string().datetime().optional(),
    isHomePage: z.boolean().optional(),
    parentId: z.string().optional(),
    order: z.number().int().min(0).optional(),

    // SEO
    metaTitle: z.string().max(60).optional(),
    metaDescription: z.string().max(160).optional(),
    ogImage: z.string().url().optional(),
})

export const listPagesSchema = z.object({
    status: z.enum(['draft', 'published']).optional(),
    template: z.enum(['default', 'landing', 'blank']).optional(),
    parentId: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
    sortBy: z.enum(['title', 'order', 'createdAt', 'publishedAt']).default('order'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const pageIdSchema = z.object({
    id: z.string().min(1),
})

export const pageSlugSchema = z.object({
    slug: z.string().min(1),
})

export const publishPageSchema = z.object({
    publishedAt: z.string().datetime().optional(),
})

export const reorderPagesSchema = z.object({
    pages: z.array(
        z.object({
            id: z.string(),
            order: z.number().int().min(0),
        })
    ).min(1).max(100),
})

// ─── TYPES ────────────────────────────────────────────────────
export type CreatePageInput = z.infer<typeof createPageSchema>
export type UpdatePageInput = z.infer<typeof updatePageSchema>
export type ListPagesInput = z.infer<typeof listPagesSchema>
export type PublishPageInput = z.infer<typeof publishPageSchema>
export type ReorderPagesInput = z.infer<typeof reorderPagesSchema>
