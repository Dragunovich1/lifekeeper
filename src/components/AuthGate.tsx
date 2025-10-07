import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useAppDataUnsafe } from '../hooks/useAppData'
import { loadProfileMeta, storeProfileMeta, type StoredProfileMeta } from '../utils/storage'

const passwordHints = [
  'Activa recordatorios de respaldo periódicos.',
  'Guardá tu contraseña maestra en un gestor externo confiable.',
  'Actualizá tus datos de contacto para recuperar acceso rápidamente.',
]

const socialProviders = [
  { key: 'google', label: 'Google', icon: '🟢' },
  { key: 'facebook', label: 'Facebook', icon: '🔵' },
  { key: 'apple', label: 'Apple', icon: '⚪️' },
] as const

type AuthMode = 'unlock' | 'create'

const initialSignup = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  confirm: '',
}

export const AuthGate = ({ children }: { children: ReactNode }) => {
  const { data, masterPassword, hasVault, unlock, createVault, error, updateData } = useAppDataUnsafe()
  const [mode, setMode] = useState<AuthMode>(hasVault ? 'unlock' : 'create')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signup, setSignup] = useState(initialSignup)
  const [storedMeta, setStoredMeta] = useState<StoredProfileMeta | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const showApp = Boolean(masterPassword && data)

  useEffect(() => {
    const meta = loadProfileMeta()
    setStoredMeta(meta)
    if (meta?.username) {
      setLoginUsername(meta.username)
    }
  }, [])

  useEffect(() => {
    setMode(hasVault ? 'unlock' : 'create')
  }, [hasVault])

  const hint = useMemo(() => passwordHints[Math.floor(Math.random() * passwordHints.length)], [])

  const resetMessages = () => {
    setLocalError(null)
    setStatusMessage(null)
  }

  const handleSocialClick = (provider: string) => {
    setStatusMessage(`La integración directa con ${provider} estará disponible próximamente.`)
  }

  if (showApp) {
    return <>{children}</>
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()

    if (mode === 'unlock') {
      if (!loginUsername.trim()) {
        setLocalError('Ingresa tu usuario para continuar')
        return
      }
      if (!loginPassword.trim()) {
        setLocalError('Ingresa tu contraseña maestra')
        return
      }
      if (
        storedMeta?.username &&
        storedMeta.username.trim().toLowerCase() !== loginUsername.trim().toLowerCase()
      ) {
        setLocalError('El usuario ingresado no coincide con el registrado en esta bóveda')
        return
      }

      try {
        setIsLoading(true)
        await unlock(loginPassword)
        setStatusMessage(`Bienvenido de nuevo, ${loginUsername.trim()}!`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No pudimos procesar el ingreso'
        setLocalError(message)
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (!signup.fullName.trim()) {
      setLocalError('Ingresa tu nombre completo')
      return
    }
    if (!signup.username.trim()) {
      setLocalError('Define un nombre de usuario')
      return
    }
    if (!signup.email.trim()) {
      setLocalError('Necesitamos un email de contacto')
      return
    }
    if (!signup.password.trim()) {
      setLocalError('Configura una contraseña maestra segura')
      return
    }
    if (signup.password !== signup.confirm) {
      setLocalError('Las contraseñas no coinciden')
      return
    }

    try {
      setIsLoading(true)
      await createVault(signup.password)
      const meta = { username: signup.username.trim(), email: signup.email.trim() }
      storeProfileMeta(meta)
      setStoredMeta(meta)
      updateData((previous) => ({
        ...previous,
        profile: {
          ...previous.profile,
          fullName: signup.fullName.trim(),
          nickName: signup.username.trim(),
          avatar: previous.profile.avatar,
          auth: {
            ...previous.profile.auth,
            username: signup.username.trim(),
            email: signup.email.trim(),
            phone: previous.profile.auth.phone,
            twoFactorEnabled: false,
          },
          updatedAt: new Date().toISOString(),
        },
      }))
      setSignup(initialSignup)
      setMode('unlock')
      setLoginUsername(meta.username)
      setLoginPassword('')
      setStatusMessage('Bóveda creada con éxito. Iniciá sesión con tus nuevas credenciales.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No pudimos crear la bóveda'
      setLocalError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <div className="auth-hero-content">
          <h1 className="auth-hero-title">LifeKeeper</h1>
          <p className="auth-hero-description">
            Tu centro privado para salud, finanzas y recuerdos. Organizado, cifrado y siempre disponible.
          </p>
          <ul className="auth-benefits">
            <li>🛡️ Bóveda cifrada con contraseña maestra</li>
            <li>🩺 Historial clínico, medicamentos y contactos SOS</li>
            <li>🔐 Gestor de contraseñas con borrado automático del portapapeles</li>
            <li>📊 Finanzas, proyectos y recordatorios sincronizados</li>
          </ul>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Acciones de autenticación">
          <button
            type="button"
            className={`auth-tab ${mode === 'unlock' ? 'active' : ''}`}
            onClick={() => {
              setMode('unlock')
              resetMessages()
            }}
            role="tab"
            aria-selected={mode === 'unlock'}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'create' ? 'active' : ''}`}
            onClick={() => {
              setMode('create')
              resetMessages()
            }}
            role="tab"
            aria-selected={mode === 'create'}
          >
            Crear bóveda
          </button>
        </div>

        <div>
          <h2 className="auth-title">
            {mode === 'unlock' ? 'Bienvenido nuevamente' : 'Crea tu espacio seguro'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'unlock'
              ? 'Accede con tu usuario y contraseña maestra para continuar.'
              : 'Ingresa tus datos principales para iniciar tu bóveda protegida.'}
          </p>
        </div>

        {statusMessage ? <p className="auth-status">{statusMessage}</p> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'unlock' ? (
            <>
              <label className="auth-label" htmlFor="login-username">
                Usuario
              </label>
              <input
                id="login-username"
                className="auth-input"
                autoComplete="username"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                placeholder="Usuario registrado"
              />
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
            </>
          ) : (
            <>
              <label className="auth-label" htmlFor="signup-fullname">
                Nombre completo
              </label>
              <input
                id="signup-fullname"
                className="auth-input"
                autoComplete="name"
                value={signup.fullName}
                onChange={(event) => setSignup((prev) => ({ ...prev, fullName: event.target.value }))}
                placeholder="Ej. Ana Gómez"
              />
              <label className="auth-label" htmlFor="signup-username">
                Usuario
              </label>
              <input
                id="signup-username"
                className="auth-input"
                autoComplete="username"
                value={signup.username}
                onChange={(event) => setSignup((prev) => ({ ...prev, username: event.target.value }))}
                placeholder="Elige un alias único"
              />
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
            </>
          )}

          {(localError || error) && <p className="auth-error">{localError || error}</p>}

          <button className="auth-submit" type="submit" disabled={isLoading}>
            {isLoading
              ? 'Procesando...'
              : mode === 'unlock'
              ? 'Iniciar sesión'
              : 'Crear bóveda segura'}
          </button>
        </form>

        <div className="auth-divider">
          <span>o continua con</span>
        </div>

        <div className="auth-socials">
          {socialProviders.map((provider) => (
            <button
              key={provider.key}
              type="button"
              className="auth-social-button"
              onClick={() => handleSocialClick(provider.label)}
            >
              <span className="auth-social-icon" aria-hidden>
                {provider.icon}
              </span>
              {provider.label}
            </button>
          ))}
        </div>

        <div className="auth-footer">
          <p className="auth-hint">{hint}</p>
          <button
            className="auth-switch"
            type="button"
            onClick={() => {
              setMode((prev) => (prev === 'unlock' ? 'create' : 'unlock'))
              resetMessages()
              setLoginPassword('')
            }}
          >
            {mode === 'unlock'
              ? '¿No tenés cuenta? Creá una bóveda ahora'
              : 'Ya tengo una bóveda, volver al inicio de sesión'}
          </button>
        </div>
      </div>
    </div>
  )
}
