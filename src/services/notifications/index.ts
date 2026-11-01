/**
 * Entrega de notificaciones.
 *  - APK (Android/iOS): notificaciones locales del sistema, que suenan con la app cerrada.
 *  - Navegador: API Notification; solo avisa mientras la pestaña o la app instalada siguen abiertas.
 */

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { PlannedNotification } from './plan'

export { buildNotificationPlan, stableId } from './plan'
export type { PlannedNotification } from './plan'

export type NotificationStatus = 'granted' | 'denied' | 'prompt' | 'unsupported'

const isNative = () => Capacitor.isNativePlatform()
const webSupported = () => typeof window !== 'undefined' && 'Notification' in window

export const notificationsMode = (): 'native' | 'web' | 'none' => (isNative() ? 'native' : webSupported() ? 'web' : 'none')

export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (isNative()) {
    try {
      const { display } = await LocalNotifications.checkPermissions()
      return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
    } catch {
      return 'unsupported'
    }
  }
  if (!webSupported()) return 'unsupported'
  return Notification.permission === 'default' ? 'prompt' : (Notification.permission as NotificationStatus)
}

export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (isNative()) {
    try {
      const { display } = await LocalNotifications.requestPermissions()
      return display === 'granted' ? 'granted' : 'denied'
    } catch {
      return 'unsupported'
    }
  }
  if (!webSupported()) return 'unsupported'
  const result = await Notification.requestPermission()
  return result === 'default' ? 'prompt' : (result as NotificationStatus)
}

/** Android 12+: sin "Alarmas y recordatorios" los avisos pueden demorarse unos minutos. */
export async function getExactAlarmStatus(): Promise<'granted' | 'denied' | 'n/a'> {
  if (!isNative() || Capacitor.getPlatform() !== 'android') return 'n/a'
  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting()
    return exact_alarm === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'n/a'
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  try {
    await LocalNotifications.changeExactNotificationSetting()
  } catch {
    /* no disponible en esta versión del sistema */
  }
}

// --- Web -------------------------------------------------------------------
const webTimers = new Map<number, number>()
const clearWebTimers = () => {
  webTimers.forEach((t) => window.clearTimeout(t))
  webTimers.clear()
}

function showWeb(n: Pick<PlannedNotification, 'title' | 'body' | 'key'>) {
  try {
    new Notification(n.title, { body: n.body, tag: n.key, icon: '/brand/assistant.png' })
  } catch {
    /* algunos navegadores móviles exigen un service worker */
  }
}

// --- API pública -----------------------------------------------------------
let channelsReady = false

async function ensureChannels() {
  if (channelsReady || !isNative() || Capacitor.getPlatform() !== 'android') return
  try {
    await LocalNotifications.createChannel({ id: 'reminders', name: 'Recordatorios', description: 'Avisos de tus recordatorios', importance: 4, visibility: 0, vibration: true })
    await LocalNotifications.createChannel({ id: 'medication', name: 'Medicación', description: 'Avisos de tomas de medicación', importance: 5, visibility: 0, vibration: true })
    channelsReady = true
  } catch {
    /* los canales ya existían */
  }
}

/** Reemplaza todo lo programado por `plan`. Devuelve cuántos avisos quedaron programados. */
export async function applyNotificationPlan(plan: PlannedNotification[]): Promise<number> {
  if ((await getNotificationStatus()) !== 'granted') return 0

  if (isNative()) {
    await ensureChannels()
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
    if (plan.length === 0) return 0
    await LocalNotifications.schedule({
      notifications: plan.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        channelId: p.channel,
        schedule: { at: p.at, allowWhileIdle: true },
        smallIcon: 'ic_stat_lifekeeper',
        extra: { key: p.key },
      })),
    })
    return plan.length
  }

  // Navegador: solo los avisos de las próximas horas, mientras la app siga abierta
  clearWebTimers()
  const now = Date.now()
  let count = 0
  for (const p of plan) {
    const wait = p.at.getTime() - now
    if (wait < 0 || wait > 12 * 3_600_000) continue
    webTimers.set(p.id, window.setTimeout(() => showWeb(p), wait))
    count++
  }
  return count
}

export async function cancelAllNotifications(): Promise<void> {
  if (isNative()) {
    try {
      const pending = await LocalNotifications.getPending()
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
    } catch {
      /* sin plugin */
    }
    return
  }
  if (typeof window !== 'undefined') clearWebTimers()
}

/** Muestra un aviso de prueba en unos segundos. */
export async function sendTestNotification(): Promise<boolean> {
  if ((await getNotificationStatus()) !== 'granted') return false
  const test = { id: 2_000_000_001, key: 'test', title: 'LifeKeeper', body: '¡Las notificaciones funcionan! 🎉', channel: 'reminders' as const, at: new Date(Date.now() + 3000) }
  if (isNative()) {
    await ensureChannels()
    await LocalNotifications.schedule({ notifications: [{ id: test.id, title: test.title, body: test.body, channelId: 'reminders', schedule: { at: test.at, allowWhileIdle: true }, smallIcon: 'ic_stat_lifekeeper' }] })
    return true
  }
  window.setTimeout(() => showWeb(test), 3000)
  return true
}
