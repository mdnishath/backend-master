import { prisma } from '../../infra/database/prisma.js'
import { cacheGet, cacheSet, cacheDel } from '../../infra/cache/redis.js'
import { NotFoundError, BadRequestError } from '../../shared/errors.js'
import type {
    CreateCategoryInput,
    UpdateCategoryInput,
    ListCategoriesInput,
} from './category.schema.js'

/**
 * Create a new category
 */
export async function createCategory(tenantId: string, data: CreateCategoryInput) {
    // Generate slug from name if not provided
    const slug = data.slug || generateSlug(data.name)

    // Check if slug is unique in this tenant
    const existing = await prisma.category.findUnique({
        where: { tenantId_slug: { tenantId, slug } },
    })

    if (existing) {
        throw new BadRequestError(`Category with slug "${slug}" already exists`)
    }

    const category = await prisma.category.create({
        data: {
            tenantId,
            name: data.name,
            slug,
            description: data.description,
            parentId: data.parentId,
        },
        include: {
            _count: {
                select: { posts: true },
            },
        },
    })

    // Invalidate cache
    await cacheDel(`categories:${tenantId}:list`)

    return category
}

/**
 * Get category by ID
 */
export async function getCategoryById(tenantId: string, categoryId: string) {
    const cacheKey = `category:${categoryId}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const category = await prisma.category.findFirst({
        where: { id: categoryId, tenantId },
        include: {
            _count: {
                select: { posts: true },
            },
        },
    })

    if (!category) {
        throw new NotFoundError('Category not found')
    }

    // Cache for 5 minutes
    await cacheSet(cacheKey, category, 300)

    return category
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(tenantId: string, slug: string) {
    const cacheKey = `category:${tenantId}:slug:${slug}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const category = await prisma.category.findUnique({
        where: { tenantId_slug: { tenantId, slug } },
        include: {
            _count: {
                select: { posts: true },
            },
        },
    })

    if (!category) {
        throw new NotFoundError('Category not found')
    }

    // Cache for 5 minutes
    await cacheSet(cacheKey, category, 300)

    return category
}

/**
 * List categories with pagination and filtering
 */
export async function listCategories(tenantId: string, query: ListCategoriesInput) {
    const { search, page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc' } = query

    const cacheKey = `categories:${tenantId}:${JSON.stringify(query)}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const where: any = { tenantId }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
        ]
    }

    const [categories, total] = await Promise.all([
        prisma.category.findMany({
            where,
            include: {
                _count: {
                    select: { posts: true },
                },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.category.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)
    const hasMore = page < totalPages

    const result = {
        categories,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore,
        },
    }

    // Cache for 2 minutes
    await cacheSet(cacheKey, result, 120)

    return result
}

/**
 * Update category
 */
export async function updateCategory(
    tenantId: string,
    categoryId: string,
    data: UpdateCategoryInput
) {
    const existing = await prisma.category.findFirst({
        where: { id: categoryId, tenantId },
    })

    if (!existing) {
        throw new NotFoundError('Category not found')
    }

    // If slug is being updated, check uniqueness
    if (data.slug && data.slug !== existing.slug) {
        const duplicate = await prisma.category.findUnique({
            where: { tenantId_slug: { tenantId, slug: data.slug } },
        })

        if (duplicate) {
            throw new BadRequestError(`Category with slug "${data.slug}" already exists`)
        }
    }

    const category = await prisma.category.update({
        where: { id: categoryId },
        data: {
            name: data.name,
            slug: data.slug,
            description: data.description,
            parentId: data.parentId,
        },
        include: {
            _count: {
                select: { posts: true },
            },
        },
    })

    // Invalidate cache
    await Promise.all([
        cacheDel(`category:${categoryId}`),
        cacheDel(`category:${tenantId}:slug:${existing.slug}`),
        cacheDel(`category:${tenantId}:slug:${category.slug}`),
        cacheDel(`categories:${tenantId}:list`),
    ])

    return category
}

/**
 * Delete category
 */
export async function deleteCategory(tenantId: string, categoryId: string) {
    const existing = await prisma.category.findFirst({
        where: { id: categoryId, tenantId },
        include: {
            _count: {
                select: { posts: true },
            },
        },
    })

    if (!existing) {
        throw new NotFoundError('Category not found')
    }

    // Check if category has posts
    if (existing._count.posts > 0) {
        throw new BadRequestError(
            `Cannot delete category "${existing.name}" because it has ${existing._count.posts} posts. Remove posts first.`
        )
    }

    await prisma.category.delete({
        where: { id: categoryId },
    })

    // Invalidate cache
    await Promise.all([
        cacheDel(`category:${categoryId}`),
        cacheDel(`category:${tenantId}:slug:${existing.slug}`),
        cacheDel(`categories:${tenantId}:list`),
    ])

    return { success: true }
}

/**
 * Get category statistics
 */
export async function getCategoryStats(tenantId: string, categoryId: string) {
    const category = await prisma.category.findFirst({
        where: { id: categoryId, tenantId },
        include: {
            _count: {
                select: { posts: true },
            },
            posts: {
                where: {
                    post: { status: 'published' },
                },
                include: {
                    post: {
                        select: {
                            views: true,
                            publishedAt: true,
                        },
                    },
                },
            },
        },
    })

    if (!category) {
        throw new NotFoundError('Category not found')
    }

    const totalViews = category.posts.reduce((sum, pc) => sum + pc.post.views, 0)
    const publishedPosts = category.posts.filter((pc) => pc.post.publishedAt).length

    return {
        categoryId: category.id,
        categoryName: category.name,
        totalPosts: category._count.posts,
        publishedPosts,
        totalViews,
        averageViews: publishedPosts > 0 ? Math.round(totalViews / publishedPosts) : 0,
    }
}

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
}
