import { useCallback, useEffect, useState } from 'react'
import { usePreferences } from '../preferences/context'
import {
  getExactAlarmStatus,
  getNotificationStatus,
  notificationsMode,
  openExactAlarmSettings,
  requestNotificationPermission,
  sendTestNotification,
  type NotificationStatus,
} from '../services/notifications'

/** Ajustes de avisos de recordatorios y medicación. */
export function NotificationSettings() {
  const { preferences, updatePreferences } = usePreferences()
  const mode = notificationsMode()
  const [status, setStatus] = useState<NotificationStatus>('prompt')
  const [exact, setExact] = useState<'granted' | 'denied' | 'n/a'>('n/a')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setStatus(await getNotificationStatus())
    setExact(await getExactAlarmStatus())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (mode === 'none') {
    return (
      <div className="pref-field">
        <label style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Notificaciones</label>
        <p className="pref-help">Este navegador no admite notificaciones.</p>
      </div>
    )
  }

  const toggle = async (checked: boolean) => {
    setMessage('')
    if (!checked) {
      updatePreferences({ notifications: false })
      return
    }
    const result = status === 'granted' ? 'granted' : await requestNotificationPermission()
    setStatus(result)
    if (result === 'granted') {
      updatePreferences({ notifications: true })
      setExact(await getExactAlarmStatus())
    } else {
      updatePreferences({ notifications: false })
      setMessage('No se dio el permiso. Podés habilitarlo desde los ajustes del sistema o del navegador.')
    }
  }

  const test = async () => {
    const ok = await sendTestNotification()
    setMessage(ok ? 'Te mando un aviso de prueba en unos segundos…' : 'Primero tenés que dar el permiso de notificaciones.')
  }

  return (
    <div className="pref-field">
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontWeight: 500, color: 'var(--color-text-primary)' }}>
        <input
          type="checkbox"
          checked={preferences.notifications}
          onChange={(event) => void toggle(event.target.checked)}
          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-accent-blue)' }}
        />
        <span>Avisos de recordatorios y medicación</span>
      </label>
      <p className="pref-help">
        {mode === 'native'
          ? 'Te avisa a la hora de cada recordatorio y de cada toma, incluso con la app cerrada.'
          : 'En el navegador solo avisa mientras LifeKeeper siga abierto. Para recibir avisos con la app cerrada, usá la app de Android.'}
      </p>

      {preferences.notifications && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', marginTop: '0.5rem', color: 'var(--color-text-primary)' }}>
            <input
              type="checkbox"
              checked={preferences.notificationDetails}
              onChange={(event) => updatePreferences({ notificationDetails: event.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-accent-blue)' }}
            />
            <span>Mostrar el detalle en el aviso</span>
          </label>
          <p className="pref-help">
            Apagado: el aviso dice solo “Es hora de tu medicación” o “Tenés un recordatorio”, sin nombres, para que nadie lea tus datos en la pantalla bloqueada.
          </p>

          {exact === 'denied' && (
            <p className="pref-help" role="status">
              Para que los avisos lleguen a la hora exacta, activá “Alarmas y recordatorios” para LifeKeeper.{' '}
              <button type="button" className="secondary-button" style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }} onClick={() => void openExactAlarmSettings()}>
                Abrir ajuste
              </button>
            </p>
          )}

          <button type="button" className="secondary-button" style={{ marginTop: '0.5rem' }} onClick={() => void test()}>
            Enviar aviso de prueba
          </button>
        </>
      )}

      {status === 'denied' && !preferences.notifications && <p className="pref-help" role="alert">El permiso está bloqueado en este dispositivo.</p>}
      {message && <p className="pref-help" role="status">{message}</p>}
    </div>
  )
}
