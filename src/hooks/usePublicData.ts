import { useEffect, useMemo, useState } from 'react'
import { getHolidays, getInflation, peekHolidays, peekInflation, type Holiday, type InflationResult } from '../services/api/publicData'

/** Feriados de uno o más años, indexados por fecha (YYYY-MM-DD). Usa la copia guardada mientras llega la actualización. */
export function useHolidays(years: number[]) {
  const key = [...new Set(years)].sort().join(',')
  const [lists, setLists] = useState<Record<number, Holiday[]>>(() => Object.fromEntries(key.split(',').filter(Boolean).map((y) => [Number(y), peekHolidays(Number(y))])))
  const [approximate, setApproximate] = useState(false)

  useEffect(() => {
    let cancelled = false
    for (const y of key.split(',').filter(Boolean).map(Number)) {
      void getHolidays(y).then((r) => {
        if (cancelled) return
        setLists((prev) => ({ ...prev, [y]: r.holidays }))
        if (r.approximate) setApproximate(true)
      })
    }
    return () => {
      cancelled = true
    }
  }, [key])

  // Un solo feriado por fecha (por si una fuente repite alguno entre años)
  const byDate = useMemo(() => new Map(Object.values(lists).flat().map((h) => [h.date, h] as const)), [lists])
  const list = useMemo(() => [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), [byDate])
  return { list, byDate, approximate }
}

/** Inflación mensual e interanual del INDEC. `data` queda en null si nunca se pudo obtener. */
export function useInflation() {
  const [data, setData] = useState<InflationResult | null>(() => peekInflation())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void getInflation().then((r) => {
      if (cancelled) return
      if (r) setData(r)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading }
}
