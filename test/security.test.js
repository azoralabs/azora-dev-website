import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1:1/test'
process.env.APP_ORIGIN = 'http://127.0.0.1:5190'
process.env.NODE_ENV = 'test'

const {
  hashPassword,
  hashSessionToken,
  sessionCookieOptions,
  verifyPassword,
} = await import('../server/security.js')

test('password hashes are salted and verify in constant-time comparison flow', async () => {
  const first = await hashPassword('a-production-password')
  const second = await hashPassword('a-production-password')

  assert.match(first, /^scrypt\$16384\$8\$1\$/)
  assert.notEqual(first, second)
  assert.equal(await verifyPassword('a-production-password', first), true)
  assert.equal(await verifyPassword('wrong-password', first), false)
  assert.equal(await verifyPassword('anything', 'not-a-valid-hash'), false)
})

test('session tokens are stored as deterministic SHA-256 hashes', () => {
  const hash = hashSessionToken('opaque-session-token')
  assert.match(hash, /^[a-f0-9]{64}$/)
  assert.equal(hash, hashSessionToken('opaque-session-token'))
  assert.notEqual(hash, hashSessionToken('other-session-token'))
})

test('session cookies are HttpOnly and same-site', () => {
  const expires = new Date('2030-01-01T00:00:00Z')
  assert.deepEqual(sessionCookieOptions(expires), {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    expires,
  })
})
