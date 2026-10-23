import type { FormEvent } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { TagInput } from '../../components/TagInput'
import { useAppData } from '../../hooks/useAppData'
import { useClipboard } from '../../hooks/useClipboard'
import { checkPasswordPwned, type PwnedCheckResult } from '../../services/api'
import type { PasswordEntry } from '../../types'
import { formatDateTime, safeParseDate } from '../../utils/dates'

type PasswordFormState = {
  service: string
  username: string
  password: string
  notes?: string
  tags: string[]
}

const initialFormState: PasswordFormState = {
  service: '',
  username: '',
  password: '',
  notes: '',
  tags: [],
}

type StrengthLevel = 'Débil' | 'Aceptable' | 'Fuerte' | 'Excelente'

const evaluateStrength = (pwd: string): { level: StrengthLevel; score: number } => {
  if (!pwd) return { level: 'Débil', score: 0 }
  let score = 0
  if (pwd.length >= 8) score += 1
  if (pwd.length >= 12) score += 1
  if (pwd.length >= 16) score += 1
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1
  if (/\d/.test(pwd)) score += 1
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1

  if (score <= 2) return { level: 'Débil', score: 25 }
  if (score <= 3) return { level: 'Aceptable', score: 50 }
  if (score <= 4) return { level: 'Fuerte', score: 75 }
  return { level: 'Excelente', score: 100 }
}

export type PasswordGenOptions = {
  length?: number
  includeUpper?: boolean
  includeLower?: boolean
  includeNumbers?: boolean
  includeSymbols?: boolean
}

export const generateSecurePassword = (options: PasswordGenOptions | number = 18): string => {
  const opts: PasswordGenOptions =
    typeof options === 'number'
      ? { length: options, includeUpper: true, includeLower: true, includeNumbers: true, includeSymbols: true }
      : {
          length: options.length ?? 18,
          includeUpper: options.includeUpper ?? true,
          includeLower: options.includeLower ?? true,
          includeNumbers: options.includeNumbers ?? true,
          includeSymbols: options.includeSymbols ?? true,
        }

  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%^&*()-_=+[]{}?'

  let all = ''
  const requiredChars: string[] = []

  const pick = (charset: string) => {
    const array = new Uint32Array(1)
    window.crypto.getRandomValues(array)
    return charset[array[0] % charset.length]
  }

  if (opts.includeUpper) {
    all += upper
    requiredChars.push(pick(upper))
  }
  if (opts.includeLower) {
    all += lower
    requiredChars.push(pick(lower))
  }
  if (opts.includeNumbers) {
    all += digits
    requiredChars.push(pick(digits))
  }
  if (opts.includeSymbols) {
    all += symbols
    requiredChars.push(pick(symbols))
  }

  // Fallback si desmarcó todo
  if (!all) {
    all = lower + digits
    requiredChars.push(pick(lower), pick(digits))
  }

  const length = Math.max(opts.length ?? 18, requiredChars.length)
  const chars = [...requiredChars]

  for (let i = chars.length; i < length; i += 1) {
    chars.push(pick(all))
  }

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const array = new Uint32Array(1)
    window.crypto.getRandomValues(array)
    const j = array[0] % (i + 1)
    const temp = chars[i]
    chars[i] = chars[j]
    chars[j] = temp
  }

  return chars.join('')
}

export type HealthFilter = 'all' | 'strong' | 'needsAction' | 'weak' | 'repeated' | 'old' | 'pwned'

export const PasswordManagerSection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<PasswordFormState>(initialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<PasswordFormState>(initialFormState)
  const [deletingEntry, setDeletingEntry] = useState<PasswordEntry | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all')
  const [revealed, setRevealed] = useState<string[]>([])
  const { status, copy } = useClipboard()

  // Auditoría de filtraciones HIBP
  const [pwnedCache, setPwnedCache] = useState<Record<string, PwnedCheckResult>>({})
  const [checkingPwnedId, setCheckingPwnedId] = useState<string | null>(null)
  const [isBatchChecking, setIsBatchChecking] = useState(false)
  const [formPwnedCheck, setFormPwnedCheck] = useState<{
    checking: boolean
    result: PwnedCheckResult | null
  }>({ checking: false, result: null })

  // Generador interactivo configurable
  const [showGenerator, setShowGenerator] = useState(false)
  const [genLength, setGenLength] = useState(18)
  const [genUpper, setGenUpper] = useState(true)
  const [genLower, setGenLower] = useState(true)
  const [genNumbers, setGenNumbers] = useState(true)
  const [genSymbols, setGenSymbols] = useState(true)
  const [genPassword, setGenPassword] = useState(() =>
    generateSecurePassword({ length: 18, includeUpper: true, includeLower: true, includeNumbers: true, includeSymbols: true }),
  )

  const refreshGeneratedPassword = (overrideLength?: number) => {
    const next = generateSecurePassword({
      length: overrideLength ?? genLength,
      includeUpper: genUpper,
      includeLower: genLower,
      includeNumbers: genNumbers,
      includeSymbols: genSymbols,
    })
    setGenPassword(next)
  }

  const checkSinglePwned = async (pwd: string, id: string) => {
    if (!pwd) return
    setCheckingPwnedId(id)
    const res = await checkPasswordPwned(pwd)
    setPwnedCache((prev) => ({ ...prev, [pwd]: res }))
    setCheckingPwnedId(null)
  }

  const checkFormPwned = async (pwd: string) => {
    if (!pwd) return
    setFormPwnedCheck({ checking: true, result: null })
    const res = await checkPasswordPwned(pwd)
    setFormPwnedCheck({ checking: false, result: res })
  }

  const handleBatchAuditPwned = async () => {
    setIsBatchChecking(true)
    const uniquePasswords = Array.from(
      new Set(data.security.passwordEntries.map((p) => p.password).filter(Boolean)),
    )
    for (const pwd of uniquePasswords) {
      if (!pwnedCache[pwd]) {
        const res = await checkPasswordPwned(pwd)
        setPwnedCache((prev) => ({ ...prev, [pwd]: res }))
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
    setIsBatchChecking(false)
  }

  const passwords = data.security.passwordEntries

  // Auto-hide revealed passwords after 20 seconds
  useEffect(() => {
    if (revealed.length === 0) return
    const timer = window.setTimeout(() => {
      setRevealed([])
    }, 20000)
    return () => window.clearTimeout(timer)
  }, [revealed])

  const existingTags = useMemo(() => {
    const counts = new Map<string, number>()
    passwords.forEach((entry) => {
      ;(entry.tags ?? []).forEach((tag) => {
        const cleaned = tag.trim()
        if (cleaned) {
          counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1)
        }
      })
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
  }, [passwords])

  const passwordCounts = useMemo(() => {
    const map = new Map<string, number>()
    passwords.forEach((entry) => {
      map.set(entry.password, (map.get(entry.password) ?? 0) + 1)
    })
    return map
  }, [passwords])

  const getEntryHealth = (
    entry: PasswordEntry,
  ): { label: 'Fuerte' | 'Repetida' | 'Débil' | 'Antigua'; badgeClass: string } => {
    const isRepeated = (passwordCounts.get(entry.password) ?? 0) > 1
    if (isRepeated) {
      return { label: 'Repetida', badgeClass: 'badge badge-error' }
    }
    const { level } = evaluateStrength(entry.password)
    if (level === 'Débil') {
      return { label: 'Débil', badgeClass: 'badge badge-error' }
    }
    const updatedDate = safeParseDate(entry.updatedAt)
    const ageDays = updatedDate ? differenceInCalendarDays(new Date(), updatedDate) : 0
    if (ageDays > 180) {
      return { label: 'Antigua', badgeClass: 'badge badge-warning' }
    }
    return { label: 'Fuerte', badgeClass: 'badge badge-success' }
  }

  const auditStats = useMemo(() => {
    let strongCount = 0
    let weakCount = 0
    let repeatedCount = 0
    let oldCount = 0
    let pwnedCount = 0

    passwords.forEach((entry) => {
      const health = getEntryHealth(entry)
      if (health.label === 'Fuerte') {
        strongCount += 1
      } else if (health.label === 'Débil') {
        weakCount += 1
      } else if (health.label === 'Repetida') {
        repeatedCount += 1
      } else if (health.label === 'Antigua') {
        oldCount += 1
      }

      if (pwnedCache[entry.password]?.pwned) {
        pwnedCount += 1
      }
    })

    return {
      total: passwords.length,
      strong: strongCount,
      needsAction: weakCount + repeatedCount + oldCount,
      weak: weakCount,
      repeated: repeatedCount,
      old: oldCount,
      pwned: pwnedCount,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwords, passwordCounts, pwnedCache])

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return passwords.filter((entry) => {
      if (term) {
        const matchesTerm = [entry.service, entry.username, entry.notes ?? '', (entry.tags ?? []).join(' ')]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term))
        if (!matchesTerm) return false
      }

      if (healthFilter === 'all') return true
      if (healthFilter === 'pwned') return Boolean(pwnedCache[entry.password]?.pwned)
      const health = getEntryHealth(entry)
      if (healthFilter === 'strong') return health.label === 'Fuerte'
      if (healthFilter === 'needsAction') return health.label !== 'Fuerte'
      if (healthFilter === 'weak') return health.label === 'Débil'
      if (healthFilter === 'repeated') return health.label === 'Repetida'
      if (healthFilter === 'old') return health.label === 'Antigua'
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwords, searchTerm, healthFilter, passwordCounts, pwnedCache])

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.service.trim() || !formState.password) return

    const nowIso = new Date().toISOString()
    const entry: PasswordEntry = {
      ...formState,
      id: uuid(),
      service: formState.service.trim(),
      username: formState.username.trim(),
      updatedAt: nowIso,
    }

    updateData((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        passwordEntries: [entry, ...previous.security.passwordEntries],
      },
    }))

    setFormState(initialFormState)
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.service.trim() || !editFormState.password) return

    const nowIso = new Date().toISOString()
    updateData((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        passwordEntries: previous.security.passwordEntries.map((entry) =>
          entry.id === editingId
            ? {
                ...entry,
                ...editFormState,
                service: editFormState.service.trim(),
                username: editFormState.username.trim(),
                updatedAt: nowIso,
              }
            : entry,
        ),
      },
    }))

    setEditingId(null)
  }

  const startEdit = (entry: PasswordEntry) => {
    setEditingId(entry.id)
    setEditFormState({
      service: entry.service,
      username: entry.username,
      password: entry.password,
      notes: entry.notes ?? '',
      tags: entry.tags ?? [],
    })
  }

  const toggleReveal = (id: string) => {
    setRevealed((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )
  }

  const handleCopy = (value: string) => {
    copy(value, 30000)
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        passwordEntries: previous.security.passwordEntries.filter((entry) => entry.id !== id),
      },
    }))
    if (editingId === id) {
      setEditingId(null)
    }
  }

  const formStrength = evaluateStrength(formState.password)
  const formStrengthBadgeClass =
    formStrength.level === 'Excelente' || formStrength.level === 'Fuerte'
      ? 'badge badge-success'
      : formStrength.level === 'Aceptable'
        ? 'badge badge-warning'
        : 'badge badge-error'

  return (
    <div>
      <SectionHeader
        title="Gestor de contraseñas"
        subtitle="Todos tus accesos cifrados con la clave maestra, auditoría de fortaleza y portapapeles temporal"
      />

      <div className="section-body compact">
        <div className="stats-grid">
          <div
            className="stat-card"
            style={{ cursor: 'pointer' }}
            onClick={() => setHealthFilter('all')}
            title="Ver todas las credenciales"
          >
            <span className="stat-title">Total guardadas</span>
            <span className="stat-value">{auditStats.total}</span>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer' }}
            onClick={() => setHealthFilter('strong')}
            title="Filtrar por claves fuertes"
          >
            <span className="stat-title">Claves fuertes</span>
            <span className="stat-value">{auditStats.strong}</span>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer' }}
            onClick={() => setHealthFilter('needsAction')}
            title="Filtrar por claves a revisar (débiles, repetidas o >180 días)"
          >
            <span className="stat-title">Por fortalecer / rotar</span>
            <span className="stat-value">{auditStats.needsAction}</span>
            <span className="panel-subtitle">Débiles, repetidas o &gt;180 días</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Nueva credencial</h3>
              <p className="panel-subtitle">
                El temporizador limpia el portapapeles en 30s y oculta las claves visibles en 20s
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setFormState({
                    ...formState,
                    password: generateSecurePassword({
                      length: genLength,
                      includeUpper: genUpper,
                      includeLower: genLower,
                      includeNumbers: genNumbers,
                      includeSymbols: genSymbols,
                    }),
                  })
                }
              >
                Generar clave rápida
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowGenerator(!showGenerator)}
              >
                {showGenerator ? 'Ocultar generador' : 'Generador a medida'}
              </button>
            </div>
          </div>

          {showGenerator && (
            <div className="subpanel field-full" style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>
                    Generador configurable de contraseñas
                  </h4>
                  <p className="panel-subtitle" style={{ margin: '0.2rem 0 0' }}>
                    Personalizá longitud y tipos de caracteres con entropía criptográfica
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => refreshGeneratedPassword()}
                  >
                    ↻ Regenerar
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => handleCopy(genPassword)}
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => setFormState({ ...formState, password: genPassword })}
                  >
                    Usar en formulario
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                  padding: '0.625rem 0.875rem',
                  background: 'var(--color-bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'monospace',
                  fontSize: '0.95rem',
                  wordBreak: 'break-all',
                }}
              >
                <span style={{ flex: 1, letterSpacing: '0.05em' }}>{genPassword}</span>
                <span
                  className={
                    evaluateStrength(genPassword).score >= 75
                      ? 'badge badge-success'
                      : 'badge badge-warning'
                  }
                >
                  {evaluateStrength(genPassword).level}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8125rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span>Longitud de clave:</span>
                    <strong>{genLength} caracteres</strong>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={48}
                    value={genLength}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setGenLength(val)
                      refreshGeneratedPassword(val)
                    }}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={genUpper}
                      onChange={(e) => {
                        setGenUpper(e.target.checked)
                        setTimeout(() => refreshGeneratedPassword(), 0)
                      }}
                    />
                    Mayúsculas (A-Z)
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={genLower}
                      onChange={(e) => {
                        setGenLower(e.target.checked)
                        setTimeout(() => refreshGeneratedPassword(), 0)
                      }}
                    />
                    Minúsculas (a-z)
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={genNumbers}
                      onChange={(e) => {
                        setGenNumbers(e.target.checked)
                        setTimeout(() => refreshGeneratedPassword(), 0)
                      }}
                    />
                    Números (0-9)
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={genSymbols}
                      onChange={(e) => {
                        setGenSymbols(e.target.checked)
                        setTimeout(() => refreshGeneratedPassword(), 0)
                      }}
                    />
                    Símbolos (!@#$)
                  </label>
                </div>
              </div>
            </div>
          )}
          <form className="form-grid two-columns" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="pwd-service">Servicio / sitio</label>
              <input
                id="pwd-service"
                value={formState.service}
                onChange={(event) => setFormState({ ...formState, service: event.target.value })}
                placeholder="Ej. correo, banco, redes"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pwd-user">Usuario</label>
              <input
                id="pwd-user"
                value={formState.username}
                onChange={(event) => setFormState({ ...formState, username: event.target.value })}
                placeholder="Correo o alias"
              />
            </div>
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="pwd-pass">Contraseña</label>
                {formState.password ? (
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => checkFormPwned(formState.password)}
                    disabled={formPwnedCheck.checking}
                  >
                    {formPwnedCheck.checking ? 'Consultando HIBP...' : '🔍 Auditar brechas'}
                  </button>
                ) : null}
              </div>
              <input
                id="pwd-pass"
                type="password"
                value={formState.password}
                onChange={(event) => {
                  setFormState({ ...formState, password: event.target.value })
                  setFormPwnedCheck({ checking: false, result: null })
                }}
                placeholder="Clave del servicio"
                required
              />
              {formState.password ? (
                <div className="chip-list" style={{ marginTop: '0.4rem' }}>
                  <span className="panel-subtitle">Fortaleza:</span>
                  <span className={formStrengthBadgeClass}>{formStrength.level}</span>
                  {formPwnedCheck.result ? (
                    formPwnedCheck.result.pwned ? (
                      <span className="badge badge-error">
                        ⚠️ ¡Filtrada {formPwnedCheck.result.count.toLocaleString()} veces en brechas!
                      </span>
                    ) : (
                      <span className="badge badge-success">
                        🛡️ Sin filtraciones registradas
                      </span>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="pwd-notes">Notas</label>
              <textarea
                id="pwd-notes"
                value={formState.notes ?? ''}
                onChange={(event) => setFormState({ ...formState, notes: event.target.value })}
                placeholder="Datos adicionales, preguntas de seguridad"
              />
            </div>
            <div className="field field-full">
              <label>Etiquetas</label>
              <TagInput
                values={formState.tags}
                onChange={(tags) => setFormState({ ...formState, tags })}
                suggestions={existingTags}
                placeholder="Enter para agregar etiquetas"
              />
            </div>
            <div className="form-actions field-full">
              <button className="primary-button" type="submit">
                Guardar credencial
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 className="panel-title">Bóveda</h3>
              <div className="chip-list" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`chip ${healthFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setHealthFilter('all')}
                >
                  Todas ({auditStats.total})
                </button>
                <button
                  type="button"
                  className={`chip ${healthFilter === 'strong' ? 'active' : ''}`}
                  onClick={() => setHealthFilter('strong')}
                >
                  Fuertes ({auditStats.strong})
                </button>
                {auditStats.needsAction > 0 && (
                  <button
                    type="button"
                    className={`chip ${healthFilter === 'needsAction' ? 'active' : ''}`}
                    onClick={() => setHealthFilter('needsAction')}
                  >
                    Atención ({auditStats.needsAction})
                  </button>
                )}
                {auditStats.weak > 0 && (
                  <button
                    type="button"
                    className={`chip ${healthFilter === 'weak' ? 'active' : ''}`}
                    onClick={() => setHealthFilter('weak')}
                  >
                    Débiles ({auditStats.weak})
                  </button>
                )}
                {auditStats.repeated > 0 && (
                  <button
                    type="button"
                    className={`chip ${healthFilter === 'repeated' ? 'active' : ''}`}
                    onClick={() => setHealthFilter('repeated')}
                  >
                    Repetidas ({auditStats.repeated})
                  </button>
                )}
                {auditStats.old > 0 && (
                  <button
                    type="button"
                    className={`chip ${healthFilter === 'old' ? 'active' : ''}`}
                    onClick={() => setHealthFilter('old')}
                  >
                    &gt;180d ({auditStats.old})
                  </button>
                )}
                {auditStats.pwned > 0 && (
                  <button
                    type="button"
                    className={`chip ${healthFilter === 'pwned' ? 'active' : ''}`}
                    style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                    onClick={() => setHealthFilter('pwned')}
                  >
                    ⚠️ Filtradas ({auditStats.pwned})
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}
                onClick={handleBatchAuditPwned}
                disabled={isBatchChecking || passwords.length === 0}
                title="Compara los hashes de tus claves con HaveIBeenPwned usando k-anonymity (100% privado)"
              >
                {isBatchChecking ? 'Auditando brechas...' : '🔍 Auditar brechas (HIBP)'}
              </button>
              <div className="search-input-wrap">
                <Search size={15} className="search-input-icon" aria-hidden />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por servicio o etiqueta"
                  aria-label="Buscar por servicio o etiqueta"
                />
              </div>
            </div>
          </div>
          {filteredEntries.length === 0 ? (
            <div className="empty-state">Todavía no hay contraseñas almacenadas.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Usuario</th>
                  <th>Contraseña</th>
                  <th>Salud</th>
                  <th>Etiquetas</th>
                  <th>Notas</th>
                  <th>Última actualización</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const health = getEntryHealth(entry)
                  return (
                    <tr key={entry.id}>
                      <td>{entry.service}</td>
                      <td>{entry.username || '—'}</td>
                      <td>
                        {revealed.includes(entry.id) ? entry.password : '••••••'}
                        <div className="section-actions">
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => toggleReveal(entry.id)}
                          >
                            {revealed.includes(entry.id) ? 'Ocultar' : 'Mostrar'}
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => handleCopy(entry.password)}
                          >
                            Copiar
                          </button>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                          <span className={health.badgeClass}>{health.label}</span>
                          {pwnedCache[entry.password] ? (
                            pwnedCache[entry.password].pwned ? (
                              <span
                                className="badge badge-error"
                                style={{ fontSize: '0.7rem' }}
                                title={`Filtrada en ${pwnedCache[entry.password].count.toLocaleString()} brechas públicas`}
                              >
                                ⚠️ Filtrada ({pwnedCache[entry.password].count})
                              </span>
                            ) : (
                              <span
                                className="badge badge-success"
                                style={{ fontSize: '0.7rem' }}
                                title="No encontrada en bases de datos vulneradas"
                              >
                                🛡️ Sin brechas
                              </span>
                            )
                          ) : (
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ fontSize: '0.6875rem', padding: '0.1rem 0.35rem' }}
                              onClick={() => checkSinglePwned(entry.password, entry.id)}
                              disabled={checkingPwnedId === entry.id}
                            >
                              {checkingPwnedId === entry.id ? '...' : 'Auditar'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        {entry.tags && entry.tags.length > 0 ? (
                          <div className="chip-list">
                            {entry.tags.map((tag) => (
                              <span key={tag} className="chip">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{entry.notes || '—'}</td>
                      <td>{formatDateTime(entry.updatedAt)}</td>
                      <td>
                        <div className="section-actions">
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => startEdit(entry)}
                          >
                            Editar
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => setDeletingEntry(entry)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {status === 'copied' ? (
            <p className="panel-subtitle">Copiada. Se limpia sola en 30 segundos.</p>
          ) : null}
        </div>
      </div>

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Editar credencial"
        subtitle="Modificá los accesos o datos del servicio"
        maxWidth="640px"
      >
        <form className="form-grid two-columns" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-pwd-service">Servicio / sitio</label>
            <input
              id="edit-pwd-service"
              value={editFormState.service}
              onChange={(event) =>
                setEditFormState({ ...editFormState, service: event.target.value })
              }
              placeholder="Ej. correo, banco, redes"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="edit-pwd-user">Usuario</label>
            <input
              id="edit-pwd-user"
              value={editFormState.username}
              onChange={(event) =>
                setEditFormState({ ...editFormState, username: event.target.value })
              }
              placeholder="Correo o alias"
            />
          </div>
          <div className="field">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <label htmlFor="edit-pwd-pass">Contraseña</label>
              <button
                className="secondary-button"
                type="button"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                onClick={() =>
                  setEditFormState({
                    ...editFormState,
                    password: generateSecurePassword(18),
                  })
                }
              >
                Generar
              </button>
            </div>
            <input
              id="edit-pwd-pass"
              type="text"
              value={editFormState.password}
              onChange={(event) =>
                setEditFormState({ ...editFormState, password: event.target.value })
              }
              placeholder="Clave del servicio"
              required
            />
            {editFormState.password ? (
              <div className="chip-list">
                <span className="panel-subtitle">Fortaleza:</span>
                <span className="badge badge-info">
                  {evaluateStrength(editFormState.password).level}
                </span>
              </div>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="edit-pwd-notes">Notas</label>
            <textarea
              id="edit-pwd-notes"
              value={editFormState.notes ?? ''}
              onChange={(event) =>
                setEditFormState({ ...editFormState, notes: event.target.value })
              }
              placeholder="Datos adicionales, preguntas de seguridad"
            />
          </div>
          <div className="field field-full">
            <label>Etiquetas</label>
            <TagInput
              values={editFormState.tags}
              onChange={(tags) => setEditFormState({ ...editFormState, tags })}
              suggestions={existingTags}
              placeholder="Enter para agregar etiquetas"
            />
          </div>
          <div
            className="form-actions field-full"
            style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}
          >
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditingId(null)}
            >
              Cancelar
            </button>
            <button className="primary-button" type="submit">
              Guardar cambios
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deletingEntry)}
        title="Eliminar credencial"
        message={
          deletingEntry
            ? `¿Querés eliminar la credencial de "${deletingEntry.service}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deletingEntry) {
            handleRemove(deletingEntry.id)
          }
        }}
        onClose={() => setDeletingEntry(null)}
      />
    </div>
  )
}
