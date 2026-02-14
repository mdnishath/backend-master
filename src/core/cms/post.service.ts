import { prisma } from '../../infra/database/prisma.js'
import { cacheGet, cacheSet, cacheDel } from '../../infra/cache/redis.js'
import { NotFoundError, ValidationError } from '../../shared/errors.js'
import type { CreatePostInput, UpdatePostInput, ListPostsInput } from './post.schema.js'

/**
 * Generate slug from title
 */
function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

/**
 * Create a new post
 */
export async function createPost(tenantId: string, authorId: string, input: CreatePostInput) {
    const slug = input.slug || generateSlug(input.title)

    // Check if slug exists
    const existing = await prisma.post.findUnique({
        where: { tenantId_slug: { tenantId, slug } },
    })

    if (existing) {
        throw new ValidationError('Slug already exists. Please use a different slug.')
    }

    // Create post
    const post = await prisma.post.create({
        data: {
            tenantId,
            authorId,
            title: input.title,
            slug,
            excerpt: input.excerpt,
            content: input.content as any,
            featuredImage: input.featuredImage,
            status: input.status,
            scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
            metaTitle: input.metaTitle,
            metaDescription: input.metaDescription,
            metaKeywords: input.metaKeywords,
            ogImage: input.ogImage,
        },
    })

    // Assign categories
    if (input.categoryIds && input.categoryIds.length > 0) {
        await prisma.postCategory.createMany({
            data: input.categoryIds.map(categoryId => ({
                postId: post.id,
                categoryId,
            })),
        })
    }

    // Assign tags
    if (input.tagIds && input.tagIds.length > 0) {
        await prisma.postTag.createMany({
            data: input.tagIds.map(tagId => ({
                postId: post.id,
                tagId,
            })),
        })
    }

    // Invalidate cache
    await cacheDel(`posts:${tenantId}:*`)

    return post
}

/**
 * Get post by ID with relations
 */
export async function getPostById(postId: string, includeUnpublished = false) {
    const cacheKey = `post:${postId}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            categories: {
                include: {
                    category: true,
                },
            },
            tags: {
                include: {
                    tag: true,
                },
            },
            comments: {
                where: { status: 'approved', parentId: null },
                orderBy: { createdAt: 'desc' },
                take: 5,
            },
        },
    })

    if (!post) {
        throw new NotFoundError('Post not found')
    }

    if (!includeUnpublished && post.status !== 'published') {
        throw new NotFoundError('Post not found')
    }

    // Cache for 5 minutes
    await cacheSet(cacheKey, post, 300)

    return post
}

/**
 * Get post by slug
 */
export async function getPostBySlug(tenantId: string, slug: string, includeUnpublished = false) {
    const post = await prisma.post.findUnique({
        where: { tenantId_slug: { tenantId, slug } },
        include: {
            categories: {
                include: {
                    category: true,
                },
            },
            tags: {
                include: {
                    tag: true,
                },
            },
            comments: {
                where: { status: 'approved', parentId: null },
                orderBy: { createdAt: 'desc' },
                take: 10,
            },
        },
    })

    if (!post) {
        throw new NotFoundError('Post not found')
    }

    if (!includeUnpublished && post.status !== 'published') {
        throw new NotFoundError('Post not found')
    }

    // Increment view count (async, don't wait)
    prisma.post.update({
        where: { id: post.id },
        data: { views: { increment: 1 } },
    }).catch(() => {}) // Ignore errors

    return post
}

/**
 * List posts with filters and pagination
 */
export async function listPosts(tenantId: string, query: ListPostsInput, includeUnpublished = false) {
    const { status, categoryId, tagId, search, page, limit, sortBy, sortOrder } = query

    const cacheKey = `posts:${tenantId}:${JSON.stringify(query)}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    // Build where clause
    const where: any = { tenantId }

    if (status && includeUnpublished) {
        where.status = status
    } else if (!includeUnpublished) {
        where.status = 'published'
    }

    if (categoryId) {
        where.categories = {
            some: { categoryId },
        }
    }

    if (tagId) {
        where.tags = {
            some: { tagId },
        }
    }

    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { excerpt: { contains: search, mode: 'insensitive' } },
        ]
    }

    // Execute query
    const [posts, total] = await Promise.all([
        prisma.post.findMany({
            where,
            include: {
                categories: {
                    include: {
                        category: { select: { id: true, name: true, slug: true } },
                    },
                },
                tags: {
                    include: {
                        tag: { select: { id: true, name: true, slug: true } },
                    },
                },
                _count: {
                    select: { comments: true },
                },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.post.count({ where }),
    ])

    const result = {
        posts,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
        },
    }

    // Cache for 2 minutes
    await cacheSet(cacheKey, result, 120)

    return result
}

/**
 * Update post
 */
export async function updatePost(postId: string, input: UpdatePostInput) {
    const existing = await prisma.post.findUnique({
        where: { id: postId },
    })

    if (!existing) {
        throw new NotFoundError('Post not found')
    }

    // Update post
    const post = await prisma.post.update({
        where: { id: postId },
        data: {
            title: input.title,
            slug: input.slug,
            excerpt: input.excerpt,
            content: input.content as any,
            featuredImage: input.featuredImage,
            status: input.status,
            scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
            metaTitle: input.metaTitle,
            metaDescription: input.metaDescription,
            metaKeywords: input.metaKeywords,
            ogImage: input.ogImage,
        },
    })

    // Update categories
    if (input.categoryIds !== undefined) {
        await prisma.postCategory.deleteMany({ where: { postId } })
        if (input.categoryIds.length > 0) {
            await prisma.postCategory.createMany({
                data: input.categoryIds.map(categoryId => ({
                    postId,
                    categoryId,
                })),
            })
        }
    }

    // Update tags
    if (input.tagIds !== undefined) {
        await prisma.postTag.deleteMany({ where: { postId } })
        if (input.tagIds.length > 0) {
            await prisma.postTag.createMany({
                data: input.tagIds.map(tagId => ({
                    postId,
                    tagId,
                })),
            })
        }
    }

    // Invalidate cache
    await cacheDel(`post:${postId}`)
    await cacheDel(`posts:${existing.tenantId}:*`)

    return post
}

/**
 * Publish post
 */
export async function publishPost(postId: string, publishedAt?: Date) {
    const post = await prisma.post.update({
        where: { id: postId },
        data: {
            status: 'published',
            publishedAt: publishedAt || new Date(),
        },
    })

    // Invalidate cache
    await cacheDel(`post:${postId}`)
    await cacheDel(`posts:${post.tenantId}:*`)

    return post
}

/**
 * Delete post
 */
export async function deletePost(postId: string) {
    const post = await prisma.post.findUnique({
        where: { id: postId },
    })

    if (!post) {
        throw new NotFoundError('Post not found')
    }

    await prisma.post.delete({ where: { id: postId } })

    // Invalidate cache
    await cacheDel(`post:${postId}`)
    await cacheDel(`posts:${post.tenantId}:*`)

    return { success: true }
}
