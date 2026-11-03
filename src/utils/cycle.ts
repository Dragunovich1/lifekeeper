/**
 * Lógica del ciclo menstrual (pura y testeable).
 *
 * Todo trabaja con claves de día locales "YYYY-MM-DD". Las fechas guardadas pueden venir en dos formatos
 * (el formulario guarda un ISO completo con hora y zona; el asistente guarda "YYYY-MM-DD"): `dayKey` los unifica.
 * Antes se hacía `startDate + 'T00:00:00'`, que con un ISO completo daba fecha inválida → "NaN".
 *
 * IMPORTANTE (honestidad médica): el método del calendario NO es un anticonceptivo confiable por sí solo
 * (uso típico ≈ 12–25 embarazos cada 100 mujeres por año) y NO protege de infecciones de transmisión sexual.
 * Por eso solo se estima una "ventana fértil" con ciclos regulares y se la llama "menor fertilidad", nunca "días seguros" a secas.
 */
import { toLocalDateKey } from './dates'
import type { MenstrualCycleEntry } from '../types'

const DAY_MS = 86_400_000

/** Fecha guardada (ISO con hora, o "YYYY-MM-DD") → clave de día local "YYYY-MM-DD". '' si es inválida. */
export const dayKey = (value?: string | Date | null): string => toLocalDateKey(value ?? null)

const parts = (key: string): [number, number, number] => {
  const [y, m, d] = key.split('-').map(Number)
  return [y, m, d]
}

export const addDaysKey = (key: string, days: number): string => {
  if (!key) return ''
  const [y, m, d] = parts(key)
  return dayKey(new Date(y, m - 1, d + days))
}

/** Diferencia en días de calendario (b − a), inmune al cambio de hora. */
export const diffDays = (aKey: string, bKey: string): number => {
  const [ay, am, ad] = parts(aKey)
  const [by, bm, bd] = parts(bKey)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS)
}

export interface CycleRecord {
  id: string
  startKey: string
  endKey?: string
  entry: MenstrualCycleEntry
}

/** Registros válidos, sin repetidos por día de inicio, del más reciente al más antiguo. */
export function normalizeEntries(entries: MenstrualCycleEntry[] | undefined): CycleRecord[] {
  const byStart = new Map<string, CycleRecord>()
  for (const entry of entries ?? []) {
    const startKey = dayKey(entry.startDate)
    if (!startKey) continue
    const endKey = entry.endDate ? dayKey(entry.endDate) : ''
    byStart.set(startKey, { id: entry.id, startKey, endKey: endKey && endKey >= startKey ? endKey : undefined, entry })
  }
  return [...byStart.values()].sort((a, b) => b.startKey.localeCompare(a.startKey))
}

/** Duración (días) de cada ciclo completo registrado, del más reciente al más antiguo. Descarta huecos (olvidos de registro). */
export function cycleLengths(records: CycleRecord[]): number[] {
  const out: number[] = []
  for (let i = 0; i < records.length - 1; i++) {
    const len = diffDays(records[i + 1].startKey, records[i].startKey)
    if (len >= 18 && len <= 60) out.push(len)
  }
  return out
}

export type Reliability = 'sin_datos' | 'baja' | 'media' | 'irregular'

export interface FertileWindow {
  /** Día del ciclo (el día 1 es el primer día de sangrado). */
  startDay: number
  endDay: number
  method: 'ogino-knaus' | 'dias-estandar'
}

export interface CycleStats {
  avg: number
  shortest: number
  longest: number
  samples: number
  source: 'registros' | 'configurado'
  reliability: Reliability
  /** null cuando no es razonable estimar días de menor fertilidad (ciclo irregular o sin datos). */
  window: FertileWindow | null
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function estimateCycle(records: CycleRecord[], configuredAvg = 28): CycleStats {
  const lengths = cycleLengths(records).slice(0, 12)
  const samples = lengths.length
  const configured = Math.min(45, Math.max(21, Math.round(configuredAvg) || 28))
  const avg = samples >= 2 ? Math.round(mean(lengths.slice(0, 6))) : configured
  const shortest = samples >= 1 ? Math.min(...lengths) : avg
  const longest = samples >= 1 ? Math.max(...lengths) : avg

  let reliability: Reliability
  let window: FertileWindow | null = null

  if (samples >= 3) {
    const spread = longest - shortest
    if (spread > 9) reliability = 'irregular'
    else {
      reliability = spread <= 7 ? 'media' : 'baja'
      // Ogino-Knaus: primer día fértil = ciclo más corto − 18; último = ciclo más largo − 11
      window = { startDay: Math.max(1, shortest - 18), endDay: longest - 11, method: 'ogino-knaus' }
    }
  } else if (avg >= 26 && avg <= 32) {
    // Método de los días estándar (ciclos de 26 a 32 días): días 8 a 19 son fértiles
    reliability = 'baja'
    window = { startDay: 8, endDay: 19, method: 'dias-estandar' }
  } else {
    reliability = 'sin_datos'
  }

  return { avg, shortest, longest, samples, source: samples >= 2 ? 'registros' : 'configurado', reliability, window }
}

export type CyclePhase = 'menstruacion' | 'folicular' | 'fertil' | 'lutea' | 'extendido'

export interface CycleInsights {
  lastStartKey: string
  cycleDay: number
  stats: CycleStats
  periodDays: number
  phase: CyclePhase
  nextPeriodKey: string
  /** Días hasta el próximo período (negativo = atrasado). */
  daysUntilNext: number
  lateDays: number
  ovulationKey: string
  /** Ventana fértil para mostrar (con ciclo irregular es solo una referencia alrededor de la ovulación). */
  fertileStartKey: string
  fertileEndKey: string
  fertileIsReliable: boolean
}

export function computeCycle(
  entries: MenstrualCycleEntry[] | undefined,
  config: { averageCycleDays?: number; averagePeriodDays?: number } = {},
  todayKey: string = dayKey(new Date()),
): CycleInsights | null {
  const records = normalizeEntries(entries)
  if (records.length === 0) return null

  const last = records[0]
  const stats = estimateCycle(records, config.averageCycleDays ?? 28)
  const periodDays = Math.max(2, Math.min(10, Math.round(config.averagePeriodDays ?? 5) || 5))
  const cycleDay = diffDays(last.startKey, todayKey) + 1
  const actualPeriod = last.endKey ? diffDays(last.startKey, last.endKey) + 1 : periodDays

  const nextPeriodKey = addDaysKey(last.startKey, stats.avg)
  const daysUntilNext = diffDays(todayKey, nextPeriodKey)
  const ovDay = stats.avg - 14
  const ovulationKey = addDaysKey(last.startKey, ovDay - 1)

  const fs = stats.window ? stats.window.startDay : Math.max(1, ovDay - 5)
  const fe = stats.window ? stats.window.endDay : ovDay + 1

  let phase: CyclePhase
  if (cycleDay < 1) phase = 'extendido'
  else if (cycleDay <= actualPeriod) phase = 'menstruacion'
  else if (cycleDay < fs) phase = 'folicular'
  else if (cycleDay <= fe) phase = 'fertil'
  else if (cycleDay <= stats.avg) phase = 'lutea'
  else phase = 'extendido'

  return {
    lastStartKey: last.startKey,
    cycleDay,
    stats,
    periodDays,
    phase,
    nextPeriodKey,
    daysUntilNext,
    lateDays: Math.max(0, -daysUntilNext),
    ovulationKey,
    fertileStartKey: addDaysKey(last.startKey, fs - 1),
    fertileEndKey: addDaysKey(last.startKey, fe - 1),
    fertileIsReliable: stats.window !== null,
  }
}

export type DayStatus = 'period' | 'ovulation' | 'fertile' | 'low' | 'unknown'

/**
 * Estado de un día cualquiera (pasado o futuro) para el calendario.
 *  - period: sangrado (registrado, o estimado en ciclos futuros)
 *  - ovulation / fertile: ventana fértil estimada
 *  - low: menor fertilidad (solo si el ciclo es lo bastante regular para estimarlo)
 *  - unknown: no se puede estimar
 */
export function dayStatusFor(
  key: string,
  entries: MenstrualCycleEntry[] | undefined,
  config: { averageCycleDays?: number; averagePeriodDays?: number } = {},
  todayKey: string = dayKey(new Date()),
): DayStatus {
  const records = normalizeEntries(entries)
  if (!key || records.length === 0) return 'unknown'

  const stats = estimateCycle(records, config.averageCycleDays ?? 28)
  const periodDays = Math.max(2, Math.min(10, Math.round(config.averagePeriodDays ?? 5) || 5))
  const asc = [...records].reverse()
  const first = asc[0]
  if (key < first.startKey) return 'unknown'

  // Inicio del ciclo que contiene `key`: el último registrado ≤ key, o una proyección hacia adelante
  let start = first
  let startKey = first.startKey
  let record: CycleRecord | undefined = first
  let nextStartKey = ''
  for (let i = 0; i < asc.length; i++) {
    if (asc[i].startKey <= key) {
      start = asc[i]
      startKey = asc[i].startKey
      record = asc[i]
      nextStartKey = asc[i + 1]?.startKey ?? ''
    }
  }
  void start

  if (!nextStartKey) {
    // Después del último registro: ciclos proyectados con la duración promedio.
    // Si el período está atrasado (pasaron más de 3 días de la fecha esperada sin registrar uno nuevo) el ciclo
    // ya no es confiable: no se estima nada hacia adelante hasta que se cargue el nuevo inicio.
    const expected = addDaysKey(startKey, stats.avg)
    if (key >= expected && diffDays(expected, todayKey) > 3) return 'unknown'
    // Y no se proyecta más de 3 ciclos hacia adelante (la incertidumbre se acumula)
    if (diffDays(startKey, key) >= stats.avg * 3) return 'unknown'
    const k = Math.floor(diffDays(startKey, key) / stats.avg)
    if (k > 0) {
      startKey = addDaysKey(startKey, k * stats.avg)
      record = undefined
    }
    nextStartKey = addDaysKey(startKey, stats.avg)
  }

  const cycleDay = diffDays(startKey, key) + 1
  const length = Math.max(18, diffDays(startKey, nextStartKey))
  const bleed = record?.endKey ? diffDays(startKey, record.endKey) + 1 : periodDays
  if (cycleDay <= bleed) return 'period'
  if (!stats.window) return 'unknown'

  const ovDay = length - 14
  if (cycleDay === ovDay) return 'ovulation'
  if (cycleDay >= stats.window.startDay && cycleDay <= stats.window.endDay) return 'fertile'
  return 'low'
}

export const PHASE_INFO: Record<CyclePhase, { name: string; emoji: string; color: string }> = {
  menstruacion: { name: 'Menstruación', emoji: '🌸', color: '#f43f5e' },
  folicular: { name: 'Fase folicular', emoji: '🌱', color: '#10b981' },
  fertil: { name: 'Ventana fértil', emoji: '🌺', color: '#f59e0b' },
  lutea: { name: 'Fase lútea', emoji: '🌙', color: '#818cf8' },
  extendido: { name: 'Ciclo extendido', emoji: '⏳', color: '#a855f7' },
}

export const RELIABILITY_TEXT: Record<Reliability, string> = {
  sin_datos: 'Todavía no hay datos suficientes (o tu ciclo habitual está fuera de 26–32 días): no se estiman días de menor fertilidad.',
  baja: 'Estimación aproximada: con pocos ciclos registrados o algo de variación. No la uses como único método.',
  media: 'Tus ciclos registrados son bastante regulares, pero igualmente es una estimación y puede fallar.',
  irregular: 'Tus ciclos varían mucho (más de 9 días de diferencia): no se pueden estimar días de menor fertilidad.',
}
