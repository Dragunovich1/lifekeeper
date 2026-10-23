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

// -----------------------------------------------------------------------------
// 7. SIMULAR CORREO DE BIENVENIDA (Test Template)
// -----------------------------------------------------------------------------
app.post('/api/mail/test-welcome', async (req, res) => {
  const { to, name = 'Daniel' } = req.body

  if (!to) {
    return res.status(400).json({ error: 'El campo "to" (email de destino) es requerido' })
  }

  const subject = 'Bienvenido a LifeKeeper — Tu bóveda privada está lista'
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #060b18; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #060b18; padding: 40px 10px; }
    .main-card { max-width: 580px; margin: 0 auto; background: linear-gradient(180deg, #0e1a38 0%, #0a1329 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4); overflow: hidden; }
    .header { padding: 32px 36px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
    .brand-title { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff; margin: 0; }
    .brand-accent { color: #38bdf8; }
    .body { padding: 32px 36px; font-size: 15px; line-height: 1.6; color: #cbd5e1; }
    .h1-title { font-size: 20px; font-weight: 600; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    .callout { background: rgba(255, 255, 255, 0.03); border-left: 4px solid #1d63dc; border-radius: 8px; padding: 16px 18px; margin: 24px 0; font-size: 14px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1d63dc 0%, #0284c7 100%); color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px 28px; border-radius: 10px; margin: 20px 0; text-align: center; box-shadow: 0 4px 14px rgba(29, 99, 220, 0.35); }
    .footer { padding: 24px 36px 32px; border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: #64748b; text-align: center; }
    .footer a { color: #38bdf8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main-card" role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: middle;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right: 12px; vertical-align: middle;">
                      <img src="https://app.lifekeeper.lat/brand/isotipo.png?v=2" alt="LifeKeeper" width="36" height="36" style="display: block; border-radius: 8px;" />
                    </td>
                    <td style="vertical-align: middle;">
                      <h1 class="brand-title">Life<span class="brand-accent">Keeper</span></h1>
                    </td>
                  </tr>
                </table>
              </td>
              <td align="right" style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle;">
                Cero Conocimiento E2EE
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="body">
          <h2 class="h1-title">¡Hola, ${name}! 👋</h2>
          <p>Tu bóveda personal en <strong>LifeKeeper</strong> ha sido creada exitosamente. A partir de hoy, tus registros de salud, finanzas, contraseñas y diario personal están protegidos bajo cifrado de extremo a extremo.</p>
          
          <div class="callout">
            <strong style="color: #38bdf8;">🛡️ Regla de Oro de Conocimiento Cero (Zero-Knowledge):</strong>
            <p style="margin: 8px 0 0;">Tu contraseña maestra nunca viaja por la red ni se guarda en nuestros servidores. <strong>Nadie más que vos puede descifrar tu información.</strong></p>
          </div>

          <p><strong>Paso fundamental:</strong> Si no descargaste tu <strong>Kit de Emergencia (PDF de 24 palabras)</strong> durante el registro, ingresá ahora a tu perfil o a la sección de Respaldos para generarlo e imprimirlo.</p>

          <div style="text-align: center;">
            <a href="https://app.lifekeeper.lat/#profile:settings" class="btn">Abrir mi Bóveda</a>
          </div>

          <p style="font-size: 13px; color: #94a3b8;">Si tenés alguna duda sobre el funcionamiento del cifrado o la soberanía de tus datos, estamos a tu disposición.</p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p style="margin: 0 0 8px;">Este es un mensaje de seguridad automatizado enviado por <strong>LifeKeeper Vault</strong>.</p>
          <p style="margin: 0 0 8px;">Por arquitectura de conocimiento cero, nosotros nunca te pediremos contraseñas ni frases de rescate.</p>
          <p style="margin: 0;"><a href="https://app.lifekeeper.lat">https://app.lifekeeper.lat</a> • Servidor Soberano y Seguro</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`

  const text = `¡Hola, ${name}!\n\nTu bóveda en LifeKeeper ha sido creada exitosamente bajo arquitectura Zero-Knowledge E2EE.\n\nRecuerda guardar tu Kit de Emergencia de 24 palabras en un lugar físico seguro.\n\nIngresá a tu bóveda: https://app.lifekeeper.lat`

  try {
    const result = await sendEmail({ to, subject, html, text })
    res.json({ success: true, template: 'welcome', result })
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar simulación de bienvenida', details: err.message })
  }
})

// Arrancar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API SERVER] LifeKeeper API backend corriendo en http://0.0.0.0:${PORT}`)
})
