import { z } from 'zod'

export const createRoleSchema = z.object({
    name: z.string().min(2, 'Role name must be at least 2 characters'),
    description: z.string().optional(),
})

export const updateRoleSchema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
})

export const assignPermissionsSchema = z.object({
    permissionIds: z.array(z.string()).min(1, 'At least one permission required'),
})

export const assignRoleSchema = z.object({
    roleId: z.string().min(1, 'Role ID is required'),
})

export const paginationSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>
export type AssignRoleInput = z.infer<typeof assignRoleSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
