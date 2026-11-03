import { useMemo, useState } from 'react'
import { Search, Trophy } from 'lucide-react'
import { Modal } from '../../../components/Modal'
import type { WorkoutSession } from '../../../types'
import { formatDate } from '../../../utils/dates'
import { describeSet, exerciseHistory, exerciseRecords, formatSeconds, kgToDisplay, type ExerciseRecord } from '../../../utils/workoutSets'

interface Point {
  date: string
  value: number
}

/** Línea de progreso simple (SVG): sin librerías, se adapta al ancho y se lee en el celular. */
function ProgressChart({ points, unit, format }: { points: Point[]; unit: string; format?: (v: number) => string }) {
  if (points.length < 2) return <p className="wk-items-empty">Hacen falta al menos dos sesiones para ver la evolución.</p>
  const W = 600
  const H = 190
  const pad = { l: 44, r: 12, t: 14, b: 26 }
  const vals = points.map((p) => p.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const lo = Math.max(0, min - span * 0.15)
  const hi = max + span * 0.15
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1)
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const f = format ?? ((v: number) => String(Math.round(v * 10) / 10))
  const ticks = [lo, (lo + hi) / 2, hi]
  const best = vals.indexOf(max)
  return (
    <svg className="wk-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolución (${unit}): de ${f(points[0].value)} a ${f(points[points.length - 1].value)}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="wk-chart-grid" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="wk-chart-label">{f(t)}</text>
        </g>
      ))}
      <path d={path} className="wk-chart-line" fill="none" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={i === best ? 5 : 3} className={i === best ? 'wk-chart-best' : 'wk-chart-dot'}>
          <title>{`${formatDate(p.date)}: ${f(p.value)} ${unit}`}</title>
        </circle>
      ))}
      <text x={pad.l} y={H - 6} className="wk-chart-label">{formatDate(points[0].date)}</text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" className="wk-chart-label">{formatDate(points[points.length - 1].date)}</text>
    </svg>
  )
}

type Metric = 'peso' | 'e1rm' | 'volumen'

interface Props {
  workouts: WorkoutSession[]
  isImperial: boolean
}

/** Solapa "Ejercicios": tus ejercicios con sus récords. El detalle y la evolución se abren en un modal. */
export function ExercisesTab({ workouts, isImperial }: Props) {
  const unit = isImperial ? 'lb' : 'kg'
  const toDisp = (kg: number) => kgToDisplay(kg, isImperial)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<ExerciseRecord | null>(null)
  const [metric, setMetric] = useState<Metric>('peso')

  const records = useMemo(() => exerciseRecords(workouts), [workouts])
  const shown = records.filter((r) => r.name.toLowerCase().includes(q.toLowerCase().trim()))
  const history = useMemo(() => (selected ? exerciseHistory(workouts, selected.name) : []), [selected, workouts])
  const timed = selected?.measure === 'time'

  const points: Point[] = history.map((h) => ({
    date: h.date,
    value: timed ? h.bestSeconds : metric === 'peso' ? toDisp(h.topWeightKg) : metric === 'e1rm' ? toDisp(h.bestE1rm) : toDisp(h.volumeKg),
  }))

  return (
    <div className="wk-exercises">
      <div className="wk-toolbar">
        <div className="wk-search">
          <Search size={15} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un ejercicio…" aria-label="Buscar ejercicio" data-no-dirty />
        </div>
        <p className="wk-toolbar-text">{records.length} ejercicio{records.length === 1 ? '' : 's'} registrados</p>
      </div>

      {records.length === 0 ? (
        <div className="empty-state wk-empty"><Trophy size={40} aria-hidden /><h4>Todavía no hay ejercicios</h4><p>Cuando registres entrenamientos con ejercicios, acá vas a ver tus marcas y cómo evolucionás.</p></div>
      ) : shown.length === 0 ? (
        <p className="wk-items-empty">Ningún ejercicio coincide con “{q}”.</p>
      ) : (
        <ul className="wk-ex-list">
          {shown.map((r) => (
            <li key={r.name}>
              <button type="button" className="wk-ex-row" onClick={() => { setSelected(r); setMetric('peso') }}>
                <div className="wk-ex-name"><strong>{r.name}</strong><small>{r.sessions} sesión{r.sessions === 1 ? '' : 'es'} · última {formatDate(r.lastDate)}</small></div>
                <div className="wk-ex-best">
                  {r.measure === 'time' ? <strong>{r.bestSeconds ? formatSeconds(r.bestSeconds) : '–'}</strong> : r.maxWeightKg ? <strong>{toDisp(r.maxWeightKg)} {unit} × {r.maxWeightReps}</strong> : <strong>p. corporal</strong>}
                  <small>{r.measure === 'time' ? 'mejor tiempo' : r.bestE1rm ? `1RM est. ${toDisp(r.bestE1rm)} ${unit}` : 'mejor serie'}</small>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name ?? ''} subtitle={selected ? `${selected.sessions} sesión${selected.sessions === 1 ? '' : 'es'} registradas` : ''} maxWidth={720} confirmDiscard={false}>
        {selected ? (
          <div className="wk-ex-detail">
            <div className="wk-pr-grid">
              {timed ? (
                <div className="wk-pr"><span>Mejor tiempo</span><strong>{formatSeconds(selected.bestSeconds)}</strong></div>
              ) : (
                <>
                  <div className="wk-pr"><span>Mayor peso</span><strong>{selected.maxWeightKg ? `${toDisp(selected.maxWeightKg)} ${unit} × ${selected.maxWeightReps}` : '–'}</strong><small>{selected.maxWeightKg ? formatDate(selected.maxWeightDate) : ''}</small></div>
                  <div className="wk-pr"><span>1RM estimada</span><strong>{selected.bestE1rm ? `${toDisp(selected.bestE1rm)} ${unit}` : '–'}</strong><small>fórmula de Epley</small></div>
                  <div className="wk-pr"><span>Mayor volumen</span><strong>{Math.round(toDisp(selected.maxSessionVolumeKg)).toLocaleString('es-AR')} {unit}</strong><small>en una sesión</small></div>
                </>
              )}
            </div>

            {!timed ? (
              <div className="wk-seg wk-metric" role="group" aria-label="Qué graficar">
                {([['peso', 'Mayor peso'], ['e1rm', '1RM estimada'], ['volumen', 'Volumen']] as [Metric, string][]).map(([m, l]) => (
                  <button key={m} type="button" className={metric === m ? 'is-on' : ''} aria-pressed={metric === m} onClick={() => setMetric(m)}>{l}</button>
                ))}
              </div>
            ) : null}
            <ProgressChart points={points} unit={timed ? 's' : unit} format={timed ? formatSeconds : undefined} />

            <h4 className="wk-detail-h">Historial</h4>
            <ul className="wk-hist-list">
              {[...history].reverse().slice(0, 15).map((h) => (
                <li key={h.sessionId}>
                  <strong>{formatDate(h.date)}</strong>
                  <span>{h.sets.map((s) => describeSet(s, { measure: h.measure }, unit, toDisp)).join('  ·  ')}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
