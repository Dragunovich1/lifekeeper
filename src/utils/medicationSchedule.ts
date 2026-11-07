/**
 * Frecuencia de una medicación: qué días hay que tomarla. Hasta ahora solo se guardaban horarios del día
 * ("09:00") y la frecuencia era texto libre sin efecto, así que una inyección semanal avisaba todos los días.
 *
 * Una medicación puede traer `recurrence` explícita; si no la trae (las ya cargadas), se deduce del texto de
 * `frequency` ("una vez por semana", "cada 15 días", "lunes y jueves"…). Sin pistas se asume diaria.
 */
import type { Medication, MedicationRecurrence } from '../types'

export const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

const NUMBER_WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30 }
const num = (w: string) => (/^\d+$/.test(w) ? Number(w) : NUMBER_WORDS[w])

const WEEKDAY_KEYS: [string, number][] = [
  ['domingo', 0], ['lunes', 1], ['martes', 2], ['miercoles', 3], ['jueves', 4], ['viernes', 5], ['sabado', 6],
]

/** Local YYYY-MM-DD → Date a medianoche local. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
export function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000)

/** Deduce la frecuencia a partir del texto. Sin pistas devuelve diaria. */
export function parseFrequency(text: string): MedicationRecurrence {
  const t = fold(text)
  if (!t) return { kind: 'daily' }

  if (/(a demanda|si hace falta|si es necesario|cuando lo necesite|cuando sea necesario|segun necesidad|\bsos\b|\bprn\b|de rescate)/.test(t)) return { kind: 'asNeeded' }

  // Días de la semana nombrados: "lunes y jueves", "lunes, miércoles y viernes", "lunes a viernes", "fines de semana"
  if (/fines? de semana/.test(t)) return { kind: 'weekdays', weekdays: [0, 6] }
  const range = t.match(/(domingo|lunes|martes|miercoles|jueves|viernes|sabado) a (domingo|lunes|martes|miercoles|jueves|viernes|sabado)/)
  if (range) {
    const from = WEEKDAY_KEYS.find(([k]) => k === range[1])![1]
    const to = WEEKDAY_KEYS.find(([k]) => k === range[2])![1]
    const days: number[] = []
    for (let d = from, i = 0; i < 7; i++, d = (d + 1) % 7) {
      days.push(d)
      if (d === to) break
    }
    return { kind: 'weekdays', weekdays: days.sort((a, b) => a - b) }
  }
  const named = WEEKDAY_KEYS.filter(([k]) => new RegExp(`\\b${k}s?\\b`).test(t)).map(([, n]) => n)
  if (named.length > 0 && !/cada \d+ (dias|semanas)/.test(t)) return named.length === 1 && /(semana|semanal|cada)/.test(t) ? { kind: 'weekly', weekdays: named } : { kind: 'weekdays', weekdays: named.sort((a, b) => a - b) }

  // Mensual
  const everyMonths = t.match(/cada (\w+) mes(?:es)?/)
  if (everyMonths && num(everyMonths[1]) && num(everyMonths[1]) > 1) return { kind: 'monthly', everyMonths: num(everyMonths[1]) }
  if (/(mensual|por mes|al mes|cada mes|una vez por mes)/.test(t)) return { kind: 'monthly', everyMonths: 1 }
  if (/(bimestral)/.test(t)) return { kind: 'monthly', everyMonths: 2 }
  if (/(trimestral)/.test(t)) return { kind: 'monthly', everyMonths: 3 }

  // Cada N semanas / quincenal / semanal
  const everyWeeks = t.match(/cada (\w+) semanas?/)
  if (everyWeeks && num(everyWeeks[1])) return num(everyWeeks[1]) === 1 ? { kind: 'weekly' } : { kind: 'interval', everyDays: num(everyWeeks[1]) * 7 }
  if (/quincenal/.test(t)) return { kind: 'interval', everyDays: 14 }
  if (/(semanal|por semana|a la semana|cada semana|una vez en la semana|1 vez por semana|x semana)/.test(t)) return { kind: 'weekly' }

  // Cada N días (pero "cada 8 horas" es diaria)
  if (/(dia por medio|interdiari|cada otro dia)/.test(t)) return { kind: 'interval', everyDays: 2 }
  const everyDays = t.match(/cada (\w+) dias?/)
  if (everyDays && num(everyDays[1])) return num(everyDays[1]) === 1 ? { kind: 'daily' } : { kind: 'interval', everyDays: num(everyDays[1]) }

  return { kind: 'daily' }
}

/** La frecuencia efectiva: la explícita si existe; si no, la deducida del texto. */
export function resolveRecurrence(med: Pick<Medication, 'frequency'> & { recurrence?: MedicationRecurrence }): MedicationRecurrence {
  return med.recurrence ?? parseFrequency(med.frequency ?? '')
}

/** ¿Corresponde tomar la medicación ese día? (respeta inicio y fin del tratamiento) */
export function isDoseDay(med: Pick<Medication, 'frequency' | 'startDate' | 'endDate'> & { recurrence?: MedicationRecurrence }, dayKey: string): boolean {
  const key = dayKey.slice(0, 10)
  if (med.startDate && key < med.startDate.slice(0, 10)) return false
  if (med.endDate && key > med.endDate.slice(0, 10)) return false
  const rec = resolveRecurrence(med)
  const day = parseDayKey(key)
  const start = med.startDate ? parseDayKey(med.startDate) : day
  switch (rec.kind) {
    case 'daily':
      return true
    case 'asNeeded':
      return false
    case 'weekdays':
      return (rec.weekdays ?? []).includes(day.getDay())
    case 'weekly': {
      const days = rec.weekdays && rec.weekdays.length ? rec.weekdays : [start.getDay()]
      return days.includes(day.getDay())
    }
    case 'interval': {
      const n = Math.max(1, rec.everyDays ?? 1)
      const diff = daysBetween(start, day)
      return diff >= 0 && diff % n === 0
    }
    case 'monthly': {
      const n = Math.max(1, rec.everyMonths ?? 1)
      const monthsDiff = (day.getFullYear() - start.getFullYear()) * 12 + (day.getMonth() - start.getMonth())
      if (monthsDiff < 0 || monthsDiff % n !== 0) return false
      const lastDay = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate()
      return day.getDate() === Math.min(start.getDate(), lastDay)
    }
  }
}

/** Texto corto: "Todos los días", "Una vez por semana (jueves)", "Cada 15 días"… */
export function recurrenceLabel(med: Pick<Medication, 'frequency' | 'startDate'> & { recurrence?: MedicationRecurrence }): string {
  const rec = resolveRecurrence(med)
  switch (rec.kind) {
    case 'daily':
      return 'Todos los días'
    case 'asNeeded':
      return 'Solo si hace falta'
    case 'weekdays':
      return (rec.weekdays ?? []).map((d) => WEEKDAY_SHORT[d]).join(', ') || 'Días a elegir'
    case 'weekly': {
      const days = rec.weekdays && rec.weekdays.length ? rec.weekdays : [med.startDate ? parseDayKey(med.startDate).getDay() : 1]
      return `Una vez por semana (${days.map((d) => WEEKDAY_NAMES[d]).join(', ')})`
    }
    case 'interval':
      return rec.everyDays === 7 ? 'Una vez por semana' : `Cada ${rec.everyDays} días`
    case 'monthly':
      return (rec.everyMonths ?? 1) === 1 ? 'Una vez al mes' : `Cada ${rec.everyMonths} meses`
  }
}

/** Próximas fechas de toma desde `from` (inclusive), hasta `count` o `maxDays` días. */
export function upcomingDoseDays(med: Parameters<typeof isDoseDay>[0], from: Date, count = 4, maxDays = 400): string[] {
  const out: string[] = []
  for (let i = 0; i < maxDays && out.length < count; i++) {
    const key = dayKeyOf(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i))
    if (isDoseDay(med, key)) out.push(key)
  }
  return out
}
