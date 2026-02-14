import { z } from 'zod'

// ─── CATEGORY SCHEMAS ─────────────────────────────────────────
export const createCategorySchema = z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
    description: z.string().max(500).optional(),
    parentId: z.string().optional(),
})

export const updateCategorySchema = createCategorySchema.partial()

export const listCategoriesSchema = z.object({
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
    sortBy: z.enum(['name', 'createdAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const categoryIdSchema = z.object({
    id: z.string().min(1),
})

export const categorySlugSchema = z.object({
    slug: z.string().min(1),
})

// ─── TAG SCHEMAS ──────────────────────────────────────────────
export const createTagSchema = z.object({
    name: z.string().min(1).max(50),
    slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
})

export const updateTagSchema = createTagSchema.partial()

export const listTagsSchema = z.object({
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(100),
    sortBy: z.enum(['name', 'createdAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const tagIdSchema = z.object({
    id: z.string().min(1),
})

export const tagSlugSchema = z.object({
    slug: z.string().min(1),
})

// ─── TYPES ────────────────────────────────────────────────────
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>

export type CreateTagInput = z.infer<typeof createTagSchema>
export type UpdateTagInput = z.infer<typeof updateTagSchema>
export type ListTagsInput = z.infer<typeof listTagsSchema>
