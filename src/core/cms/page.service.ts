import { prisma } from '../../infra/database/prisma.js'
import { cacheGet, cacheSet, cacheDel } from '../../infra/cache/redis.js'
import { NotFoundError, BadRequestError } from '../../shared/errors.js'
import type {
    CreatePageInput,
    UpdatePageInput,
    ListPagesInput,
    PublishPageInput,
    ReorderPagesInput,
} from './page.schema.js'

/**
 * Create a new page
 */
export async function createPage(tenantId: string, authorId: string, data: CreatePageInput) {
    // Generate slug from title if not provided
    const slug = data.slug || generateSlug(data.title)

    // Check if slug is unique in this tenant
    const existing = await prisma.page.findFirst({
        where: { tenantId, slug },
    })

    if (existing) {
        throw new BadRequestError(`Page with slug "${slug}" already exists`)
    }

    // If setting as home page, unset current home page
    if (data.isHomePage) {
        await prisma.page.updateMany({
            where: { tenantId, isHomePage: true },
            data: { isHomePage: false },
        })
    }

    // Verify parent page exists if provided
    if (data.parentId) {
        const parent = await prisma.page.findFirst({
            where: { id: data.parentId, tenantId },
        })

        if (!parent) {
            throw new NotFoundError('Parent page not found')
        }
    }

    const page = await prisma.page.create({
        data: {
            tenantId,
            authorId,
            title: data.title,
            slug,
            content: data.content as any,
            htmlContent: data.htmlContent,
            template: data.template,
            status: data.status,
            publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
            isHomePage: data.isHomePage,
            parentId: data.parentId,
            order: data.order,
            metaTitle: data.metaTitle,
            metaDescription: data.metaDescription,
            ogImage: data.ogImage,
        },
        include: {
            parent: true,
            children: {
                orderBy: { order: 'asc' },
            },
        },
    })

    // Invalidate cache
    await invalidatePageCache(tenantId)

    return page
}

/**
 * Get page by ID
 */
export async function getPageById(tenantId: string, pageId: string, includeUnpublished = false) {
    const cacheKey = `page:${pageId}:${includeUnpublished}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const where: any = { id: pageId, tenantId }

    if (!includeUnpublished) {
        where.status = 'published'
        where.publishedAt = { lte: new Date() }
    }

    const page = await prisma.page.findFirst({
        where,
        include: {
            parent: true,
            children: {
                where: includeUnpublished ? {} : { status: 'published' },
                orderBy: { order: 'asc' },
            },
        },
    })

    if (!page) {
        throw new NotFoundError('Page not found')
    }

    // Cache for 10 minutes (pages change less frequently)
    await cacheSet(cacheKey, page, 600)

    return page
}

/**
 * Get page by slug
 */
export async function getPageBySlug(tenantId: string, slug: string, includeUnpublished = false) {
    const cacheKey = `page:${tenantId}:slug:${slug}:${includeUnpublished}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const where: any = { tenantId, slug }

    if (!includeUnpublished) {
        where.status = 'published'
        where.publishedAt = { lte: new Date() }
    }

    const page = await prisma.page.findFirst({
        where,
        include: {
            parent: true,
            children: {
                where: includeUnpublished ? {} : { status: 'published' },
                orderBy: { order: 'asc' },
            },
        },
    })

    if (!page) {
        throw new NotFoundError('Page not found')
    }

    // Cache for 10 minutes
    await cacheSet(cacheKey, page, 600)

    return page
}

/**
 * Get home page
 */
export async function getHomePage(tenantId: string) {
    const cacheKey = `page:${tenantId}:home`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const page = await prisma.page.findFirst({
        where: {
            tenantId,
            isHomePage: true,
            status: 'published',
        },
        include: {
            children: {
                where: { status: 'published' },
                orderBy: { order: 'asc' },
            },
        },
    })

    if (!page) {
        throw new NotFoundError('Home page not found')
    }

    // Cache for 10 minutes
    await cacheSet(cacheKey, page, 600)

    return page
}

/**
 * List pages with pagination and filtering
 */
export async function listPages(
    tenantId: string,
    query: ListPagesInput,
    includeUnpublished = false
) {
    const {
        status,
        template,
        parentId,
        search,
        page = 1,
        limit = 50,
        sortBy = 'order',
        sortOrder = 'asc',
    } = query

    const cacheKey = `pages:${tenantId}:${JSON.stringify(query)}:${includeUnpublished}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const where: any = { tenantId }

    // Filter by status
    if (includeUnpublished && status) {
        where.status = status
    } else if (!includeUnpublished) {
        where.status = 'published'
        where.publishedAt = { lte: new Date() }
    }

    // Filter by template
    if (template) {
        where.template = template
    }

    // Filter by parent
    if (parentId === 'null') {
        where.parentId = null
    } else if (parentId) {
        where.parentId = parentId
    }

    // Search in title and content
    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
        ]
    }

    const [pages, total] = await Promise.all([
        prisma.page.findMany({
            where,
            include: {
                parent: true,
                children: {
                    where: includeUnpublished ? {} : { status: 'published' },
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.page.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)
    const hasMore = page < totalPages

    const result = {
        pages,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore,
        },
    }

    // Cache for 5 minutes
    await cacheSet(cacheKey, result, 300)

    return result
}

/**
 * Update page
 */
export async function updatePage(
    tenantId: string,
    pageId: string,
    authorId: string,
    data: UpdatePageInput
) {
    const existing = await prisma.page.findFirst({
        where: { id: pageId, tenantId },
    })

    if (!existing) {
        throw new NotFoundError('Page not found')
    }

    // If slug is being updated, check uniqueness
    if (data.slug && data.slug !== existing.slug) {
        const duplicate = await prisma.page.findFirst({
            where: { tenantId, slug: data.slug },
        })

        if (duplicate) {
            throw new BadRequestError(`Page with slug "${data.slug}" already exists`)
        }
    }

    // If setting as home page, unset current home page
    if (data.isHomePage && !existing.isHomePage) {
        await prisma.page.updateMany({
            where: { tenantId, isHomePage: true },
            data: { isHomePage: false },
        })
    }

    // Verify parent page exists if provided
    if (data.parentId && data.parentId !== existing.parentId) {
        const parent = await prisma.page.findFirst({
            where: { id: data.parentId, tenantId },
        })

        if (!parent) {
            throw new NotFoundError('Parent page not found')
        }

        // Prevent circular reference
        if (data.parentId === pageId) {
            throw new BadRequestError('Page cannot be its own parent')
        }
    }

    const page = await prisma.page.update({
        where: { id: pageId },
        data: {
            title: data.title,
            slug: data.slug,
            content: data.content as any,
            htmlContent: data.htmlContent,
            template: data.template,
            status: data.status,
            publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
            isHomePage: data.isHomePage,
            parentId: data.parentId,
            order: data.order,
            metaTitle: data.metaTitle,
            metaDescription: data.metaDescription,
            ogImage: data.ogImage,
        },
        include: {
            parent: true,
            children: {
                orderBy: { order: 'asc' },
            },
        },
    })

    // Invalidate cache
    await invalidatePageCache(tenantId)

    return page
}

/**
 * Publish or unpublish a page
 */
export async function publishPage(
    tenantId: string,
    pageId: string,
    data: PublishPageInput
) {
    const existing = await prisma.page.findFirst({
        where: { id: pageId, tenantId },
    })

    if (!existing) {
        throw new NotFoundError('Page not found')
    }

    const page = await prisma.page.update({
        where: { id: pageId },
        data: {
            status: 'published',
            publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        },
        include: {
            parent: true,
            children: {
                orderBy: { order: 'asc' },
            },
        },
    })

    // Invalidate cache
    await invalidatePageCache(tenantId)

    return page
}

/**
 * Reorder pages
 */
export async function reorderPages(tenantId: string, data: ReorderPagesInput) {
    const { pages } = data

    // Verify all pages exist and belong to tenant
    const pageRecords = await prisma.page.findMany({
        where: {
            id: { in: pages.map((p) => p.id) },
            tenantId,
        },
    })

    if (pageRecords.length !== pages.length) {
        throw new BadRequestError('Some pages not found')
    }

    // Update order for each page
    await Promise.all(
        pages.map((p) =>
            prisma.page.update({
                where: { id: p.id },
                data: { order: p.order },
            })
        )
    )

    // Invalidate cache
    await invalidatePageCache(tenantId)

    return { success: true, updated: pages.length }
}

/**
 * Delete page
 */
export async function deletePage(tenantId: string, pageId: string) {
    const existing = await prisma.page.findFirst({
        where: { id: pageId, tenantId },
        include: {
            children: true,
        },
    })

    if (!existing) {
        throw new NotFoundError('Page not found')
    }

    // Check if page has children
    if (existing.children.length > 0) {
        throw new BadRequestError(
            `Cannot delete page "${existing.title}" because it has ${existing.children.length} child pages. Delete child pages first.`
        )
    }

    await prisma.page.delete({
        where: { id: pageId },
    })

    // Invalidate cache
    await invalidatePageCache(tenantId)

    return { success: true }
}

/**
 * Get page tree (hierarchical structure)
 */
export async function getPageTree(tenantId: string, includeUnpublished = false) {
    const cacheKey = `pages:${tenantId}:tree:${includeUnpublished}`
    const cached = await cacheGet<any>(cacheKey)

    if (cached) {
        return cached
    }

    const where: any = { tenantId, parentId: null }

    if (!includeUnpublished) {
        where.status = 'published'
    }

    const pages = await prisma.page.findMany({
        where,
        include: {
            children: {
                where: includeUnpublished ? {} : { status: 'published' },
                orderBy: { order: 'asc' },
                include: {
                    children: {
                        where: includeUnpublished ? {} : { status: 'published' },
                        orderBy: { order: 'asc' },
                    },
                },
            },
        },
        orderBy: { order: 'asc' },
    })

    // Cache for 10 minutes
    await cacheSet(cacheKey, pages, 600)

    return pages
}

/**
 * Invalidate page cache for a tenant
 */
async function invalidatePageCache(tenantId: string) {
    // This is a simple implementation
    // In production, you'd want to track all cache keys more systematically
    await cacheDel(`page:*`)
    await cacheDel(`pages:${tenantId}:*`)
}

/**
 * Generate slug from title
 */
function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-\/]/g, '') // Keep slashes for hierarchy
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}
