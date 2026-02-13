import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { join, extname } from 'node:path'
import crypto from 'node:crypto'
import { env } from '../../config/env.js'

const UPLOAD_DIR = env.UPLOAD_DIR ?? 'uploads'
const MAX_FILE_SIZE = env.MAX_FILE_SIZE ?? 10 * 1024 * 1024 // 10MB

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true })
}

export interface StoredFile {
    id: string
    originalName: string
    storagePath: string
    mimeType: string
    size: number
    url: string
}

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'text/plain', 'text/csv',
    'application/json',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

/**
 * Store a file from a multipart upload.
 * In production: swap this with S3/MinIO upload.
 */
export async function storeFile(
    fileStream: NodeJS.ReadableStream,
    originalName: string,
    mimeType: string,
): Promise<StoredFile> {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error(`File type ${mimeType} is not allowed`)
    }

    const id = crypto.randomUUID()
    const ext = extname(originalName) || '.bin'
    const fileName = `${id}${ext}`
    const storagePath = join(UPLOAD_DIR, fileName)

    return new Promise((resolve, reject) => {
        let size = 0
        const writeStream = createWriteStream(storagePath)

        fileStream.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > MAX_FILE_SIZE) {
                writeStream.destroy()
                unlink(storagePath).catch(() => { })
                reject(new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`))
            }
        })

        fileStream.pipe(writeStream)

        writeStream.on('finish', () => {
            resolve({
                id,
                originalName,
                storagePath,
                mimeType,
                size,
                url: `/uploads/${fileName}`,
            })
        })

        writeStream.on('error', reject)
    })
}

/**
 * Delete a stored file.
 */
export async function deleteFile(storagePath: string): Promise<void> {
    try {
        await unlink(storagePath)
    } catch {
        // File may already be deleted
    }
}
