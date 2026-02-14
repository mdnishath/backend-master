#!/usr/bin/env tsx

// ────────────────────────────────────────────────────────────────
// Enterprise SaaS Backend - Interactive Setup Wizard
// Guided configuration for custom setups
// ────────────────────────────────────────────────────────────────

import { createInterface } from 'readline'
import { writeFile, readFile } from 'fs/promises'
import { randomBytes } from 'crypto'

const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
})

// ─── Helper Functions ─────────────────────────────────────────

function question(query: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(query, resolve)
    })
}

function generateSecret(length = 32): string {
    return randomBytes(length).toString('base64')
}

function printHeader(text: string) {
    console.log('\n' + '═'.repeat(60))
    console.log(`  ${text}`)
    console.log('═'.repeat(60) + '\n')
}

function printSuccess(text: string) {
    console.log(`✓ ${text}`)
}

function printInfo(text: string) {
    console.log(`ℹ ${text}`)
}

// ─── Configuration Interface ──────────────────────────────────

interface Config {
    // Server
    port: number
    host: string
    nodeEnv: 'development' | 'production' | 'test'

    // Database
    dbType: 'postgresql' | 'mysql' | 'sqlite'
    dbHost: string
    dbPort: number
    dbName: string
    dbUser: string
    dbPassword: string

    // Redis
    useRedis: boolean
    redisHost: string
    redisPort: number

    // JWT
    jwtSecret: string
    jwtAccessExpiry: string
    jwtRefreshExpiry: string

    // Upload
    uploadDir: string
    maxFileSize: number

    // Logging
    logLevel: 'debug' | 'info' | 'warn' | 'error'

    // Admin
    adminEmail: string
    adminPassword: string

    // Deployment
    deploymentType: 'docker' | 'manual' | 'railway' | 'render'
}

// ─── Main Wizard ──────────────────────────────────────────────

async function runWizard() {
    printHeader('🎨 Enterprise SaaS Backend - Setup Wizard')

    console.log('This wizard will guide you through configuring your backend.\n')
    console.log('Press Enter to use default values shown in [brackets].\n')

    const config: Partial<Config> = {}

    // ─── Server Configuration ─────────────────────────────────

    printHeader('1️⃣  Server Configuration')

    const port = await question('Server port [3000]: ')
    config.port = port ? parseInt(port, 10) : 3000

    const host = await question('Server host [0.0.0.0]: ')
    config.host = host || '0.0.0.0'

    const nodeEnv = await question('Environment (development/production/test) [development]: ')
    config.nodeEnv = (nodeEnv || 'development') as Config['nodeEnv']

    printSuccess(`Server will run on ${config.host}:${config.port}`)

    // ─── Database Configuration ───────────────────────────────

    printHeader('2️⃣  Database Configuration')

    const dbType = await question('Database type (postgresql/mysql/sqlite) [postgresql]: ')
    config.dbType = (dbType || 'postgresql') as Config['dbType']

    if (config.dbType === 'sqlite') {
        config.dbHost = 'localhost'
        config.dbPort = 0
        config.dbName = 'enterprise_saas.db'
        config.dbUser = ''
        config.dbPassword = ''
        printInfo('SQLite will use local file: enterprise_saas.db')
    } else {
        const dbHost = await question(`${config.dbType} host [localhost]: `)
        config.dbHost = dbHost || 'localhost'

        const defaultPort = config.dbType === 'postgresql' ? 5432 : 3306
        const dbPort = await question(`${config.dbType} port [${defaultPort}]: `)
        config.dbPort = dbPort ? parseInt(dbPort, 10) : defaultPort

        const dbName = await question('Database name [enterprise_saas]: ')
        config.dbName = dbName || 'enterprise_saas'

        const dbUser = await question(`Database user [${config.dbType === 'postgresql' ? 'postgres' : 'root'}]: `)
        config.dbUser = dbUser || (config.dbType === 'postgresql' ? 'postgres' : 'root')

        const dbPassword = await question('Database password (leave empty to generate): ')
        config.dbPassword = dbPassword || randomBytes(12).toString('base64').slice(0, 16)

        printSuccess(`Database: ${config.dbType}://${config.dbUser}@${config.dbHost}:${config.dbPort}/${config.dbName}`)
    }

    // ─── Redis Configuration ──────────────────────────────────

    printHeader('3️⃣  Redis Configuration (Optional)')

    printInfo('Redis is used for caching and background jobs.')
    printInfo('You can skip this and the system will work with graceful degradation.')

    const useRedis = await question('Use Redis? (y/n) [y]: ')
    config.useRedis = !useRedis || useRedis.toLowerCase() === 'y'

    if (config.useRedis) {
        const redisHost = await question('Redis host [localhost]: ')
        config.redisHost = redisHost || 'localhost'

        const redisPort = await question('Redis port [6379]: ')
        config.redisPort = redisPort ? parseInt(redisPort, 10) : 6379

        printSuccess(`Redis: ${config.redisHost}:${config.redisPort}`)
    } else {
        config.redisHost = 'localhost'
        config.redisPort = 6379
        printInfo('Redis disabled - caching and background jobs will be skipped')
    }

    // ─── JWT Configuration ────────────────────────────────────

    printHeader('4️⃣  JWT Configuration')

    printInfo('JWT secret will be auto-generated for security.')
    config.jwtSecret = generateSecret(32)

    const jwtAccessExpiry = await question('Access token expiry [15m]: ')
    config.jwtAccessExpiry = jwtAccessExpiry || '15m'

    const jwtRefreshExpiry = await question('Refresh token expiry [7d]: ')
    config.jwtRefreshExpiry = jwtRefreshExpiry || '7d'

    printSuccess(`JWT: Access=${config.jwtAccessExpiry}, Refresh=${config.jwtRefreshExpiry}`)

    // ─── File Upload Configuration ────────────────────────────

    printHeader('5️⃣  File Upload Configuration')

    const uploadDir = await question('Upload directory [uploads]: ')
    config.uploadDir = uploadDir || 'uploads'

    const maxFileSize = await question('Max file size in MB [10]: ')
    config.maxFileSize = maxFileSize ? parseInt(maxFileSize, 10) * 1024 * 1024 : 10485760

    printSuccess(`Files: ${config.uploadDir}/ (max ${(config.maxFileSize / 1048576).toFixed(0)}MB)`)

    // ─── Logging Configuration ────────────────────────────────

    printHeader('6️⃣  Logging Configuration')

    const logLevel = await question('Log level (debug/info/warn/error) [info]: ')
    config.logLevel = (logLevel || 'info') as Config['logLevel']

    printSuccess(`Log level: ${config.logLevel}`)

    // ─── Admin User ───────────────────────────────────────────

    printHeader('7️⃣  Admin User Configuration')

    const adminEmail = await question('Admin email [admin@example.com]: ')
    config.adminEmail = adminEmail || 'admin@example.com'

    const adminPassword = await question('Admin password (leave empty to generate): ')
    config.adminPassword = adminPassword || randomBytes(12).toString('base64').slice(0, 16)

    printSuccess(`Admin: ${config.adminEmail}`)

    // ─── Deployment Type ──────────────────────────────────────

    printHeader('8️⃣  Deployment Type')

    console.log('Choose your deployment method:')
    console.log('  1. Docker (recommended)')
    console.log('  2. Manual (Node.js directly)')
    console.log('  3. Railway (one-click deploy)')
    console.log('  4. Render (one-click deploy)')

    const deployType = await question('Select (1-4) [1]: ')
    const deployMap: { [key: string]: Config['deploymentType'] } = {
        '1': 'docker',
        '2': 'manual',
        '3': 'railway',
        '4': 'render',
    }
    config.deploymentType = deployMap[deployType || '1'] || 'docker'

    printSuccess(`Deployment: ${config.deploymentType}`)

    // ─── Generate Files ───────────────────────────────────────

    printHeader('9️⃣  Generating Configuration Files')

    await generateEnvFile(config as Config)
    if (config.deploymentType === 'docker') {
        await generateDockerComposeFile(config as Config)
    }

    printSuccess('Configuration files generated!')

    // ─── Summary ──────────────────────────────────────────────

    printHeader('✨ Setup Complete!')

    console.log('\n📋 Summary:')
    console.log(`   Environment:  ${config.nodeEnv}`)
    console.log(`   Server:       ${config.host}:${config.port}`)
    console.log(`   Database:     ${config.dbType}`)
    console.log(`   Redis:        ${config.useRedis ? 'Enabled' : 'Disabled'}`)
    console.log(`   Deployment:   ${config.deploymentType}`)
    console.log('\n🔐 Credentials saved to:')
    console.log('   • .env')
    if (config.dbPassword) {
        console.log(`   • Database password: ${config.dbPassword}`)
    }
    console.log(`   • Admin password: ${config.adminPassword}`)
    console.log('\n📚 Next Steps:')

    if (config.deploymentType === 'docker') {
        console.log('   1. Run: docker-compose up -d')
        console.log('   2. Run: npm run db:migrate')
        console.log('   3. Run: npm run seed')
        console.log('   4. Visit: http://localhost:' + config.port + '/docs')
    } else {
        console.log('   1. Install dependencies: npm install')
        console.log('   2. Run migrations: npm run db:migrate')
        console.log('   3. Seed database: npm run seed')
        console.log('   4. Start server: npm run dev')
        console.log('   5. Visit: http://localhost:' + config.port + '/docs')
    }

    console.log('\n🎉 Happy coding!\n')

    rl.close()
}

// ─── File Generators ──────────────────────────────────────────

async function generateEnvFile(config: Config) {
    const dbUrl = config.dbType === 'sqlite'
        ? 'file:./enterprise_saas.db'
        : `${config.dbType}://${config.dbUser}:${config.dbPassword}@${config.dbHost}:${config.dbPort}/${config.dbName}`

    const envContent = `# ────────────────────────────────────────────────────────────────
# Auto-generated by setup-wizard.ts on ${new Date().toISOString()}
# ────────────────────────────────────────────────────────────────

# ─── Server Configuration ─────────────────────────────────────
PORT=${config.port}
HOST=${config.host}
NODE_ENV=${config.nodeEnv}

# ─── Database Configuration ───────────────────────────────────
DATABASE_URL=${dbUrl}
${config.dbType !== 'sqlite' ? `POSTGRES_DB=${config.dbName}
POSTGRES_USER=${config.dbUser}
POSTGRES_PASSWORD=${config.dbPassword}
POSTGRES_PORT=${config.dbPort}` : ''}

# ─── JWT Configuration ────────────────────────────────────────
JWT_SECRET=${config.jwtSecret}
JWT_ACCESS_EXPIRY=${config.jwtAccessExpiry}
JWT_REFRESH_EXPIRY=${config.jwtRefreshExpiry}

# ─── Redis Configuration ──────────────────────────────────────
${config.useRedis ? `REDIS_URL=redis://${config.redisHost}:${config.redisPort}` : '# Redis disabled'}
${config.useRedis ? `REDIS_PORT=${config.redisPort}` : ''}

# ─── File Upload Configuration ────────────────────────────────
UPLOAD_DIR=${config.uploadDir}
MAX_FILE_SIZE=${config.maxFileSize}

# ─── Logging Configuration ────────────────────────────────────
LOG_LEVEL=${config.logLevel}

# ─── Admin Credentials ────────────────────────────────────────
ADMIN_EMAIL=${config.adminEmail}
ADMIN_PASSWORD=${config.adminPassword}
`

    await writeFile('.env', envContent, 'utf-8')
    printSuccess('.env file created')
}

async function generateDockerComposeFile(config: Config) {
    if (config.dbType === 'sqlite') {
        printInfo('SQLite doesn\'t need Docker - skipping docker-compose.yml')
        return
    }

    const composeContent = `# ────────────────────────────────────────────────────────────────
# Auto-generated by setup-wizard.ts on ${new Date().toISOString()}
# ────────────────────────────────────────────────────────────────

version: '3.8'

services:
  # ─── Database ─────────────────────────────────────────────────
  ${config.dbType}:
    image: ${config.dbType}:${config.dbType === 'postgresql' ? '15-alpine' : '8-alpine'}
    container_name: backend-${config.dbType}
    restart: unless-stopped
    environment:
      ${config.dbType === 'postgresql' ? `POSTGRES_DB: ${config.dbName}
      POSTGRES_USER: ${config.dbUser}
      POSTGRES_PASSWORD: ${config.dbPassword}` : `MYSQL_ROOT_PASSWORD: ${config.dbPassword}
      MYSQL_DATABASE: ${config.dbName}
      MYSQL_USER: ${config.dbUser}
      MYSQL_PASSWORD: ${config.dbPassword}`}
    ports:
      - "${config.dbPort}:${config.dbType === 'postgresql' ? '5432' : '3306'}"
    volumes:
      - db_data:/var/lib/${config.dbType === 'postgresql' ? 'postgresql' : 'mysql'}/data
    healthcheck:
      test: ${config.dbType === 'postgresql' ? `["CMD-SHELL", "pg_isready -U ${config.dbUser}"]` : `["CMD", "mysqladmin", "ping", "-h", "localhost"]`}
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend-network

${config.useRedis ? `  # ─── Redis Cache ─────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: backend-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    ports:
      - "${config.redisPort}:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend-network
` : ''}
  # ─── Backend API ──────────────────────────────────────────────
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: backend-api
    restart: unless-stopped
    ports:
      - "${config.port}:${config.port}"
    environment:
      PORT: ${config.port}
      HOST: ${config.host}
      NODE_ENV: ${config.nodeEnv}
      DATABASE_URL: ${config.dbType}://${config.dbUser}:${config.dbPassword}@${config.dbType}:${config.dbType === 'postgresql' ? '5432' : '3306'}/${config.dbName}
      ${config.useRedis ? `REDIS_URL: redis://redis:6379` : ''}
      JWT_SECRET: ${config.jwtSecret}
      JWT_ACCESS_EXPIRY: ${config.jwtAccessExpiry}
      JWT_REFRESH_EXPIRY: ${config.jwtRefreshExpiry}
      UPLOAD_DIR: ${config.uploadDir}
      MAX_FILE_SIZE: ${config.maxFileSize}
      LOG_LEVEL: ${config.logLevel}
    volumes:
      - ./${config.uploadDir}:/app/${config.uploadDir}
    depends_on:
      ${config.dbType}:
        condition: service_healthy
${config.useRedis ? `      redis:
        condition: service_healthy` : ''}
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:${config.port}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - backend-network

volumes:
  db_data:
    driver: local
${config.useRedis ? `  redis_data:
    driver: local` : ''}

networks:
  backend-network:
    driver: bridge
`

    await writeFile('docker-compose.yml', composeContent, 'utf-8')
    printSuccess('docker-compose.yml created')
}

// ─── Run Wizard ───────────────────────────────────────────────

runWizard().catch((error) => {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
})
