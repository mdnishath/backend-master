import { z } from 'zod'

// Post status enum
export const postStatusEnum = z.enum(['draft', 'published', 'scheduled'])

// Create post schema
export const createPostSchema = z.object({
    title: z.string().min(1).max(255),
    slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
    excerpt: z.string().max(500).optional(),
    content: z.record(z.string(), z.unknown()), // JSON content from editor
    featuredImage: z.string().url().optional(),
    status: postStatusEnum.default('draft'),
    scheduledFor: z.string().datetime().optional(),

    // SEO
    metaTitle: z.string().max(60).optional(),
    metaDescription: z.string().max(160).optional(),
    metaKeywords: z.string().optional(),
    ogImage: z.string().url().optional(),

    // Relations
    categoryIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string()).optional(),
})

// Update post schema
export const updatePostSchema = createPostSchema.partial()

// Publish post schema
export const publishPostSchema = z.object({
    publishedAt: z.string().datetime().optional(),
})

// List posts query
export const listPostsSchema = z.object({
    status: postStatusEnum.optional(),
    categoryId: z.string().optional(),
    tagId: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'publishedAt', 'views', 'title']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
export type PublishPostInput = z.infer<typeof publishPostSchema>
export type ListPostsInput = z.infer<typeof listPostsSchema>
