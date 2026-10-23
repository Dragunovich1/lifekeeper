import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Mail, CheckCircle2 } from 'lucide-react'
import { AUTO_LOCK_OPTIONS, CURRENCY_OPTIONS, UNIT_SYSTEM_OPTIONS, type CurrencyCode, type UnitSystem } from '../preferences/types'
import { usePreferences } from '../preferences/context'
import { ScrollbarOverlay } from '../scrollbar/ScrollbarOverlay'
import { Select } from './Select'
import { sendTestTemplate } from '../services/mail/mailService'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  userName?: string
  userEmail?: string
  avatarSrc?: string
}

const getInitials = (value?: string) => {
  if (!value) return 'LK'
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join('')
}

export const SettingsModal = ({ open, onClose, userName, userEmail, avatarSrc }: SettingsModalProps) => {
  const { preferences, updatePreferences } = usePreferences()
  const closeRef = useRef<HTMLButtonElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<Element | null>(null)
  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null)
  const [sentSuccess, setSentSuccess] = useState<string | null>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pref-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="pref-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="pref-modal-header">
          <div className="pref-modal-heading">
            <span className="page-eyebrow">Cuenta</span>
            <h2 id="settings-title">Configuración</h2>
            <p className="pref-modal-subtitle">Preferencias de uso y seguridad de tu bóveda</p>
          </div>
          <button ref={closeRef} type="button" className="pref-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="pref-modal-body" ref={bodyRef}>
          <section aria-labelledby="settings-account">
            <h3 className="pref-section-title" id="settings-account">
              Cuenta
            </h3>
            <div className="pref-account">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="pref-avatar pref-avatar-image" aria-hidden />
              ) : (
                <span className="pref-avatar" aria-hidden>
                  {getInitials(userName)}
                </span>
              )}
              <div>
                <div className="pref-account-name">{userName || 'Sin nombre'}</div>
                {userEmail ? <div className="pref-account-email">{userEmail}</div> : null}
              </div>
            </div>
          </section>

          <section aria-labelledby="settings-preferences">
            <h3 className="pref-section-title" id="settings-preferences">
              Preferencias
            </h3>
            <div className="pref-fields">
              <div className="pref-field">
                <label htmlFor="settings-autolock">Auto-bloqueo por inactividad</label>
                <Select
                  id="settings-autolock"
                  value={String(preferences.autoLockMinutes)}
                  onChange={(value) =>
                    updatePreferences({ autoLockMinutes: Number(value) })
                  }
                  options={AUTO_LOCK_OPTIONS.map((option) => ({
                    value: String(option.value),
                    label: option.label,
                  }))}
                  ariaLabel="Auto-bloqueo por inactividad"
                />
                <p className="pref-help">
                  Cierra la bóveda automáticamente después de este tiempo sin actividad.
                </p>
              </div>

              <div className="pref-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={preferences.privacyCurtain}
                    onChange={(event) =>
                      updatePreferences({ privacyCurtain: event.target.checked })
                    }
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-accent-blue)' }}
                  />
                  <span>Cortina de privacidad activa</span>
                </label>
                <p className="pref-help">
                  Difumina la pantalla al cambiar de pestaña para proteger tus datos de miradas indiscretas.
                </p>
              </div>

              <div className="pref-field">
                <label htmlFor="settings-start">Sección inicial</label>
                <Select
                  id="settings-start"
                  value={preferences.startSection}
                  onChange={(value) =>
                    updatePreferences({ startSection: value === 'last' ? 'last' : 'dashboard' })
                  }
                  options={[
                    { value: 'dashboard', label: 'Dashboard' },
                    { value: 'last', label: 'Última sección visitada' },
                  ]}
                  ariaLabel="Sección inicial"
                />
                <p className="pref-help">Elegí dónde querés retomar la app al desbloquearla.</p>
              </div>

              <div className="pref-field">
                <label htmlFor="settings-currency">Moneda predeterminada</label>
                <Select
                  id="settings-currency"
                  value={preferences.currency}
                  onChange={(value) =>
                    updatePreferences({ currency: value as CurrencyCode })
                  }
                  options={CURRENCY_OPTIONS.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                  ariaLabel="Moneda predeterminada"
                />
                <p className="pref-help">Se aplicará a tus registros financieros, balances y topes.</p>
              </div>

              <div className="pref-field">
                <label htmlFor="settings-units">Sistema de unidades de medida</label>
                <Select
                  id="settings-units"
                  value={preferences.unitSystem}
                  onChange={(value) =>
                    updatePreferences({ unitSystem: value as UnitSystem })
                  }
                  options={UNIT_SYSTEM_OPTIONS.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                  ariaLabel="Sistema de unidades de medida"
                />
                <p className="pref-help">Usado para altura, peso, métricas de salud e IMC.</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="settings-notifications">
            <h3 className="pref-section-title" id="settings-notifications" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={16} />
              <span>Notificaciones por Correo (@lifekeeper.lat)</span>
            </h3>
            <p className="pref-help" style={{ marginBottom: '0.875rem' }}>
              Servicio de correo oficial activo. Podés probar el envío de cualquiera de los templates oficiales directo a tu casilla registrada <strong>({userEmail || 'Configurada en tu perfil'})</strong>:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
              <button
                type="button"
                className="secondary-button"
                disabled={sendingTemplate !== null || !userEmail}
                onClick={async () => {
                  if (!userEmail) return
                  setSendingTemplate('welcome')
                  await sendTestTemplate(userEmail, 'welcome', userName)
                  setSendingTemplate(null)
                  setSentSuccess('¡Template de Bienvenida enviado!')
                  setTimeout(() => setSentSuccess(null), 5000)
                }}
                style={{ fontSize: '0.75rem', padding: '0.5rem 0.65rem' }}
              >
                {sendingTemplate === 'welcome' ? 'Enviando...' : '💌 Bienvenida'}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={sendingTemplate !== null || !userEmail}
                onClick={async () => {
                  if (!userEmail) return
                  setSendingTemplate('login')
                  await sendTestTemplate(userEmail, 'login', userName)
                  setSendingTemplate(null)
                  setSentSuccess('¡Alerta de Nuevo Login enviada!')
                  setTimeout(() => setSentSuccess(null), 5000)
                }}
                style={{ fontSize: '0.75rem', padding: '0.5rem 0.65rem' }}
              >
                {sendingTemplate === 'login' ? 'Enviando...' : '🛡️ Alerta Login'}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={sendingTemplate !== null || !userEmail}
                onClick={async () => {
                  if (!userEmail) return
                  setSendingTemplate('bruteforce')
                  await sendTestTemplate(userEmail, 'bruteforce', userName)
                  setSendingTemplate(null)
                  setSentSuccess('¡Alerta Crítica de Seguridad enviada!')
                  setTimeout(() => setSentSuccess(null), 5000)
                }}
                style={{ fontSize: '0.75rem', padding: '0.5rem 0.65rem' }}
              >
                {sendingTemplate === 'bruteforce' ? 'Enviando...' : '🚨 Alerta Fallos'}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={sendingTemplate !== null || !userEmail}
                onClick={async () => {
                  if (!userEmail) return
                  setSendingTemplate('backup')
                  await sendTestTemplate(userEmail, 'backup', userName)
                  setSendingTemplate(null)
                  setSentSuccess('¡Confirmación de Respaldo enviada!')
                  setTimeout(() => setSentSuccess(null), 5000)
                }}
                style={{ fontSize: '0.75rem', padding: '0.5rem 0.65rem' }}
              >
                {sendingTemplate === 'backup' ? 'Enviando...' : '☁️ Respaldo'}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={sendingTemplate !== null || !userEmail}
                onClick={async () => {
                  if (!userEmail) return
                  setSendingTemplate('health')
                  await sendTestTemplate(userEmail, 'health', userName)
                  setSendingTemplate(null)
                  setSentSuccess('¡Recordatorio de Salud enviado!')
                  setTimeout(() => setSentSuccess(null), 5000)
                }}
                style={{ fontSize: '0.75rem', padding: '0.5rem 0.65rem' }}
              >
                {sendingTemplate === 'health' ? 'Enviando...' : '💊 Salud'}
              </button>
            </div>
            {sentSuccess && (
              <p style={{ marginTop: '0.75rem', color: 'var(--color-success)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={15} />
                <span>{sentSuccess} Revisá tu casilla de correo.</span>
              </p>
            )}
          </section>
        </div>

        <ScrollbarOverlay targetRef={bodyRef} zIndex={1051} minThumb={28} />

        <footer className="pref-modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
