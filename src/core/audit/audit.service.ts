import { prisma } from '../../infra/database/prisma.js'
import type { Prisma } from '@prisma/client'

interface AuditEntry {
    action: string
    resource: string
    resourceId?: string
    userId?: string
    tenantId?: string
    metadata?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
}

export async function createAuditLog(entry: AuditEntry) {
    return prisma.auditLog.create({
        data: {
            action: entry.action,
            resource: entry.resource,
            resourceId: entry.resourceId,
            userId: entry.userId,
            tenantId: entry.tenantId,
            metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
        },
    })
}

export async function getAuditLogs(filters: {
    tenantId?: string
    userId?: string
    resource?: string
    action?: string
    page?: number
    limit?: number
}) {
    const { tenantId, userId, resource, action, page = 1, limit = 50 } = filters
    const skip = (page - 1) * limit

    const where = {
        ...(tenantId && { tenantId }),
        ...(userId && { userId }),
        ...(resource && { resource }),
        ...(action && { action }),
    }

    const [data, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.auditLog.count({ where }),
    ])

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    }
}
