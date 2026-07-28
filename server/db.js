import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { config, isProduction } from './config.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 15,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: isProduction && !config.databaseUrl.includes('@postgres:')
    ? { rejectUnauthorized: true }
    : false,
})

export const query = (text, values) => pool.query(text, values)

export async function transaction(work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function migrate() {
  const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url))
  const schema = await fs.readFile(schemaPath, 'utf8')
  await pool.query(schema)
  await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()')
}
