export interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    message?: string
    error?: {
        code: string
        details?: unknown
    }
    meta?: {
        page?: number
        limit?: number
        total?: number
        totalPages?: number
    }
}

export function successResponse<T>(data: T, message?: string, meta?: ApiResponse['meta']): ApiResponse<T> {
    return {
        success: true,
        data,
        ...(message && { message }),
        ...(meta && { meta }),
    }
}

export function errorResponse(message: string, code: string, details?: unknown): ApiResponse {
    return {
        success: false,
        message,
        error: {
            code,
            ...(details !== undefined ? { details } : {}),
        },
    }
}

export function paginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
): ApiResponse<T[]> {
    return {
        success: true,
        data,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    }
}
