/**
 * Modelo de series de un entrenamiento: calentamiento, al fallo y drop sets con caídas, medidas por
 * repeticiones o por tiempo, y los cálculos de volumen / récords que salen de ahí.
 *
 * Los entrenamientos viejos guardaban todo en un solo `setType` ('warmup' | 'failure' | 'dropset'): las
 * funciones `isWarmup`, `isFailure` y `dropsOf` los siguen entendiendo, y `normalizeSet` los migra al
 * modelo nuevo (banderas independientes + lista de caídas) la primera vez que se edita una serie.
 */
import type { WorkoutDrop, WorkoutExercise, WorkoutExerciseSet, WorkoutMeasure, WorkoutSession } from '../types'
import { buildBlocks } from './workoutGroups'

export const KG_TO_LB = 2.20462

export const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

export const isWarmup = (s: WorkoutExerciseSet) => Boolean(s.warmup) || s.setType === 'warmup'
export const isFailure = (s: WorkoutExerciseSet) => Boolean(s.failure) || s.setType === 'failure'

/** Caídas de la serie. Un drop set viejo (sin detalle) cuenta como una caída sin datos. */
export function dropsOf(s: WorkoutExerciseSet): WorkoutDrop[] {
  if (s.drops && s.drops.length > 0) return s.drops
  return s.setType === 'dropset' ? [{ reps: 0 }] : []
}
export const hasDrops = (s: WorkoutExerciseSet) => dropsOf(s).length > 0

export const measureOf = (ex: Pick<WorkoutExercise, 'measure'>): WorkoutMeasure => ex.measure ?? 'reps'

/** Pasa las marcas del modelo viejo (setType) a campos independientes. No toca los datos que no hacen falta. */
export function normalizeSet(s: WorkoutExerciseSet): WorkoutExerciseSet {
  const next: WorkoutExerciseSet = { ...s }
  if (isWarmup(s)) next.warmup = true
  else delete next.warmup
  if (isFailure(s)) next.failure = true
  else delete next.failure
  const drops = dropsOf(s)
  if (drops.length > 0) next.drops = drops
  else delete next.drops
  next.setType = s.setType === 'biserie' ? 'biserie' : 'normal'
  return next
}

/** Serie nueva a partir de la anterior: mismas repeticiones, peso, tiempo y caídas, sin marcas de "hecha". */
export function nextSetFrom(last?: WorkoutExerciseSet): WorkoutExerciseSet {
  if (!last) return { reps: 10, weight: 0, rpe: 8, setType: 'normal', notes: '' }
  const next: WorkoutExerciseSet = {
    reps: last.reps,
    weight: last.weight,
    rpe: last.rpe,
    setType: 'normal',
    notes: '',
  }
  if (last.seconds) next.seconds = last.seconds
  const drops = dropsOf(last).filter((d) => d.reps > 0 || d.weight)
  if (drops.length > 0) next.drops = drops.map((d) => ({ ...d }))
  return next
}

/** Series por defecto de un ejercicio nuevo según cómo se mide. */
export function defaultSetsFor(measure: WorkoutMeasure = 'reps', count = 3): WorkoutExerciseSet[] {
  return Array.from({ length: count }, () =>
    measure === 'time'
      ? { reps: 0, seconds: 60, setType: 'normal' as const, notes: '' }
      : { reps: 10, weight: 0, rpe: 8, setType: 'normal' as const, notes: '' },
  )
}

/** Cambia la forma de medir un ejercicio (pasa las series a tiempo o a repeticiones sin perder lo cargado). */
export function withMeasure(ex: WorkoutExercise, measure: WorkoutMeasure): WorkoutExercise {
  if (measureOf(ex) === measure) return ex
  return {
    ...ex,
    measure: measure === 'time' ? 'time' : undefined,
    sets: ex.sets.map((s) => {
      const next = { ...s }
      if (measure === 'time') {
        next.seconds = next.seconds || 60
        next.reps = 0
        delete next.weight
        delete next.drops
      } else {
        next.reps = next.reps || 10
        delete next.seconds
      }
      return next
    }),
  }
}

/* ---------- Volumen y récords ---------- */

const round1 = (n: number) => Math.round(n * 10) / 10

/** Volumen de una serie en kg (calentamientos y ejercicios por tiempo no suman). Incluye las caídas. */
export function setVolumeKg(s: WorkoutExerciseSet, measure: WorkoutMeasure = 'reps'): number {
  if (measure === 'time' || isWarmup(s)) return 0
  let total = (s.reps || 0) * (s.weight || 0)
  for (const d of dropsOf(s)) total += (d.reps || 0) * (d.weight || 0)
  return total
}

export const exerciseVolumeKg = (ex: WorkoutExercise) =>
  ex.sets.reduce((acc, s) => acc + setVolumeKg(s, measureOf(ex)), 0)

export const sessionVolumeKg = (w: Pick<WorkoutSession, 'exercises'>) =>
  w.exercises.reduce((acc, ex) => acc + exerciseVolumeKg(ex), 0)

/** Una repetición máxima estimada (Epley). Solo tiene sentido con peso y pocas repeticiones. */
export function estimate1RM(weight: number, reps: number): number {
  if (!weight || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export interface SessionSummary {
  /** Ejercicios cargados (cada uno de una biserie cuenta). */
  exercises: number
  /** Ítems: una biserie es un solo ítem. */
  items: number
  effectiveSets: number
  warmupSets: number
  dropSets: number
  failureSets: number
  volumeKg: number
  /** Mayor peso levantado en una serie efectiva. */
  topWeightKg: number
  /** Segundos acumulados en ejercicios por tiempo. */
  timeSeconds: number
}

export function summarizeSession(w: Pick<WorkoutSession, 'exercises'>): SessionSummary {
  const sum: SessionSummary = {
    exercises: w.exercises.length,
    items: buildBlocks(w.exercises).length,
    effectiveSets: 0,
    warmupSets: 0,
    dropSets: 0,
    failureSets: 0,
    volumeKg: 0,
    topWeightKg: 0,
    timeSeconds: 0,
  }
  for (const ex of w.exercises) {
    const measure = measureOf(ex)
    for (const s of ex.sets) {
      if (isWarmup(s)) {
        sum.warmupSets += 1
        continue
      }
      sum.effectiveSets += 1
      if (hasDrops(s)) sum.dropSets += 1
      if (isFailure(s)) sum.failureSets += 1
      sum.volumeKg += setVolumeKg(s, measure)
      if (measure === 'time') sum.timeSeconds += s.seconds || 0
      else sum.topWeightKg = Math.max(sum.topWeightKg, s.weight || 0)
    }
  }
  sum.volumeKg = round1(sum.volumeKg)
  return sum
}

export interface ExerciseSessionEntry {
  date: string
  sessionId: string
  title: string
  sets: WorkoutExerciseSet[]
  measure: WorkoutMeasure
  topWeightKg: number
  topWeightReps: number
  bestE1rm: number
  volumeKg: number
  bestSeconds: number
}

/** Historial de un ejercicio (por nombre, sin importar mayúsculas ni tildes), de la más vieja a la más nueva. */
export function exerciseHistory(workouts: WorkoutSession[], name: string): ExerciseSessionEntry[] {
  const key = fold(name)
  const out: ExerciseSessionEntry[] = []
  for (const w of workouts) {
    const matches = w.exercises.filter((e) => fold(e.name) === key)
    if (matches.length === 0) continue
    const sets = matches.flatMap((e) => e.sets)
    const measure = measureOf(matches[0])
    let topWeightKg = 0
    let topWeightReps = 0
    let bestE1rm = 0
    let bestSeconds = 0
    for (const s of sets) {
      if (isWarmup(s)) continue
      if (measure === 'time') bestSeconds = Math.max(bestSeconds, s.seconds || 0)
      const wgt = s.weight || 0
      if (wgt > topWeightKg || (wgt === topWeightKg && (s.reps || 0) > topWeightReps)) {
        topWeightKg = wgt
        topWeightReps = s.reps || 0
      }
      bestE1rm = Math.max(bestE1rm, estimate1RM(wgt, s.reps || 0))
    }
    out.push({
      date: w.date,
      sessionId: w.id,
      title: w.title,
      sets,
      measure,
      topWeightKg,
      topWeightReps,
      bestE1rm: round1(bestE1rm),
      volumeKg: round1(matches.reduce((a, e) => a + exerciseVolumeKg(e), 0)),
      bestSeconds,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** Lo último que hiciste con ese ejercicio (para mostrar "la vez pasada: 40 kg × 12"). */
export function lastPerformance(workouts: WorkoutSession[], name: string, excludeSessionId?: string) {
  const history = exerciseHistory(
    workouts.filter((w) => w.id !== excludeSessionId),
    name,
  )
  return history.length ? history[history.length - 1] : null
}

export interface ExerciseRecord {
  name: string
  sessions: number
  lastDate: string
  measure: WorkoutMeasure
  maxWeightKg: number
  maxWeightReps: number
  maxWeightDate: string
  bestE1rm: number
  bestSeconds: number
  maxSessionVolumeKg: number
}

/** Un registro por ejercicio con sus récords, ordenado por cuántas veces lo hiciste. */
export function exerciseRecords(workouts: WorkoutSession[]): ExerciseRecord[] {
  const names = new Map<string, string>()
  for (const w of workouts) for (const e of w.exercises) if (!names.has(fold(e.name))) names.set(fold(e.name), e.name)
  const out: ExerciseRecord[] = []
  for (const [, name] of names) {
    const hist = exerciseHistory(workouts, name)
    if (hist.length === 0) continue
    let best: ExerciseSessionEntry = hist[0]
    for (const h of hist) if (h.topWeightKg > best.topWeightKg || (h.topWeightKg === best.topWeightKg && h.topWeightReps > best.topWeightReps)) best = h
    out.push({
      name,
      sessions: hist.length,
      lastDate: hist[hist.length - 1].date,
      measure: hist[hist.length - 1].measure,
      maxWeightKg: best.topWeightKg,
      maxWeightReps: best.topWeightReps,
      maxWeightDate: best.date,
      bestE1rm: Math.max(...hist.map((h) => h.bestE1rm)),
      bestSeconds: Math.max(...hist.map((h) => h.bestSeconds)),
      maxSessionVolumeKg: Math.max(...hist.map((h) => h.volumeKg)),
    })
  }
  return out.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
}

/** Récords que se rompieron en `session` respecto de todo lo anterior (solo si ya había historial del ejercicio). */
export function newRecords(session: WorkoutSession, previous: WorkoutSession[]): { name: string; kind: 'peso' | 'e1rm' | 'tiempo'; value: number }[] {
  const found: { name: string; kind: 'peso' | 'e1rm' | 'tiempo'; value: number }[] = []
  const seen = new Set<string>()
  for (const ex of session.exercises) {
    const key = fold(ex.name)
    if (seen.has(key)) continue
    seen.add(key)
    const before = exerciseHistory(previous, ex.name)
    if (before.length === 0) continue
    const now = exerciseHistory([session], ex.name)[0]
    if (!now) continue
    if (now.measure === 'time') {
      const prev = Math.max(...before.map((b) => b.bestSeconds))
      if (now.bestSeconds > prev) found.push({ name: ex.name, kind: 'tiempo', value: now.bestSeconds })
      continue
    }
    const prevW = Math.max(...before.map((b) => b.topWeightKg))
    const prevE = Math.max(...before.map((b) => b.bestE1rm))
    if (now.topWeightKg > prevW && now.topWeightKg > 0) found.push({ name: ex.name, kind: 'peso', value: now.topWeightKg })
    else if (now.bestE1rm > prevE && now.bestE1rm > 0) found.push({ name: ex.name, kind: 'e1rm', value: now.bestE1rm })
  }
  return found
}

/* ---------- Unidades y formato ---------- */

export const kgToDisplay = (kg: number, imperial: boolean) => (imperial ? round1(kg * KG_TO_LB) : round1(kg))
export const displayToKg = (v: number, imperial: boolean) => (imperial ? Number((v / KG_TO_LB).toFixed(2)) : v)

/** Multiplica todos los pesos (series y caídas) por `factor`. Sirve para pasar de kg a lb y volver. */
export function convertExerciseWeights(exercises: WorkoutExercise[], toDisplay: (v: number) => number): WorkoutExercise[] {
  return exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => ({
      ...s,
      weight: typeof s.weight === 'number' && s.weight > 0 ? toDisplay(s.weight) : s.weight ? s.weight : 0,
      drops: s.drops?.map((d) => ({ ...d, weight: typeof d.weight === 'number' && d.weight > 0 ? toDisplay(d.weight) : 0 })),
    })),
  }))
}

/** 90 → "1:30", 60 → "1:00", 3700 → "1:01:40". */
export function formatSeconds(total: number): string {
  const t = Math.max(0, Math.round(total))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/** Texto corto de una serie para el historial: "12 × 40 kg · Fallo · ↓ 10 × 30 kg" (pesos ya en la unidad pedida). */
export function describeSet(s: WorkoutExerciseSet, ex: Pick<WorkoutExercise, 'measure' | 'perSide'>, unit: string, toDisplay: (kg: number) => number): string {
  const side = ex.perSide ? ' c/lado' : ''
  const parts: string[] = []
  if (measureOf(ex) === 'time') {
    parts.push(`${formatSeconds(s.seconds || 0)}${side}`)
  } else {
    const w = s.weight ? `${toDisplay(s.weight)} ${unit}` : 'p. corporal'
    parts.push(`${s.reps || 0}${side} × ${w}`)
  }
  if (isWarmup(s)) parts.push('Calent.')
  if (isFailure(s)) parts.push('Fallo')
  for (const d of dropsOf(s)) {
    parts.push(d.reps > 0 || d.weight ? `↓ ${d.reps || '?'} × ${d.weight ? `${toDisplay(d.weight)} ${unit}` : 'p. corporal'}` : '↓ Drop')
  }
  return parts.join(' · ')
}

/** Adivina si un ejercicio se mide por tiempo (plancha, cinta, bici, elongación…) a partir del nombre. */
export function guessMeasure(name: string): WorkoutMeasure {
  return /\b(plancha|cinta|trote|trotar|correr|caminata|bici|bicicleta|eliptico|remo ergometro|soga|saltar|elongacion|estiramiento|movilidad|yoga|isometri|hiit|escaladora|cardio|sauna)/.test(fold(name)) ? 'time' : 'reps'
}
