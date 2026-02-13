import { prisma } from '../../infra/database/prisma.js'
import { hashPassword, verifyPassword } from '../../utils/hash.js'
import { NotFoundError, UnauthorizedError, ValidationError } from '../../shared/errors.js'
import crypto from 'node:crypto'

const RESET_TOKEN_EXPIRY_MINUTES = 60

/**
 * Request a password reset — generates a token and stores it.
 * In production, this would send an email with the reset link.
 */
export async function requestPasswordReset(email: string) {
    const user = await prisma.user.findFirst({ where: { email } })

    // Always return success to prevent email enumeration
    if (!user) {
        return { message: 'If an account exists with this email, a reset link has been sent.' }
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex')
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000)

    // Store hashed token in user record
    await prisma.user.update({
        where: { id: user.id },
        data: {
            resetToken: hashedToken,
            resetTokenExpiresAt: expiresAt,
        },
    })

    // In production: send email with resetToken link
    // For now, return the token (dev only)
    return {
        message: 'If an account exists with this email, a reset link has been sent.',
        // DEV ONLY — remove in production
        resetToken,
        resetUrl: `http://localhost:3000/reset-password?token=${resetToken}`,
    }
}

/**
 * Reset password using a valid reset token.
 */
export async function resetPassword(token: string, newPassword: string) {
    if (newPassword.length < 8) {
        throw new ValidationError('Password must be at least 8 characters')
    }

    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await prisma.user.findFirst({
        where: {
            resetToken: hashedToken,
            resetTokenExpiresAt: { gt: new Date() },
        },
    })

    if (!user) {
        throw new UnauthorizedError('Invalid or expired reset token')
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword)

    // Update password and clear reset token
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            resetToken: null,
            resetTokenExpiresAt: null,
        },
    })

    // Invalidate all refresh tokens for security
    await prisma.refreshToken.deleteMany({
        where: { userId: user.id },
    })

    return { message: 'Password has been reset successfully. Please login again.' }
}

/**
 * Change password for an authenticated user.
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters')
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
        throw new NotFoundError('User not found')
    }

    const isValid = await verifyPassword(user.password, currentPassword)
    if (!isValid) {
        throw new UnauthorizedError('Current password is incorrect')
    }

    const hashedPassword = await hashPassword(newPassword)

    await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
    })

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({
        where: { userId: user.id },
    })

    return { message: 'Password changed successfully. Please login again.' }
}
