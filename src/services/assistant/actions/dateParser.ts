/**
 * Interpreta fechas escritas en español coloquial ("mañana", "el 15 de noviembre", "en 10 días",
 * "el viernes", "fin de mes"). Devuelve YYYY-MM-DD en hora local o null si no encuentra ninguna.
 */

const MONTHS: Record<string, number> = {
  enero: 0, ene: 0, febrero: 1, feb: 1, marzo: 2, mar: 2, abril: 3, abr: 3, mayo: 4, may: 4, junio: 5, jun: 5,
  julio: 6, jul: 6, agosto: 7, ago: 7, septiembre: 8, setiembre: 8, sep: 8, sept: 8, set: 8, octubre: 9, oct: 9,
  noviembre: 10, nov: 10, diciembre: 11, dic: 11,
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  quince: 15, veinte: 20, treinta: 30,
}

const pad = (n: number) => String(n).padStart(2, '0')
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!,;()"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

function addDays(base: Date, days: number): Date {
  const d = startOfDay(base)
  d.setDate(d.getDate() + days)
  return d
}

/** Construye una fecha validando que el día exista (31 de febrero → null). */
function makeDate(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month, day)
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null
}

export function parseSpanishDate(text: string, now: Date = new Date()): string | null {
  const n = normalize(text)
  const today = startOfDay(now)

  // ISO explícita
  const iso = n.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) {
    const d = makeDate(+iso[1], +iso[2] - 1, +iso[3])
    if (d) return toKey(d)
  }

  // 15/11, 15/11/2026, 15-11-26
  const slash = n.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/)
  if (slash) {
    const day = +slash[1]
    const month = +slash[2] - 1
    let year = slash[3] ? +slash[3] : today.getFullYear()
    if (slash[3] && year < 100) year += 2000
    let d = makeDate(year, month, day)
    if (d && !slash[3] && d < today) d = makeDate(year + 1, month, day)
    if (d) return toKey(d)
  }

  // 15 de noviembre [de 2026]
  const monthName = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')
  const named = n.match(new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s+)?(${monthName})\\b(?:\\s+(?:de\\s+)?(\\d{4}))?`))
  if (named) {
    const day = +named[1]
    const month = MONTHS[named[2]]
    const explicitYear = named[3] ? +named[3] : null
    let d = makeDate(explicitYear ?? today.getFullYear(), month, day)
    if (d && !explicitYear && d < today) d = makeDate(today.getFullYear() + 1, month, day)
    if (d) return toKey(d)
  }

  if (/\bpasado manana\b/.test(n)) return toKey(addDays(today, 2))
  if (/\bmanana\b/.test(n)) return toKey(addDays(today, 1))
  if (/\bhoy\b/.test(n)) return toKey(today)

  // en 10 días / en dos semanas / en 3 meses
  const rel = n.match(/\ben\s+(\d+|[a-z]+)\s+(dia|dias|semana|semanas|mes|meses)\b/)
  if (rel) {
    const amount = /^\d+$/.test(rel[1]) ? +rel[1] : NUMBER_WORDS[rel[1]]
    if (amount) {
      if (rel[2].startsWith('dia')) return toKey(addDays(today, amount))
      if (rel[2].startsWith('semana')) return toKey(addDays(today, amount * 7))
      const d = new Date(today.getFullYear(), today.getMonth() + amount, today.getDate())
      return toKey(d)
    }
  }

  if (/\bfin de mes\b|\bfinales de mes\b/.test(n)) {
    return toKey(new Date(today.getFullYear(), today.getMonth() + 1, 0))
  }

  // el viernes / el lunes que viene (siempre el próximo, nunca hoy)
  const wd = n.match(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/)
  if (wd) {
    const target = WEEKDAYS[wd[1]]
    let diff = (target - today.getDay() + 7) % 7
    if (diff === 0) diff = 7
    return toKey(addDays(today, diff))
  }

  // "el 15" → próximo día 15
  const dayOnly = n.match(/\b(?:el|dia)\s+(\d{1,2})\b(?!\s*(?:hs|h|:|horas))/)
  if (dayOnly) {
    const day = +dayOnly[1]
    let d = makeDate(today.getFullYear(), today.getMonth(), day)
    if (!d || d < today) d = makeDate(today.getFullYear(), today.getMonth() + 1, day)
    if (d) return toKey(d)
  }

  return null
}
