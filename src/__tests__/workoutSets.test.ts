import { describe, expect, it } from 'vitest'
import type { WorkoutExercise, WorkoutExerciseSet, WorkoutSession } from '../types'
import {
  convertExerciseWeights,
  describeSet,
  dropsOf,
  estimate1RM,
  exerciseHistory,
  exerciseRecords,
  formatSeconds,
  isFailure,
  isWarmup,
  lastPerformance,
  newRecords,
  nextSetFrom,
  normalizeSet,
  sessionVolumeKg,
  setVolumeKg,
  summarizeSession,
  withMeasure,
} from '../utils/workoutSets'

const ex = (name: string, sets: WorkoutExerciseSet[], extra: Partial<WorkoutExercise> = {}): WorkoutExercise => ({ id: name + Math.random(), name, sets, ...extra })
const session = (id: string, date: string, exercises: WorkoutExercise[]): WorkoutSession => ({ id, date, title: 'Día ' + id, type: 'fuerza', exercises })

describe('series: calentamiento, al fallo y drop sets', () => {
  it('entiende el modelo viejo (setType) y el nuevo (banderas)', () => {
    expect(isWarmup({ reps: 10, setType: 'warmup' })).toBe(true)
    expect(isWarmup({ reps: 10, warmup: true })).toBe(true)
    expect(isFailure({ reps: 10, setType: 'failure' })).toBe(true)
    expect(isFailure({ reps: 10, failure: true, setType: 'normal' })).toBe(true)
    expect(dropsOf({ reps: 10, setType: 'dropset' })).toEqual([{ reps: 0 }])
    expect(dropsOf({ reps: 10, drops: [{ reps: 8, weight: 30 }] })).toHaveLength(1)
    expect(dropsOf({ reps: 10 })).toEqual([])
  })

  it('normalizeSet migra las marcas viejas y deja setType normal', () => {
    expect(normalizeSet({ reps: 10, setType: 'warmup' })).toMatchObject({ warmup: true, setType: 'normal' })
    expect(normalizeSet({ reps: 10, setType: 'failure' })).toMatchObject({ failure: true, setType: 'normal' })
    const d = normalizeSet({ reps: 10, setType: 'dropset' })
    expect(d.drops).toEqual([{ reps: 0 }])
    expect(d.setType).toBe('normal')
    // una serie ya normal no gana banderas
    const n = normalizeSet({ reps: 10, weight: 20, setType: 'normal' })
    expect(n.warmup).toBeUndefined()
    expect(n.failure).toBeUndefined()
    expect(n.drops).toBeUndefined()
    // la biserie antigua se conserva
    expect(normalizeSet({ reps: 10, setType: 'biserie' }).setType).toBe('biserie')
  })

  it('el volumen suma las caídas y excluye calentamientos y tiempo', () => {
    expect(setVolumeKg({ reps: 10, weight: 60 })).toBe(600)
    expect(setVolumeKg({ reps: 10, weight: 60, drops: [{ reps: 10, weight: 45 }, { reps: 10, weight: 30 }] })).toBe(600 + 450 + 300)
    expect(setVolumeKg({ reps: 10, weight: 20, warmup: true })).toBe(0)
    expect(setVolumeKg({ reps: 0, seconds: 60 }, 'time')).toBe(0)
  })

  it('nextSetFrom copia la serie anterior sin marcas de hecha ni calentamiento', () => {
    const next = nextSetFrom({ reps: 12, weight: 40, rpe: 9, done: true, warmup: true, failure: true, notes: 'x', drops: [{ reps: 10, weight: 30 }] })
    expect(next).toMatchObject({ reps: 12, weight: 40, rpe: 9, notes: '', drops: [{ reps: 10, weight: 30 }] })
    expect(next.done).toBeUndefined()
    expect(next.warmup).toBeUndefined()
    expect(next.failure).toBeUndefined()
  })

  it('withMeasure pasa un ejercicio a tiempo y de vuelta', () => {
    const base = ex('Plancha', [{ reps: 10, weight: 5, setType: 'normal' }])
    const t = withMeasure(base, 'time')
    expect(t.measure).toBe('time')
    expect(t.sets[0]).toMatchObject({ reps: 0, seconds: 60 })
    expect(t.sets[0].weight).toBeUndefined()
    const back = withMeasure(t, 'reps')
    expect(back.measure).toBeUndefined()
    expect(back.sets[0].seconds).toBeUndefined()
    expect(back.sets[0].reps).toBe(10)
  })

  it('formatSeconds', () => {
    expect(formatSeconds(90)).toBe('1:30')
    expect(formatSeconds(60)).toBe('1:00')
    expect(formatSeconds(3700)).toBe('1:01:40')
  })

  it('1RM estimada (Epley)', () => {
    expect(estimate1RM(100, 1)).toBe(100)
    expect(estimate1RM(100, 10)).toBeCloseTo(133.3, 1)
    expect(estimate1RM(0, 10)).toBe(0)
  })
})

describe('resumen de sesión', () => {
  const s = session('1', '2026-09-01', [
    ex('Sentadilla', [
      { reps: 10, weight: 20, warmup: true },
      { reps: 10, weight: 60 },
      { reps: 10, weight: 60, failure: true, drops: [{ reps: 10, weight: 45 }] },
    ]),
    ex('Plancha', [{ reps: 0, seconds: 60 }, { reps: 0, seconds: 45 }], { measure: 'time' }),
  ])

  it('cuenta series efectivas, calentamientos, drop sets y volumen', () => {
    const r = summarizeSession(s)
    expect(r.effectiveSets).toBe(4)
    expect(r.warmupSets).toBe(1)
    expect(r.dropSets).toBe(1)
    expect(r.failureSets).toBe(1)
    expect(r.volumeKg).toBe(600 + 600 + 450)
    expect(r.topWeightKg).toBe(60)
    expect(r.timeSeconds).toBe(105)
    expect(sessionVolumeKg(s)).toBe(1650)
  })

  it('un ítem combinado cuenta como un ítem', () => {
    const a = ex('A', [{ reps: 10 }], { groupId: 'g', groupKind: 'biserie' })
    const b = ex('B', [{ reps: 10 }], { groupId: 'g', groupKind: 'biserie' })
    const r = summarizeSession(session('2', '2026-09-02', [a, b, ex('C', [{ reps: 10 }])]))
    expect(r.exercises).toBe(3)
    expect(r.items).toBe(2)
  })
})

describe('historial, récords y última vez', () => {
  const w1 = session('1', '2026-09-01', [ex('Press de banca', [{ reps: 10, weight: 60 }, { reps: 8, weight: 70 }])])
  const w2 = session('2', '2026-09-08', [ex('press de banca', [{ reps: 8, weight: 72.5 }])])
  const w3 = session('3', '2026-09-15', [ex('Press de banca', [{ reps: 5, weight: 70 }])])

  it('junta el historial sin importar mayúsculas y lo ordena por fecha', () => {
    const h = exerciseHistory([w3, w1, w2], 'PRESS DE BANCA')
    expect(h.map((e) => e.sessionId)).toEqual(['1', '2', '3'])
    expect(h[0].topWeightKg).toBe(70)
    expect(h[0].topWeightReps).toBe(8)
  })

  it('lastPerformance devuelve la vez anterior', () => {
    expect(lastPerformance([w1, w2, w3], 'Press de banca', '3')?.sessionId).toBe('2')
    expect(lastPerformance([w1], 'Sentadilla')).toBeNull()
  })

  it('records por ejercicio', () => {
    const r = exerciseRecords([w1, w2, w3])
    expect(r).toHaveLength(1)
    expect(r[0].sessions).toBe(3)
    expect(r[0].maxWeightKg).toBe(72.5)
  })

  it('detecta récords nuevos solo si ya había historial', () => {
    const heavy = session('4', '2026-09-22', [ex('Press de banca', [{ reps: 5, weight: 80 }]), ex('Remo', [{ reps: 10, weight: 50 }])])
    const recs = newRecords(heavy, [w1, w2, w3])
    expect(recs).toEqual([{ name: 'Press de banca', kind: 'peso', value: 80 }]) // Remo es nuevo: no es "récord"
    expect(newRecords(w3, [w1, w2])).toEqual([])
  })
})

describe('unidades y texto', () => {
  it('convierte pesos de series y caídas', () => {
    const [c] = convertExerciseWeights([ex('A', [{ reps: 5, weight: 10, drops: [{ reps: 5, weight: 5 }] }])], (kg) => kg * 2)
    expect(c.sets[0].weight).toBe(20)
    expect(c.sets[0].drops?.[0].weight).toBe(10)
  })

  it('describeSet muestra fallo, caídas y por lado', () => {
    const id = (n: number) => n
    expect(describeSet({ reps: 12, weight: 40 }, {}, 'kg', id)).toBe('12 × 40 kg')
    expect(describeSet({ reps: 10, weight: 60, failure: true, drops: [{ reps: 10, weight: 45 }] }, {}, 'kg', id)).toBe('10 × 60 kg · Fallo · ↓ 10 × 45 kg')
    expect(describeSet({ reps: 15, weight: 0 }, { perSide: true }, 'kg', id)).toBe('15 c/lado × p. corporal')
    expect(describeSet({ reps: 0, seconds: 90 }, { measure: 'time' }, 'kg', id)).toBe('1:30')
    expect(describeSet({ reps: 10, weight: 20, warmup: true }, {}, 'kg', id)).toBe('10 × 20 kg · Calent.')
  })
})
