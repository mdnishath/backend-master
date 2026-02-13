import { z } from 'zod'

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),

    REDIS_URL: z.string().default('redis://localhost:6379'),

    UPLOAD_DIR: z.string().default('uploads'),
    MAX_FILE_SIZE: z.coerce.number().default(10485760), // 10MB

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

function validateEnv() {
    const result = envSchema.safeParse(process.env)

    if (!result.success) {
        console.error('❌ Invalid environment variables:')
        console.error(z.prettifyError(result.error))
        process.exit(1)
    }

    return result.data
}

export const env = validateEnv()

export type Env = z.infer<typeof envSchema>
