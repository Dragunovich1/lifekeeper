import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { UserProfile } from '../../types'

interface ProfileFormState {
  fullName: string
  nickName: string
  bio: string
  birthDate: string
  country: string
  avatar?: string
  auth: {
    username: string
    email: string
    phone: string
    twoFactorEnabled: boolean
    recoveryEmail: string
    securityQuestion: string
    securityAnswerHint: string
  }
}

const toFormState = (profile: UserProfile): ProfileFormState => ({
  fullName: profile.fullName ?? '',
  nickName: profile.nickName ?? '',
  bio: profile.bio ?? '',
  birthDate: profile.birthDate ?? '',
  country: profile.country ?? '',
  avatar: profile.avatar,
  auth: {
    username: profile.auth.username ?? '',
    email: profile.auth.email ?? '',
    phone: profile.auth.phone ?? '',
    twoFactorEnabled: Boolean(profile.auth.twoFactorEnabled),
    recoveryEmail: profile.auth.recoveryEmail ?? '',
    securityQuestion: profile.auth.securityQuestion ?? '',
    securityAnswerHint: profile.auth.securityAnswerHint ?? '',
  },
})

export const ProfileSection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<ProfileFormState>(() => toFormState(data.profile))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFormState(toFormState(data.profile))
  }, [data.profile])

  const avatarInitials = useMemo(() => {
    if (formState.fullName) {
      return formState.fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((chunk) => chunk.charAt(0).toUpperCase())
        .join('')
    }
    return 'LK'
  }, [formState.fullName])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setStatus(null)
    setError(null)

    try {
      updateData((previous) => ({
        ...previous,
        profile: {
          ...previous.profile,
          fullName: formState.fullName,
          nickName: formState.nickName || undefined,
          bio: formState.bio || undefined,
          birthDate: formState.birthDate || undefined,
          country: formState.country || undefined,
          avatar: formState.avatar,
          auth: {
            ...previous.profile.auth,
            username: formState.auth.username,
            email: formState.auth.email,
            phone: formState.auth.phone || undefined,
            twoFactorEnabled: formState.auth.twoFactorEnabled,
            recoveryEmail: formState.auth.recoveryEmail || undefined,
            securityQuestion: formState.auth.securityQuestion || undefined,
            securityAnswerHint: formState.auth.securityAnswerHint || undefined,
          },
          updatedAt: new Date().toISOString(),
        },
      }))
      setStatus('Datos de perfil actualizados correctamente.')
    } catch {
      setError('No pudimos guardar los cambios, intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (file?: File) => {
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen valido.')
      return
    }
    const dataUrl = await readFileAsDataUrl(file)
    setFormState((prev) => ({ ...prev, avatar: dataUrl }))
    setStatus(null)
  }

  return (
    <div>
      <SectionHeader
        title="Perfil de usuario"
        subtitle="Actualiza tu informacion basica, avatar y opciones de inicio de sesion"
      />

      <form className="section-body" onSubmit={handleSubmit}>
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Datos personales</h3>
          </div>
          <div className="profile-avatar-wrapper">
            {formState.avatar ? (
              <img className="profile-avatar" src={formState.avatar} alt="Avatar del usuario" />
            ) : (
              <div className="profile-avatar placeholder">{avatarInitials}</div>
            )}
            <div className="profile-avatar-actions">
              <label className="secondary-button" htmlFor="profile-avatar-input">
                Subir foto
              </label>
              <input
                id="profile-avatar-input"
                type="file"
                accept="image/*"
                hidden
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  await handleAvatarChange(file)
                  if (event.target) {
                    event.target.value = ''
                  }
                }}
              />
              {formState.avatar ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setFormState((prev) => ({ ...prev, avatar: undefined }))
                    setStatus(null)
                  }}
                >
                  Quitar foto
                </button>
              ) : null}
            </div>
          </div>

          <div className="form-grid two-columns">
            <div className="field">
              <label htmlFor="profile-fullname">Nombre completo</label>
              <input
                id="profile-fullname"
                value={formState.fullName}
                onChange={(event) => setFormState({ ...formState, fullName: event.target.value })}
                placeholder="Ej. Juan Perez"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-nickname">Alias</label>
              <input
                id="profile-nickname"
                value={formState.nickName}
                onChange={(event) => setFormState({ ...formState, nickName: event.target.value })}
                placeholder="Como te gusta que te llamen"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-birth">Fecha de nacimiento</label>
              <input
                id="profile-birth"
                type="date"
                value={formState.birthDate || ''}
                onChange={(event) => setFormState({ ...formState, birthDate: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-country">Pais / Ciudad</label>
              <input
                id="profile-country"
                value={formState.country}
                onChange={(event) => setFormState({ ...formState, country: event.target.value })}
                placeholder="Ubicacion"
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="profile-bio">Acerca de ti</label>
              <textarea
                id="profile-bio"
                value={formState.bio}
                onChange={(event) => setFormState({ ...formState, bio: event.target.value })}
                placeholder="Resena corta, intereses, notas"
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Datos de autenticacion</h3>
          </div>
          <div className="form-grid two-columns">
            <div className="field">
              <label htmlFor="profile-username">Usuario</label>
              <input
                id="profile-username"
                value={formState.auth.username}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    auth: { ...formState.auth, username: event.target.value },
                  })
                }
                placeholder="Nombre de usuario"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-email">Email principal</label>
              <input
                id="profile-email"
                type="email"
                value={formState.auth.email}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    auth: { ...formState.auth, email: event.target.value },
                  })
                }
                placeholder="correo@dominio.com"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-phone">Telefono</label>
              <input
                id="profile-phone"
                value={formState.auth.phone}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    auth: { ...formState.auth, phone: event.target.value },
                  })
                }
                placeholder="Numero movil"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-recovery">Email de recuperacion</label>
              <input
                id="profile-recovery"
                type="email"
                value={formState.auth.recoveryEmail}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    auth: { ...formState.auth, recoveryEmail: event.target.value },
                  })
                }
                placeholder="Contacto alternativo"
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="toggle-field">
                <input
                  type="checkbox"
                  checked={formState.auth.twoFactorEnabled}
                  onChange={(event) =>
                    setFormState({
                      ...formState,
                      auth: { ...formState.auth, twoFactorEnabled: event.target.checked },
                    })
                  }
                />
                Activar doble factor (registrado manualmente)
              </label>
            </div>
            <div className="field">
              <label htmlFor="profile-question">Pregunta de seguridad</label>
              <input
                id="profile-question"
                value={formState.auth.securityQuestion}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    auth: { ...formState.auth, securityQuestion: event.target.value },
                  })
                }
                placeholder="Ej. Lugar de nacimiento"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-answer">Pista de respuesta</label>
              <input
                id="profile-answer"
                value={formState.auth.securityAnswerHint}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    auth: { ...formState.auth, securityAnswerHint: event.target.value },
                  })
                }
                placeholder="Solo una pista, no la respuesta completa"
              />
            </div>
          </div>
        </div>

        <div className="section-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
        {status ? <p className="panel-subtitle">{status}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}
      </form>
    </div>
  )
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = (event) => reject(event)
    reader.readAsDataURL(file)
  })

