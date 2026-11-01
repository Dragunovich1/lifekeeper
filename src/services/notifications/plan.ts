/**
 * Qué notificar y cuándo (lógica pura, sin tocar el sistema operativo).
 *
 * Se arma una lista de avisos concretos para los próximos días:
 *  - Recordatorios pendientes (respetando "posponer").
 *  - Tomas de medicación de los tratamientos activos (se omiten las que ya figuran como tomadas).
 * La lista se vuelve a calcular cada vez que cambian los datos o se abre la app.
 */

import type { AppData } from '../../types'
import { safeParseDate, toLocalDateKey } from '../../utils/dates'

export type NotificationChannel = 'reminders' | 'medication'

export interface PlannedNotification {
  /** Número estable derivado de la clave: reprogramar no duplica avisos. */
  id: number
  key: string
  title: string
  body: string
  at: Date
  channel: NotificationChannel
}

export interface PlanOptions {
  now?: Date
  /** Mostrar el nombre del medicamento / recordatorio en la notificación. */
  showDetails: boolean
  /** Tope de avisos (iOS admite 64 pendientes). */
  maxTotal?: number
}

const DAY = 86_400_000

/** FNV-1a de 32 bits, acotado a un entero positivo. */
export function stableId(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return ((h >>> 0) & 0x7fffffff) || 1
}

const dateKey = (d: Date) => toLocalDateKey(d)

function atLocal(day: Date, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return null
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(m[1]), Number(m[2]), 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

export function buildNotificationPlan(data: AppData, { now = new Date(), showDetails, maxTotal = 60 }: PlanOptions): PlannedNotification[] {
  const plan: PlannedNotification[] = []
  const horizon = now.getTime() + 90 * DAY

  // --- Recordatorios ---------------------------------------------------------
  for (const r of data.utilities.reminders ?? []) {
    if (r.done) continue
    const at = safeParseDate(r.snoozedUntil ?? r.dateTime)
    if (!at || at.getTime() <= now.getTime() || at.getTime() > horizon) continue
    const key = `rem:${r.id}:${at.getTime()}`
    plan.push({
      id: stableId(key),
      key,
      title: 'Recordatorio',
      body: showDetails ? [r.title, r.details].filter(Boolean).join(' — ').slice(0, 140) : 'Tenés un recordatorio pendiente',
      at,
      channel: 'reminders',
    })
  }

  // --- Medicación ------------------------------------------------------------
  const meds = (data.health.medications ?? []).filter((m) => m.active && m.schedules.length > 0)
  const dosesPerDay = meds.reduce((sum, m) => sum + m.schedules.length, 0)
  // Con muchas tomas por día se programan menos días para no pasarse del tope
  const days = Math.min(14, Math.max(2, Math.floor(40 / Math.max(1, dosesPerDay))))

  for (const med of meds) {
    for (let offset = 0; offset < days; offset++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
      const key = dateKey(day)
      if (med.startDate && key < med.startDate.slice(0, 10)) continue
      if (med.endDate && key > med.endDate.slice(0, 10)) continue
      for (const schedule of med.schedules) {
        const at = atLocal(day, schedule.time)
        if (!at || at.getTime() <= now.getTime()) continue
        if (med.intakeLog?.includes(`${key}T${schedule.time}`)) continue
        const k = `med:${med.id}:${key}T${schedule.time}`
        plan.push({
          id: stableId(k),
          key: k,
          title: 'Medicación',
          body: showDetails ? `${med.name}${med.dosage ? ` ${med.dosage}` : ''}${schedule.note ? ` — ${schedule.note}` : ''}`.slice(0, 140) : 'Es hora de tu medicación',
          at,
          channel: 'medication',
        })
      }
    }
  }

  return plan.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, maxTotal)
}
