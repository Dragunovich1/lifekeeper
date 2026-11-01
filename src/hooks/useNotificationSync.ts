import { useEffect } from 'react'
import { useAppData } from './useAppData'
import { usePreferences } from '../preferences/context'
import { applyNotificationPlan, buildNotificationPlan, cancelAllNotifications } from '../services/notifications'

/**
 * Mantiene al día los avisos programados: se recalcula cuando cambian los recordatorios o la medicación,
 * al volver a abrir la app y cada 6 horas mientras está abierta.
 */
export function useNotificationSync() {
  const { data } = useAppData()
  const { preferences } = usePreferences()
  const enabled = preferences.notifications
  const showDetails = preferences.notificationDetails
  const reminders = data?.utilities.reminders
  const medications = data?.health.medications

  useEffect(() => {
    if (!enabled) {
      void cancelAllNotifications()
      return
    }
    if (!data) return

    const run = () => {
      const plan = buildNotificationPlan(data, { showDetails })
      applyNotificationPlan(plan).catch((err) => console.warn('[NOTIFICACIONES] No se pudo programar:', err))
    }
    const timer = window.setTimeout(run, 1500)
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(run, 6 * 3_600_000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // data completo solo se lee dentro de run; se recalcula cuando cambian recordatorios o medicación
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, showDetails, reminders, medications])
}
