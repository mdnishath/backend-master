import { prisma } from '../../infra/database/prisma.js'
import { cacheGet, cacheSet, cacheDel } from '../../infra/cache/redis.js'
import { NotFoundError, BadRequestError } from '../../shared/errors.js'
import type {
    CreateTagInput,
    UpdateTagInput,
    ListTagsInput,
} from './category.schema.js'

/**
 * Create a new tag
 */
export async function createTag(tenantId: string, data: CreateTagInput) {
    // Generate slug from name if not provided
    const slug = data.slug || generateSlug(data.name)

    // Check if slug is unique in this tenant
    const existing = await prisma.tag.findUnique({
        where: { tenantId_slug: { tenantId, slug } },
    })

    if (existing) {
        throw new BadRequestError(`Tag with slug "${slug}" already exists`)
    }

    const tag = await prisma.tag.create({
        data: {
            tenantId,
            name: data.name,
            slug,
        },
        include: {
            _count: {
                select: { posts: true },
            },
        },
    })

    // Invalidate cache
    await cacheDel(`tags:${tenantId}:list`)

    return tag
}

/**
 * Get tag by ID
 */
export async function getTagById(tenantId: string, tagId: string) {
    const cacheKey = `tag:${tagId}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const tag = await prisma.tag.findFirst({
        where: { id: tagId, tenantId },
        include: {
            _count: {
                select: { posts: true },
            },
        },
    })

    if (!tag) {
        throw new NotFoundError('Tag not found')
    }

    // Cache for 5 minutes
    await cacheSet(cacheKey, tag, 300)

    return tag
}

/**
 * Get tag by slug
 */
export async function getTagBySlug(tenantId: string, slug: string) {
    const cacheKey = `tag:${tenantId}:slug:${slug}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const tag = await prisma.tag.findUnique({
        where: { tenantId_slug: { tenantId, slug } },
        include: {
            _count: {
                select: { posts: true },
            },
        },
    })

    if (!tag) {
        throw new NotFoundError('Tag not found')
    }

    // Cache for 5 minutes
    await cacheSet(cacheKey, tag, 300)

    return tag
}

/**
 * List tags with pagination and filtering
 */
export async function listTags(tenantId: string, query: ListTagsInput) {
    const { search, page = 1, limit = 100, sortBy = 'name', sortOrder = 'asc' } = query

    const cacheKey = `tags:${tenantId}:${JSON.stringify(query)}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const where: any = { tenantId }

    if (search) {
        where.name = { contains: search, mode: 'insensitive' }
    }

    const [tags, total] = await Promise.all([
        prisma.tag.findMany({
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
        prisma.tag.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)
    const hasMore = page < totalPages

    const result = {
        tags,
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
 * Update tag
 */
export async function updateTag(
    tenantId: string,
    tagId: string,
    data: UpdateTagInput
) {
    const existing = await prisma.tag.findFirst({
        where: { id: tagId, tenantId },
    })

    if (!existing) {
        throw new NotFoundError('Tag not found')
    }

    // If slug is being updated, check uniqueness
    if (data.slug && data.slug !== existing.slug) {
        const duplicate = await prisma.tag.findUnique({
            where: { tenantId_slug: { tenantId, slug: data.slug } },
        })

        if (duplicate) {
            throw new BadRequestError(`Tag with slug "${data.slug}" already exists`)
        }
    }

    const tag = await prisma.tag.update({
        where: { id: tagId },
        data: {
            name: data.name,
            slug: data.slug,
        },
        include: {
            _count: {
                select: { posts: true },
            },
        },
    })

    // Invalidate cache
    await Promise.all([
        cacheDel(`tag:${tagId}`),
        cacheDel(`tag:${tenantId}:slug:${existing.slug}`),
        cacheDel(`tag:${tenantId}:slug:${tag.slug}`),
        cacheDel(`tags:${tenantId}:list`),
    ])

    return tag
}

/**
 * Delete tag
 */
export async function deleteTag(tenantId: string, tagId: string) {
    const existing = await prisma.tag.findFirst({
        where: { id: tagId, tenantId },
        include: {
            _count: {
                select: { posts: true },
            },
        },
    })

    if (!existing) {
        throw new NotFoundError('Tag not found')
    }

    // Tags can be deleted even if they have posts (just removes associations)
    // If you want to prevent deletion, uncomment:
    // if (existing._count.posts > 0) {
    //     throw new BadRequestError(
    //         `Cannot delete tag "${existing.name}" because it has ${existing._count.posts} posts.`
    //     )
    // }

    await prisma.tag.delete({
        where: { id: tagId },
    })

    // Invalidate cache
    await Promise.all([
        cacheDel(`tag:${tagId}`),
        cacheDel(`tag:${tenantId}:slug:${existing.slug}`),
        cacheDel(`tags:${tenantId}:list`),
    ])

    return { success: true }
}

/**
 * Get tag statistics
 */
export async function getTagStats(tenantId: string, tagId: string) {
    const tag = await prisma.tag.findFirst({
        where: { id: tagId, tenantId },
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

    if (!tag) {
        throw new NotFoundError('Tag not found')
    }

    const totalViews = tag.posts.reduce((sum, pt) => sum + pt.post.views, 0)
    const publishedPosts = tag.posts.filter((pt) => pt.post.publishedAt).length

    return {
        tagId: tag.id,
        tagName: tag.name,
        totalPosts: tag._count.posts,
        publishedPosts,
        totalViews,
        averageViews: publishedPosts > 0 ? Math.round(totalViews / publishedPosts) : 0,
    }
}

/**
 * Get popular tags (most used)
 */
export async function getPopularTags(tenantId: string, limit = 20) {
    const cacheKey = `tags:${tenantId}:popular:${limit}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const tags = await prisma.tag.findMany({
        where: { tenantId },
        include: {
            _count: {
                select: { posts: true },
            },
        },
        orderBy: {
            posts: {
                _count: 'desc',
            },
        },
        take: limit,
    })

    // Cache for 5 minutes
    await cacheSet(cacheKey, tags, 300)

    return tags
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
