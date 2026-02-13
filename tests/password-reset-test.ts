/**
 * Password Reset API Test — run with: npx tsx --env-file=.env tests/password-reset-test.ts
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
    console.log(`${r.status < 400 ? '✅' : '❌'} [${r.status}] ${label}`)
    console.log(JSON.stringify(r.data, null, 2).slice(0, 300))
    console.log('---')
}

async function main() {
    console.log('🔐 Password Reset Flow Test\n')

    // 1. Register a user
    const reg = await request('POST', '/api/v1/auth/register', {
        email: 'reset-test@example.com',
        password: 'OldPassword123',
        firstName: 'Reset',
        lastName: 'Test',
        tenantName: 'Reset Tenant',
    })
    log('Register', reg)

    // 2. Login
    const login = await request('POST', '/api/v1/auth/login', {
        email: 'reset-test@example.com',
        password: 'OldPassword123',
    })
    log('Login', login)
    const accessToken = login.data?.data?.accessToken

    // 3. Request password reset
    const forgot = await request('POST', '/api/v1/auth/forgot-password', {
        email: 'reset-test@example.com',
    })
    log('Forgot Password', forgot)
    const resetToken = forgot.data?.data?.resetToken

    // 4. Reset password with token
    if (resetToken) {
        const reset = await request('POST', '/api/v1/auth/reset-password', {
            token: resetToken,
            newPassword: 'NewPassword456',
        })
        log('Reset Password', reset)

        // 5. Login with new password
        const loginNew = await request('POST', '/api/v1/auth/login', {
            email: 'reset-test@example.com',
            password: 'NewPassword456',
        })
        log('Login with New Password', loginNew)
        const newToken = loginNew.data?.data?.accessToken

        // 6. Change password (authenticated)
        if (newToken) {
            const change = await request('POST', '/api/v1/auth/change-password', {
                currentPassword: 'NewPassword456',
                newPassword: 'FinalPassword789',
            }, newToken)
            log('Change Password', change)

            // 7. Login with final password
            const loginFinal = await request('POST', '/api/v1/auth/login', {
                email: 'reset-test@example.com',
                password: 'FinalPassword789',
            })
            log('Login with Final Password', loginFinal)
        }
    } else {
        console.log('⛔ No reset token returned.')
    }

    // 8. Forgot password for non-existent email (should still return 200)
    const nonExist = await request('POST', '/api/v1/auth/forgot-password', {
        email: 'nonexistent@example.com',
    })
    log('Forgot Password (non-existent email — should be 200)', nonExist)

    console.log('\n🏁 Password reset test complete!')
}

main().catch(console.error)
