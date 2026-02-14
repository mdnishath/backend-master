import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { AppError, ValidationError, TooManyRequestsError } from '../../shared/errors.js'
import { errorResponse } from '../../shared/response.js'
import { env } from '../../config/env.js'

export async function errorHandlerPlugin(app: FastifyInstance) {
    app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
        // Log the error
        request.log.error({
            err: error,
            url: request.url,
            method: request.method,
        })

        // Handle rate limit errors (429) with special headers
        if (error instanceof TooManyRequestsError) {
            if (error.details && typeof error.details === 'object') {
                const details = error.details as { limit?: number; remaining?: number; reset?: number }
                if (details.limit) reply.header('X-RateLimit-Limit', details.limit)
                if (details.remaining !== undefined) reply.header('X-RateLimit-Remaining', details.remaining)
                if (details.reset) reply.header('X-RateLimit-Reset', details.reset)
                reply.header('Retry-After', details.reset ? Math.ceil(details.reset - Date.now() / 1000) : 60)
            }
            return reply.status(error.statusCode).send(
                errorResponse(error.message, error.code, error.details),
            )
        }

        // Handle validation errors
        if (error instanceof ValidationError) {
            return reply.status(error.statusCode).send(
                errorResponse(error.message, error.code, error.details),
            )
        }

        // Handle all other custom errors
        if (error instanceof AppError) {
            return reply.status(error.statusCode).send(
                errorResponse(error.message, error.code),
            )
        }

        // Handle Fastify validation errors
        if (error.validation) {
            return reply.status(400).send(
                errorResponse('Validation failed', 'VALIDATION_ERROR', error.validation),
            )
        }

        // Handle Prisma known errors
        if (error.name === 'PrismaClientKnownRequestError') {
            const prismaError = error as unknown as { code: string; meta?: { target?: string[] } }

            if (prismaError.code === 'P2002') {
                const target = prismaError.meta?.target?.join(', ') ?? 'field'
                return reply.status(409).send(
                    errorResponse(`A record with this ${target} already exists`, 'CONFLICT'),
                )
            }

            if (prismaError.code === 'P2025') {
                return reply.status(404).send(
                    errorResponse('Record not found', 'NOT_FOUND'),
                )
            }
        }

        // Unknown errors — don't leak internals in production
        const message = env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error.message

        return reply.status(500).send(
            errorResponse(message, 'INTERNAL_ERROR'),
        )
    })
}
