import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { useInflation } from '../../../hooks/usePublicData'
import type { InflationPoint } from '../../../services/api/publicData'
import type { FinanceTransaction } from '../../../types'
import { toLocalDateKey } from '../../../utils/dates'

const pct = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? '—' : `${n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`)

const monthName = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  const t = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const monthLong = (ym: string) => `${monthName(ym)} ${ym.slice(0, 4)}`
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function Bars({ series }: { series: InflationPoint[] }) {
  const points = series.filter((p) => p.monthly !== null).slice(-12)
  if (points.length < 2) return null
  const max = Math.max(...points.map((p) => p.monthly as number), 0.1)
  const W = 240
  const H = 54
  const gap = 4
  const bw = (W - gap * (points.length - 1)) / points.length
  return (
    <svg className="fin-infl-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Inflación mensual de los últimos meses" preserveAspectRatio="none">
      {points.map((p, i) => {
        const h = Math.max(3, ((p.monthly as number) / max) * (H - 4))
        return (
          <rect key={p.month} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={2} className={i === points.length - 1 ? 'is-last' : ''}>
            <title>{`${monthLong(p.month)}: ${pct(p.monthly)}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

interface Props {
  transactions: FinanceTransaction[]
  currency: string
  defaultCurrency: string
  /** Mes que está mirando el calendario. */
  cursor: { year: number; month: number }
}

/** Inflación (INDEC) y cómo vienen tus gastos frente a ella. */
export function InflationCard({ transactions, currency, defaultCurrency, cursor }: Props) {
  const { data, loading } = useInflation()

  const comparison = useMemo(() => {
    if (currency !== 'ARS') return null
    const expenses = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== 'expense' || (t.currency || defaultCurrency) !== 'ARS') continue
      const ym = toLocalDateKey(t.date).slice(0, 7)
      expenses.set(ym, (expenses.get(ym) ?? 0) + t.amount)
    }
    const now = new Date()
    const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const cursorYm = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`
    // El mes en curso está incompleto: se compara el último mes cerrado
    const month = cursorYm < nowYm ? cursorYm : shiftMonth(nowYm, -1)
    const prev = shiftMonth(month, -1)
    const a = expenses.get(month) ?? 0
    const b = expenses.get(prev) ?? 0
    if (a <= 0 || b <= 0) return null
    const delta = (a / b - 1) * 100
    const inflation = data?.series.find((p) => p.month === month)?.monthly ?? null
    return { month, prev, delta, inflation }
  }, [transactions, currency, defaultCurrency, cursor, data])

  if (!data?.latest) {
    return loading ? <section className="fin-infl is-loading" aria-busy="true" aria-label="Inflación"><span>Cargando inflación…</span></section> : null
  }

  const latest = data.latest
  return (
    <section className="fin-infl" aria-label="Inflación (INDEC)">
      <header>
        <span className="fin-infl-title"><TrendingUp size={16} aria-hidden="true" /> Inflación</span>
        <small>{data.stale ? 'copia guardada' : 'INDEC'}</small>
      </header>

      <div className="fin-infl-main">
        <div>
          <strong>{pct(latest.monthly)}</strong>
          <span>en {monthLong(latest.month)}</span>
        </div>
        <div>
          <strong>{pct(latest.yoy)}</strong>
          <span>interanual</span>
        </div>
        <Bars series={data.series} />
      </div>

      {comparison && (
        <p className={`fin-infl-compare ${comparison.inflation !== null && comparison.delta > comparison.inflation ? 'is-over' : 'is-under'}`}>
          Tus gastos de <b>{monthName(comparison.month)}</b> {comparison.delta >= 0 ? 'subieron' : 'bajaron'} <b>{pct(Math.abs(comparison.delta))}</b> frente a {monthName(comparison.prev)}
          {comparison.inflation !== null ? (
            <>
              {' '}
              (la inflación del mes fue {pct(comparison.inflation)}): {comparison.delta > comparison.inflation ? 'crecieron por encima de la inflación.' : 'quedaron por debajo de la inflación.'}
            </>
          ) : (
            '. El INDEC todavía no publicó la inflación de ese mes.'
          )}
        </p>
      )}

      <footer>
        Fuente: {data.source}. Actualizado el {new Date(data.fetchedAt).toLocaleDateString('es-AR')}.
      </footer>
    </section>
  )
}
