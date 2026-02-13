/**
 * Phase 2 API Test — run with: npx tsx --env-file=.env tests/phase2-test.ts
 */
export { }
const BASE_URL = 'http://localhost:3000'

async function request(method: string, path: string, body?: object, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
    return { status: res.status, data: await res.json() }
}

function log(label: string, r: { status: number; data: unknown }) {
    const ok = r.status < 400
    console.log(`${ok ? '✅' : '❌'} [${r.status}] ${label}`)
    if (!ok) console.log(JSON.stringify(r.data, null, 2).slice(0, 300))
    console.log('---')
}

async function main() {
    console.log('🏢 Phase 2 API Tests\n')

    // 1. Register + Login to get a token
    const reg = await request('POST', '/api/v1/auth/register', {
        email: 'phase2-test@example.com',
        password: 'TestPassword123',
        firstName: 'Phase2',
        lastName: 'Tester',
        tenantName: 'Phase2 Tenant',
    })
    const accessToken = reg.data?.data?.accessToken
    if (!accessToken) {
        // Try login if already registered
        const login = await request('POST', '/api/v1/auth/login', {
            email: 'phase2-test@example.com',
            password: 'TestPassword123',
        })
        var token = login.data?.data?.accessToken
    } else {
        var token = accessToken
    }
    console.log(`🔑 Got token: ${token ? '✅' : '❌'}\n`)

    // 2. Audit Logs — GET
    const auditLogs = await request('GET', '/api/v1/audit-logs?page=1&limit=10', undefined, token)
    log('GET Audit Logs', auditLogs)

    // 3. File Upload — we'll test the list endpoint (no files yet)
    const fileList = await request('GET', '/api/v1/files?page=1&limit=10', undefined, token)
    log('GET Files List', fileList)

    // 4. Job Stats — requires Redis (may fail gracefully)
    try {
        const jobStats = await request('GET', '/api/v1/jobs/stats', undefined, token)
        log('GET Job Stats', jobStats)
    } catch (err) {
        console.log('⚠️  Job stats endpoint — Redis not available (expected)')
        console.log('---')
    }

    // 5. Health check (should show DB connected)
    const health = await request('GET', '/health')
    log('Health Check', health)

    // 6. Swagger docs accessible
    const docsRes = await fetch(`${BASE_URL}/docs`)
    console.log(`${docsRes.status === 200 ? '✅' : '❌'} [${docsRes.status}] Swagger UI accessible`)
    console.log('---')

    // 7. Rate limiting — make rapid requests
    console.log('🔄 Testing rate limiting (10 rapid requests)...')
    let rateLimited = false
    for (let i = 0; i < 10; i++) {
        const r = await fetch(`${BASE_URL}/health`)
        if (r.status === 429) {
            rateLimited = true
            console.log(`✅ Rate limiting active (hit 429 on request ${i + 1})`)
            break
        }
    }
    if (!rateLimited) console.log('ℹ️  Rate limit not hit (100/min threshold)')
    console.log('---')

    console.log('\n🏁 Phase 2 API Tests Complete!')
}

main().catch(console.error)
