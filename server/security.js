import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'
import { config, isProduction } from './config.js'
import { query } from './db.js'

const scrypt = promisify(scryptCallback)
const SESSION_COOKIE = 'azora_session'
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export const hashSessionToken = (value) =>
  createHash('sha256').update(value).digest('hex')

const sha256 = hashSessionToken

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, 64, SCRYPT_OPTIONS)
  return [
    'scrypt',
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt.toString('base64url'),
    Buffer.from(derived).toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, saltText, hashText] = encoded.split('$')
  if (algorithm !== 'scrypt' || !saltText || !hashText) return false
  const expected = Buffer.from(hashText, 'base64url')
  const actual = Buffer.from(await scrypt(
    password,
    Buffer.from(saltText, 'base64url'),
    expected.length,
    {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    },
  ))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function sessionCookieOptions(expiresAt) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  }
}

export async function createSession(userId, request) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + config.sessionDays * 86_400_000)
  const ip = request.ip ?? ''
  const userAgent = String(request.get('user-agent') ?? '').slice(0, 300)

  await query(
    `INSERT INTO sessions
       (token_hash, user_id, expires_at, ip_hash, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenHash, userId, expiresAt, ip ? sha256(ip) : null, userAgent],
  )

  return { token, expiresAt }
}

export async function destroySession(token) {
  if (!token) return
  await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)])
}

export async function sessionMiddleware(request, _response, next) {
  const token = request.cookies?.[SESSION_COOKIE]
  request.user = null
  request.sessionToken = token ?? null

  if (!token) return next()

  try {
    const result = await query(
      `SELECT
         u.id, u.email, u.username, u.display_name, u.bio, u.location,
         u.website, u.role, u.reputation, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [sha256(token)],
    )
    request.user = result.rows[0] ?? null
    if (request.user) {
      query(
        `UPDATE sessions
         SET last_used_at = NOW()
         WHERE token_hash = $1 AND last_used_at < NOW() - INTERVAL '15 minutes'`,
        [sha256(token)],
      ).catch(() => {})
    }
    next()
  } catch (error) {
    next(error)
  }
}

export function setSessionCookie(response, token, expiresAt) {
  response.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt))
}

export function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  })
}

export function requireUser(request, response, next) {
  if (!request.user) {
    return response.status(401).json({ error: 'Sign in to continue.' })
  }
  next()
}

export function requireModerator(request, response, next) {
  if (!request.user || !['moderator', 'admin'].includes(request.user.role)) {
    return response.status(403).json({ error: 'Moderator access required.' })
  }
  next()
}

export function protectMutation(request, response, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return next()
  if (request.get('x-requested-with') !== 'azora-web') {
    return response.status(403).json({ error: 'Invalid request source.' })
  }

  const origin = request.get('origin')
  if (origin && origin !== config.appOrigin) {
    return response.status(403).json({ error: 'Origin is not allowed.' })
  }
  next()
}

export const sessionCookieName = SESSION_COOKIE
