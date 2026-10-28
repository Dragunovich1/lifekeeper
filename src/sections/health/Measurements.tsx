import { useMemo, useState, type FormEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { Activity, ChevronDown, Copy, Droplet, FlaskConical, HeartPulse, Pencil, Plus, Thermometer, Trash2, Wind } from 'lucide-react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { HealthMeasurement, MeasurementType, MoodLevel } from '../../types'
import { toLocalDateKey, toLocalTimeKey } from '../../utils/dates'
import {
  FEELINGS,
  MEASUREMENT_META,
  MEASUREMENT_TYPES,
  SYMPTOM_OPTIONS,
  buildDoctorSummary,
  classifyMeasurement,
  defaultContext,
  feelingEmoji,
  formatMeasurement,
  formatMeasurementUnit,
  measurementTimestamp,
  statsFor,
} from '../../utils/measurements'
import '../../styles/measurements.css'

const ICONS: Record<MeasurementType, typeof Droplet> = {
  glucosa: Droplet,
  presion: HeartPulse,
  pulso: Activity,
  saturacion: Wind,
  temperatura: Thermometer,
  colesterol: FlaskConical,
}


interface FormState {
  type: MeasurementType
  value: string
  value2: string
  pulse: string
  date: string
  time: string
  context: string
  feeling: MoodLevel | ''
  symptoms: string[]
  notes: string
}

const emptyForm = (type: MeasurementType = 'glucosa'): FormState => ({
  type,
  value: '',
  value2: '',
  pulse: '',
  date: toLocalDateKey(new Date()),
  time: toLocalTimeKey(new Date()),
  context: defaultContext(type),
  feeling: '',
  symptoms: [],
  notes: '',
})

const num = (s: string): number | undefined => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

const dayLabel = (dateKey: string): string => {
  const today = toLocalDateKey(new Date())
  const yesterday = toLocalDateKey(new Date(Date.now() - 86_400_000))
  if (dateKey === today) return 'Hoy'
  if (dateKey === yesterday) return 'Ayer'
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ---------------------------------------------------------------------------
// Gráfico de evolución (SVG responsive)
// ---------------------------------------------------------------------------
function TrendChart({ items, type }: { items: HealthMeasurement[]; type: MeasurementType }) {
  const meta = MEASUREMENT_META[type]
  const W = 640
  const H = 210
  const pad = { l: 40, r: 14, t: 14, b: 26 }
  if (items.length < 2) {
    return <div className="meas-chart-empty">Cargá al menos 2 mediciones para ver la evolución.</div>
  }

  const sorted = [...items].sort((a, b) => measurementTimestamp(a) - measurementTimestamp(b))
  const times = sorted.map(measurementTimestamp)
  const tMin = times[0]
  const tMax = Math.max(times[times.length - 1], tMin + 3_600_000)
  // Si todas las mediciones están muy juntas (p. ej. el mismo día), se reparten parejo en lugar de apilarse
  const sameDay = tMax - tMin < 36 * 3_600_000
  const series: { key: string; values: (number | undefined)[]; cls: string }[] = [{ key: 'sys', values: sorted.map((m) => m.value), cls: 's1' }]
  if (type === 'presion') series.push({ key: 'dia', values: sorted.map((m) => m.value2), cls: 's2' })

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== undefined))
  const lows = type === 'presion' ? [60, 129] : meta.band
  const yMin = Math.floor(Math.min(...all, lows[0]) * 0.94)
  const yMax = Math.ceil(Math.max(...all, lows[1]) * 1.06)
  const xAt = (i: number, t: number) =>
    pad.l + (sameDay ? (sorted.length === 1 ? 0.5 : i / (sorted.length - 1)) : (t - tMin) / (tMax - tMin)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b)
  const bandTop = y(type === 'presion' ? 129 : meta.band[1])
  const bandBottom = y(type === 'presion' ? 60 : meta.band[0])
  const ticks = [yMin, (yMin + yMax) / 2, yMax].map((v) => Math.round(v * 10) / 10)
  const fmt = (t: number) => new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

  return (
    <svg className="meas-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolución de ${meta.label}`} preserveAspectRatio="xMidYMid meet">
      <rect x={pad.l} y={Math.min(bandTop, bandBottom)} width={W - pad.l - pad.r} height={Math.abs(bandBottom - bandTop)} className="meas-band" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="meas-grid" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="meas-axis">{t}</text>
        </g>
      ))}
      <text x={pad.l} y={H - 6} className="meas-axis">{sameDay ? `${fmt(tMin)} ${sorted[0].time}` : fmt(tMin)}</text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" className="meas-axis">{sameDay ? `${fmt(tMax)} ${sorted[sorted.length - 1].time}` : fmt(tMax)}</text>
      {series.map((s) => {
        const pts = s.values.map((v, i) => (v === undefined ? null : ([xAt(i, times[i]), y(v)] as const)))
        const path = pts.filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${p![0].toFixed(1)},${p![1].toFixed(1)}`).join(' ')
        return (
          <g key={s.key} className={`meas-series ${s.cls}`}>
            <path d={path} fill="none" />
            {pts.map((p, i) =>
              p ? (
                <circle key={i} cx={p[0]} cy={p[1]} r={4}>
                  <title>{`${fmt(times[i])} ${sorted[i].time} · ${s.values[i]} ${meta.unit}`}</title>
                </circle>
              ) : null,
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Sección
// ---------------------------------------------------------------------------
export const MeasurementsSection = () => {
  const { data, updateData } = useAppData()
  const measurements = useMemo(() => data.health.measurements ?? [], [data.health.measurements])

  const [filter, setFilter] = useState<MeasurementType | 'all'>('all')
  const [range, setRange] = useState<7 | 30 | 90>(30)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<HealthMeasurement | null>(null)
  const [visible, setVisible] = useState(15)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const flash = (t: string) => {
    setNotice(t)
    window.setTimeout(() => setNotice(''), 2200)
  }

  const sorted = useMemo(() => [...measurements].sort((a, b) => measurementTimestamp(b) - measurementTimestamp(a)), [measurements])
  const filtered = useMemo(() => (filter === 'all' ? sorted : sorted.filter((m) => m.type === filter)), [sorted, filter])

  const perType = useMemo(
    () =>
      MEASUREMENT_TYPES.map((meta) => {
        const items = measurements.filter((m) => m.type === meta.type)
        const recent = items.filter((m) => measurementTimestamp(m) >= Date.now() - 30 * 86_400_000)
        return { meta, all: items, stats30: statsFor(recent), last: statsFor(items)?.last }
      }),
    [measurements],
  )

  const chartItems = useMemo(() => {
    if (filter === 'all') return []
    const since = Date.now() - range * 86_400_000
    return measurements.filter((m) => m.type === filter && measurementTimestamp(m) >= since)
  }, [measurements, filter, range])

  const grouped = useMemo(() => {
    const map = new Map<string, HealthMeasurement[]>()
    for (const m of filtered.slice(0, visible)) map.set(m.date, [...(map.get(m.date) ?? []), m])
    return [...map.entries()]
  }, [filtered, visible])

  // ---- Formulario ----------------------------------------------------------
  const openNew = (type?: MeasurementType) => {
    setEditingId(null)
    setForm(emptyForm(type ?? (filter === 'all' ? 'glucosa' : filter)))
    setError('')
    setFormOpen(true)
  }

  const openEdit = (m: HealthMeasurement) => {
    setEditingId(m.id)
    setForm({
      type: m.type,
      value: String(m.value),
      value2: m.value2 !== undefined ? String(m.value2) : '',
      pulse: m.pulse !== undefined ? String(m.pulse) : '',
      date: m.date,
      time: m.time,
      context: m.context ?? '',
      feeling: m.feeling ?? '',
      symptoms: m.symptoms ?? [],
      notes: m.notes ?? '',
    })
    setError('')
    setFormOpen(true)
  }

  const meta = MEASUREMENT_META[form.type]
  const previewValue = num(form.value)
  const previewValue2 = num(form.value2)
  const preview =
    previewValue !== undefined && (form.type !== 'presion' || previewValue2 !== undefined)
      ? classifyMeasurement({ type: form.type, value: previewValue, value2: previewValue2, context: form.context })
      : null

  const toggleSymptom = (s: string) =>
    setForm((f) => {
      const has = f.symptoms.includes(s)
      let next = has ? f.symptoms.filter((x) => x !== s) : [...f.symptoms, s]
      if (!has && s === 'Sin síntomas') next = ['Sin síntomas']
      if (!has && s !== 'Sin síntomas') next = next.filter((x) => x !== 'Sin síntomas')
      return { ...f, symptoms: next }
    })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = num(form.value)
    const value2 = num(form.value2)
    const pulse = num(form.pulse)
    const { min, max } = meta.limits
    if (value === undefined || value < min || value > max) {
      setError(`Ingresá un valor entre ${min} y ${max} ${meta.unit}.`)
      return
    }
    if (form.type === 'presion' && (value2 === undefined || value2 < 30 || value2 > 160 || value2 >= value)) {
      setError('La diastólica (la de abajo) debe ser un número menor que la sistólica.')
      return
    }

    const record: HealthMeasurement = {
      id: editingId ?? uuid(),
      type: form.type,
      date: form.date,
      time: form.time || '00:00',
      value,
      value2: form.type === 'presion' ? value2 : undefined,
      pulse: form.type === 'presion' && pulse && pulse > 20 && pulse < 250 ? pulse : undefined,
      context: form.context || undefined,
      feeling: form.feeling || undefined,
      symptoms: form.symptoms.length ? form.symptoms : undefined,
      notes: form.notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    }

    updateData((prev) => {
      const current = prev.health.measurements ?? []
      const next = editingId ? current.map((m) => (m.id === editingId ? { ...record, createdAt: m.createdAt } : m)) : [record, ...current]
      return { ...prev, health: { ...prev.health, measurements: next } }
    })
    setFormOpen(false)
    setFilter(form.type)
    flash(editingId ? 'Medición actualizada' : 'Medición guardada')
  }

  const confirmDelete = () => {
    if (deleting) updateData((prev) => ({ ...prev, health: { ...prev.health, measurements: (prev.health.measurements ?? []).filter((m) => m.id !== deleting.id) } }))
    setDeleting(null)
  }

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildDoctorSummary(measurements, 30))
      flash('Resumen copiado: pegalo en un mensaje para tu médico')
    } catch {
      flash('No se pudo copiar')
    }
  }

  const selectedStats = filter === 'all' ? null : perType.find((p) => p.meta.type === filter)?.stats30

  return (
    <div className="tool-page meas-page">
      <SectionHeader
        title="Mediciones"
        subtitle="Glucosa, presión, pulso y más: cargá cada valor junto con cómo te sentías."
        actions={
          <>
            {measurements.length > 0 && (
              <button type="button" className="secondary-button meas-icon-btn" onClick={copySummary} aria-label="Copiar resumen para el médico" title="Copiar resumen para el médico">
                <Copy size={15} /> <span>Resumen</span>
              </button>
            )}
            <button type="button" className="primary-button" onClick={() => openNew()}>
              <Plus size={16} /> <span>Nueva medición</span>
            </button>
          </>
        }
      />

      <div className="meas-chips" role="tablist" aria-label="Tipo de medición">
        <button type="button" role="tab" aria-selected={filter === 'all'} className={`meas-chip ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
          Todas
        </button>
        {perType.map(({ meta: m, last }) => {
          const Icon = ICONS[m.type]
          const level = last ? classifyMeasurement(last).level : undefined
          return (
            <button key={m.type} type="button" role="tab" aria-selected={filter === m.type} className={`meas-chip ${filter === m.type ? 'is-active' : ''}`} onClick={() => setFilter(m.type)}>
              <Icon size={14} aria-hidden="true" /> {m.short}
              {level && <i className={`meas-dot lv-${level}`} aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      {measurements.length === 0 ? (
        <div className="empty-state shop-empty">
          <HeartPulse size={34} aria-hidden="true" />
          <h3>Todavía no cargaste mediciones</h3>
          <p>Si tenés glucómetro, tensiómetro u oxímetro, anotá cada valor y cómo te sentías. También podés decirle al asistente: <em>“me medí la presión, 12/8 y estoy tranquilo”</em>.</p>
          <button type="button" className="primary-button" onClick={() => openNew()}><Plus size={16} /> Cargar la primera</button>
        </div>
      ) : (
        <>
          {filter === 'all' ? (
            <div className="meas-cards">
              {perType
                .filter((p) => p.last)
                .map(({ meta: m, last, stats30 }) => {
                  const Icon = ICONS[m.type]
                  const st = classifyMeasurement(last!)
                  return (
                    <button key={m.type} type="button" className={`meas-card lv-${st.level}`} onClick={() => setFilter(m.type)}>
                      <span className="meas-card-head"><Icon size={15} aria-hidden="true" /> {m.short}</span>
                      <strong>{formatMeasurement(last!)} <small>{m.unit}</small></strong>
                      <span className={`meas-badge lv-${st.level}`}>{st.label}</span>
                      {last!.context && <span className="meas-ctx-tag">{last!.context}</span>}
                      <span className="meas-card-foot">
                        {feelingEmoji(last!.feeling)} {last!.date === toLocalDateKey(new Date()) ? 'Hoy' : last!.date.split('-').reverse().slice(0, 2).join('/')} {last!.time}
                        {stats30 && stats30.count > 1 ? ` · prom. ${m.type === 'presion' ? `${Math.round(stats30.avg)}/${Math.round(stats30.avg2 ?? 0)}` : stats30.avg.toFixed(m.type === 'temperatura' ? 1 : 0)}` : ''}
                      </span>
                    </button>
                  )
                })}
            </div>
          ) : (
            <section className="card meas-chart-card" aria-label={`Evolución de ${MEASUREMENT_META[filter].label}`}>
              <div className="meas-chart-head">
                <h3>{MEASUREMENT_META[filter].label} <small>({MEASUREMENT_META[filter].unit})</small></h3>
                <div className="meas-range" role="radiogroup" aria-label="Período">
                  {([7, 30, 90] as const).map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={range === r} className={range === r ? 'is-active' : ''} onClick={() => setRange(r)}>
                      {r} d
                    </button>
                  ))}
                </div>
              </div>
              <TrendChart items={chartItems} type={filter} />
              {selectedStats && (
                <div className="meas-stats">
                  <div><span>Último</span><strong>{formatMeasurement(selectedStats.last)}</strong></div>
                  <div><span>Promedio 30 d</span><strong>{filter === 'presion' ? `${Math.round(selectedStats.avg)}/${Math.round(selectedStats.avg2 ?? 0)}` : selectedStats.avg.toFixed(filter === 'temperatura' ? 1 : 0)}</strong></div>
                  <div><span>Mín.</span><strong>{selectedStats.min}</strong></div>
                  <div><span>Máx.</span><strong>{selectedStats.max}</strong></div>
                </div>
              )}
              <p className="meas-legend">La franja sombreada es el rango de referencia general para adultos.</p>
            </section>
          )}

          {filtered.length === 0 ? (
            <div className="empty-state shop-empty"><p>No hay mediciones de este tipo todavía.</p></div>
          ) : (
            <div className="meas-history">
              {grouped.map(([date, items]) => (
                <section key={date} aria-label={dayLabel(date)}>
                  <h3 className="meas-day">{dayLabel(date)}</h3>
                  <ul>
                    {items.map((m) => {
                      const Icon = ICONS[m.type]
                      const st = classifyMeasurement(m)
                      const open = expandedId === m.id
                      return (
                        <li key={m.id} className={`meas-item lv-${st.level} ${open ? 'is-open' : ''}`}>
                          <button type="button" className="meas-item-main" aria-expanded={open} onClick={() => setExpandedId(open ? null : m.id)}>
                            <span className="meas-icon"><Icon size={17} aria-hidden="true" /></span>
                            <span className="meas-val">
                              <strong>{formatMeasurement(m)}</strong> <small>{MEASUREMENT_META[m.type].unit}</small>
                              <span className="meas-sub">{m.time}{m.context ? <> · <b className="meas-ctx-inline">{m.context}</b></> : ' · momento sin aclarar'}</span>
                            </span>
                            <span className={`meas-badge lv-${st.level}`}>{st.label}</span>
                            <span className="meas-feel" title={m.feeling ? `Se sentía ${m.feeling.toLowerCase()}` : undefined}>{feelingEmoji(m.feeling)}</span>
                            <ChevronDown size={16} className="meas-chevron" aria-hidden="true" />
                          </button>
                          {open && (
                            <div className="meas-detail">
                              {st.hint && <p className="meas-alert" role="alert">⚠️ {st.hint}</p>}
                              <dl>
                                <div><dt>Medición</dt><dd>{formatMeasurement(m)} {formatMeasurementUnit(m)}</dd></div>
                                <div><dt>Momento</dt><dd>{m.context ?? 'Sin aclarar'}</dd></div>
                                {m.feeling && <div><dt>Cómo se sentía</dt><dd>{feelingEmoji(m.feeling)} {FEELINGS.find((f) => f.value === m.feeling)?.label}</dd></div>}
                                {m.symptoms && m.symptoms.length > 0 && <div><dt>Síntomas</dt><dd>{m.symptoms.join(', ')}</dd></div>}
                                {m.notes && <div><dt>Notas</dt><dd>{m.notes}</dd></div>}
                              </dl>
                              <div className="meas-detail-actions">
                                <button type="button" className="secondary-button" onClick={() => openEdit(m)}><Pencil size={14} /> Editar</button>
                                <button type="button" className="secondary-button danger" onClick={() => setDeleting(m)}><Trash2 size={14} /> Eliminar</button>
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
              {filtered.length > visible && (
                <button type="button" className="secondary-button meas-more" onClick={() => setVisible((v) => v + 15)}>
                  Ver más ({filtered.length - visible})
                </button>
              )}
            </div>
          )}

          <p className="meas-disclaimer">
            Los estados (normal, elevada, alta…) son orientativos y se basan en rangos generales para adultos (por ejemplo, guía ESC para la presión). No reemplazan la opinión de tu médico.
          </p>
        </>
      )}

      {/* ---- Formulario ---- */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Editar medición' : 'Nueva medición'} className="meas-modal">
        <form className="meas-form" onSubmit={submit}>
          {!editingId && (
            <div className="meas-types" role="radiogroup" aria-label="Qué te mediste">
              {MEASUREMENT_TYPES.map((m) => {
                const Icon = ICONS[m.type]
                return (
                  <button key={m.type} type="button" role="radio" aria-checked={form.type === m.type} className={form.type === m.type ? 'is-active' : ''} onClick={() => setForm({ ...emptyForm(m.type), date: form.date, time: form.time })}>
                    <Icon size={16} aria-hidden="true" /> {m.short}
                  </button>
                )
              })}
            </div>
          )}

          <div className="meas-values">
            {form.type === 'presion' ? (
              <>
                <label><span>Sistólica (alta)</span><input type="number" inputMode="numeric" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="120" autoFocus /></label>
                <label><span>Diastólica (baja)</span><input type="number" inputMode="numeric" value={form.value2} onChange={(e) => setForm({ ...form, value2: e.target.value })} placeholder="80" /></label>
                <label><span>Pulso (opcional)</span><input type="number" inputMode="numeric" value={form.pulse} onChange={(e) => setForm({ ...form, pulse: e.target.value })} placeholder="72" /></label>
              </>
            ) : (
              <label className="meas-value-main"><span>{meta.label} ({meta.unit})</span><input type="number" inputMode="decimal" step="any" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={meta.placeholder} autoFocus /></label>
            )}
          </div>

          {preview && (
            <div className={`meas-preview lv-${preview.level}`} aria-live="polite">
              <strong>{preview.label}</strong>
              {preview.hint && <span>{preview.hint}</span>}
            </div>
          )}

          <div className="meas-when">
            <label><span>Fecha</span><input type="date" value={form.date} max={toLocalDateKey(new Date())} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label><span>Hora</span><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
          </div>

          {meta.contexts.length > 0 && (
            <fieldset className="meas-fieldset">
              <legend>¿En qué momento te mediste?</legend>
              <div className="meas-contexts" role="radiogroup" aria-label="Momento de la medición">
                {meta.contexts.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={form.context === c} className={form.context === c ? 'is-active' : ''} onClick={() => setForm({ ...form, context: form.context === c ? '' : c })}>
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className="meas-fieldset">
            <legend>¿Cómo te sentías?</legend>
            <div className="meas-feelings" role="radiogroup" aria-label="Cómo te sentías">
              {FEELINGS.map((f) => (
                <button key={f.value} type="button" role="radio" aria-checked={form.feeling === f.value} className={form.feeling === f.value ? 'is-active' : ''} onClick={() => setForm({ ...form, feeling: form.feeling === f.value ? '' : f.value })}>
                  <span aria-hidden="true">{f.emoji}</span>
                  {f.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="meas-fieldset">
            <legend>Síntomas (opcional)</legend>
            <div className="meas-symptoms">
              {SYMPTOM_OPTIONS.map((s) => (
                <button key={s} type="button" aria-pressed={form.symptoms.includes(s)} className={form.symptoms.includes(s) ? 'is-active' : ''} onClick={() => toggleSymptom(s)}>
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="meas-notes">
            <span>Notas (opcional)</span>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ej.: me medí después de caminar, había tomado café…" />
          </label>

          {error && <p className="meas-error" role="alert">{error}</p>}

          <div className="meas-form-actions">
            <button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancelar</button>
            <button type="submit" className="primary-button">{editingId ? 'Guardar cambios' : 'Guardar medición'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        title="Eliminar medición"
        message="¿Eliminar esta medición? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />

      {notice && <div className="tool-toast" role="status">{notice}</div>}
    </div>
  )
}

