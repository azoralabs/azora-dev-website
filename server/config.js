import 'dotenv/config'

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3028),
  databaseUrl: required('DATABASE_URL'),
  appOrigin: required('APP_ORIGIN', 'http://127.0.0.1:5190'),
  sessionDays: Number(process.env.SESSION_DAYS ?? 30),
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
}

export const isProduction = config.nodeEnv === 'production'
