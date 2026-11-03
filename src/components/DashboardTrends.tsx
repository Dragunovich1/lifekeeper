import { useMemo } from 'react'
import { useAppData } from '../hooks/useAppData'
import { MEASUREMENT_META, measurementTimestamp } from '../utils/measurements'
import { toLocalDateKey } from '../utils/dates'
import type { HealthMeasurement, MeasurementType } from '../types'

const W = 140
const H = 44

function Line({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 4 - ((v - min) / span) * (H - 8)}`)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="3" fill={color} />
    </svg>
  )
}

function Bars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const bw = W / values.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" aria-hidden>
      {values.map((v, i) => (
        <rect key={i} x={i * bw + 1} y={H - 2 - (v / max) * (H - 6)} width={Math.max(bw - 2, 1)} height={(v / max) * (H - 6) + 0.5} rx="1.5" fill={color} opacity={v ? 0.9 : 0.25} />
      ))}
    </svg>
  )
}

const dayKeys = (n: number, now = new Date()) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1 - i))
    return toLocalDateKey(d)
  })

/** Mini tendencias (SVG liviano): gastos 30 días, agua 7 días y mediciones de los últimos 30 días. */
export const DashboardTrends = () => {
  const { data } = useAppData()

  const cards = useMemo(() => {
    const out: { key: string; title: string; value: string; sub: string; chart: React.ReactNode }[] = []
    const now = new Date()

    const keys30 = dayKeys(30, now)
    const spendByDay = new Map<string, number>()
    for (const t of data.personal.finances) {
      if (t.type !== 'expense') continue
      const k = toLocalDateKey(t.date)
      spendByDay.set(k, (spendByDay.get(k) ?? 0) + t.amount)
    }
    const spend = keys30.map((k) => spendByDay.get(k) ?? 0)
    const spendTotal = spend.reduce((a, b) => a + b, 0)
    if (spendTotal > 0) {
      out.push({
        key: 'spend',
        title: 'Gastos · 30 días',
        value: spendTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 }),
        sub: `${spend.filter(Boolean).length} días con gasto`,
        chart: <Bars values={spend} color="var(--color-accent-red, #f87171)" />,
      })
    }

    const keys7 = dayKeys(7, now)
    const water = keys7.map((k) => (data.health.hydrationLogs ?? []).find((l) => l.date === k)?.amountMl ?? 0)
    if (water.some(Boolean)) {
      const avg = Math.round(water.reduce((a, b) => a + b, 0) / 7)
      out.push({ key: 'water', title: 'Agua · 7 días', value: `${avg} ml`, sub: 'promedio diario', chart: <Bars values={water} color="var(--color-accent-blue, #60a5fa)" /> })
    }

    const since = now.getTime() - 30 * 86_400_000
    const measured = (type: MeasurementType) =>
      (data.health.measurements ?? [])
        .filter((m: HealthMeasurement) => m.type === type && measurementTimestamp(m) >= since)
        .sort((a, b) => measurementTimestamp(a) - measurementTimestamp(b))
    for (const type of ['presion', 'glucosa', 'pulso'] as MeasurementType[]) {
      const items = measured(type)
      if (items.length < 2) continue
      const last = items[items.length - 1]
      const meta = MEASUREMENT_META[type]
      out.push({
        key: type,
        title: `${meta.label} · 30 días`,
        value: type === 'presion' ? `${last.value}/${last.value2 ?? '—'}` : `${last.value}`,
        sub: `${meta.unit} · última de ${items.length}`,
        chart: <Line values={items.map((m) => m.value)} color="var(--color-accent-green, #34d399)" />,
      })
    }
    return out
  }, [data])

  if (cards.length === 0) return null

  return (
    <section className="panel dashboard-trends" aria-label="Tendencias">
      <div className="panel-header">
        <h3 className="panel-title">Tendencias</h3>
      </div>
      <div className="trend-grid">
        {cards.map((c) => (
          <div key={c.key} className="trend-card">
            <span className="trend-title">{c.title}</span>
            <strong className="trend-value">{c.value}</strong>
            <small className="trend-sub">{c.sub}</small>
            {c.chart}
          </div>
        ))}
      </div>
    </section>
  )
}
