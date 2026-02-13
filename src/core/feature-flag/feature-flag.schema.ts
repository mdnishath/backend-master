import { z } from 'zod'

export const createFeatureFlagSchema = z.object({
    key: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Key must be lowercase alphanumeric with hyphens'),
    name: z.string().min(1),
    description: z.string().optional(),
    isEnabled: z.boolean().default(false),
    metadata: z.record(z.string(), z.unknown()).optional(),
})

export const updateFeatureFlagSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    isEnabled: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
})

export const checkFeatureSchema = z.object({
    key: z.string().min(1),
})

export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>
export type CheckFeatureInput = z.infer<typeof checkFeatureSchema>
