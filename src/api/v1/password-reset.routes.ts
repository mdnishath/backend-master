import type { FastifyInstance } from 'fastify'
import * as passwordResetService from '../../core/auth/password-reset.service.js'
import { authGuard } from '../middleware/auth.guard.js'
import { successResponse } from '../../shared/response.js'

export async function passwordResetRoutes(app: FastifyInstance) {
    // ─── REQUEST PASSWORD RESET ────────────────────────────────
    app.post('/forgot-password', {
        schema: {
            description: 'Request a password reset link',
            tags: ['Auth'],
            body: {
                type: 'object',
                required: ['email'],
                properties: {
                    email: { type: 'string', format: 'email' },
                },
            },
        },
        handler: async (request, reply) => {
            const { email } = request.body as { email: string }
            const data = await passwordResetService.requestPasswordReset(email)
            return reply.send(successResponse(data))
        },
    })

    // ─── RESET PASSWORD ────────────────────────────────────────
    app.post('/reset-password', {
        schema: {
            description: 'Reset password using reset token',
            tags: ['Auth'],
            body: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                    token: { type: 'string' },
                    newPassword: { type: 'string', minLength: 8 },
                },
            },
        },
        handler: async (request, reply) => {
            const { token, newPassword } = request.body as { token: string; newPassword: string }
            const data = await passwordResetService.resetPassword(token, newPassword)
            return reply.send(successResponse(data))
        },
    })

    // ─── CHANGE PASSWORD (authenticated) ───────────────────────
    app.post('/change-password', {
        schema: {
            description: 'Change password for authenticated user',
            tags: ['Auth'],
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                    currentPassword: { type: 'string' },
                    newPassword: { type: 'string', minLength: 8 },
                },
            },
        },
        preHandler: authGuard,
        handler: async (request, reply) => {
            const { currentPassword, newPassword } = request.body as {
                currentPassword: string
                newPassword: string
            }
            const data = await passwordResetService.changePassword(
                request.user.id,
                currentPassword,
                newPassword,
            )
            return reply.send(successResponse(data))
        },
    })
}
