import { formatDate } from '../utils/dates'
import '../styles/form-modal.css'

export interface TrendPoint {
  date: string
  value: number
}

interface Props {
  points: TrendPoint[]
  unit: string
  format?: (v: number) => string
  /** Qué mostrar cuando hay menos de 2 puntos. */
  emptyText?: string
}

/** Línea de evolución simple (SVG, sin librerías): se adapta al ancho y se lee bien en el celular. */
export function TrendChart({ points, unit, format, emptyText = 'Hacen falta al menos dos registros para ver la evolución.' }: Props) {
  if (points.length < 2) return <p className="tc-empty">{emptyText}</p>
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
  const last = points.length - 1
  return (
    <svg className="tc-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolución (${unit}): de ${f(points[0].value)} a ${f(points[last].value)}`}>
      {[lo, (lo + hi) / 2, hi].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="tc-grid" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="tc-label">{f(t)}</text>
        </g>
      ))}
      <path d={path} className="tc-line" fill="none" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={i === last ? 5 : 3} className={i === last ? 'tc-last' : 'tc-dot'}>
          <title>{`${formatDate(p.date)}: ${f(p.value)} ${unit}`}</title>
        </circle>
      ))}
      <text x={pad.l} y={H - 6} className="tc-label">{formatDate(points[0].date)}</text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" className="tc-label">{formatDate(points[last].date)}</text>
    </svg>
  )
}
