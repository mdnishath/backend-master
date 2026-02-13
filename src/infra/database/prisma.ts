import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { env } from '../../config/env.js'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

// Prisma 7: Requires database adapter (PrismaPg for PostgreSQL)
function createPrismaClient() {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
    const adapter = new PrismaPg(pool)

    return new PrismaClient({
        adapter,
        log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}
