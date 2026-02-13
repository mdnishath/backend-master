import { buildApp } from './app.js'
import { env } from './config/env.js'
import { startAllWorkers } from './infra/queue/workers.js'

async function main() {
    const app = await buildApp()

    try {
        // Start background workers
        try {
            startAllWorkers()
            app.log.info('✅ Background workers started')
        } catch (err) {
            app.log.warn('⚠️  Background workers failed to start (Redis may be unavailable)')
        }

        await app.listen({ port: env.PORT, host: env.HOST })

        console.log(`
╔══════════════════════════════════════════════════╗
║       🚀 Enterprise SaaS Backend Running        ║
╠══════════════════════════════════════════════════╣
║  Server:  http://${env.HOST}:${env.PORT}                  ║
║  Docs:    http://localhost:${env.PORT}/docs              ║
║  Health:  http://localhost:${env.PORT}/health            ║
║  Mode:    ${env.NODE_ENV.padEnd(39)}║
╚══════════════════════════════════════════════════╝
    `)
    } catch (err) {
        app.log.error(err)
        process.exit(1)
    }
}

main()
