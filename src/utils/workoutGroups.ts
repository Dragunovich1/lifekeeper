/**
 * Ítems combinados de un entrenamiento: biserie (2 ejercicios), triserie (3) y circuito (4 o más).
 *
 * Un ítem combinado es una tanda de `WorkoutExercise` consecutivos con el mismo `groupId`. Cada ejercicio
 * conserva sus propias series (reps / peso), y la "ronda" n del ítem es la serie n de todos sus ejercicios.
 */
import type { WorkoutExercise, WorkoutExerciseSet, WorkoutGroupKind, WorkoutMeasure } from '../types'
import { defaultSetsFor, formatSeconds, measureOf, nextSetFrom } from './workoutSets'

export const GROUP_MIN = 2
export const GROUP_MAX = 6

export interface ExerciseDraft {
  name: string
  muscles?: string[]
  equipment?: string[]
  measure?: WorkoutMeasure
  perSide?: boolean
}

export type WorkoutBlock =
  | { kind: 'single'; index: number }
  | { kind: 'group'; groupId: string; groupKind: WorkoutGroupKind; indices: number[] }

export const GROUP_LABELS: Record<WorkoutGroupKind, string> = {
  biserie: 'Biserie',
  triserie: 'Triserie',
  circuito: 'Circuito',
}

export function groupKindFor(count: number): WorkoutGroupKind {
  if (count <= 2) return 'biserie'
  if (count === 3) return 'triserie'
  return 'circuito'
}

/** Series por defecto de un ejercicio nuevo. */
export function defaultSets(count = 3, measure: WorkoutMeasure = 'reps'): WorkoutExerciseSet[] {
  return defaultSetsFor(measure, count)
}

/** Agrupa la lista plana en bloques: ejercicios sueltos o ítems combinados (solo si son consecutivos). */
export function buildBlocks(exercises: WorkoutExercise[]): WorkoutBlock[] {
  const blocks: WorkoutBlock[] = []
  exercises.forEach((ex, index) => {
    const last = blocks[blocks.length - 1]
    if (ex.groupId && last && last.kind === 'group' && last.groupId === ex.groupId) {
      last.indices.push(index)
      last.groupKind = groupKindFor(last.indices.length)
      return
    }
    if (ex.groupId) {
      blocks.push({ kind: 'group', groupId: ex.groupId, groupKind: groupKindFor(1), indices: [index] })
      return
    }
    blocks.push({ kind: 'single', index })
  })
  // Un "grupo" de un solo ejercicio es en realidad un ejercicio suelto
  return blocks.map((b) => (b.kind === 'group' && b.indices.length < GROUP_MIN ? { kind: 'single', index: b.indices[0] } : b))
}

/** Crea los ejercicios de un ítem combinado (2 a 6 ejercicios) con las mismas rondas. */
export function createGroup(drafts: ExerciseDraft[], newId: () => string, rounds = 3, restSeconds?: number): WorkoutExercise[] {
  const clean = drafts.map((d) => ({ ...d, name: d.name.trim() })).filter((d) => d.name).slice(0, GROUP_MAX)
  if (clean.length < GROUP_MIN) throw new Error(`Un ítem combinado necesita al menos ${GROUP_MIN} ejercicios.`)
  const groupId = newId()
  const groupKind = groupKindFor(clean.length)
  return clean.map((d) => ({
    id: newId(),
    name: d.name,
    muscles: d.muscles?.length ? d.muscles : undefined,
    equipment: d.equipment?.length ? d.equipment : undefined,
    sets: defaultSets(rounds, d.measure ?? 'reps'),
    ...(d.measure === 'time' ? { measure: 'time' as const } : {}),
    ...(d.perSide ? { perSide: true } : {}),
    groupId,
    groupKind,
    ...(restSeconds ? { restSeconds } : {}),
  }))
}

/** Un ejercicio suelto nuevo (por tiempo si el nombre lo sugiere o si el borrador lo pide). */
export function createSingle(draft: ExerciseDraft, newId: () => string, sets = 3, restSeconds?: number): WorkoutExercise {
  const measure = draft.measure ?? 'reps'
  return {
    id: newId(),
    name: draft.name.trim(),
    muscles: draft.muscles?.length ? draft.muscles : undefined,
    equipment: draft.equipment?.length ? draft.equipment : undefined,
    sets: defaultSets(sets, measure),
    ...(measure === 'time' ? { measure: 'time' as const } : {}),
    ...(draft.perSide ? { perSide: true } : {}),
    ...(restSeconds ? { restSeconds } : {}),
  }
}

/** Cantidad de rondas del ítem (la mayor cantidad de series entre sus ejercicios). */
export function roundCount(members: WorkoutExercise[]): number {
  return members.reduce((max, m) => Math.max(max, m.sets.length), 0)
}

/** "Sentadilla + Estocadas" */
export function groupTitle(members: WorkoutExercise[]): string {
  return members.map((m) => m.name).join(' + ')
}

/** Suma una ronda a todos los ejercicios, copiando la última de cada uno (sin marcar como hecha). */
export function addRound(members: WorkoutExercise[]): WorkoutExercise[] {
  return members.map((m) => ({ ...m, sets: [...m.sets, nextSetFrom(m.sets[m.sets.length - 1])] }))
}

/** Quita la ronda `round` de todos los ejercicios. */
export function removeRound(members: WorkoutExercise[], round: number): WorkoutExercise[] {
  return members.map((m) => ({ ...m, sets: m.sets.filter((_, i) => i !== round) }))
}

/** Reemplaza (o quita, si `members` es null) un ítem combinado dentro de la lista plana. */
export function replaceGroup(exercises: WorkoutExercise[], groupId: string, members: WorkoutExercise[] | null): WorkoutExercise[] {
  const firstIndex = exercises.findIndex((e) => e.groupId === groupId)
  if (firstIndex < 0) return exercises
  const rest = exercises.filter((e) => e.groupId !== groupId)
  return members ? [...rest.slice(0, firstIndex), ...members, ...rest.slice(firstIndex)] : rest
}

/** Deshace el ítem: sus ejercicios pasan a ser ejercicios sueltos. */
export function ungroup(members: WorkoutExercise[]): WorkoutExercise[] {
  return members.map((m) => {
    const rest = { ...m }
    delete rest.groupId
    delete rest.groupKind
    return rest
  })
}

/** Descanso del ítem en segundos (el primero de sus ejercicios que lo tenga). */
export function groupRest(members: WorkoutExercise[]): number | undefined {
  return members.find((m) => m.restSeconds && m.restSeconds > 0)?.restSeconds
}

export function setGroupRest(members: WorkoutExercise[], seconds: number | undefined): WorkoutExercise[] {
  return members.map((m) => {
    const next = { ...m }
    if (seconds && seconds > 0) next.restSeconds = seconds
    else delete next.restSeconds
    return next
  })
}

/** ¿La ronda `round` está completa (todos los ejercicios que la tienen, hechos)? */
export function isRoundDone(members: WorkoutExercise[], round: number): boolean {
  const sets = members.map((m) => m.sets[round]).filter(Boolean)
  return sets.length > 0 && sets.every((s) => s.done)
}

/**
 * Copia una lista de ejercicios (para usar una rutina vieja como plantilla): ids nuevos, mismos grupos
 * (con un groupId nuevo por grupo) y series sin marcar.
 */
export function cloneExercises(exercises: WorkoutExercise[], newId: () => string): WorkoutExercise[] {
  const groupMap = new Map<string, string>()
  return exercises.map((ex) => {
    let groupId: string | undefined
    if (ex.groupId) {
      if (!groupMap.has(ex.groupId)) groupMap.set(ex.groupId, newId())
      groupId = groupMap.get(ex.groupId)
    }
    return {
      ...ex,
      id: newId(),
      groupId,
      groupKind: groupId ? ex.groupKind : undefined,
      sets: ex.sets.map((s) => ({ ...s, done: false, setType: s.setType || 'normal', notes: s.notes || '', drops: s.drops?.map((d) => ({ ...d })) })),
    }
  })
}

/**
 * Texto para exportes/historial: "Sentadilla + Estocadas — 3 rondas: 15+15 · 12+12 · 10+10" cuando hay grupo;
 * para un ejercicio suelto devuelve el nombre.
 */
export function describeBlock(members: WorkoutExercise[]): { title: string; detail: string } {
  if (members.length === 1) return { title: members[0].name, detail: '' }
  const rounds = roundCount(members)
  const parts: string[] = []
  for (let r = 0; r < rounds; r++) {
    parts.push(members.map((m) => (m.sets[r] ? (measureOf(m) === 'time' ? formatSeconds(m.sets[r].seconds || 0) : String(m.sets[r].reps)) : '–')).join('+'))
  }
  return { title: groupTitle(members), detail: `${rounds} ${rounds === 1 ? 'ronda' : 'rondas'}: ${parts.join(' · ')}` }
}

/** Sube o baja un ítem (ejercicio suelto o grupo entero) dentro de la lista plana. */
export function moveBlock(exercises: WorkoutExercise[], blockIndex: number, direction: -1 | 1): WorkoutExercise[] {
  const blocks = buildBlocks(exercises).map((b) => (b.kind === 'group' ? b.indices : [b.index]))
  const target = blockIndex + direction
  if (blockIndex < 0 || target < 0 || target >= blocks.length) return exercises
  const reordered = [...blocks]
  ;[reordered[blockIndex], reordered[target]] = [reordered[target], reordered[blockIndex]]
  return reordered.flatMap((idxs) => idxs.map((i) => exercises[i]))
}
