import { describe, expect, it } from 'vitest'
import type { WorkoutSession } from '../types'
import { buildTables, filterWorkouts, resolvePeriod, setsTable, summarizePeriod, tableToCsv, workoutsToJson } from '../utils/workoutExport'

const NOW = new Date(2026, 8, 15) // 15/09/2026

const w = (id: string, date: string, extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id,
  date,
  title: 'Sesión ' + id,
  type: 'fuerza',
  exercises: [],
  ...extra,
})

describe('períodos', () => {
  it('resuelve períodos relativos y de calendario', () => {
    expect(resolvePeriod('week', NOW)).toMatchObject({ from: '2026-09-09', to: '2026-09-15' })
    expect(resolvePeriod('month', NOW)).toMatchObject({ from: '2026-08-17', to: '2026-09-15' })
    expect(resolvePeriod('thisMonth', NOW)).toMatchObject({ from: '2026-09-01', to: '2026-09-15', label: 'septiembre 2026' })
    expect(resolvePeriod('lastMonth', NOW)).toMatchObject({ from: '2026-08-01', to: '2026-08-31', label: 'agosto 2026' })
    expect(resolvePeriod('thisYear', NOW)).toMatchObject({ from: '2026-01-01' })
    expect(resolvePeriod('all', NOW)).toMatchObject({ from: null, to: null })
  })

  it('el período a elegir arma su etiqueta', () => {
    expect(resolvePeriod('custom', NOW, { from: '2026-03-01', to: '2026-03-31' }).label).toBe('Del 01/03/2026 al 31/03/2026')
    expect(resolvePeriod('custom', NOW, { from: '2026-03-01' }).label).toBe('Desde el 01/03/2026')
  })

  it('filtra por fechas (inclusive), disciplina y texto, y ordena de más viejo a más nuevo', () => {
    const list = [
      w('c', '2026-09-10T12:00:00', { type: 'running', title: 'Fondo' }),
      w('a', '2026-08-31T12:00:00'),
      w('b', '2026-09-01T00:30:00', { exercises: [{ id: 'e', name: 'Sentadilla', sets: [] }] }),
      w('old', '2026-07-01T12:00:00'),
    ]
    const p = resolvePeriod('lastMonth', NOW)
    expect(filterWorkouts(list, { period: p }).map((x) => x.id)).toEqual(['a'])
    expect(filterWorkouts(list, { period: resolvePeriod('thisMonth', NOW) }).map((x) => x.id)).toEqual(['b', 'c'])
    expect(filterWorkouts(list, { period: resolvePeriod('all', NOW), type: 'running' }).map((x) => x.id)).toEqual(['c'])
    expect(filterWorkouts(list, { period: resolvePeriod('all', NOW), search: 'sentadilla' }).map((x) => x.id)).toEqual(['b'])
  })
})

describe('tablas', () => {
  const sessions: WorkoutSession[] = [
    w('1', '2026-09-01T10:00:00', {
      durationMinutes: 60,
      exercises: [
        { id: 'p', name: 'Prensa', restSeconds: 120, sets: [{ reps: 12, weight: 100 }, { reps: 10, weight: 120, failure: true, drops: [{ reps: 10, weight: 90 }, { reps: 8, weight: 70 }] }, { reps: 10, weight: 40, warmup: true }] },
        { id: 'a', name: 'Press', groupId: 'g', groupKind: 'biserie', restSeconds: 90, sets: [{ reps: 10, weight: 50 }] },
        { id: 'b', name: 'Aperturas', groupId: 'g', groupKind: 'biserie', restSeconds: 90, sets: [{ reps: 12, weight: 14 }] },
        { id: 't', name: 'Plancha', measure: 'time', sets: [{ reps: 0, seconds: 60 }] },
      ],
    }),
    w('2', '2026-09-08T10:00:00', { type: 'running', durationMinutes: 40, distanceKm: 6 }),
  ]
  const ctx = { imperial: false }

  it('una fila por serie y una más por cada caída; calentamientos marcados', () => {
    const t = setsTable(sessions, ctx)
    const col = (name: string) => t.headers.indexOf(name)
    // Prensa: 3 series + 2 caídas = 5, Press 1, Aperturas 1, Plancha 1
    expect(t.rows).toHaveLength(8)
    const tipos = t.rows.map((r) => r[col('Tipo de serie')])
    expect(tipos.filter((x) => x === 'Caída')).toHaveLength(2)
    expect(tipos.filter((x) => x === 'Calentamiento')).toHaveLength(1)
    const fallo = t.rows.find((r) => r[col('Al fallo')] === 'Sí')
    expect(fallo?.[col('Repeticiones')]).toBe(10)
    // ítems combinados
    const biserie = t.rows.filter((r) => r[col('Tipo de ítem')] === 'Biserie')
    expect(biserie.map((r) => r[col('Ejercicio')])).toEqual(['Press', 'Aperturas'])
    expect(biserie[0][col('Descanso (seg)')]).toBe(90)
    // por tiempo
    const plancha = t.rows.find((r) => r[col('Ejercicio')] === 'Plancha')
    expect(plancha?.[col('Tiempo (seg)')]).toBe(60)
    expect(plancha?.[col('Repeticiones')]).toBe('')
  })

  it('convierte a libras sin tocar los datos guardados', () => {
    const t = setsTable(sessions, { imperial: true })
    const wcol = t.headers.findIndex((h) => h.startsWith('Peso'))
    expect(t.headers[wcol]).toBe('Peso (lb)')
    expect(t.rows[0][wcol]).toBe(220.5) // 100 kg
    expect(sessions[0].exercises[0].sets[0].weight).toBe(100)
  })

  it('resume el período: volumen sin calentamientos y con caídas', () => {
    const s = summarizePeriod(sessions, resolvePeriod('custom', NOW, { from: '2026-09-01', to: '2026-09-14' }))
    // 12*100 + (10*120 + 10*90 + 8*70) + 10*50 + 12*14 = 1200 + 2660 + 500 + 168
    expect(s.volumeKg).toBe(4528)
    expect(s.sessions).toBe(2)
    expect(s.perWeek).toBe(1) // 2 sesiones en 14 días
    expect(s.distanceKm).toBe(6)
    expect(s.dropSets).toBe(1)
    expect(s.warmupSets).toBe(1)
  })

  it('arma las cuatro hojas y un CSV bien escapado', () => {
    const tables = buildTables(sessions, resolvePeriod('all', NOW), ctx, 'Carolina')
    expect(tables.map((t) => t.name)).toEqual(['Resumen', 'Sesiones', 'Series', 'Ejercicios'])
    const csv = tableToCsv({ name: 'x', headers: ['a', 'b'], rows: [['hola; "mundo"', 1], ['línea\nnueva', '']] })
    expect(csv.startsWith('﻿a;b')).toBe(true)
    expect(csv).toContain('"hola; ""mundo"""')
    expect(csv).toContain('"línea\nnueva"')
  })

  it('el JSON incluye período, resumen y sesiones', () => {
    const json = JSON.parse(workoutsToJson(sessions, resolvePeriod('all', NOW), ctx, 'Carolina'))
    expect(json.tipo).toBe('entrenamientos')
    expect(json.sesiones).toHaveLength(2)
    expect(json.resumen.sessions).toBe(2)
  })
})
