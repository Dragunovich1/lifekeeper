/**
 * Datos públicos de uso libre (feriados, inflación, ejercicios, MedlinePlus).
 * Se consultan a través del backend propio (`/api/public/...`): ver server/src/publicData.js.
 * Todo tiene copia local para seguir funcionando sin conexión.
 */

import { timeoutSignal } from '../../utils/abort'
import { fixedHolidays, type Holiday } from '../../utils/holidaysFallback'
import { LOCAL_EXERCISES, searchLocalExercises, translateCategory, translateEquipment, translateMuscle, type ExerciseSuggestion } from '../../utils/exerciseCatalog'
import { apiFetch } from './apiConfig'

export type { Holiday, ExerciseSuggestion }

const DAY = 86_400_000
const HOUR = 3_600_000

// ---------------------------------------------------------------------------
// Caché en localStorage
// ---------------------------------------------------------------------------
interface Stored<T> {
  at: number
  value: T
}

function readStore<T>(key: string): Stored<T> | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Stored<T>) : null
  } catch {
    return null
  }
}

function writeStore<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), value } satisfies Stored<T>))
  } catch {
    /* sin almacenamiento */
  }
}

async function publicJson<T>(path: string, timeoutMs = 9000): Promise<T> {
  const res = await apiFetch(`/api/public${path}`, { headers: { Accept: 'application/json' }, signal: timeoutSignal(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('json')) throw new Error('Respuesta inesperada del servidor')
  return (await res.json()) as T
}

const inflight = new Map<string, Promise<unknown>>()
/** Evita pedir lo mismo varias veces en simultáneo (p. ej. dos componentes montados juntos). */
function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const current = inflight.get(key) as Promise<T> | undefined
  if (current) return current
  const p = run().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

// ---------------------------------------------------------------------------
// Feriados
// ---------------------------------------------------------------------------
export interface HolidaysResult {
  year: number
  holidays: Holiday[]
  /** true si son solo los feriados de fecha fija (sin conexión y sin copia). */
  approximate: boolean
  stale: boolean
}

const holidaysKey = (year: number) => `lk_public_holidays_${year}`

export function peekHolidays(year: number): Holiday[] {
  return readStore<Holiday[]>(holidaysKey(year))?.value ?? []
}

export function getHolidays(year: number): Promise<HolidaysResult> {
  return once(`holidays-${year}`, async () => {
    const cached = readStore<Holiday[]>(holidaysKey(year))
    if (cached && Date.now() - cached.at < 7 * DAY) return { year, holidays: cached.value, approximate: false, stale: false }
    try {
      const data = await publicJson<{ holidays: Holiday[]; stale?: boolean }>(`/holidays?year=${year}`)
      writeStore(holidaysKey(year), data.holidays)
      return { year, holidays: data.holidays, approximate: false, stale: Boolean(data.stale) }
    } catch {
      if (cached) return { year, holidays: cached.value, approximate: false, stale: true }
      return { year, holidays: fixedHolidays(year), approximate: true, stale: true }
    }
  })
}

// ---------------------------------------------------------------------------
// Inflación
// ---------------------------------------------------------------------------
export interface InflationPoint {
  month: string
  monthly: number | null
  yoy: number | null
}

export interface InflationResult {
  source: string
  series: InflationPoint[]
  latest: InflationPoint | null
  fetchedAt: number
  stale: boolean
}

const INFLATION_KEY = 'lk_public_inflation'

export function peekInflation(): InflationResult | null {
  const c = readStore<Omit<InflationResult, 'fetchedAt' | 'stale'>>(INFLATION_KEY)
  return c ? { ...c.value, fetchedAt: c.at, stale: Date.now() - c.at > 12 * HOUR } : null
}

export function getInflation(): Promise<InflationResult | null> {
  return once('inflation', async () => {
    const cached = readStore<Omit<InflationResult, 'fetchedAt' | 'stale'>>(INFLATION_KEY)
    if (cached && Date.now() - cached.at < 12 * HOUR) return { ...cached.value, fetchedAt: cached.at, stale: false }
    try {
      const data = await publicJson<Omit<InflationResult, 'fetchedAt' | 'stale'> & { stale?: boolean }>('/inflation?months=24')
      const value = { source: data.source, series: data.series, latest: data.latest }
      writeStore(INFLATION_KEY, value)
      return { ...value, fetchedAt: Date.now(), stale: Boolean(data.stale) }
    } catch {
      return cached ? { ...cached.value, fetchedAt: cached.at, stale: true } : null
    }
  })
}

// ---------------------------------------------------------------------------
// Ejercicios
// ---------------------------------------------------------------------------
interface RemoteExercise {
  name: string
  nameEn?: string
  lang?: string
  category?: string
  muscles?: string[]
  musclesSecondary?: string[]
  equipment?: string[]
}

const exerciseMemo = new Map<string, ExerciseSuggestion[]>()

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Sugerencias de ejercicios: catálogo base al instante y, si hay conexión, el catálogo de wger. */
export async function searchExercises(query: string, limit = 8): Promise<ExerciseSuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const local = searchLocalExercises(q, limit)
  const key = fold(q)
  let remote = exerciseMemo.get(key)
  if (!remote) {
    try {
      const data = await publicJson<{ ready: boolean; results: RemoteExercise[] }>(`/exercises?q=${encodeURIComponent(q)}&limit=${limit}`, 6000)
      remote = data.ready
        ? data.results.map((r) => ({
            name: r.name,
            nameEn: r.nameEn,
            category: r.category ? translateCategory(r.category) : undefined,
            muscles: [...new Set([...(r.muscles ?? []), ...(r.musclesSecondary ?? [])].map(translateMuscle))],
            equipment: (r.equipment ?? []).map(translateEquipment),
            source: 'wger' as const,
          }))
        : []
      if (data.ready) exerciseMemo.set(key, remote)
    } catch {
      remote = []
    }
  }
  const seen = new Set<string>()
  const merged: ExerciseSuggestion[] = []
  for (const e of [...local, ...remote]) {
    const k = fold(e.name)
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(e)
  }
  return merged.slice(0, limit)
}

export const localExerciseCount = LOCAL_EXERCISES.length

// ---------------------------------------------------------------------------
// MedlinePlus
// ---------------------------------------------------------------------------
export interface HealthInfoTopic {
  title: string
  url: string
  summary: string
}

export interface HealthInfoResult {
  query: string
  topics: HealthInfoTopic[]
  stale: boolean
  /** Solo en medicamentos: principio activo con el que se consultó. */
  ingredient?: string
}

export async function getHealthTopics(query: string): Promise<HealthInfoResult> {
  const q = query.trim()
  const data = await publicJson<{ topics: HealthInfoTopic[]; stale?: boolean }>(`/medlineplus/topics?q=${encodeURIComponent(q)}&lang=es&max=4`, 12000)
  return { query: q, topics: data.topics, stale: Boolean(data.stale) }
}

export async function getDrugInfo(name: string): Promise<HealthInfoResult> {
  const q = name.trim()
  const data = await publicJson<{ entries: HealthInfoTopic[]; ingredient?: string; stale?: boolean }>(`/medlineplus/drug?name=${encodeURIComponent(q)}&lang=es`, 15000)
  return { query: q, topics: data.entries, stale: Boolean(data.stale), ingredient: data.ingredient || undefined }
}
