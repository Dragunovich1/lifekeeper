/**
 * Cruza el calendario de referencia (src/data/vaccineSchedules.ts) con la fecha de nacimiento y las vacunas
 * ya registradas para decir qué está aplicado, qué está pendiente y qué viene.
 */
import type { VaccineRecord } from '../types'
import type { ScheduleVaccine, VaccineSchedule } from '../data/vaccineSchedules'

export type DoseStatus = 'done' | 'overdue' | 'soon' | 'future'

export interface ScheduleItem {
  vaccineId: string
  vaccineName: string
  prevents: string
  doseIndex: number
  doseLabel: string
  dueDate: string // YYYY-MM-DD
  status: DoseStatus
  record?: VaccineRecord
}

export interface ScheduleVaccineResult {
  vaccine: ScheduleVaccine
  items: ScheduleItem[]
  /** Vacuna que solo aplica en ciertas situaciones: no cuenta como pendiente */
  optional: boolean
}

export interface ScheduleReport {
  results: ScheduleVaccineResult[]
  /** Dosis vencidas o próximas (a 60 días), ordenadas por fecha */
  attention: ScheduleItem[]
  doneCount: number
  totalCount: number
  ageMonths: number
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const startOfDay = (v: string | Date) => {
  const d = typeof v === 'string' ? new Date(v) : v
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Fecha + N meses (si el día no existe en el mes destino, queda el último día). */
export function addMonths(date: Date, months: number): Date {
  const total = date.getMonth() + months
  const y = date.getFullYear() + Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12
  const last = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(date.getDate(), last))
}

export function ageInMonths(birth: Date, now: Date): number {
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (now.getDate() < birth.getDate()) months -= 1
  return Math.max(0, months)
}

const SOON_DAYS = 60
const EARLY_TOLERANCE_MONTHS = 6
const ADULT_FROM_MONTHS = 18 * 12

export function computeSchedule(schedule: VaccineSchedule, birthDate: string, records: VaccineRecord[], now = new Date()): ScheduleReport {
  const birth = startOfDay(birthDate)
  const today = startOfDay(now)
  const ageMonths = ageInMonths(birth, today)
  const isAdult = ageMonths >= ADULT_FROM_MONTHS
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))

  const results: ScheduleVaccineResult[] = []
  for (const vaccine of schedule.vaccines) {
    const optional = Boolean(vaccine.condition)
    // En la adultez no se evalúan las dosis de la infancia (se ven si están cargadas, pero no figuran como pendientes)
    const evaluate = !isAdult || Boolean(vaccine.adult)
    const mine = sorted.filter((r) => vaccine.match.test(fold(r.vaccine)))
    const used = new Set<string>()
    const items: ScheduleItem[] = []

    vaccine.doses.forEach((dose, doseIndex) => {
      const due = addMonths(birth, dose.ageMonths)
      const earliest = addMonths(due, -EARLY_TOLERANCE_MONTHS)
      const hit = mine.find((r) => !used.has(r.id) && startOfDay(r.date) >= earliest)
      if (hit) used.add(hit.id)
      let status: DoseStatus = 'future'
      if (hit) status = 'done'
      else if (due <= today) status = 'overdue'
      else if ((due.getTime() - today.getTime()) / 86_400_000 <= SOON_DAYS) status = 'soon'
      items.push({ vaccineId: vaccine.id, vaccineName: vaccine.name, prevents: vaccine.prevents, doseIndex, doseLabel: dose.label, dueDate: keyOf(due), status, record: hit })
    })

    // Refuerzo periódico (p. ej. cada 10 años): si la serie está completa, la próxima fecha sale de la última aplicación
    if (vaccine.repeatYears && items.length && items.every((i) => i.status === 'done')) {
      const last = mine[mine.length - 1]
      const due = addMonths(startOfDay(last.date), vaccine.repeatYears * 12)
      let status: DoseStatus = 'future'
      if (due <= today) status = 'overdue'
      else if ((due.getTime() - today.getTime()) / 86_400_000 <= SOON_DAYS) status = 'soon'
      items.push({ vaccineId: vaccine.id, vaccineName: vaccine.name, prevents: vaccine.prevents, doseIndex: items.length, doseLabel: `Refuerzo (cada ${vaccine.repeatYears} años)`, dueDate: keyOf(due), status })
    }

    // Lo que no se evalúa (infancia en una persona adulta) no se marca como pendiente ni próximo
    const shown = items.map((i) => (!evaluate && i.status !== 'done' ? { ...i, status: 'future' as DoseStatus } : i))
    // Las vacunas con condición no se marcan como pendientes
    const finalItems = optional ? shown.map((i) => (i.status === 'overdue' || i.status === 'soon' ? { ...i, status: 'future' as DoseStatus } : i)) : shown
    results.push({ vaccine, items: finalItems, optional })
  }

  const counted = results.filter((r) => !r.optional && (!isAdult || r.vaccine.adult))
  const all = counted.flatMap((r) => r.items)
  const attention = all.filter((i) => i.status === 'overdue' || i.status === 'soon').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return {
    results,
    attention,
    doneCount: all.filter((i) => i.status === 'done').length,
    totalCount: all.filter((i) => i.status !== 'future' || i.record).length || all.length,
    ageMonths,
  }
}

export function ageLabel(ageMonths: number): string {
  if (ageMonths < 24) return `${ageMonths} ${ageMonths === 1 ? 'mes' : 'meses'}`
  return `${Math.floor(ageMonths / 12)} años`
}
