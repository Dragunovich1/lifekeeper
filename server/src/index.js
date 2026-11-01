import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { pool, query } from './db.js'
import { signToken, requireAuth } from './auth.js'
import { sendEmail } from './mailer.js'
import { createMailRouter } from './mailRoutes.js'
import { renderTemplate } from './mailTemplates.js'
import { buildCorsOptions, createRateLimiter, limitBy } from './security.js'
import { createPublicDataRouter } from './publicData.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// Configuración de middlewares
// Detrás de nginx: la IP real del cliente viene en X-Forwarded-For (cantidad de proxies configurable)
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1))
app.use(cors(buildCorsOptions()))
// Solo el registro y la sincronización de la bóveda reciben cuerpos grandes; el resto, 1 MB
app.use(['/api/vault', '/api/auth/register'], express.json({ limit: '50mb' }))
app.use(express.json({ limit: '1mb' }))

// Límites de intentos (en memoria)
const clientIp = (req) => req.ip || req.socket.remoteAddress || 'ip-desconocida'
const MAX_FAILED_LOGINS = 10 // fallos en 15 minutos antes de bloquear la cuenta temporalmente
const ALERT_AFTER_FAILURES = 5
const alertedAt = new Map() // userId -> última alerta de fuerza bruta enviada
app.use('/api/auth/login', limitBy(createRateLimiter({ windowMs: 15 * 60_000, max: 30 }), clientIp))
app.use('/api/auth/register', limitBy(createRateLimiter({ windowMs: 60 * 60_000, max: 10 }), clientIp, 'Demasiados registros desde esta red. Probá más tarde.'))
app.use('/api/auth/salt', limitBy(createRateLimiter({ windowMs: 15 * 60_000, max: 60 }), clientIp))

// Datos públicos de solo lectura (feriados, inflación, ejercicios, MedlinePlus) con caché
app.use('/api/public', createPublicDataRouter())

// Asegurar soporte de columna username para login tanto por usuario como por email
query(`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));
`).catch((err) => console.warn('[DB MIGRATION WARN]:', err.message))

// Ruta de Salud
app.get('/api/health', async (_req, res) => {
  try {
    const dbRes = await query('SELECT NOW() as db_time')
    res.json({
      status: 'ok',
      service: 'lifekeeper-api',
      server_time: new Date().toISOString(),
      database: 'connected',
      db_time: dbRes.rows[0].db_time,
    })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      service: 'lifekeeper-api',
      database: 'disconnected',
      error: err.message,
    })
  }
})

// -----------------------------------------------------------------------------
// 1. OBTENER SALT DE USUARIO (Zero-Knowledge Pre-Login por Email o Username)
// -----------------------------------------------------------------------------
app.get('/api/auth/salt', async (req, res) => {
  const identifier = (req.query.email || req.query.identifier || '').toString().trim().toLowerCase()
  if (!identifier) {
    return res.status(400).json({ error: 'Parámetro email o usuario es requerido' })
  }

  try {
    const result = await query(
      'SELECT email, username, salt FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1 LIMIT 1',
      [identifier],
    )
    if (result.rows.length > 0) {
      return res.json({
        exists: true,
        salt: result.rows[0].salt,
        email: result.rows[0].email,
        username: result.rows[0].username,
      })
    }

    // Si el usuario no existe, devolvemos exists: false
    return res.json({ exists: false, salt: null })
  } catch (err) {
    console.error('[AUTH ERROR] Error al consultar salt:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// -----------------------------------------------------------------------------
// 2. REGISTRO DE CUENTA Y PRIMER SNAPSHOT CIFRADO
// -----------------------------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  const {
    email,
    username,
    auth_hash,
    salt,
    encrypted_data,
    iv,
    auth_tag,
    checksum,
    device_id = 'web-client',
  } = req.body

  if (!email || !auth_hash || !salt || !encrypted_data || !iv || !auth_tag) {
    return res.status(400).json({
      error: 'Campos requeridos incompletos (email, auth_hash, salt, encrypted_data, iv, auth_tag)',
    })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedUsername = username ? username.trim() : null

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Verificar si el usuario ya existe por email o username
    const existing = await client.query(
      'SELECT id, email, username, auth_hash, salt, current_vault_version FROM users WHERE LOWER(email) = $1 OR ($2::text IS NOT NULL AND LOWER(username) = LOWER($2)) LIMIT 1',
      [normalizedEmail, normalizedUsername],
    )
    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0]
      if (existingUser.auth_hash === auth_hash) {
        // Si coincide el hash (mismo dueño vinculando dispositivo), actualizamos username si faltaba y devolvemos sesión
        if (normalizedUsername && !existingUser.username) {
          await client.query('UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2', [
            normalizedUsername,
            existingUser.id,
          ])
        }
        await client.query('COMMIT')
        const token = signToken({ userId: existingUser.id, email: existingUser.email })
        return res.status(200).json({
          success: true,
          token,
          user: { id: existingUser.id, email: existingUser.email, username: normalizedUsername || existingUser.username },
          salt: existingUser.salt,
          vault: {
            version: existingUser.current_vault_version || 1,
            encrypted_data,
            iv,
            auth_tag,
            checksum,
          },
        })
      }
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Ya existe una cuenta con este correo o usuario' })
    }

    // Insertar usuario
    const userRes = await client.query(
      `INSERT INTO users (email, username, auth_hash, salt, current_vault_version)
       VALUES ($1, $2, $3, $4, 1)
       RETURNING id, email, username, created_at`,
      [normalizedEmail, normalizedUsername, auth_hash, salt],
    )
    const user = userRes.rows[0]

    // Insertar snapshot inicial de la bóveda cifrada
    await client.query(
      `INSERT INTO vault_snapshots (user_id, version, encrypted_data, iv, auth_tag, checksum, device_id)
       VALUES ($1, 1, $2, $3, $4, $5, $6)`,
      [user.id, encrypted_data, iv, auth_tag, checksum || 'sha256-init', device_id],
    )

    // Insertar histórico
    await client.query(
      `INSERT INTO vault_history (user_id, version, encrypted_data, iv, checksum, device_id)
       VALUES ($1, 1, $2, $3, $4, $5)`,
      [user.id, encrypted_data, iv, checksum || 'sha256-init', device_id],
    )

    // Auditoría
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const userAgent = req.headers['user-agent'] || 'unknown'
    await client.query(
      `INSERT INTO security_audit_logs (user_id, event_type, ip_address, user_agent)
       VALUES ($1, 'account_created', $2::inet, $3)`,
      [user.id, ip ? ip.split(',')[0].trim() : null, userAgent],
    )

    await client.query('COMMIT')

    const token = signToken({ userId: user.id, email: user.email })

    // Correo de bienvenida (plantilla del servidor); un fallo de correo nunca rompe el registro
    const welcome = renderTemplate('welcome', { name: user.username || user.email.split('@')[0] })
    sendEmail({ to: user.email, subject: welcome.subject, html: welcome.html, text: welcome.text }).catch((err) =>
      console.warn('[MAIL ERROR REGISTRO]:', err.message),
    )

    return res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, username: user.username },
      vault: {
        version: 1,
        encrypted_data,
        iv,
        auth_tag,
        checksum,
      },
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[AUTH REGISTER ERROR]:', err)
    return res.status(500).json({ error: 'Error al registrar usuario', details: err.message })
  } finally {
    client.release()
  }
})

// -----------------------------------------------------------------------------
// 3. INICIO DE SESIÓN (Zero-Knowledge Login por Email o Username)
// -----------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { email, username, auth_hash, device_id = 'web-client' } = req.body
  const identifier = (email || username || '').toString().trim().toLowerCase()

  if (!identifier || !auth_hash) {
    return res.status(400).json({ error: 'Usuario/Email y auth_hash son requeridos' })
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  const userAgent = req.headers['user-agent'] || 'unknown'
  const cleanIp = ip ? ip.split(',')[0].trim() : null

  try {
    const userRes = await query(
      'SELECT id, email, username, auth_hash, salt, current_vault_version FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1 LIMIT 1',
      [identifier],
    )

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const user = userRes.rows[0]

    // Bloqueo temporal si hubo demasiados intentos fallidos recientes sobre esta cuenta
    const recent = await query(
      `SELECT COUNT(*)::int AS n FROM security_audit_logs
       WHERE user_id = $1 AND event_type = 'login_failed' AND created_at > NOW() - INTERVAL '15 minutes'`,
      [user.id],
    )
    const failedRecently = recent.rows[0]?.n ?? 0
    if (failedRecently >= MAX_FAILED_LOGINS) {
      res.set('Retry-After', '900')
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Esperá unos minutos antes de volver a intentar.', retryAfterSec: 900 })
    }

    // Comprobación de hash de autenticación
    if (user.auth_hash !== auth_hash) {
      await query(
        `INSERT INTO security_audit_logs (user_id, event_type, ip_address, user_agent)
         VALUES ($1, 'login_failed', $2::inet, $3)`,
        [user.id, cleanIp, userAgent],
      )
      // Aviso al dueño de la cuenta (como mucho una vez por hora)
      const count = failedRecently + 1
      const last = alertedAt.get(user.id) ?? 0
      if (count >= ALERT_AFTER_FAILURES && Date.now() - last > 3_600_000) {
        alertedAt.set(user.id, Date.now())
        const alert = renderTemplate('brute_force', { failedCount: count, ip: cleanIp ?? 'desconocida' })
        sendEmail({ to: user.email, subject: alert.subject, html: alert.html, text: alert.text }).catch((err) =>
          console.warn('[MAIL ERROR ALERTA]:', err.message),
        )
      }
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    if (username && !user.username) {
      await query('UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2', [
        username.trim(),
        user.id,
      ]).catch(() => undefined)
      user.username = username.trim()
    }

    // Obtener el snapshot más reciente de la bóveda
    const vaultRes = await query(
      `SELECT version, encrypted_data, iv, auth_tag, checksum, updated_at
       FROM vault_snapshots
       WHERE user_id = $1`,
      [user.id],
    )

    const vault = vaultRes.rows[0] || null

    // Registrar inicio de sesión exitoso
    await query(
      `INSERT INTO security_audit_logs (user_id, event_type, ip_address, user_agent)
       VALUES ($1, 'login_success', $2::inet, $3)`,
      [user.id, cleanIp, userAgent],
    )

    const token = signToken({ userId: user.id, email: user.email })

    return res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, username: user.username },
      vault,
    })
  } catch (err) {
    console.error('[AUTH LOGIN ERROR]:', err)
    return res.status(500).json({ error: 'Error al iniciar sesión', details: err.message })
  }
})

// -----------------------------------------------------------------------------
// 4. DESCARGAR ÚLTIMA VERSIÓN DE LA BÓVEDA (Pull Sync)
// -----------------------------------------------------------------------------
app.get('/api/vault/sync', requireAuth, async (req, res) => {
  const userId = req.user.userId

  try {
    const vaultRes = await query(
      `SELECT version, encrypted_data, iv, auth_tag, checksum, device_id, updated_at
       FROM vault_snapshots
       WHERE user_id = $1`,
      [userId],
    )

    if (vaultRes.rows.length === 0) {
      return res.status(404).json({ error: 'Bóveda no encontrada para este usuario' })
    }

    res.json({
      success: true,
      vault: vaultRes.rows[0],
    })
  } catch (err) {
    console.error('[VAULT PULL ERROR]:', err)
    res.status(500).json({ error: 'Error al sincronizar bóveda', details: err.message })
  }
})

// -----------------------------------------------------------------------------
// 5. SUBIR NUEVA VERSIÓN DE LA BÓVEDA (Push Sync)
// -----------------------------------------------------------------------------
app.post('/api/vault/sync', requireAuth, async (req, res) => {
  const userId = req.user.userId
  const { version, encrypted_data, iv, auth_tag, checksum, username, device_id = 'web-client' } = req.body

  if (!encrypted_data || !iv || !auth_tag) {
    return res.status(400).json({ error: 'Campos requeridos incompletos (encrypted_data, iv, auth_tag)' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Upsert en vault_snapshots
    const upsertRes = await client.query(
      `INSERT INTO vault_snapshots (user_id, version, encrypted_data, iv, auth_tag, checksum, device_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         version = EXCLUDED.version,
         encrypted_data = EXCLUDED.encrypted_data,
         iv = EXCLUDED.iv,
         auth_tag = EXCLUDED.auth_tag,
         checksum = EXCLUDED.checksum,
         device_id = EXCLUDED.device_id,
         updated_at = NOW()
       RETURNING version, updated_at`,
      [userId, version || 1, encrypted_data, iv, auth_tag, checksum || '', device_id],
    )

    // Guardar en histórico para recuperación
    await client.query(
      `INSERT INTO vault_history (user_id, version, encrypted_data, iv, checksum, device_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, version || 1, encrypted_data, iv, checksum || '', device_id],
    )

    // Actualizar versión y username opcional en users
    if (username) {
      await client.query(
        `UPDATE users SET current_vault_version = $1, username = COALESCE(NULLIF($3, ''), username), updated_at = NOW() WHERE id = $2`,
        [version || 1, userId, username.trim()],
      )
    } else {
      await client.query(`UPDATE users SET current_vault_version = $1, updated_at = NOW() WHERE id = $2`, [
        version || 1,
        userId,
      ])
    }

    await client.query('COMMIT')

    res.json({
      success: true,
      version: upsertRes.rows[0].version,
      updated_at: upsertRes.rows[0].updated_at,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[VAULT PUSH ERROR]:', err)
    res.status(500).json({ error: 'Error al sincronizar bóveda', details: err.message })
  } finally {
    client.release()
  }
})

// -----------------------------------------------------------------------------
// 6. CORREOS TRANSACCIONALES (solo con sesión, plantillas del servidor, destinatario = la cuenta)
// -----------------------------------------------------------------------------
app.use('/api/mail', createMailRouter({ send: sendEmail, auth: requireAuth }))

// Arrancar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API SERVER] LifeKeeper API backend corriendo en http://0.0.0.0:${PORT}`)
})
