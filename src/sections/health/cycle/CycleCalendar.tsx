import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Droplets } from 'lucide-react'
import { dayKey, dayStatusFor, normalizeEntries, estimateCycle, RELIABILITY_TEXT, type DayStatus } from '../../../utils/cycle'
import { hasActiveHormonal } from '../../../utils/contraceptives'
import type { IntimacyProtection } from '../../../types'
import { useCycleData } from './useCycleData'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DOW = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

const STATUS_TEXT: Record<DayStatus, string> = {
  period: 'Período (sangrado)',
  ovulation: 'Ovulación estimada: máxima fertilidad',
  fertile: 'Ventana fértil estimada',
  low: 'Menor fertilidad estimada (no es seguro)',
  unknown: 'Sin estimación para este día',
}

const PROTECTION: Array<{ value: IntimacyProtection; label: string }> = [
  { value: 'preservativo', label: 'Preservativo' },
  { value: 'anticonceptivo', label: 'Anticonceptivo' },
  { value: 'ambos', label: 'Ambos' },
  { value: 'ninguna', label: 'Sin protección' },
]

/** Calendario del ciclo: período, ventana fértil, ovulación y días de menor fertilidad, con tus registros encima. */
export function CycleCalendar() {
  const { cycle, startPeriod, addIntimacy } = useCycleData()
  const todayKey = dayKey(new Date())
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayKey.split('-').map(Number)
    return { y, m: m - 1 }
  })
  const [selected, setSelected] = useState(todayKey)

  const cfg = useMemo(() => ({ averageCycleDays: cycle.averageCycleDays, averagePeriodDays: cycle.averagePeriodDays }), [cycle.averageCycleDays, cycle.averagePeriodDays])
  const stats = useMemo(() => estimateCycle(normalizeEntries(cycle.entries), cycle.averageCycleDays), [cycle.entries, cycle.averageCycleDays])
  const hormonal = hasActiveHormonal(cycle.contraceptives)

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const lead = (first.getDay() + 6) % 7
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const out: Array<{ key: string; day: number } | null> = Array(lead).fill(null)
    for (let d = 1; d <= days; d++) out.push({ key: dayKey(new Date(cursor.y, cursor.m, d)), day: d })
    while (out.length % 7) out.push(null)
    return out
  }, [cursor])

  const statusByDay = useMemo(() => {
    const map = new Map<string, DayStatus>()
    for (const c of cells) if (c) map.set(c.key, dayStatusFor(c.key, cycle.entries, cfg, todayKey))
    return map
  }, [cells, cycle.entries, cfg, todayKey])

  const intimacyByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of cycle.intimacy ?? []) map.set(e.date, (map.get(e.date) ?? 0) + 1)
    return map
  }, [cycle.intimacy])
  const pillDays = useMemo(() => new Set((cycle.contraceptives ?? []).filter((m) => m.type === 'pastilla').flatMap((m) => m.takenLog ?? [])), [cycle.contraceptives])

  const move = (delta: number) => setCursor(({ y, m }) => {
    const d = new Date(y, m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const status = dayStatusFor(selected, cycle.entries, cfg, todayKey)
  const hasPeriodOnSelected = cycle.entries.some((e) => dayKey(e.startDate) === selected)

  return (
    <div className="cy-stack">
      <div className="cy-card">
        <div className="cy-cal-head">
          <button type="button" className="secondary-button cy-icon" onClick={() => move(-1)} aria-label="Mes anterior">
            <ChevronLeft size={16} />
          </button>
          <h3 className="cy-h">{MONTHS[cursor.m]} {cursor.y}</h3>
          <button type="button" className="secondary-button cy-icon" onClick={() => move(1)} aria-label="Mes siguiente">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="cy-cal" role="grid" aria-label="Calendario del ciclo">
          {DOW.map((d) => (
            <span key={d} className="cy-dow" role="columnheader">{d}</span>
          ))}
          {cells.map((c, i) =>
            c ? (
              <button
                key={c.key}
                type="button"
                role="gridcell"
                className={`cy-day is-${statusByDay.get(c.key) ?? 'unknown'}${c.key === todayKey ? ' is-today' : ''}${c.key === selected ? ' is-selected' : ''}`}
                onClick={() => setSelected(c.key)}
                aria-label={`${c.day} de ${MONTHS[cursor.m]}: ${STATUS_TEXT[statusByDay.get(c.key) ?? 'unknown']}`}
                aria-pressed={c.key === selected}
              >
                <span>{c.day}</span>
                <span className="cy-marks">
                  {pillDays.has(c.key) ? <i className="cy-mark-pill" title="Pastilla tomada" /> : null}
                  {intimacyByDay.has(c.key) ? <i className="cy-mark-heart" title="Registro" /> : null}
                </span>
              </button>
            ) : (
              <span key={`e${i}`} className="cy-day is-empty" aria-hidden />
            ),
          )}
        </div>

        <ul className="cy-legend cy-legend-cal">
          <li><i className="lg-period" /> Período</li>
          <li><i className="lg-ovulation" /> Ovulación</li>
          <li><i className="lg-fertile" /> Ventana fértil</li>
          <li><i className="lg-low" /> Menor fertilidad</li>
          <li><i className="cy-mark-pill" /> Pastilla</li>
        </ul>
      </div>

      <div className="cy-card cy-daybox">
        <h4 className="cy-h4">{selected.split('-').reverse().join('/')}{selected === todayKey ? ' · hoy' : ''}</h4>
        <p className={`cy-daystatus is-${status}`}>{STATUS_TEXT[status]}</p>
        {hormonal ? <p className="cy-muted">Usás un método hormonal: la ventana fértil natural no aplica.</p> : null}
        <div className="cy-day-actions">
          {!hasPeriodOnSelected ? (
            <button type="button" className="secondary-button" onClick={() => startPeriod(selected)}>
              <Droplets size={15} /> Empezó mi período este día
            </button>
          ) : (
            <span className="cy-muted">Período registrado este día.</span>
          )}
        </div>
        <div className="cy-quick">
          <span className="cy-muted">Registrar en este día (privado):</span>
          <div className="cy-quick-btns">
            {PROTECTION.map((p) => (
              <button key={p.value} type="button" className="cy-chip" onClick={() => addIntimacy({ date: selected, protection: p.value })}>
                + {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`cy-note ${stats.reliability === 'irregular' || stats.reliability === 'sin_datos' ? 'is-warn' : ''}`}>
        <b>Confiabilidad de la estimación: {{ sin_datos: 'sin datos', baja: 'baja', media: 'media', irregular: 'ciclo irregular' }[stats.reliability]}.</b> {RELIABILITY_TEXT[stats.reliability]}
        <br />
        <b>Importante:</b> los "días de menor fertilidad" son solo una estimación por calendario. <b>No son un método anticonceptivo confiable</b> (puede fallar en 1 de cada 4 usos habituales) y <b>no protegen de infecciones de transmisión sexual</b>. Para evitar un embarazo o una ITS, usá un método anticonceptivo y preservativo.
      </div>
    </div>
  )
}

