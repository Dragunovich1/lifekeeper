/**
 * Lugares que ya usaste (dónde te vacunaste, etc.), ordenados para sugerirlos primero:
 * más veces usado y más reciente = más arriba. Todo local: no sale nada del dispositivo.
 */
export interface HistoryPlace {
  place: string
  count: number
  lastUsed: string
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

export function rankPlaceHistory(entries: { place?: string; date?: string }[], now = Date.now()): HistoryPlace[] {
  const map = new Map<string, HistoryPlace>()
  for (const e of entries) {
    const place = (e.place ?? '').trim()
    if (!place) continue
    const key = fold(place)
    const date = e.date ?? ''
    const cur = map.get(key)
    if (cur) {
      cur.count += 1
      if (date > cur.lastUsed) {
        cur.lastUsed = date
        cur.place = place // se queda con la escritura más reciente
      }
    } else {
      map.set(key, { place, count: 1, lastUsed: date })
    }
  }
  const score = (h: HistoryPlace) => {
    const t = Date.parse(h.lastUsed)
    const ageDays = Number.isFinite(t) ? Math.max(0, (now - t) / 86_400_000) : 3650
    return h.count * 2 + 4 / (1 + ageDays / 180)
  }
  return [...map.values()].sort((a, b) => score(b) - score(a) || a.place.localeCompare(b.place))
}

/** Lugares del historial que coinciden con lo escrito (sin tildes ni mayúsculas); sin texto, los más usados. */
export function matchPlaceHistory(history: HistoryPlace[], text: string, limit = 5): HistoryPlace[] {
  const q = fold(text)
  const list = q ? history.filter((h) => fold(h.place).includes(q)) : history
  return list.slice(0, limit)
}
