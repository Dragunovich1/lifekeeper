import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Dumbbell, HeartPulse, Info, Sparkles, ShieldCheck } from 'lucide-react'
import { DatePicker } from '../../components/DatePicker'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import { usePreferences } from '../../preferences/context'
import type { UserProfile } from '../../types'
import { fromLocalDateOrDateTime, toLocalDateKey } from '../../utils/dates'
import { downloadEmergencyKitPdf } from '../../services/crypto/emergencyKit'

interface ProfileFormState {
  firstName: string
  lastName: string
  fullName: string
  nickName: string
  bio: string
  birthDate: string
  country: string
  avatar?: string
  heightCm: number | ''
  weightKg: number | ''
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

const toFormState = (profile: UserProfile): ProfileFormState => {
  let firstName = profile.firstName ?? ''
  let lastName = profile.lastName ?? ''
  const fullName = profile.fullName ?? ''

  if ((!firstName || !lastName) && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/)
    if (!firstName) firstName = parts[0] || ''
    if (!lastName && parts.length > 1) lastName = parts.slice(1).join(' ')
  }

  const computedFullName = (firstName && lastName)
    ? `${firstName} ${lastName}`.trim()
    : (firstName || lastName || fullName)

  return {
    firstName,
    lastName,
    fullName: computedFullName,
    nickName: profile.nickName ?? '',
    bio: profile.bio ?? '',
    birthDate: profile.birthDate ?? '',
    country: profile.country ?? '',
    avatar: profile.avatar,
    heightCm: typeof profile.heightCm === 'number' && profile.heightCm > 0 ? profile.heightCm : '',
    weightKg: typeof profile.weightKg === 'number' && profile.weightKg > 0 ? profile.weightKg : '',
    auth: {
      username: profile.auth.username ?? '',
      email: profile.auth.email ?? '',
      phone: profile.auth.phone ?? '',
      twoFactorEnabled: Boolean(profile.auth.twoFactorEnabled),
      recoveryEmail: profile.auth.recoveryEmail ?? '',
      securityQuestion: profile.auth.securityQuestion ?? '',
      securityAnswerHint: profile.auth.securityAnswerHint ?? '',
    },
  }
}

export const ProfileSection = () => {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const isImperial = preferences.unitSystem === 'imperial'

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

  // Cálculo de IMC y métricas de salud deportiva
  const bmiData = useMemo(() => {
    const heightCm = typeof formState.heightCm === 'number' ? formState.heightCm : 0
    const weightKg = typeof formState.weightKg === 'number' ? formState.weightKg : 0

    if (heightCm < 80 || weightKg < 25) {
      return null
    }

    const heightM = heightCm / 100
    const rawBmi = weightKg / (heightM * heightM)
    const bmi = Number(rawBmi.toFixed(1))

    let category = 'Peso saludable'
    let badgeClass = 'badge badge-success'
    let meterColor = 'var(--color-success)'
    let advice =
      'Tu índice se encuentra en el rango saludable recomendado por la OMS. Es una base óptima para entrenamientos continuos de fuerza, acondicionamiento y resistencia aeróbica.'

    if (bmi < 18.5) {
      category = 'Bajo peso'
      badgeClass = 'badge badge-warning'
      meterColor = 'var(--color-warning)'
      advice =
        'Tu índice se sitúa por debajo del rango estándar. Para acompañar futuros planes de entrenamiento, se aconseja priorizar superávit calórico nutritivo y ejercicios anaeróbicos de fuerza con recuperación adecuada.'
    } else if (bmi >= 25 && bmi < 30) {
      category = 'Sobrepeso'
      badgeClass = 'badge badge-warning'
      meterColor = 'var(--color-warning)'
      advice =
        'Tu índice refleja un ligero sobrepeso respecto a tu estatura. Te sugerimos complementar rutinas de fuerza con trabajo cardiovascular moderado, óptima hidratación y descansos regulares.'
    } else if (bmi >= 30) {
      category = 'Obesidad'
      badgeClass = 'badge badge-error'
      meterColor = 'var(--color-error)'
      advice =
        'Es aconsejable una evaluación médica o nutricional antes de encarar entrenamientos de alta exigencia. Se recomienda iniciar con actividades aeróbicas de bajo impacto articular (caminatas, natación o bicicleta).'
    }

    const minHealthyKg = 18.5 * (heightM * heightM)
    const maxHealthyKg = 24.9 * (heightM * heightM)

    const minHealthyDisplay = isImperial
      ? `${(minHealthyKg * 2.20462).toFixed(1)} lb`
      : `${minHealthyKg.toFixed(1)} kg`
    const maxHealthyDisplay = isImperial
      ? `${(maxHealthyKg * 2.20462).toFixed(1)} lb`
      : `${maxHealthyKg.toFixed(1)} kg`

    // Escala 15 a 40 para el medidor visual
    const scalePercent = Math.min(100, Math.max(0, ((bmi - 15) / (40 - 15)) * 100))

    return {
      bmi,
      category,
      badgeClass,
      meterColor,
      advice,
      minHealthyDisplay,
      maxHealthyDisplay,
      scalePercent,
    }
  }, [formState.heightCm, formState.weightKg, isImperial])

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
          firstName: formState.firstName.trim() || undefined,
          lastName: formState.lastName.trim() || undefined,
          fullName: (formState.firstName.trim() && formState.lastName.trim())
            ? `${formState.firstName.trim()} ${formState.lastName.trim()}`
            : formState.firstName.trim() || formState.lastName.trim() || formState.fullName.trim(),
          nickName: formState.nickName || undefined,
          bio: formState.bio || undefined,
          birthDate: formState.birthDate
            ? fromLocalDateOrDateTime(formState.birthDate) || undefined
            : undefined,
          country: formState.country || undefined,
          avatar: formState.avatar,
          heightCm:
            typeof formState.heightCm === 'number' && formState.heightCm > 0
              ? formState.heightCm
              : undefined,
          weightKg:
            typeof formState.weightKg === 'number' && formState.weightKg > 0
              ? formState.weightKg
              : undefined,
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
      setError('No pudimos guardar los cambios, intentá nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (file?: File) => {
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Seleccioná un archivo de imagen válido.')
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
        subtitle="Actualizá tu información básica, avatar y opciones de inicio de sesión"
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
              <label htmlFor="profile-firstname">Nombre</label>
              <input
                id="profile-firstname"
                value={formState.firstName}
                onChange={(event) => {
                  const first = event.target.value
                  setFormState({
                    ...formState,
                    firstName: first,
                    fullName: `${first} ${formState.lastName}`.trim(),
                  })
                }}
                placeholder="Ej. Daniel"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-lastname">Apellido</label>
              <input
                id="profile-lastname"
                value={formState.lastName}
                onChange={(event) => {
                  const last = event.target.value
                  setFormState({
                    ...formState,
                    lastName: last,
                    fullName: `${formState.firstName} ${last}`.trim(),
                  })
                }}
                placeholder="Ej. Díaz"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-nickname">Alias</label>
              <input
                id="profile-nickname"
                value={formState.nickName}
                onChange={(event) => setFormState({ ...formState, nickName: event.target.value })}
                placeholder="Cómo te gusta que te llamen"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-birth">Fecha de nacimiento</label>
              <DatePicker
                id="profile-birth"
                value={toLocalDateKey(formState.birthDate)}
                onChange={(value) =>
                  setFormState({
                    ...formState,
                    birthDate: fromLocalDateOrDateTime(value),
                  })
                }
                ariaLabel="Fecha de nacimiento"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-country">País o ciudad</label>
              <input
                id="profile-country"
                value={formState.country}
                onChange={(event) => setFormState({ ...formState, country: event.target.value })}
                placeholder="Ubicación"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-height">
                Altura {isImperial ? '(pulgadas / in)' : '(cm)'}
              </label>
              <input
                id="profile-height"
                type="number"
                step={isImperial ? '0.5' : '1'}
                min="0"
                value={
                  isImperial
                    ? formState.heightCm
                      ? Math.round(formState.heightCm / 2.54)
                      : ''
                    : formState.heightCm || ''
                }
                onChange={(event) => {
                  const val = event.target.value === '' ? '' : Number(event.target.value)
                  if (val === '') {
                    setFormState((prev) => ({ ...prev, heightCm: '' }))
                  } else if (isImperial) {
                    setFormState((prev) => ({ ...prev, heightCm: Math.round(val * 2.54) }))
                  } else {
                    setFormState((prev) => ({ ...prev, heightCm: val }))
                  }
                }}
                placeholder={isImperial ? 'Ej. 69' : 'Ej. 175'}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-weight">
                Peso {isImperial ? '(libras / lb)' : '(kg)'}
              </label>
              <input
                id="profile-weight"
                type="number"
                step="0.1"
                min="0"
                value={
                  isImperial
                    ? formState.weightKg
                      ? Number((formState.weightKg * 2.20462).toFixed(1))
                      : ''
                    : formState.weightKg || ''
                }
                onChange={(event) => {
                  const val = event.target.value === '' ? '' : Number(event.target.value)
                  if (val === '') {
                    setFormState((prev) => ({ ...prev, weightKg: '' }))
                  } else if (isImperial) {
                    setFormState((prev) => ({
                      ...prev,
                      weightKg: Number((val / 2.20462).toFixed(2)),
                    }))
                  } else {
                    setFormState((prev) => ({ ...prev, weightKg: val }))
                  }
                }}
                placeholder={isImperial ? 'Ej. 165' : 'Ej. 72.5'}
              />
            </div>
            <div className="field field-full">
              <label htmlFor="profile-bio">Reseña</label>
              <textarea
                id="profile-bio"
                value={formState.bio}
                onChange={(event) => setFormState({ ...formState, bio: event.target.value })}
                placeholder="Reseña corta, intereses, notas"
              />
            </div>

            {/* Subpanel de IMC y Composición corporal */}
            <div className="subpanel field-full" style={{ marginTop: '0.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HeartPulse size={18} style={{ color: 'var(--color-accent-blue)' }} />
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>
                    Composición corporal e IMC
                  </h4>
                </div>
                {bmiData ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: bmiData.meterColor }}>
                      {bmiData.bmi}
                    </span>
                    <span className={bmiData.badgeClass}>{bmiData.category}</span>
                  </div>
                ) : null}
              </div>

              {bmiData ? (
                <div>
                  <div style={{ position: 'relative', marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                    <div
                      style={{
                        height: '8px',
                        borderRadius: '999px',
                        background:
                          'linear-gradient(90deg, #38bdf8 0%, #34d399 28%, #fbbf24 65%, #f87171 100%)',
                        width: '100%',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '-5px',
                        left: `${bmiData.scalePercent}%`,
                        transform: 'translateX(-50%)',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'var(--color-surface)',
                        border: `3px solid ${bmiData.meterColor}`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                      }}
                      title={`Tu IMC: ${bmiData.bmi}`}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <span>Bajo peso (&lt;18.5)</span>
                    <span>Saludable (18.5-24.9)</span>
                    <span>Sobrepeso (25-29.9)</span>
                    <span>Obesidad (≥30)</span>
                  </div>

                  <div className="smart-card">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        Rango de peso saludable sugerido para tu estatura:
                      </span>
                      <strong style={{ fontSize: '0.875rem', color: 'var(--color-success)' }}>
                        {bmiData.minHealthyDisplay} - {bmiData.maxHealthyDisplay}
                      </strong>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '0.625rem',
                        alignItems: 'flex-start',
                        marginTop: '0.25rem',
                      }}
                    >
                      <Sparkles
                        size={16}
                        style={{
                          color: 'var(--color-accent-blue)',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      />
                      <div style={{ fontSize: '0.8125rem', lineHeight: '1.45' }}>
                        <div>{bmiData.advice}</div>
                        <div
                          style={{
                            marginTop: '0.35rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                          }}
                        >
                          <span
                            style={{
                              color: 'var(--color-text-muted)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <Dumbbell size={13} style={{ flexShrink: 0 }} />
                            Métricas sincronizadas con tus registros de fuerza y entrenamientos.
                          </span>
                          <a
                            href="#personal:workouts"
                            className="secondary-button"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                          >
                            Ver entrenamientos ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.625rem 0.875rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-sunken)',
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <Info size={16} style={{ color: 'var(--color-accent-blue)', flexShrink: 0 }} />
                  <span>
                    Completá tu altura y peso para calcular tu Índice de Masa Corporal (IMC), conocer tu
                    peso saludable de referencia y recibir sugerencias para tus entrenamientos.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Autenticación y contraseña</h3>
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
              <label htmlFor="profile-phone">Teléfono</label>
              <input
                id="profile-phone"
                value={formState.auth.phone}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    auth: { ...formState.auth, phone: event.target.value },
                  })
                }
                placeholder="Número móvil"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-recovery">Email de recuperación</label>
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
            <div className="field field-full">
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
                Activar doble factor de autenticación (registrado manualmente)
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
              <label htmlFor="profile-answer">Pista de respuesta o contraseña</label>
              <input
                id="profile-answer"
                value={formState.auth.securityAnswerHint}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    auth: { ...formState.auth, securityAnswerHint: event.target.value },
                  })
                }
                placeholder="Todavía sin pista cargada (no escribas la contraseña completa)"
              />
            </div>
            <div className="field field-full">
              <div className="subpanel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)' }}>
                    <ShieldCheck size={18} color="var(--color-accent-blue)" />
                    Kit de Emergencia y Rescate (PDF A4)
                  </strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Descargá el documento confidencial con las 24 palabras mnemónicas de rescate para recuperar tu cuenta.
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    try {
                      await downloadEmergencyKitPdf({
                        userEmail: formState.auth.email || 'usuario@lifekeeper.local',
                        userName: formState.fullName || formState.nickName,
                      })
                      setStatus('Kit de Emergencia descargado correctamente.')
                      setError(null)
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Error al generar el PDF del Kit')
                    }
                  }}
                >
                  Descargar Kit PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="section-actions">
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
