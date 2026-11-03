/**
 * Rutinas (programas con varios días): qué día toca, cómo empezar un día precargando tus últimas cargas
 * y cómo convertir una sesión vieja o una plantilla del asistente en un día de rutina.
 */
import type { WorkoutExercise, WorkoutRoutine, WorkoutRoutineDay, WorkoutSession, WorkoutTemplate } from '../types'
import { cloneExercises } from './workoutGroups'
import { fold, lastPerformance, measureOf } from './workoutSets'

export interface NextDay {
  day: WorkoutRoutineDay
  index: number
  /** Cuándo fue la última vez que se hizo un día de esta rutina (ISO) o null si nunca. */
  lastDoneAt: string | null
  /** Veces que se completó cada día. */
  counts: Record<string, number>
}

/** El día que toca: el siguiente al último que hiciste de esta rutina (o el primero). */
export function nextRoutineDay(routine: WorkoutRoutine, workouts: WorkoutSession[]): NextDay | null {
  if (routine.days.length === 0) return null
  const done = workouts.filter((w) => w.routineId === routine.id).sort((a, b) => b.date.localeCompare(a.date))
  const counts: Record<string, number> = {}
  for (const w of done) if (w.routineDayId) counts[w.routineDayId] = (counts[w.routineDayId] ?? 0) + 1
  const last = done.find((w) => w.routineDayId && routine.days.some((d) => d.id === w.routineDayId))
  let index = 0
  if (last) {
    const lastIndex = routine.days.findIndex((d) => d.id === last.routineDayId)
    index = (lastIndex + 1) % routine.days.length
  }
  return { day: routine.days[index], index, lastDoneAt: last?.date ?? null, counts }
}

/**
 * Ejercicios de un día listos para entrenar: ids nuevos, series sin marcar y, donde el peso previsto es 0,
 * el que usaste la última vez (serie por serie; si hoy hay más series, se repite la última).
 */
export function prepareDayForLive(day: WorkoutRoutineDay, workouts: WorkoutSession[], newId: () => string): WorkoutExercise[] {
  return cloneExercises(day.exercises, newId).map((ex) => {
    if (measureOf(ex) === 'time') return ex
    const last = lastPerformance(workouts, ex.name)
    if (!last) return ex
    const prevSets = last.sets.filter((s) => !s.warmup && s.setType !== 'warmup')
    if (prevSets.length === 0) return ex
    return {
      ...ex,
      sets: ex.sets.map((s, i) => {
        if (s.weight) return s
        const ref = prevSets[Math.min(i, prevSets.length - 1)]
        return { ...s, weight: ref.weight ?? 0, drops: s.drops ?? (ref.drops?.length ? ref.drops.map((d) => ({ ...d })) : undefined) }
      }),
    }
  })
}

/** Convierte una sesión ya hecha en un día de rutina (con las cargas que usaste). */
export function sessionToDay(session: WorkoutSession, newId: () => string): WorkoutRoutineDay {
  return {
    id: newId(),
    name: session.title,
    type: session.type,
    notes: session.notes,
    exercises: cloneExercises(session.exercises, newId).map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s, done: undefined })) })),
  }
}

/** Plantilla del asistente → rutina de un solo día. */
export function templateToRoutine(t: WorkoutTemplate, newId: () => string): WorkoutRoutine {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name: t.name,
    notes: t.notes,
    createdAt: now,
    updatedAt: now,
    days: [{ id: newId(), name: t.name, type: t.type, notes: t.notes, exercises: cloneExercises(t.exercises, newId) }],
  }
}

export function newRoutine(name: string, newId: () => string): WorkoutRoutine {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    days: [{ id: newId(), name: 'Día 1', type: 'fuerza', exercises: [] }],
  }
}

export function duplicateRoutine(r: WorkoutRoutine, newId: () => string): WorkoutRoutine {
  const now = new Date().toISOString()
  return {
    ...r,
    id: newId(),
    name: `${r.name} (copia)`,
    createdAt: now,
    updatedAt: now,
    days: r.days.map((d) => ({ ...d, id: newId(), exercises: cloneExercises(d.exercises, newId) })),
  }
}

/** Mueve el elemento `from` a la posición `to` (sin mutar). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const copy = [...list]
  const [it] = copy.splice(from, 1)
  copy.splice(to, 0, it)
  return copy
}

/** Cantidad de ejercicios y series previstas de un día (para mostrar en la tarjeta). */
export function dayOverview(day: WorkoutRoutineDay) {
  const names = Array.from(new Set(day.exercises.map((e) => e.name)))
  const sets = day.exercises.reduce((a, e) => a + e.sets.filter((s) => !s.warmup && s.setType !== 'warmup').length, 0)
  return { exerciseCount: day.exercises.length, sets, names, preview: names.slice(0, 3).join(' · ') + (names.length > 3 ? ` +${names.length - 3}` : '') }
}

export const sameName = (a: string, b: string) => fold(a) === fold(b)
