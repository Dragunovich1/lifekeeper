import {
  type EmailPayload,
  getWelcomeEmail,
  getNewLoginAlertEmail,
  getBruteForceAlertEmail,
  getBackupSuccessEmail,
  getHealthReminderEmail,
} from './templates'

/**
 * Despacha un correo electrónico seguro a través del backend LifeKeeper (/api/mail/send).
 * Diseñado a prueba de fallos para no interrumpir el flujo del usuario si la red flaquea.
 */
export async function dispatchEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.warn('[MAIL SERVICE] Error al enviar:', data.error || res.statusText)
      return { success: false, error: data.error || `HTTP ${res.status}` }
    }

    console.info(`[MAIL SERVICE] Correo "${payload.subject}" enviado exitosamente a ${payload.to}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de conexión'
    console.warn('[MAIL SERVICE] Error de red:', message)
    return { success: false, error: message }
  }
}

/**
 * 1. Envío de Bienvenida y Activación de Bóveda
 */
export async function notifyWelcome(userName: string, userEmail: string) {
  if (!userEmail || !userEmail.includes('@')) return
  const payload = getWelcomeEmail(userName, userEmail)
  return dispatchEmail(payload)
}

/**
 * 2. Alerta de Seguridad por Nuevo Inicio de Sesión
 */
export async function notifyNewLoginAlert(
  userEmail: string,
  loginInfo: { device: string; ip: string; timestamp: string; locationApprox?: string },
) {
  if (!userEmail || !userEmail.includes('@')) return
  const payload = getNewLoginAlertEmail(userEmail, loginInfo)
  return dispatchEmail(payload)
}

/**
 * 3. Alerta Crítica por Intentos Fallidos Consecutivos (Fuerza Bruta)
 */
export async function notifyBruteForceAlert(userEmail: string, failedCount: number, clientIp = 'Cliente Web') {
  if (!userEmail || !userEmail.includes('@')) return
  const payload = getBruteForceAlertEmail(userEmail, failedCount, clientIp)
  return dispatchEmail(payload)
}

/**
 * 4. Notificación de Respaldo Cifrado Exitoso en PostgreSQL
 */
export async function notifyBackupSuccess(
  userEmail: string,
  backupDetails: { timestamp: string; snapshotId: string; sizeKb: number },
) {
  if (!userEmail || !userEmail.includes('@')) return
  const payload = getBackupSuccessEmail(userEmail, backupDetails)
  return dispatchEmail(payload)
}

/**
 * 5. Recordatorio Preventivo de Salud y Medicación
 */
export async function notifyHealthReminder(
  userEmail: string,
  reminder: { title: string; category: 'medicamento' | 'vacuna' | 'turno'; detail: string; dueDateTime: string },
) {
  if (!userEmail || !userEmail.includes('@')) return
  const payload = getHealthReminderEmail(userEmail, reminder)
  return dispatchEmail(payload)
}

/**
 * 6. Disparador de Prueba para cualquier template
 */
export async function sendTestTemplate(
  toEmail: string,
  type: 'welcome' | 'login' | 'bruteforce' | 'backup' | 'health',
  userName = 'Usuario LifeKeeper',
) {
  const now = new Date().toLocaleString('es-AR')

  switch (type) {
    case 'welcome':
      return notifyWelcome(userName, toEmail)
    case 'login':
      return notifyNewLoginAlert(toEmail, {
        device: `${navigator.platform || 'PC'} • Navegador Web`,
        ip: 'Servidor Local (Dell Latitude)',
        timestamp: now,
        locationApprox: 'Buenos Aires, Argentina',
      })
    case 'bruteforce':
      return notifyBruteForceAlert(toEmail, 3, 'IP de origen no reconocida')
    case 'backup':
      return notifyBackupSuccess(toEmail, {
        timestamp: now,
        snapshotId: `snap_${Date.now().toString(36)}`,
        sizeKb: 142,
      })
    case 'health':
      return notifyHealthReminder(toEmail, {
        title: 'Ibuprofeno 600mg',
        category: 'medicamento',
        detail: 'Tomar 1 comprimido después de la cena con abundante agua.',
        dueDateTime: `${now} (Programado)`,
      })
    default:
      return notifyWelcome(userName, toEmail)
  }
}
