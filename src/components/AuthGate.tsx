import type { FormEvent, ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CloudDownload, Fingerprint, HeartPulse, LockKeyhole, Server, ShieldCheck } from 'lucide-react'
import { useAppDataUnsafe } from '../hooks/useAppData'
import { loadProfileMeta, storeProfileMeta, type StoredProfileMeta } from '../utils/storage'
import { Footer } from './Footer'
import { usePreferences } from '../preferences/context'
import {
  isBiometricsAvailable,
  isBiometricsEnrolled,
  authenticateWithBiometrics,
  enrollBiometrics,
} from '../services/crypto/webAuthn'
import { downloadEmergencyKitPdf } from '../services/crypto/emergencyKit'
import { notifyWelcome, notifyNewLoginAlert, notifyBruteForceAlert } from '../services/mail/mailService'
import { getCustomServerUrl, setCustomServerUrl } from '../services/api/apiConfig'

type AuthMode = 'unlock' | 'create' | 'restore'

const initialSignup = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  password: '',
  confirm: '',
}

export const AuthGate = ({ children }: { children: ReactNode }) => {
  const { data, masterPassword, hasVault, unlock, createVault, restoreFromCloud, error } = useAppDataUnsafe()
  const { preferences } = usePreferences()
  const isLightMode = preferences.mode === 'light'
  const logoLoginSrc = isLightMode ? '/brand/logo-login-light.png?v=2' : '/brand/logo-login.png?v=2'
  const markSrc = isLightMode ? '/brand/isotipo-light.png?v=2' : '/brand/isotipo.png?v=2'
  const wordmarkSrc = isLightMode ? '/brand/wordmark-light.png?v=2' : '/brand/wordmark.png?v=2'
  // Iniciamos siempre en 'unlock' para que desde el Smartphone o APK pueda entrar directo con su usuario/email
  const [mode, setMode] = useState<AuthMode>('unlock')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signup, setSignup] = useState(initialSignup)
  const [storedMeta, setStoredMeta] = useState<StoredProfileMeta | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showServerConfig, setShowServerConfig] = useState(false)
  const [serverUrlInput, setServerUrlInput] = useState<string>(() => getCustomServerUrl() || '')
  const [serverSavedMsg, setServerSavedMsg] = useState<string | null>(null)
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('lifekeeper_failed_attempts') || '0', 10) || 0
    } catch {
      return 0
    }
  })
  const [biometricsReady, setBiometricsReady] = useState(false)
  const cardRef = useRef<HTMLElement | null>(null)
  const previousRect = useRef<DOMRect | null>(null)
  const morphAnimation = useRef<Animation | null>(null)

  const showApp = Boolean(masterPassword && data)

  useEffect(() => {
    void isBiometricsAvailable().then((avail) => {
      setBiometricsReady(avail && isBiometricsEnrolled())
    })
  }, [])

  useEffect(() => {
    const meta = loadProfileMeta()
    setStoredMeta(meta)
    if (meta?.username) {
      setLoginUsername(meta.username)
    } else if (meta?.email) {
      setLoginUsername(meta.email)
    }
  }, [hasVault])

  const resetMessages = () => {
    setLocalError(null)
  }

  const switchMode = (target?: AuthMode) => {
    if (cardRef.current) {
      previousRect.current = cardRef.current.getBoundingClientRect()
    }
    setMode((prev) => target ?? (prev === 'unlock' ? 'create' : 'unlock'))
    resetMessages()
    setLoginPassword('')
  }

  // Morphea el contenedor al pasar entre login y creación de bóveda
  useLayoutEffect(() => {
    const card = cardRef.current
    const previous = previousRect.current
    previousRect.current = null
    if (!card || !previous) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const next = card.getBoundingClientRect()
    if (Math.abs(previous.width - next.width) < 1 && Math.abs(previous.height - next.height) < 1) {
      return
    }

    morphAnimation.current?.cancel()
    card.classList.add('is-morphing')
    const animation = card.animate(
      [
        { width: `${previous.width}px`, height: `${previous.height}px` },
        { width: `${next.width}px`, height: `${next.height}px` },
      ],
      { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
    morphAnimation.current = animation
    animation.finished
      .catch(() => undefined)
      .finally(() => card.classList.remove('is-morphing'))
  }, [mode])

  if (showApp) {
    return <>{children}</>
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()

    if (mode === 'restore') {
      if (!loginUsername.trim()) {
        setLocalError('Ingresá tu usuario o correo electrónico registrado')
        return
      }
      if (!loginPassword.trim()) {
        setLocalError('Ingresá tu contraseña maestra')
        return
      }

      try {
        setIsLoading(true)
        if (restoreFromCloud) {
          await restoreFromCloud(loginUsername.trim(), loginPassword)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No pudimos restaurar la bóveda desde la nube'
        setLocalError(message)
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (mode === 'unlock') {
      if (!loginUsername.trim()) {
        setLocalError('Ingresá tu usuario o email para continuar')
        return
      }
      if (!loginPassword.trim()) {
        setLocalError('Ingresá tu contraseña maestra')
        return
      }

      const inputId = loginUsername.trim().toLowerCase()
      const matchesStoredUser =
        !storedMeta?.username || storedMeta.username.trim().toLowerCase() === inputId
      const matchesStoredEmail =
        Boolean(storedMeta?.email) && storedMeta!.email!.trim().toLowerCase() === inputId

      if (hasVault && storedMeta?.username && !matchesStoredUser && !matchesStoredEmail) {
        // Si ingresa otro usuario/email distinto al local, intentamos restaurar esa cuenta desde la nube
        if (restoreFromCloud) {
          try {
            setIsLoading(true)
            await restoreFromCloud(loginUsername.trim(), loginPassword)
            return
          } catch {
            setLocalError('El usuario ingresado no coincide con la bóveda local ni se pudo autenticar en la nube')
            setIsLoading(false)
            return
          }
        }
      }

      try {
        setIsLoading(true)
        await unlock(loginPassword, loginUsername.trim())
        setFailedAttempts(0)
        localStorage.removeItem('lifekeeper_failed_attempts')

        // Alerta de nuevo inicio de sesión en equipo no registrado previamente
        try {
          const deviceKey = `lifekeeper_dev_${navigator.userAgent.slice(0, 40)}`
          if (storedMeta?.email && !localStorage.getItem(deviceKey)) {
            localStorage.setItem(deviceKey, '1')
            void notifyNewLoginAlert(storedMeta.email, {
              device: `${navigator.platform || 'Dispositivo'} • Navegador Web`,
              ip: 'Cliente Web',
              timestamp: new Date().toLocaleString('es-AR'),
            })
          }
        } catch {
          // Ignore
        }
      } catch (err) {
        const nextAttempts = failedAttempts + 1
        setFailedAttempts(nextAttempts)
        try {
          localStorage.setItem('lifekeeper_failed_attempts', String(nextAttempts))
        } catch {
          // Ignore
        }

        // Alerta crítica por intentos fallidos de contraseña maestra
        if (nextAttempts >= 3 && storedMeta?.email) {
          void notifyBruteForceAlert(storedMeta.email, nextAttempts, 'Cliente Web')
        }

        if (nextAttempts >= 10) {
          // Autodestrucción por seguridad tras 10 intentos
          localStorage.clear()
          sessionStorage.clear()
          setLocalError(
            '⚠️ PROTOCOLO DE AUTODESTRUCCIÓN: Se alcanzó el límite de 10 intentos fallidos. Todos los datos locales de la bóveda han sido eliminados permanentemente por seguridad.',
          )
        } else if (nextAttempts >= 5) {
          setLocalError(
            `Contraseña incorrecta. ⚠️ ADVERTENCIA: Te quedan ${10 - nextAttempts} intentos antes de que la bóveda local sea eliminada.`,
          )
        } else {
          const message = err instanceof Error ? err.message : 'No pudimos procesar el ingreso'
          setLocalError(message)
        }
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (!signup.firstName.trim()) {
      setLocalError('Ingresá tu nombre')
      return
    }
    if (!signup.lastName.trim()) {
      setLocalError('Ingresá tu apellido')
      return
    }
    if (!signup.username.trim()) {
      setLocalError('Definí un nombre de usuario')
      return
    }
    if (!signup.email.trim()) {
      setLocalError('Necesitamos un email de contacto')
      return
    }
    if (!signup.password.trim()) {
      setLocalError('Configurá una contraseña maestra segura')
      return
    }
    if (signup.password !== signup.confirm) {
      setLocalError('Las contraseñas no coinciden')
      return
    }

    try {
      setIsLoading(true)
      const firstName = signup.firstName.trim()
      const lastName = signup.lastName.trim()
      const computedFullName = `${firstName} ${lastName}`.trim()
      const meta = { username: signup.username.trim(), email: signup.email.trim() }

      await createVault(signup.password, {
        firstName,
        lastName,
        fullName: computedFullName,
        username: signup.username.trim(),
        email: signup.email.trim(),
      })
      storeProfileMeta(meta)
      setStoredMeta(meta)

      // Descarga automática del Emergency Kit PDF
      void downloadEmergencyKitPdf({
        userEmail: signup.email.trim(),
        userName: computedFullName,
      })

      // Envío de correo de bienvenida oficial con template LifeKeeper
      if (signup.email.trim()) {
        void notifyWelcome(firstName, signup.email.trim())
      }

      // Si el navegador soporta biometría, enrolar
      if (biometricsReady) {
        void enrollBiometrics(signup.username.trim(), signup.email.trim())
      }

      setSignup(initialSignup)
      setLoginUsername(meta.username)
      setLoginPassword('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No pudimos crear la bóveda'
      setLocalError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-stage">
        <section
          ref={cardRef}
          className={`auth-card${mode === 'create' ? ' auth-card-create' : ''}`}
          aria-labelledby="auth-title"
        >
          <aside className="auth-brand-panel">
            <div className={`auth-brand-logo is-${preferences.logo}`}>
              {preferences.logo === 'full' ? (
                <img src={logoLoginSrc} alt="LifeKeeper" />
              ) : null}
              {preferences.logo === 'mark' ? (
                <img src={markSrc} alt="LifeKeeper" />
              ) : null}
              {preferences.logo === 'wordmark' ? (
                <img src={wordmarkSrc} alt="LifeKeeper" />
              ) : null}
            </div>

            <p className="auth-brand-tagline">
              Tu centro privado para salud, finanzas y recuerdos.
            </p>

            <ul className="auth-brand-points">
              <li>
                <ShieldCheck size={16} aria-hidden />
                <span>Cifrado Zero-Knowledge AES-256 con contraseña maestra</span>
              </li>
              <li>
                <LockKeyhole size={16} aria-hidden />
                <span>Sincronización cifrada entre Desktop y Smartphone</span>
              </li>
              <li>
                <HeartPulse size={16} aria-hidden />
                <span>Salud, finanzas y recordatorios en un solo lugar</span>
              </li>
            </ul>
          </aside>

          <div className="auth-form-panel" key={mode}>
            <header className="auth-header">
              <h1 className="auth-title" id="auth-title">
                {mode === 'unlock'
                  ? 'Iniciar sesión'
                  : mode === 'restore'
                    ? 'Sincronizar desde la nube'
                    : 'Crear tu bóveda'}
              </h1>
              {mode === 'create' ? (
                <p className="auth-subtitle">
                  Completá tus datos y definí una contraseña maestra para empezar.
                </p>
              ) : mode === 'restore' ? (
                <p className="auth-subtitle">
                  Ingresá el usuario o correo de tu bóveda de Desktop y tu contraseña maestra.
                </p>
              ) : !hasVault ? (
                <p className="auth-subtitle">
                  Ingresá con tu usuario o email para abrir tu bóveda sincronizada en este dispositivo.
                </p>
              ) : null}
            </header>

            <form
              className={`auth-form${mode === 'create' ? ' auth-form-create' : ''}`}
              onSubmit={handleSubmit}
              noValidate
            >
              {mode === 'restore' ? (
                <>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="restore-email">
                      Usuario o correo electrónico
                    </label>
                    <input
                      id="restore-email"
                      className="auth-input"
                      type="text"
                      autoComplete="username"
                      spellCheck={false}
                      value={loginUsername}
                      onChange={(event) => setLoginUsername(event.target.value)}
                      placeholder="Tu usuario o correo@dominio.com"
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="restore-password">
                      Contraseña maestra
                    </label>
                    <input
                      id="restore-password"
                      className="auth-input"
                      type="password"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Contraseña maestra de tu bóveda"
                    />
                  </div>
                </>
              ) : mode === 'unlock' ? (
                <>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="login-username">
                      Usuario o Email
                    </label>
                    <input
                      id="login-username"
                      className="auth-input"
                      autoComplete="username"
                      spellCheck={false}
                      value={loginUsername}
                      onChange={(event) => setLoginUsername(event.target.value)}
                      placeholder="Usuario o correo registrado"
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="login-password">
                      Contraseña maestra
                    </label>
                    <input
                      id="login-password"
                      className="auth-input"
                      type="password"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Contraseña maestra"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="signup-firstname">
                      Nombre
                    </label>
                    <input
                      id="signup-firstname"
                      className="auth-input"
                      autoComplete="given-name"
                      value={signup.firstName}
                      onChange={(event) => setSignup((prev) => ({ ...prev, firstName: event.target.value }))}
                      placeholder="Ej. Daniel"
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="signup-lastname">
                      Apellido
                    </label>
                    <input
                      id="signup-lastname"
                      className="auth-input"
                      autoComplete="family-name"
                      value={signup.lastName}
                      onChange={(event) => setSignup((prev) => ({ ...prev, lastName: event.target.value }))}
                      placeholder="Ej. Díaz"
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="signup-username">
                      Usuario
                    </label>
                    <input
                      id="signup-username"
                      className="auth-input"
                      autoComplete="username"
                      spellCheck={false}
                      value={signup.username}
                      onChange={(event) => setSignup((prev) => ({ ...prev, username: event.target.value }))}
                      placeholder="Elige un alias único"
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="signup-email">
                      Email de contacto
                    </label>
                    <input
                      id="signup-email"
                      className="auth-input"
                      type="email"
                      autoComplete="email"
                      value={signup.email}
                      onChange={(event) => setSignup((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="correo@dominio.com"
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="signup-password">
                      Contraseña maestra
                    </label>
                    <input
                      id="signup-password"
                      className="auth-input"
                      type="password"
                      autoComplete="new-password"
                      value={signup.password}
                      onChange={(event) => setSignup((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder="Mínimo 12 caracteres"
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="signup-confirm">
                      Confirma tu contraseña
                    </label>
                    <input
                      id="signup-confirm"
                      className="auth-input"
                      type="password"
                      autoComplete="new-password"
                      value={signup.confirm}
                      onChange={(event) => setSignup((prev) => ({ ...prev, confirm: event.target.value }))}
                      placeholder="Repite la contraseña"
                    />
                  </div>
                </>
              )}

              {(localError || error) && (
                <p className={`auth-error${mode === 'create' ? ' auth-field-full' : ''}`} role="alert">
                  {localError || error}
                </p>
              )}

              <button className="auth-submit" type="submit" disabled={isLoading}>
                {isLoading
                  ? 'Sincronizando bóveda...'
                  : mode === 'unlock'
                    ? 'Iniciar sesión'
                    : mode === 'restore'
                      ? 'Restaurar y sincronizar'
                      : 'Crear bóveda segura'}
              </button>

              {mode === 'unlock' && biometricsReady ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    resetMessages()
                    setIsLoading(true)
                    try {
                      const success = await authenticateWithBiometrics()
                      if (success) {
                        const cachedPwd = sessionStorage.getItem('lifekeeper_bio_pwd')
                        if (cachedPwd) {
                          await unlock(cachedPwd, loginUsername.trim())
                        } else {
                          setLocalError(
                            'Identidad biométrica confirmada. Ingresá tu contraseña maestra para reactivar la sesión completa.',
                          )
                        }
                      } else {
                        setLocalError('No se pudo verificar la identidad biométrica.')
                      }
                    } catch {
                      setLocalError('Error al autenticar por biometría.')
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    padding: '0.65rem 1rem',
                    fontSize: '0.875rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <Fingerprint size={18} />
                  <span>Desbloquear con Windows Hello / Huella</span>
                </button>
              ) : null}
            </form>

            <div className="auth-card-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'center' }}>
              <button
                className="auth-switch"
                type="button"
                onClick={() => switchMode(mode === 'unlock' ? 'create' : 'unlock')}
              >
                {mode === 'unlock'
                  ? '¿No tenés cuenta? Creá una bóveda ahora'
                  : 'Volver a iniciar sesión'}
              </button>
              {mode !== 'restore' && (
                <button
                  className="auth-switch"
                  type="button"
                  onClick={() => switchMode('restore')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <CloudDownload size={14} />
                  <span>Restaurar / vincular bóveda desde la nube</span>
                </button>
              )}

              <button
                type="button"
                className="auth-switch"
                onClick={() => setShowServerConfig((prev) => !prev)}
                style={{ fontSize: '0.75rem', opacity: 0.75, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}
              >
                <Server size={12} />
                <span>{showServerConfig ? 'Ocultar servidor' : 'Configurar servidor (APK / Red local)'}</span>
              </button>

              {showServerConfig && (
                <div
                  style={{
                    width: '100%',
                    marginTop: '0.35rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(15, 23, 42, 0.55)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    URL del Servidor LifeKeeper (vacío = automático):
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <input
                      type="url"
                      className="auth-input"
                      style={{ flex: 1, minWidth: '170px', fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                      placeholder="https://app.lifekeeper.lat o http://192.168.0.52"
                      value={serverUrlInput}
                      onChange={(e) => setServerUrlInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                      onClick={() => {
                        setCustomServerUrl(serverUrlInput)
                        setServerSavedMsg('Servidor guardado')
                        setTimeout(() => setServerSavedMsg(null), 2500)
                      }}
                    >
                      Guardar
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => {
                        setServerUrlInput('http://192.168.0.52')
                        setCustomServerUrl('http://192.168.0.52')
                        setServerSavedMsg('Usando LAN 192.168.0.52')
                        setTimeout(() => setServerSavedMsg(null), 2500)
                      }}
                    >
                      LAN (192.168.0.52)
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => {
                        setServerUrlInput('https://app.lifekeeper.lat')
                        setCustomServerUrl('https://app.lifekeeper.lat')
                        setServerSavedMsg('Usando app.lifekeeper.lat')
                        setTimeout(() => setServerSavedMsg(null), 2500)
                      }}
                    >
                      Dominio (app.lifekeeper.lat)
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => {
                        setServerUrlInput('')
                        setCustomServerUrl(null)
                        setServerSavedMsg('Modo automático activo')
                        setTimeout(() => setServerSavedMsg(null), 2500)
                      }}
                    >
                      Automático
                    </button>
                  </div>
                  {serverSavedMsg && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>{serverSavedMsg}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
