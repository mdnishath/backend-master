/**
 * Quick API integration test — run with: npx tsx tests/api-test.ts
 */
export { }
const BASE_URL = 'http://localhost:3000'

async function request(method: string, path: string, body?: object, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    })

    const json = await res.json()
    return { status: res.status, data: json }
}

function log(label: string, result: { status: number; data: unknown }) {
    const icon = result.status < 400 ? '✅' : '❌'
    console.log(`${icon} [${result.status}] ${label}`)
    console.log(JSON.stringify(result.data, null, 2))
    console.log('---')
}

async function main() {
    console.log('🧪 Enterprise SaaS Backend — API Test Suite\n')

    // 1. Health Check
    const health = await request('GET', '/health')
    log('Health Check', health)

    // 2. Register
    const register = await request('POST', '/api/v1/auth/register', {
        email: 'test@example.com',
        password: 'StrongPass123!@#',
        firstName: 'Test',
        lastName: 'User',
        tenantName: 'Test Tenant',
    })
    log('Register', register)

    if (register.status !== 201) {
        console.log('⛔ Registration failed, aborting remaining tests.')
        process.exit(1)
    }

    // 3. Login
    const login = await request('POST', '/api/v1/auth/login', {
        email: 'test@example.com',
        password: 'StrongPass123!@#',
    })
    log('Login', login)

    const accessToken = login.data?.data?.accessToken
    const refreshToken = login.data?.data?.refreshToken

    if (!accessToken) {
        console.log('⛔ Login failed, no access token.')
        process.exit(1)
    }

    // 4. Get Profile (with token)
    const profile = await request('GET', '/api/v1/auth/me', undefined, accessToken)
    log('Get Profile', profile)

    // 5. Get Profile (without token — should fail)
    const noAuth = await request('GET', '/api/v1/auth/me')
    log('Get Profile (no auth — should be 401)', noAuth)

    // 6. List Permissions
    const perms = await request('GET', '/api/v1/permissions', undefined, accessToken)
    log('List Permissions', perms)

    // 7. List Roles
    const roles = await request('GET', '/api/v1/roles', undefined, accessToken)
    log('List Roles', roles)

    // 8. Refresh Token
    const refresh = await request('POST', '/api/v1/auth/refresh', {
        refreshToken,
    })
    log('Refresh Token', refresh)

    // 9. Logout
    const newToken = refresh.data?.data?.accessToken ?? accessToken
    const newRefresh = refresh.data?.data?.refreshToken ?? refreshToken
    const logout = await request('POST', '/api/v1/auth/logout', {
        refreshToken: newRefresh,
    }, newToken)
    log('Logout', logout)

    console.log('\n🏁 Test suite complete!')
}

main().catch(console.error)
