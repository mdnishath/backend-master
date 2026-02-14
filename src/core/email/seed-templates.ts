import { readFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '../../infra/database/prisma.js'

const TEMPLATES_DIR = join(process.cwd(), 'src', 'core', 'email', 'templates')

interface TemplateDefinition {
    name: string
    subject: string
    filename: string
    variables: string[]
}

const DEFAULT_TEMPLATES: TemplateDefinition[] = [
    {
        name: 'welcome',
        subject: 'Welcome to {{appName}}!',
        filename: 'welcome.html',
        variables: ['name', 'appName', 'dashboardUrl', 'year'],
    },
    {
        name: 'password-reset',
        subject: 'Reset Your Password',
        filename: 'password-reset.html',
        variables: ['name', 'appName', 'resetLink', 'expiryMinutes', 'year'],
    },
]

/**
 * Seed default email templates into database
 */
export async function seedEmailTemplates(tenantId?: string) {
    console.log('📧 Seeding email templates...')

    for (const template of DEFAULT_TEMPLATES) {
        try {
            const htmlPath = join(TEMPLATES_DIR, template.filename)
            const htmlBody = await readFile(htmlPath, 'utf-8')

            // Create or update template
            const tid = tenantId === undefined ? null : tenantId
            await prisma.emailTemplate.upsert({
                where: {
                    tenantId_name: {
                        tenantId: tid!,
                        name: template.name,
                    },
                },
                update: {
                    subject: template.subject,
                    htmlBody,
                    variables: template.variables as any,
                    isActive: true,
                },
                create: {
                    tenantId: tid,
                    name: template.name,
                    subject: template.subject,
                    htmlBody,
                    variables: template.variables as any,
                    isActive: true,
                },
            })

            console.log(`  ✓ ${template.name} template ${tenantId ? '(tenant-specific)' : '(global)'}`)
        } catch (error) {
            console.error(`  ✗ Failed to seed ${template.name}:`, error)
        }
    }

    console.log('✅ Email templates seeded successfully\n')
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedEmailTemplates()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Failed to seed templates:', error)
            process.exit(1)
        })
}
