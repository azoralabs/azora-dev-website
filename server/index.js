import path from 'node:path'
import { fileURLToPath } from 'node:url'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import authRoutes from './auth-routes.js'
import communityRoutes from './community-routes.js'
import { config, isProduction } from './config.js'
import { migrate, pool, query } from './db.js'
import { protectMutation, sessionMiddleware } from './security.js'

const app = express()
const distPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')

app.set('trust proxy', config.trustProxy)
app.disable('x-powered-by')
app.use(pinoHttp({
  autoLogging: {
    ignore: (request) => request.url === '/api/health',
  },
  redact: ['req.headers.cookie', 'req.headers.authorization'],
}))
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}))
app.use(compression())
app.use(express.json({ limit: '256kb' }))
app.use(cookieParser())
app.use(sessionMiddleware)
app.use('/api', protectMutation)
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
}))

app.get('/api/health', async (_request, response) => {
  await query('SELECT 1')
  response.json({ status: 'ok' })
})
app.use('/api/auth', authRoutes)
app.use('/api', communityRoutes)

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API endpoint not found.' })
})

app.use(express.static(distPath, {
  etag: true,
  maxAge: isProduction ? '1h' : 0,
  setHeaders(response, filePath) {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
  },
}))

app.get('*splat', (_request, response) => {
  response.sendFile(path.join(distPath, 'index.html'))
})

app.use((error, request, response, _next) => {
  request.log.error({ err: error }, 'request failed')
  const status = error.status && Number.isInteger(error.status) ? error.status : 500
  response.status(status).json({
    error: status >= 500 ? 'The server could not complete this request.' : error.message,
  })
})

await migrate()

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Azora Dev listening on ${config.port}`)
})

const shutdown = async () => {
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
