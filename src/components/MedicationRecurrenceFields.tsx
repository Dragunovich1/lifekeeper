import '../styles/form-modal.css'
import { useId } from 'react'
import { Select } from './Select'
import type { MedicationRecurrence } from '../types'
import { WEEKDAY_NAMES, WEEKDAY_SHORT, parseDayKey, recurrenceLabel, resolveRecurrence, upcomingDoseDays } from '../utils/medicationSchedule'
import { formatDate, toLocalDateKey } from '../utils/dates'

type PresetKey = 'daily' | 'everyOther' | 'weekly' | 'twiceWeek' | 'threeWeek' | 'workdays' | 'weekend' | 'biweekly' | 'monthly' | 'quarterly' | 'asNeeded' | 'custom'

const PRESETS: { key: PresetKey; label: string; rec?: MedicationRecurrence; hint?: string }[] = [
  { key: 'daily', label: 'Todos los días', rec: { kind: 'daily' } },
  { key: 'everyOther', label: 'Día por medio (cada 2 días)', rec: { kind: 'interval', everyDays: 2 } },
  { key: 'weekly', label: 'Una vez por semana', rec: { kind: 'weekly' } },
  { key: 'twiceWeek', label: 'Dos veces por semana (lun y jue)', rec: { kind: 'weekdays', weekdays: [1, 4] } },
  { key: 'threeWeek', label: 'Tres veces por semana (lun, mié y vie)', rec: { kind: 'weekdays', weekdays: [1, 3, 5] } },
  { key: 'workdays', label: 'De lunes a viernes', rec: { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] } },
  { key: 'weekend', label: 'Fines de semana', rec: { kind: 'weekdays', weekdays: [0, 6] } },
  { key: 'biweekly', label: 'Cada 15 días', rec: { kind: 'interval', everyDays: 14 } },
  { key: 'monthly', label: 'Una vez al mes', rec: { kind: 'monthly', everyMonths: 1 } },
  { key: 'quarterly', label: 'Cada 3 meses', rec: { kind: 'monthly', everyMonths: 3 } },
  { key: 'asNeeded', label: 'Solo si hace falta', rec: { kind: 'asNeeded' } },
  { key: 'custom', label: 'Personalizado…' },
]

const sameDays = (a?: number[], b?: number[]) => (a ?? []).slice().sort().join() === (b ?? []).slice().sort().join()

/** Qué opción del desplegable corresponde a una frecuencia (si ninguna, "Personalizado"). */
const presetOf = (rec: MedicationRecurrence): PresetKey => {
  const hit = PRESETS.find((p) => {
    const r = p.rec
    if (!r || r.kind !== rec.kind) return false
    if (r.kind === 'weekly') return true // "una vez por semana": el día se elige aparte
    if (r.kind === 'weekdays') return sameDays(r.weekdays, rec.weekdays)
    if (r.kind === 'interval') return r.everyDays === rec.everyDays
    if (r.kind === 'monthly') return (r.everyMonths ?? 1) === (rec.everyMonths ?? 1)
    return true
  })
  return hit?.key ?? 'custom'
}

interface Props {
  frequency: string
  recurrence?: MedicationRecurrence
  startDate: string
  onChange: (next: { frequency: string; recurrence?: MedicationRecurrence }) => void
}

/**
 * "¿Cada cuánto se toma?": un desplegable con los períodos más comunes (sin texto libre que interpretar).
 * Define qué días corresponde la toma y, por lo tanto, cuándo avisa. Las horas del día se cargan aparte, en "Horarios".
 * Con "Personalizado…" se elige otra combinación de días, cada N días o cada N meses.
 */
export function MedicationRecurrenceFields({ frequency, recurrence, startDate, onChange }: Props) {
  const id = useId()
  const med = { frequency, recurrence, startDate }
  const rec = resolveRecurrence(med)
  const startWeekday = startDate ? parseDayKey(toLocalDateKey(startDate)).getDay() : 1
  // "Personalizado" se queda elegido mientras la persona arma su combinación
  const preset = recurrence && recurrence.kind === 'weekdays' && presetOf(rec) === 'custom' ? 'custom' : presetOf(rec)

  const set = (next: MedicationRecurrence) => onChange({ recurrence: next, frequency: recurrenceLabel({ frequency: '', startDate, recurrence: next }) })

  const pick = (key: PresetKey) => {
    if (key === 'custom') {
      // Parte de la frecuencia actual para no perder lo elegido
      set(rec.kind === 'daily' || rec.kind === 'asNeeded' ? { kind: 'weekdays', weekdays: [startWeekday] } : rec)
      return
    }
    const p = PRESETS.find((x) => x.key === key)!.rec!
    set(p.kind === 'weekly' ? { kind: 'weekly', weekdays: [startWeekday] } : p)
  }

  const toggleDay = (d: number) => {
    const current = rec.weekdays ?? []
    const next = current.includes(d) ? current.filter((x) => x !== d) : [...current, d].sort((a, b) => a - b)
    set({ kind: 'weekdays', weekdays: next.length ? next : [d] })
  }

  const customKind = rec.kind === 'interval' ? 'interval' : rec.kind === 'monthly' ? 'monthly' : 'weekdays'
  const upcoming = upcomingDoseDays(med, new Date(), 4)
  const weeklyDays = rec.weekdays && rec.weekdays.length ? rec.weekdays : [startWeekday]

  return (
    <div className="mrf">
      <div className="field">
        <label htmlFor={`${id}-preset`}>¿Cada cuánto se toma?</label>
        <Select id={`${id}-preset`} value={preset} onChange={(v) => pick(v as PresetKey)} options={PRESETS.map((p) => ({ value: p.key, label: p.label }))} ariaLabel="Cada cuánto se toma" />
      </div>

      {preset === 'weekly' ? (
        <div className="mrf-row" role="group" aria-label="Día de la semana">
          <span className="mrf-label">¿Qué día?</span>
          <div className="mrf-chips">
            {WEEKDAY_NAMES.map((name, d) => (
              <button key={d} type="button" className={`mrf-chip${weeklyDays.includes(d) ? ' is-on' : ''}`} onClick={() => set({ kind: 'weekly', weekdays: [d] })} aria-pressed={weeklyDays.includes(d)}>
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {preset === 'custom' ? (
        <div className="mrf-custom">
          <div className="field">
            <label htmlFor={`${id}-custom`}>Tipo de frecuencia</label>
            <Select
              id={`${id}-custom`}
              value={customKind}
              onChange={(v) => set(v === 'interval' ? { kind: 'interval', everyDays: rec.everyDays ?? 3 } : v === 'monthly' ? { kind: 'monthly', everyMonths: rec.everyMonths ?? 2 } : { kind: 'weekdays', weekdays: rec.weekdays?.length ? rec.weekdays : [startWeekday] })}
              options={[
                { value: 'weekdays', label: 'Ciertos días de la semana' },
                { value: 'interval', label: 'Cada cierta cantidad de días' },
                { value: 'monthly', label: 'Cada cierta cantidad de meses' },
              ]}
              ariaLabel="Tipo de frecuencia personalizada"
            />
          </div>
          {customKind === 'weekdays' ? (
            <div className="mrf-row" role="group" aria-label="Días de la semana">
              <span className="mrf-label">Se toma</span>
              <div className="mrf-chips">
                {WEEKDAY_SHORT.map((name, d) => (
                  <button key={d} type="button" className={`mrf-chip${(rec.weekdays ?? []).includes(d) ? ' is-on' : ''}`} onClick={() => toggleDay(d)} aria-pressed={(rec.weekdays ?? []).includes(d)}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {customKind === 'interval' ? (
            <div className="mrf-row">
              <label className="mrf-label" htmlFor={`${id}-n`}>Cada</label>
              <input id={`${id}-n`} className="mrf-num" type="number" min="2" max="365" inputMode="numeric" value={rec.everyDays ?? 3} onChange={(e) => set({ kind: 'interval', everyDays: Math.max(2, Math.min(365, Number(e.target.value) || 2)) })} />
              <span className="mrf-label">días (contando desde el inicio)</span>
            </div>
          ) : null}
          {customKind === 'monthly' ? (
            <div className="mrf-row">
              <label className="mrf-label" htmlFor={`${id}-m`}>Cada</label>
              <input id={`${id}-m`} className="mrf-num" type="number" min="1" max="24" inputMode="numeric" value={rec.everyMonths ?? 2} onChange={(e) => set({ kind: 'monthly', everyMonths: Math.max(1, Math.min(24, Number(e.target.value) || 1)) })} />
              <span className="mrf-label">meses (el mismo día del mes que el inicio)</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mrf-hint" role="status">
        {rec.kind === 'asNeeded'
          ? 'No genera avisos: registrás la toma cuando la usás.'
          : upcoming.length
            ? <>Próximas tomas: <strong>{upcoming.map((k) => formatDate(k)).join(' · ')}</strong>. Solo esos días te avisa.</>
            : 'Con estas fechas de inicio y fin no hay tomas próximas.'}
      </p>
    </div>
  )
}
