import { describe, expect, it } from 'vitest'
import type { WorkoutRoutine, WorkoutSession } from '../types'
import { dayOverview, duplicateRoutine, moveItem, nextRoutineDay, prepareDayForLive, sessionToDay, templateToRoutine } from '../utils/workoutRoutines'

let n = 0
const id = () => `id${++n}`

const routine: WorkoutRoutine = {
  id: 'r1',
  name: 'Septiembre',
  createdAt: '2026-09-01',
  updatedAt: '2026-09-01',
  days: [
    { id: 'd1', name: 'Día 1', exercises: [{ id: 'e1', name: 'Sentadilla', sets: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }] }] },
    { id: 'd2', name: 'Día 2', exercises: [{ id: 'e2', name: 'Press', sets: [{ reps: 10, weight: 0 }] }] },
    { id: 'd3', name: 'Día 3', exercises: [] },
  ],
}
const done = (date: string, dayId: string, routineId = 'r1'): WorkoutSession => ({ id: id(), date, title: 'x', type: 'fuerza', exercises: [], routineId, routineDayId: dayId })

describe('rutinas', () => {
  it('sin sesiones toca el primer día', () => {
    expect(nextRoutineDay(routine, [])?.day.id).toBe('d1')
    expect(nextRoutineDay({ ...routine, days: [] }, [])).toBeNull()
  })

  it('toca el siguiente al último que hiciste y vuelve a empezar al terminar', () => {
    expect(nextRoutineDay(routine, [done('2026-09-02', 'd1')])?.day.id).toBe('d2')
    expect(nextRoutineDay(routine, [done('2026-09-02', 'd1'), done('2026-09-03', 'd2')])?.day.id).toBe('d3')
    expect(nextRoutineDay(routine, [done('2026-09-04', 'd3')])?.day.id).toBe('d1')
  })

  it('ignora sesiones de otras rutinas y cuenta los días hechos', () => {
    const r = nextRoutineDay(routine, [done('2026-09-02', 'd2', 'otra'), done('2026-09-03', 'd1'), done('2026-09-05', 'd1')])
    expect(r?.day.id).toBe('d2')
    expect(r?.counts.d1).toBe(2)
    expect(r?.lastDoneAt).toBe('2026-09-05')
  })

  it('precarga las cargas de la última vez donde el peso previsto es 0', () => {
    const history: WorkoutSession[] = [
      { id: 'h1', date: '2026-08-30', title: 'x', type: 'fuerza', exercises: [{ id: 'z', name: 'sentadilla', sets: [{ reps: 10, weight: 40 }, { reps: 8, weight: 50 }] }] },
    ]
    const ex = prepareDayForLive(routine.days[0], history, id)[0]
    expect(ex.id).not.toBe('e1')
    expect(ex.sets.map((s) => s.weight)).toEqual([40, 50, 50]) // la tercera repite la última
    // si ya había un peso previsto, se respeta
    const planned = { ...routine.days[0], exercises: [{ ...routine.days[0].exercises[0], sets: [{ reps: 10, weight: 100 }] }] }
    expect(prepareDayForLive(planned, history, id)[0].sets[0].weight).toBe(100)
  })

  it('convierte una sesión y una plantilla del asistente', () => {
    const s: WorkoutSession = { id: 's', date: '2026-09-01', title: 'Pierna', type: 'fuerza', exercises: [{ id: 'a', name: 'Prensa', sets: [{ reps: 12, weight: 80, done: true }] }] }
    const d = sessionToDay(s, id)
    expect(d.name).toBe('Pierna')
    expect(d.exercises[0].sets[0].done).toBeFalsy()
    const r = templateToRoutine({ id: 't', name: 'Hipertrofia', type: 'fuerza', exercises: s.exercises }, id)
    expect(r.days).toHaveLength(1)
    expect(r.days[0].exercises[0].id).not.toBe('a')
  })

  it('duplica con ids nuevos', () => {
    const c = duplicateRoutine(routine, id)
    expect(c.id).not.toBe(routine.id)
    expect(c.days[0].id).not.toBe('d1')
    expect(c.name).toBe('Septiembre (copia)')
  })

  it('mueve elementos y resume un día', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
    expect(moveItem([1, 2, 3], 0, 5)).toEqual([1, 2, 3])
    expect(dayOverview(routine.days[0])).toMatchObject({ exerciseCount: 1, sets: 3, preview: 'Sentadilla' })
  })
})
