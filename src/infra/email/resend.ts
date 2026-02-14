import { Resend } from 'resend'
import { env } from '../../config/env.js'

// Initialize Resend client
// In development, API key is optional (logs to console instead)
export const resend = env.RESEND_API_KEY
    ? new Resend(env.RESEND_API_KEY)
    : null

// Check if email service is available
export const isEmailEnabled = !!env.RESEND_API_KEY

// Email configuration
export const emailConfig = {
    from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
    fromName: env.EMAIL_FROM_NAME,
    fromEmail: env.EMAIL_FROM,
}

// For development: log emails to console instead of sending
export function logEmailToConsole(email: {
    to: string | string[]
    subject: string
    html: string
    text?: string
}) {
    console.log('\n📧 ═══════════════════════════════════════════════════')
    console.log('📬 EMAIL (Development Mode - Not Sent)')
    console.log('═══════════════════════════════════════════════════')
    console.log('To:', email.to)
    console.log('Subject:', email.subject)
    console.log('─────────────────────────────────────────────────────')
    console.log('HTML Body:')
    console.log(email.html)
    if (email.text) {
        console.log('─────────────────────────────────────────────────────')
        console.log('Text Body:')
        console.log(email.text)
    }
    console.log('═══════════════════════════════════════════════════\n')
}
