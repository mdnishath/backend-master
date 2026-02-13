import type { FastifyInstance } from 'fastify'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'

export async function swaggerPlugin(app: FastifyInstance) {
    await app.register(fastifySwagger, {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'Enterprise SaaS Backend API',
                description: 'White-label enterprise backend with Auth, RBAC, and Multi-tenancy',
                version: '1.0.0',
                contact: {
                    name: 'API Support',
                },
            },
            servers: [
                {
                    url: 'http://localhost:3000',
                    description: 'Development server',
                },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
            tags: [
                { name: 'Health', description: 'Health check endpoints' },
                { name: 'Auth', description: 'Authentication endpoints' },
                { name: 'RBAC', description: 'Role-based access control' },
            ],
        },
    })

    await app.register(fastifySwaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
            persistAuthorization: true,
        },
    })
}
