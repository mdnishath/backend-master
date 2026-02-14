export class AppError extends Error {
    public readonly statusCode: number
    public readonly code: string
    public readonly isOperational: boolean

    constructor(message: string, statusCode: number, code: string, isOperational = true) {
        super(message)
        this.statusCode = statusCode
        this.code = code
        this.isOperational = isOperational
        Object.setPrototypeOf(this, new.target.prototype)
    }
}

export class BadRequestError extends AppError {
    constructor(message = 'Bad request', code = 'BAD_REQUEST') {
        super(message, 400, code)
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
        super(message, 401, code)
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', code = 'FORBIDDEN') {
        super(message, 403, code)
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Not found', code = 'NOT_FOUND') {
        super(message, 404, code)
    }
}

export class ConflictError extends AppError {
    constructor(message = 'Conflict', code = 'CONFLICT') {
        super(message, 409, code)
    }
}

export class ValidationError extends AppError {
    public readonly details: unknown

    constructor(message = 'Validation failed', details?: unknown) {
        super(message, 422, 'VALIDATION_ERROR')
        this.details = details
    }
}

export class TooManyRequestsError extends AppError {
    public readonly details: unknown

    constructor(message = 'Too many requests', details?: unknown) {
        super(message, 429, 'TOO_MANY_REQUESTS')
        this.details = details
    }
}
