import type { FastifyInstance } from 'fastify'
import * as authService from '../../core/auth/auth.service.js'
import { registerSchema, loginSchema, refreshTokenSchema } from '../../core/auth/auth.schema.js'
import { authGuard } from '../middleware/auth.guard.js'
import { successResponse } from '../../shared/response.js'
import { ValidationError } from '../../shared/errors.js'
import { z } from 'zod'

export async function authRoutes(app: FastifyInstance) {
    // ─── REGISTER ──────────────────────────────────────────────
    app.post('/register', {
        schema: {
            description: 'Register a new user and create a tenant',
            tags: ['Auth'],
            body: {
                type: 'object',
                required: ['email', 'password', 'tenantName'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    tenantName: { type: 'string', minLength: 2 },
                },
            },
        },
        handler: async (request, reply) => {
            const result = registerSchema.safeParse(request.body)
            if (!result.success) {
                throw new ValidationError('Validation failed', z.prettifyError(result.error))
            }

            const data = await authService.register(result.data)
            return reply.status(201).send(successResponse(data, 'Registration successful'))
        },
    })

    // ─── LOGIN ─────────────────────────────────────────────────
    app.post('/login', {
        schema: {
            description: 'Login with email and password',
            tags: ['Auth'],
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                },
            },
        },
        handler: async (request, reply) => {
            const result = loginSchema.safeParse(request.body)
            if (!result.success) {
                throw new ValidationError('Validation failed', z.prettifyError(result.error))
            }

            const data = await authService.login(result.data)
            return reply.send(successResponse(data, 'Login successful'))
        },
    })

    // ─── REFRESH TOKEN ─────────────────────────────────────────
    app.post('/refresh', {
        schema: {
            description: 'Refresh access token using refresh token',
            tags: ['Auth'],
            body: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                    refreshToken: { type: 'string' },
                },
            },
        },
        handler: async (request, reply) => {
            const result = refreshTokenSchema.safeParse(request.body)
            if (!result.success) {
                throw new ValidationError('Validation failed', z.prettifyError(result.error))
            }

            const data = await authService.refreshAccessToken(result.data.refreshToken)
            return reply.send(successResponse(data, 'Token refreshed'))
        },
    })

    // ─── LOGOUT ────────────────────────────────────────────────
    app.post('/logout', {
        schema: {
            description: 'Logout and invalidate refresh token',
            tags: ['Auth'],
            body: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                    refreshToken: { type: 'string' },
                },
            },
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const { refreshToken } = request.body as { refreshToken: string }
            await authService.logout(refreshToken)
            return reply.send(successResponse(null, 'Logged out successfully'))
        },
    })

    // ─── GET PROFILE ───────────────────────────────────────────
    app.get('/me', {
        schema: {
            description: 'Get current user profile',
            tags: ['Auth'],
            security: [{ bearerAuth: [] }],
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const data = await authService.getProfile(request.user.id)
            return reply.send(successResponse(data))
        },
    })
}
