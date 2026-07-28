import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { query, transaction } from './db.js'
import {
  clearSessionCookie,
  createSession,
  destroySession,
  hashSessionToken,
  hashPassword,
  requireUser,
  setSessionCookie,
  verifyPassword,
} from './security.js'
import { asyncRoute, parseBody, toPublicUser } from './utils.js'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again shortly.' },
})

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase())
const username = z.string()
  .trim()
  .min(3, 'Username must contain at least 3 characters.')
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Use letters, numbers, underscores, or hyphens.')
  .transform((value) => value.toLowerCase())
const password = z.string()
  .min(10, 'Password must contain at least 10 characters.')
  .max(128)

const registerSchema = z.object({
  email,
  username,
  displayName: z.string().trim().min(2).max(60),
  password,
})

const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
})

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(280).default(''),
  location: z.string().trim().max(80).default(''),
  website: z.union([z.literal(''), z.string().trim().url().max(200)]).default(''),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
})

router.get('/session', asyncRoute(async (request, response) => {
  response.json({ user: toPublicUser(request.user) })
}))

router.post('/register', authLimiter, asyncRoute(async (request, response) => {
  const body = parseBody(registerSchema, request, response)
  if (!body) return

  const passwordHash = await hashPassword(body.password)

  try {
    const user = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO users (email, username, display_name, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [body.email, body.username, body.displayName, passwordHash],
      )
      return result.rows[0]
    })

    const session = await createSession(user.id, request)
    setSessionCookie(response, session.token, session.expiresAt)
    response.status(201).json({ user: toPublicUser(user) })
  } catch (error) {
    if (error.code === '23505') {
      return response.status(409).json({
        error: error.constraint?.includes('email')
          ? 'An account already uses this email.'
          : 'This username is already taken.',
      })
    }
    throw error
  }
}))

router.post('/login', authLimiter, asyncRoute(async (request, response) => {
  const body = parseBody(loginSchema, request, response)
  if (!body) return

  const result = await query('SELECT * FROM users WHERE email = $1', [body.email])
  const user = result.rows[0]

  if (!user || !(await verifyPassword(body.password, user.password_hash))) {
    return response.status(401).json({ error: 'Email or password is incorrect.' })
  }

  const session = await createSession(user.id, request)
  setSessionCookie(response, session.token, session.expiresAt)
  await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id])
  response.json({ user: toPublicUser(user) })
}))

router.post('/logout', asyncRoute(async (request, response) => {
  await destroySession(request.sessionToken)
  clearSessionCookie(response)
  response.status(204).end()
}))

router.patch('/profile', requireUser, asyncRoute(async (request, response) => {
  const body = parseBody(profileSchema, request, response)
  if (!body) return

  const result = await query(
    `UPDATE users
     SET display_name = $1, bio = $2, location = $3, website = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [body.displayName, body.bio, body.location, body.website, request.user.id],
  )
  response.json({ user: toPublicUser(result.rows[0]) })
}))

router.post('/change-password', authLimiter, requireUser, asyncRoute(async (request, response) => {
  const body = parseBody(passwordSchema, request, response)
  if (!body) return

  const result = await query('SELECT password_hash FROM users WHERE id = $1', [request.user.id])
  if (!(await verifyPassword(body.currentPassword, result.rows[0].password_hash))) {
    return response.status(401).json({ error: 'Current password is incorrect.' })
  }

  const nextHash = await hashPassword(body.newPassword)
  await transaction(async (client) => {
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [nextHash, request.user.id],
    )
    await client.query(
      'DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2',
      [request.user.id, request.sessionToken ? hashSessionToken(request.sessionToken) : ''],
    )
  })
  response.status(204).end()
}))

export default router
