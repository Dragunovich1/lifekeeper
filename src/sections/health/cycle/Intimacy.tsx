import { useMemo, useState, type FormEvent } from 'react'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { DatePicker } from '../../../components/DatePicker'
import type { IntimacyEntry, IntimacyProtection } from '../../../types'
import { EMERGENCY_INFO, hasActiveHormonal } from '../../../utils/contraceptives'
import { addDaysKey, dayKey, dayStatusFor, diffDays } from '../../../utils/cycle'
import { useCycleData } from './useCycleData'

const PROTECTION: Array<{ value: IntimacyProtection; label: string; emoji: string }> = [
  { value: 'preservativo', label: 'Preservativo', emoji: '🛡️' },
  { value: 'anticonceptivo', label: 'Anticonceptivo', emoji: '💊' },
  { value: 'ambos', label: 'Ambos', emoji: '✅' },
  { value: 'ninguna', label: 'Sin protección', emoji: '⚠️' },
  { value: 'otra', label: 'Otro', emoji: '➕' },
]
const LABEL = Object.fromEntries(PROTECTION.map((p) => [p.value, p])) as Record<IntimacyProtection, (typeof PROTECTION)[number]>

const fmt = (k: string) => k.split('-').reverse().join('/')

/** Registro privado de relaciones y de la protección usada, con avisos de salud útiles (anticoncepción de emergencia, test, ITS). */
export function Intimacy() {
  const { cycle, addIntimacy, removeIntimacy } = useCycleData()
  const todayKey = dayKey(new Date())
  const [date, setDate] = useState(todayKey)
  const [protection, setProtection] = useState<IntimacyProtection>('preservativo')
  const [emergency, setEmergency] = useState(false)
  const [notes, setNotes] = useState('')
  const hormonal = hasActiveHormonal(cycle.contraceptives)

  const list = useMemo(() => [...(cycle.intimacy ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [cycle.intimacy])
  const cfg = { averageCycleDays: cycle.averageCycleDays, averagePeriodDays: cycle.averagePeriodDays }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    addIntimacy({ date: dayKey(date) || todayKey, protection, emergencyPill: emergency, notes })
    setNotes('')
    setEmergency(false)
  }

  // Avisos: relación sin protección reciente
  const alerts = useMemo(() => {
    const out: Array<{ entry: IntimacyEntry; hoursLeft: number; fertile: boolean; testFrom: string }> = []
    for (const e of list) {
      if (e.protection !== 'ninguna') continue
      const days = diffDays(e.date, todayKey)
      if (days < 0 || days > 21) continue
      const st = dayStatusFor(e.date, cycle.entries, cfg)
      out.push({ entry: e, hoursLeft: 72 - days * 24, fertile: st === 'fertile' || st === 'ovulation', testFrom: addDaysKey(e.date, 21) })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, cycle.entries, cycle.averageCycleDays, cycle.averagePeriodDays, todayKey])

  const counts = useMemo(() => {
    const since = addDaysKey(todayKey, -90)
    const c: Record<IntimacyProtection, number> = { preservativo: 0, anticonceptivo: 0, ambos: 0, ninguna: 0, otra: 0 }
    for (const e of list) if (e.date >= since) c[e.protection] += 1
    return c
  }, [list, todayKey])
  const maxCount = Math.max(1, ...Object.values(counts))

  return (
    <div className="cy-stack">
      <div className="cy-note cy-private">
        <Lock size={16} aria-hidden />
        <span>
          Este registro es <b>privado</b>: se guarda cifrado en tu bóveda, no aparece en el Calendario, el Dashboard ni en las alertas, y el asistente no lo usa.
        </span>
      </div>

      {alerts.map(({ entry, hoursLeft, fertile, testFrom }) => (
        <div key={entry.id} className="cy-note is-warn">
          <b>Relación sin protección el {fmt(entry.date)}{fertile ? ' (dentro de tu ventana fértil estimada)' : ''}.</b>{' '}
          {entry.emergencyPill ? 'Registraste anticoncepción de emergencia. ' : hoursLeft > 0 ? `Si querés evitar un embarazo, la píldora de emergencia funciona mejor cuanto antes: te quedan unas ${hoursLeft} h dentro de las 72 h. ` : `Pasaron más de 72 h; algunas píldoras de emergencia llegan hasta 120 h con menor eficacia: consultá en una farmacia o centro de salud cuanto antes. `}
          {EMERGENCY_INFO.test.replace('a partir de las 3 semanas', `a partir del ${fmt(testFrom)} (3 semanas)`)} {EMERGENCY_INFO.sti}
        </div>
      ))}

      <div className="cy-card">
        <h3 className="cy-h">Registrar</h3>
        <form onSubmit={submit} className="cy-form">
          <div className="field">
            <label htmlFor="ci-date">Fecha</label>
            <DatePicker id="ci-date" value={date} onChange={setDate} ariaLabel="Fecha" />
          </div>
          <div className="field">
            <label>Protección utilizada</label>
            <div className="cy-types" role="radiogroup" aria-label="Protección utilizada">
              {PROTECTION.map((p) => (
                <button key={p.value} type="button" role="radio" aria-checked={protection === p.value} className={`cy-type${protection === p.value ? ' is-active' : ''}`} onClick={() => setProtection(p.value)}>
                  <span aria-hidden>{p.emoji}</span> {p.label}
                </button>
              ))}
            </div>
          </div>
          {protection === 'ninguna' ? (
            <label className="cy-check">
              <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} /> Tomé anticoncepción de emergencia
            </label>
          ) : null}
          <div className="field">
            <label htmlFor="ci-notes">Notas (opcional)</label>
            <input id="ci-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Solo para vos" />
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-button">
              <Plus size={16} /> Guardar registro
            </button>
          </div>
        </form>
        {hormonal ? <p className="cy-muted">Recordá: tu método hormonal no protege de infecciones de transmisión sexual; solo el preservativo lo hace.</p> : null}
      </div>

      <div className="cy-card">
        <h3 className="cy-h">Protección en los últimos 90 días</h3>
        <ul className="cy-hbars">
          {PROTECTION.filter((p) => counts[p.value] > 0 || p.value !== 'otra').map((p) => (
            <li key={p.value}>
              <span className="cy-hbar-label">{p.emoji} {p.label}</span>
              <span className="cy-hbar-track">
                <i className={p.value === 'ninguna' ? 'is-risk' : ''} style={{ width: `${(counts[p.value] / maxCount) * 100}%` }} />
              </span>
              <b>{counts[p.value]}</b>
            </li>
          ))}
        </ul>
      </div>

      <div className="cy-card">
        <h3 className="cy-h">Historial</h3>
        {list.length === 0 ? (
          <p className="cy-empty">Sin registros.</p>
        ) : (
          <ul className="cy-list">
            {list.slice(0, 40).map((e) => (
              <li key={e.id}>
                <div>
                  <b>{fmt(e.date)}</b> · {LABEL[e.protection].emoji} {LABEL[e.protection].label}
                  {e.emergencyPill ? ' · 💊 emergencia' : ''}
                  {e.notes ? <small> — {e.notes}</small> : null}
                </div>
                <button type="button" className="secondary-button cy-icon cy-danger" onClick={() => removeIntimacy(e.id)} aria-label={`Eliminar registro del ${fmt(e.date)}`}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
