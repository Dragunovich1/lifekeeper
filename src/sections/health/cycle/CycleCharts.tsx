import { useMemo } from 'react'
import type { MenstrualCycleEntry } from '../../../types'
import { PHASE_INFO, cycleLengths, normalizeEntries, type CycleInsights } from '../../../utils/cycle'
import { adherenceSummary, type AdherenceDay } from '../../../utils/contraceptives'

/** Línea de tiempo del ciclo actual: fases coloreadas, ovulación y marcador de "hoy". */
export function CycleTimeline({ insights }: { insights: CycleInsights }) {
  const { stats, periodDays, cycleDay } = insights
  const total = Math.max(stats.avg, 21)
  const ov = stats.avg - 14
  const fs = stats.window ? stats.window.startDay : Math.max(1, ov - 5)
  const fe = stats.window ? stats.window.endDay : ov + 1

  const segments = [
    { key: 'menstruacion', from: 1, to: Math.min(periodDays, total), ...PHASE_INFO.menstruacion },
    { key: 'folicular', from: periodDays + 1, to: fs - 1, ...PHASE_INFO.folicular },
    { key: 'fertil', from: fs, to: fe, ...PHASE_INFO.fertil },
    { key: 'lutea', from: fe + 1, to: total, ...PHASE_INFO.lutea },
  ].filter((s) => s.to >= s.from)

  const over = cycleDay > total
  const markerPct = Math.min(100, Math.max(0, ((Math.min(cycleDay, total) - 0.5) / total) * 100))

  return (
    <div className="cy-timeline" role="img" aria-label={`Día ${cycleDay} de un ciclo de ${stats.avg} días`}>
      <div className="cy-timeline-bar">
        {segments.map((s) => (
          <span
            key={s.key}
            className={`cy-seg${s.key === 'fertil' && !insights.fertileIsReliable ? ' is-weak' : ''}`}
            style={{ flexGrow: s.to - s.from + 1, background: s.color }}
            title={`${s.name}: días ${s.from}–${s.to}`}
          />
        ))}
        {over ? <span className="cy-seg" style={{ flexGrow: Math.min(cycleDay - total, 10), background: PHASE_INFO.extendido.color }} title="Ciclo extendido" /> : null}
        <span className="cy-ovul" style={{ left: `${((ov - 0.5) / total) * 100}%` }} title={`Ovulación estimada (día ${ov})`}>
          ◆
        </span>
        <span className="cy-today" style={{ left: `${markerPct}%` }}>
          <b>Hoy</b>
        </span>
      </div>
      <div className="cy-timeline-scale">
        <span>Día 1</span>
        <span>
          Ovulación ~día {ov}
        </span>
        <span>Día {total}</span>
      </div>
      <ul className="cy-legend">
        {Object.entries(PHASE_INFO)
          .filter(([k]) => k !== 'extendido' || over)
          .map(([k, v]) => (
            <li key={k}>
              <i style={{ background: v.color }} /> {v.name}
            </li>
          ))}
      </ul>
    </div>
  )
}

/** Duración de los últimos ciclos (barras) con la franja habitual de 21–35 días y el promedio. */
export function CycleLengthChart({ entries, average }: { entries: MenstrualCycleEntry[]; average: number }) {
  const lengths = useMemo(() => cycleLengths(normalizeEntries(entries)).slice(0, 12).reverse(), [entries])
  if (lengths.length < 2) {
    return <p className="cy-empty">Cuando registres al menos 3 inicios de período vas a ver acá cómo varía la duración de tus ciclos.</p>
  }
  const W = 320
  const H = 150
  const pad = { l: 26, r: 8, t: 10, b: 18 }
  const max = Math.max(40, ...lengths) + 2
  const min = Math.min(18, ...lengths) - 2
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)
  const bw = (W - pad.l - pad.r) / lengths.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cy-svg" role="img" aria-label="Duración de los últimos ciclos">
      <rect x={pad.l} y={y(35)} width={W - pad.l - pad.r} height={y(21) - y(35)} className="cy-band" />
      {[21, 28, 35].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="cy-grid" />
          <text x={pad.l - 4} y={y(v) + 3} textAnchor="end" className="cy-axis">
            {v}
          </text>
        </g>
      ))}
      {lengths.map((v, i) => {
        const h = Math.max(2, y(min) - y(v))
        const outside = v < 21 || v > 35
        return (
          <g key={i}>
            <rect x={pad.l + i * bw + bw * 0.18} y={y(v)} width={bw * 0.64} height={h} rx="3" className={outside ? 'cy-bar is-out' : 'cy-bar'} />
            <text x={pad.l + i * bw + bw / 2} y={y(v) - 3} textAnchor="middle" className="cy-val">
              {v}
            </text>
          </g>
        )
      })}
      <line x1={pad.l} x2={W - pad.r} y1={y(average)} y2={y(average)} className="cy-avg" />
    </svg>
  )
}

/** Síntomas más frecuentes en tus registros. */
export function SymptomChart({ entries }: { entries: MenstrualCycleEntry[] }) {
  const top = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of entries) for (const s of e.symptoms ?? []) counts.set(s, (counts.get(s) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [entries])
  if (top.length === 0) return <p className="cy-empty">Todavía no registraste síntomas. Al cargar un período podés marcarlos y acá vas a ver cuáles se repiten.</p>
  const max = top[0][1]
  return (
    <ul className="cy-hbars">
      {top.map(([name, n]) => (
        <li key={name}>
          <span className="cy-hbar-label">{name}</span>
          <span className="cy-hbar-track">
            <i style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <b>{n}</b>
        </li>
      ))}
    </ul>
  )
}

/** Cumplimiento de la pastilla en los últimos días (un cuadrito por día). */
export function AdherenceStrip({ days }: { days: AdherenceDay[] }) {
  const sum = adherenceSummary(days)
  return (
    <div className="cy-adh">
      <div className="cy-adh-grid" role="img" aria-label="Cumplimiento de los últimos días">
        {days.map((d) => (
          <i key={d.key} className={`cy-adh-day is-${d.status}`} title={`${d.key.split('-').reverse().join('/')}: ${LABEL[d.status]}`} />
        ))}
      </div>
      <div className="cy-adh-foot">
        <span>
          {sum.percent === null ? 'Sin datos todavía' : (
            <>
              <b>{sum.percent}%</b> de cumplimiento · {sum.taken} tomadas · {sum.missed} olvidadas
            </>
          )}
        </span>
        <ul className="cy-legend">
          <li><i className="cy-adh-day is-taken" /> Tomada</li>
          <li><i className="cy-adh-day is-missed" /> Olvidada</li>
          <li><i className="cy-adh-day is-pause" /> Pausa</li>
        </ul>
      </div>
    </div>
  )
}

const LABEL = { taken: 'tomada', missed: 'olvidada', pause: 'pausa', pending: 'pendiente', before: 'antes del inicio' } as const
