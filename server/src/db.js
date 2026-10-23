import pg from 'pg'

const { Pool } = pg

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://lifekeeper_admin:lifekeeper_secure_password_2026@postgres:5432/lifekeeper_vault'

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('[DB ERROR] Error inesperado en el pool de PostgreSQL:', err.message)
})

export async function query(text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  if (process.env.DEBUG_SQL) {
    console.log(`[SQL DEBUG] ${text} [${duration}ms]`)
  }
  return res
}
