import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_PERMISSIONS = [
    // User management
    { action: 'create', resource: 'user', description: 'Create users' },
    { action: 'read', resource: 'user', description: 'View users' },
    { action: 'update', resource: 'user', description: 'Update users' },
    { action: 'delete', resource: 'user', description: 'Delete users' },

    // Role management
    { action: 'create', resource: 'role', description: 'Create roles' },
    { action: 'read', resource: 'role', description: 'View roles' },
    { action: 'update', resource: 'role', description: 'Update roles' },
    { action: 'delete', resource: 'role', description: 'Delete roles' },

    // Tenant management
    { action: 'create', resource: 'tenant', description: 'Create tenants' },
    { action: 'read', resource: 'tenant', description: 'View tenants' },
    { action: 'update', resource: 'tenant', description: 'Update tenants' },
    { action: 'delete', resource: 'tenant', description: 'Delete tenants' },

    // Permission management
    { action: 'read', resource: 'permission', description: 'View permissions' },
    { action: 'assign', resource: 'permission', description: 'Assign permissions' },
]

async function seed() {
    console.log('🌱 Seeding database...')

    // Create default permissions
    for (const perm of DEFAULT_PERMISSIONS) {
        await prisma.permission.upsert({
            where: {
                action_resource: {
                    action: perm.action,
                    resource: perm.resource,
                },
            },
            update: {},
            create: perm,
        })
    }

    console.log(`✅ Created ${DEFAULT_PERMISSIONS.length} permissions`)
    console.log('🎉 Seeding complete!')
    console.log('')
    console.log('You can now register your first user via:')
    console.log('  POST /api/v1/auth/register')
    console.log('  { email, password, firstName, lastName, tenantName }')
}

seed()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
