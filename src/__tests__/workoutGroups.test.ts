import { describe, expect, it } from 'vitest'
import type { WorkoutExercise } from '../types'
import {
  addRound,
  buildBlocks,
  cloneExercises,
  createGroup,
  describeBlock,
  groupKindFor,
  groupRest,
  isRoundDone,
  removeRound,
  replaceGroup,
  setGroupRest,
  ungroup,
} from '../utils/workoutGroups'

let n = 0
const id = () => `id${++n}`
const single = (name: string): WorkoutExercise => ({ id: id(), name, sets: [{ reps: 10, weight: 0 }] })

describe('workoutGroups', () => {
  it('elige el tipo según la cantidad de ejercicios', () => {
    expect(groupKindFor(2)).toBe('biserie')
    expect(groupKindFor(3)).toBe('triserie')
    expect(groupKindFor(4)).toBe('circuito')
  })

  it('crea una biserie con dos ejercicios, mismo grupo y tres rondas', () => {
    const g = createGroup([{ name: 'Sentadilla' }, { name: ' Estocadas ' }], id, 3, 120)
    expect(g).toHaveLength(2)
    expect(g[0].groupId).toBeTruthy()
    expect(g[0].groupId).toBe(g[1].groupId)
    expect(g.every((e) => e.groupKind === 'biserie' && e.sets.length === 3 && e.restSeconds === 120)).toBe(true)
    expect(g[1].name).toBe('Estocadas')
    expect(g[0].id).not.toBe(g[1].id)
  })

  it('exige al menos dos ejercicios con nombre', () => {
    expect(() => createGroup([{ name: 'Solo uno' }, { name: '  ' }], id)).toThrow()
  })

  it('arma bloques: sueltos y grupos, sin mezclar grupos separados', () => {
    const a = createGroup([{ name: 'A' }, { name: 'B' }], id)
    const c = createGroup([{ name: 'C' }, { name: 'D' }, { name: 'E' }], id)
    const list = [single('X'), ...a, ...c, single('Y')]
    const blocks = buildBlocks(list)
    expect(blocks.map((b) => b.kind)).toEqual(['single', 'group', 'group', 'single'])
    const g2 = blocks[2]
    expect(g2.kind === 'group' && g2.groupKind).toBe('triserie')
    expect(g2.kind === 'group' && g2.indices).toEqual([3, 4, 5])
  })

  it('un grupo de un solo ejercicio se trata como suelto', () => {
    const lonely = { ...single('Z'), groupId: 'g' }
    expect(buildBlocks([lonely])).toEqual([{ kind: 'single', index: 0 }])
  })

  it('suma y quita rondas en todos los ejercicios', () => {
    const g = createGroup([{ name: 'A' }, { name: 'B' }], id)
    const more = addRound(g)
    expect(more.every((e) => e.sets.length === 4)).toBe(true)
    const fewer = removeRound(more, 0)
    expect(fewer.every((e) => e.sets.length === 3)).toBe(true)
  })

  it('reemplaza y elimina un grupo conservando su lugar', () => {
    const g = createGroup([{ name: 'A' }, { name: 'B' }], id)
    const list = [single('X'), ...g, single('Y')]
    const edited = replaceGroup(list, g[0].groupId!, g.map((e) => ({ ...e, name: e.name + '!' })))
    expect(edited.map((e) => e.name)).toEqual(['X', 'A!', 'B!', 'Y'])
    expect(replaceGroup(list, g[0].groupId!, null).map((e) => e.name)).toEqual(['X', 'Y'])
  })

  it('deshace el ítem sin perder series', () => {
    const g = createGroup([{ name: 'A' }, { name: 'B' }], id)
    const loose = ungroup(g)
    expect(loose.every((e) => !e.groupId && !e.groupKind && e.sets.length === 3)).toBe(true)
  })

  it('maneja el descanso del ítem', () => {
    const g = createGroup([{ name: 'A' }, { name: 'B' }], id)
    expect(groupRest(g)).toBeUndefined()
    const withRest = setGroupRest(g, 90)
    expect(groupRest(withRest)).toBe(90)
    expect(withRest.every((e) => e.restSeconds === 90)).toBe(true)
    expect(groupRest(setGroupRest(withRest, undefined))).toBeUndefined()
  })

  it('una ronda está hecha solo si todos sus ejercicios lo están', () => {
    const g = createGroup([{ name: 'A' }, { name: 'B' }], id)
    g[0].sets[0].done = true
    expect(isRoundDone(g, 0)).toBe(false)
    g[1].sets[0].done = true
    expect(isRoundDone(g, 0)).toBe(true)
  })

  it('clona una rutina con grupos nuevos, sin repetir ids ni marcas de "hecha"', () => {
    const g = createGroup([{ name: 'A' }, { name: 'B' }], id)
    g[0].sets[0].done = true
    const copy = cloneExercises([...g, single('S')], id)
    expect(copy[0].groupId).toBeTruthy()
    expect(copy[0].groupId).toBe(copy[1].groupId)
    expect(copy[0].groupId).not.toBe(g[0].groupId)
    expect(copy[0].id).not.toBe(g[0].id)
    expect(copy[0].sets[0].done).toBe(false)
    expect(copy[2].groupId).toBeUndefined()
  })

  it('describe un ítem para historial y PDF', () => {
    const g = createGroup([{ name: 'Press' }, { name: 'Aperturas' }], id, 2)
    g[0].sets[0].reps = 15
    g[1].sets[0].reps = 12
    expect(describeBlock(g)).toEqual({ title: 'Press + Aperturas', detail: '2 rondas: 15+12 · 10+10' })
    expect(describeBlock([single('Solo')])).toEqual({ title: 'Solo', detail: '' })
  })
})
