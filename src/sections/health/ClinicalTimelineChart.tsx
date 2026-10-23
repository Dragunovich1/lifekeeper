import type { ClinicalNote } from '../../types'
import { formatDate, safeParseDate } from '../../utils/dates'

const CHART_WIDTH = 800
const CHART_HEIGHT = 230
const PADDING = { left: 40, right: 24, top: 34, bottom: 38 }
const LANES = [0, 26, 52]

const PALETTE = [
  'var(--color-accent-blue)',
  'var(--color-accent-cyan)',
  'var(--color-accent-purple)',
  'var(--color-warning)',
]

const hashTag = (tag: string) => {
  let hash = 0
  for (let index = 0; index < tag.length; index += 1) {
    hash = (hash * 31 + tag.charCodeAt(index)) % 997
  }
  return hash
}

const colorForNote = (note: ClinicalNote) => {
  const tag = note.tags?.[0]
  return tag ? PALETTE[hashTag(tag) % PALETTE.length] : 'var(--color-accent-blue)'
}

export const ClinicalTimelineChart = ({ notes }: { notes: ClinicalNote[] }) => {
  if (notes.length === 0) {
    return (
      <div className="empty-state">
        Todavía no hay eventos clínicos. Guardá la primera entrada para ver el gráfico.
      </div>
    )
  }

  const sorted = [...notes].sort(
    (first, second) =>
      (safeParseDate(first.date)?.getTime() ?? 0) -
      (safeParseDate(second.date)?.getTime() ?? 0),
  )
  const times = sorted.map((note) => safeParseDate(note.date)?.getTime() ?? 0)
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const span = Math.max(maxTime - minTime, 1000 * 60 * 60 * 24 * 30)
  const start = minTime - span * 0.03
  const end = maxTime + span * 0.03
  const baseline = CHART_HEIGHT - PADDING.bottom
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right

  const xFor = (time: number) =>
    PADDING.left + ((time - start) / (end - start)) * innerWidth

  const tickCount = 6
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const time = start + ((end - start) / (tickCount - 1)) * index
    return { time, x: xFor(time), date: new Date(time) }
  })

  const monthFormatter = new Intl.DateTimeFormat(
    'es-AR',
    (end - start) / (1000 * 60 * 60 * 24) > 540
      ? { year: 'numeric' }
      : { month: 'short', year: '2-digit' },
  )

  return (
    <div className="clinical-chart">
      <div className="clinical-chart-head">
        <div>
          <h3 className="panel-title">Todos los eventos clínicos</h3>
          <p className="panel-subtitle">
            {notes.length} {notes.length === 1 ? 'evento registrado' : 'eventos registrados'} ·{' '}
            {formatDate(sorted[0].date)} — {formatDate(sorted[sorted.length - 1].date)}
          </p>
        </div>
        <span className="badge badge-info">{notes.length} eventos</span>
      </div>

      <svg
        className="clinical-chart-svg"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`Línea de tiempo con ${notes.length} eventos clínicos`}
      >
        {ticks.map((tick, index) => (
          <g key={`tick-${index}`}>
            <line
              x1={tick.x}
              x2={tick.x}
              y1={PADDING.top}
              y2={baseline}
              className="clinical-chart-grid"
            />
            <text x={tick.x} y={baseline + 22} className="clinical-chart-label" textAnchor="middle">
              {monthFormatter.format(tick.date)}
            </text>
          </g>
        ))}

        <line
          x1={PADDING.left}
          x2={CHART_WIDTH - PADDING.right}
          y1={baseline}
          y2={baseline}
          className="clinical-chart-axis"
        />

        {sorted.map((note, index) => {
          const x = xFor(safeParseDate(note.date)?.getTime() ?? minTime)
          const lane = LANES[index % LANES.length]
          const y = baseline - 18 - lane
          const color = colorForNote(note)
          return (
            <g key={note.id} className="clinical-chart-event">
              <line x1={x} x2={x} y1={baseline} y2={y} stroke={color} className="clinical-chart-stem" />
              <circle cx={x} cy={y} r={5.5} fill={color} className="clinical-chart-point" />
              <circle cx={x} cy={y} r={10} fill="transparent">
                <title>{`${note.title} · ${formatDate(note.date)}`}</title>
              </circle>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
