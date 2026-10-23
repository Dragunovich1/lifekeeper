import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { pool, query } from './db.js'
import { signToken, requireAuth } from './auth.js'
import { sendEmail } from './mailer.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// Configuración de middlewares
app.use(cors())
app.use(express.json({ limit: '50mb' }))

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
// 1. OBTENER SALT DE USUARIO (Zero-Knowledge Pre-Login)
// -----------------------------------------------------------------------------
app.get('/api/auth/salt', async (req, res) => {
  const email = (req.query.email || '').toString().trim().toLowerCase()
  if (!email) {
    return res.status(400).json({ error: 'Parámetro email es requerido' })
  }

  try {
    const result = await query('SELECT salt FROM users WHERE email = $1', [email])
    if (result.rows.length > 0) {
      return res.json({ exists: true, salt: result.rows[0].salt })
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

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Verificar si el usuario ya existe
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Ya existe una cuenta con este correo electrónico' })
    }

    // Insertar usuario
    const userRes = await client.query(
      `INSERT INTO users (email, auth_hash, salt, current_vault_version)
       VALUES ($1, $2, $3, 1)
       RETURNING id, email, created_at`,
      [normalizedEmail, auth_hash, salt],
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

    // Intentar enviar email de bienvenida de forma asíncrona
    sendEmail({
      to: user.email,
      subject: '¡Bienvenido a LifeKeeper! Tu bóveda cifrada está activa',
      text: `Hola! Tu cuenta en LifeKeeper (${user.email}) ha sido creada con éxito. Recuerda que tus datos están protegidos con cifrado de Conocimiento Cero (Zero-Knowledge).`,
      html: `
        <div style="font-family: sans-serif; background: #060b18; color: #e2e8f0; padding: 24px; border-radius: 12px;">
          <h2 style="color: #38bdf8; margin-top: 0;">¡Bienvenido a LifeKeeper!</h2>
          <p>Tu bóveda personal ha sido creada exitosamente con cifrado de Conocimiento Cero (Zero-Knowledge).</p>
          <p>Tus contraseñas, fichas de salud, finanzas y notas están aseguradas con AES-256-GCM y sólo tú tienes la llave.</p>
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8;">Si no realizaste este registro, por favor ponte en contacto con soporte.</p>
        </div>
      `,
    }).catch((err) => console.warn('[MAIL ERROR REGISTRO]:', err.message))

    return res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email },
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
// 3. INICIO DE SESIÓN (Zero-Knowledge Login)
// -----------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { email, auth_hash, device_id = 'web-client' } = req.body

  if (!email || !auth_hash) {
    return res.status(400).json({ error: 'Email y auth_hash son requeridos' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  const userAgent = req.headers['user-agent'] || 'unknown'
  const cleanIp = ip ? ip.split(',')[0].trim() : null

  try {
    const userRes = await query('SELECT id, email, auth_hash, salt, current_vault_version FROM users WHERE email = $1', [
      normalizedEmail,
    ])

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const user = userRes.rows[0]

    // Comprobación de hash de autenticación
    if (user.auth_hash !== auth_hash) {
      await query(
        `INSERT INTO security_audit_logs (user_id, event_type, ip_address, user_agent)
         VALUES ($1, 'login_failed', $2::inet, $3)`,
        [user.id, cleanIp, userAgent],
      )
      return res.status(401).json({ error: 'Credenciales inválidas' })
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
      user: { id: user.id, email: user.email },
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
  const { version, encrypted_data, iv, auth_tag, checksum, device_id = 'web-client' } = req.body

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

    // Actualizar versión en users
    await client.query(`UPDATE users SET current_vault_version = $1, updated_at = NOW() WHERE id = $2`, [
      version || 1,
      userId,
    ])

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
// 6. ENVIAR CORREO TRANSACCIONAL
// -----------------------------------------------------------------------------
app.post('/api/mail/send', async (req, res) => {
  const { to, subject, html, text, from } = req.body

  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: 'Destinatario (to), Asunto (subject) y Contenido son requeridos' })
  }

  try {
    const result = await sendEmail({ to, subject, html, text, from })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar correo', details: err.message })
  }
})

// Arrancar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API SERVER] LifeKeeper API backend corriendo en http://0.0.0.0:${PORT}`)
})
