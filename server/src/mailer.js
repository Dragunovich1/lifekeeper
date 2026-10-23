import nodemailer from 'nodemailer'

const resendApiKey = process.env.RESEND_API_KEY
const host = process.env.SMTP_HOST
const port = parseInt(process.env.SMTP_PORT || '587', 10)
const secure = process.env.SMTP_SECURE === 'true' || port === 465
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
const defaultFrom = process.env.SMTP_FROM || 'LifeKeeper <no-reply@lifekeeper.lat>'

let transporter = null

if (resendApiKey) {
  console.log('[MAIL] Configurado mediante Resend API Key oficial.')
} else if (host) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  })

  // Verificar conexión inicial
  transporter
    .verify()
    .then(() => {
      console.log(`[MAIL] Servicio SMTP conectado exitosamente a ${host}:${port}`)
    })
    .catch((err) => {
      console.warn(`[MAIL WARN] Falló la verificación SMTP con ${host}:${port}:`, err.message)
    })
} else {
  console.log('[MAIL] No se configuró RESEND_API_KEY ni SMTP_HOST. Los correos se imprimirán en consola (Modo Simulación).')
}

export async function sendEmail({ to, subject, html, text, from = defaultFrom }) {
  if (!to || !subject) {
    throw new Error('Destinatario (to) y Asunto (subject) son requeridos')
  }

  // 1. Envío prioritario vía Resend REST API (ultra rápido y nativo)
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || `Error HTTP ${response.status} de Resend`)
      }

      console.log(`[MAIL RESEND ENVIADO] A: ${to} | ID: ${data.id} | Asunto: ${subject}`)
      return { success: true, messageId: data.id, simulated: false }
    } catch (err) {
      console.error(`[MAIL RESEND ERROR] Error al enviar correo a ${to}:`, err.message)
      throw err
    }
  }

  // 2. Envío secundario vía SMTP estándar (Nodemailer)
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
      })
      console.log(`[MAIL SMTP ENVIADO] A: ${to} | ID: ${info.messageId} | Asunto: ${subject}`)
      return { success: true, messageId: info.messageId, simulated: false }
    } catch (err) {
      console.error(`[MAIL SMTP ERROR] Error al enviar correo a ${to}:`, err.message)
      throw err
    }
  }

  // 3. Fallback: Modo Simulación en consola
  console.log(`\n================== [CORREO SIMULADO] ==================`)
  console.log(`De:      ${from}`)
  console.log(`Para:    ${to}`)
  console.log(`Asunto:  ${subject}`)
  console.log(`Texto:   ${text || '(sin texto plano)'}`)
  console.log(`=======================================================\n`)
  return { success: true, messageId: `mock-${Date.now()}`, simulated: true }
}

