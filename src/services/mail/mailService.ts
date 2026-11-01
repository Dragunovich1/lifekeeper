import { apiFetch } from '../api/apiConfig'
import { syncService } from '../sync/syncService'

/**
 * Correos transaccionales de LifeKeeper.
 *
 * El servidor arma el contenido con sus propias plantillas y los envía SIEMPRE a la dirección de la cuenta
 * (la de la sesión en la nube). Por eso hace falta tener la sesión iniciada; sin ella no se envía nada.
 * El correo de bienvenida y la alerta por intentos fallidos los dispara el servidor por su cuenta.
 */

export type MailTemplateId = 'welcome' | 'new_login' | 'brute_force' | 'backup_success' | 'health_reminder'
export interface MailResult {
  success: boolean
  error?: string
}

async function notify(template: MailTemplateId, params: Record<string, unknown>): Promise<MailResult> {
  const token = syncService.getSession()?.token
  if (!token) return { success: false, error: 'Necesitás tener la sesión en la nube iniciada para enviar correos.' }
  try {
    const res = await apiFetch('/api/mail/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ template, params }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) return { success: false, error: data.error || `HTTP ${res.status}` }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error de conexión' }
  }
}

/** La bienvenida la envía el servidor al crear la cuenta; se deja por compatibilidad. */
export async function notifyWelcome(_userName: string, _userEmail: string): Promise<MailResult> {
  return { success: true }
}

/** Alerta de nuevo inicio de sesión desde otro dispositivo. */
export async function notifyNewLoginAlert(
  _userEmail: string,
  loginInfo: { device: string; ip: string; timestamp: string; locationApprox?: string },
) {
  return notify('new_login', loginInfo)
}

/** Las alertas por intentos fallidos las genera el servidor al contarlos; se deja por compatibilidad. */
export async function notifyBruteForceAlert(_userEmail: string, _failedCount: number, _clientIp = 'Cliente Web'): Promise<MailResult> {
  return { success: true }
}

export async function notifyBackupSuccess(_userEmail: string, backupDetails: { timestamp: string; snapshotId: string; sizeKb: number }) {
  return notify('backup_success', backupDetails)
}

export async function notifyHealthReminder(
  _userEmail: string,
  reminder: { title: string; category: 'medicamento' | 'vacuna' | 'turno'; detail: string; dueDateTime: string },
) {
  return notify('health_reminder', reminder)
}

/** Envía una plantilla de prueba a la propia cuenta (panel de ajustes). */
export async function sendTestTemplate(
  _toEmail: string,
  type: 'welcome' | 'login' | 'bruteforce' | 'backup' | 'health',
  userName = 'Usuario LifeKeeper',
): Promise<MailResult> {
  const now = new Date().toLocaleString('es-AR')
  switch (type) {
    case 'welcome':
      return notify('welcome', { name: userName })
    case 'login':
      return notify('new_login', { device: `${navigator.platform || 'PC'} • Navegador Web`, ip: 'Servidor Local', timestamp: now, locationApprox: 'Buenos Aires, Argentina' })
    case 'bruteforce':
      return notify('brute_force', { failedCount: 5, ip: 'IP de prueba' })
    case 'backup':
      return notify('backup_success', { timestamp: now, snapshotId: `snap_${Date.now().toString(36)}`, sizeKb: 142 })
    case 'health':
      return notify('health_reminder', {
        title: 'Ibuprofeno 600mg',
        category: 'medicamento',
        detail: 'Tomar 1 comprimido después de la cena con abundante agua.',
        dueDateTime: `${now} (Programado)`,
      })
  }
}
