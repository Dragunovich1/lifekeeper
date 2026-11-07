import { describe, expect, it } from 'vitest'
import { isDoseDay, parseFrequency, recurrenceLabel, resolveRecurrence, upcomingDoseDays } from '../utils/medicationSchedule'

const med = (frequency: string, startDate = '2026-11-05', extra: Record<string, unknown> = {}) => ({ frequency, startDate, ...extra })

describe('frecuencia de medicación (texto → días)', () => {
  it('semanal: "una inyección por semana" ya no avisa todos los días', () => {
    expect(parseFrequency('1 inyección por semana')).toEqual({ kind: 'weekly' })
    expect(parseFrequency('Una vez a la semana')).toEqual({ kind: 'weekly' })
    expect(parseFrequency('Semanal')).toEqual({ kind: 'weekly' })
    expect(parseFrequency('Cada semana')).toEqual({ kind: 'weekly' })
  })

  it('cada N días / semanas / mes', () => {
    expect(parseFrequency('Cada 15 días')).toEqual({ kind: 'interval', everyDays: 15 })
    expect(parseFrequency('cada dos semanas')).toEqual({ kind: 'interval', everyDays: 14 })
    expect(parseFrequency('Quincenal')).toEqual({ kind: 'interval', everyDays: 14 })
    expect(parseFrequency('Día por medio')).toEqual({ kind: 'interval', everyDays: 2 })
    expect(parseFrequency('Una vez al mes')).toEqual({ kind: 'monthly', everyMonths: 1 })
    expect(parseFrequency('Cada 3 meses')).toEqual({ kind: 'monthly', everyMonths: 3 })
  })

  it('días de la semana nombrados', () => {
    expect(parseFrequency('Lunes y jueves')).toEqual({ kind: 'weekdays', weekdays: [1, 4] })
    expect(parseFrequency('lunes, miércoles y viernes')).toEqual({ kind: 'weekdays', weekdays: [1, 3, 5] })
    expect(parseFrequency('de lunes a viernes')).toEqual({ kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] })
    expect(parseFrequency('Fines de semana')).toEqual({ kind: 'weekdays', weekdays: [0, 6] })
    expect(parseFrequency('Los martes por semana')).toEqual({ kind: 'weekly', weekdays: [2] })
  })

  it('diaria por defecto, incluso con horas, y a demanda', () => {
    for (const t of ['', 'Diaria', 'Cada 8 horas', '3 veces al día', 'Según indicación', 'Cada 1 día']) expect(parseFrequency(t)).toEqual({ kind: 'daily' })
    expect(parseFrequency('Si hace falta')).toEqual({ kind: 'asNeeded' })
    expect(parseFrequency('A demanda')).toEqual({ kind: 'asNeeded' })
  })
})

describe('¿hay que tomarla ese día?', () => {
  it('semanal sin día: el mismo día de la semana que el inicio (jueves 5/11/2026)', () => {
    const m = med('1 inyección por semana', '2026-11-05')
    expect(isDoseDay(m, '2026-11-05')).toBe(true)
    expect(isDoseDay(m, '2026-11-06')).toBe(false)
    expect(isDoseDay(m, '2026-11-11')).toBe(false)
    expect(isDoseDay(m, '2026-11-12')).toBe(true)
    expect(isDoseDay(m, '2026-11-19')).toBe(true)
  })

  it('cada N días cuenta desde el inicio y no antes', () => {
    const m = med('Cada 3 días', '2026-11-01')
    expect(['2026-11-01', '2026-11-04', '2026-11-07'].every((d) => isDoseDay(m, d))).toBe(true)
    expect(isDoseDay(m, '2026-11-02')).toBe(false)
    expect(isDoseDay(m, '2026-10-29')).toBe(false)
  })

  it('mensual: mismo día del mes (ajustado a fin de mes) y cada N meses', () => {
    const m = med('Mensual', '2026-01-31')
    expect(isDoseDay(m, '2026-02-28')).toBe(true)
    expect(isDoseDay(m, '2026-03-31')).toBe(true)
    expect(isDoseDay(m, '2026-03-30')).toBe(false)
    const q = med('Cada 3 meses', '2026-01-15')
    expect(isDoseDay(q, '2026-04-15')).toBe(true)
    expect(isDoseDay(q, '2026-02-15')).toBe(false)
  })

  it('respeta inicio y fin del tratamiento, y a demanda no agenda nada', () => {
    const m = med('Diaria', '2026-11-05', { endDate: '2026-11-07' })
    expect(isDoseDay(m, '2026-11-04')).toBe(false)
    expect(isDoseDay(m, '2026-11-06')).toBe(true)
    expect(isDoseDay(m, '2026-11-08')).toBe(false)
    expect(isDoseDay(med('Si hace falta'), '2026-11-06')).toBe(false)
  })

  it('la frecuencia explícita gana sobre el texto', () => {
    const m = med('Diaria', '2026-11-05', { recurrence: { kind: 'weekdays', weekdays: [1] } })
    expect(resolveRecurrence(m)).toEqual({ kind: 'weekdays', weekdays: [1] })
    expect(isDoseDay(m, '2026-11-09')).toBe(true) // lunes
    expect(isDoseDay(m, '2026-11-10')).toBe(false)
  })

  it('etiquetas y próximas tomas', () => {
    expect(recurrenceLabel(med('1 inyección por semana', '2026-11-05'))).toBe('Una vez por semana (jueves)')
    expect(recurrenceLabel(med('Cada 15 días'))).toBe('Cada 15 días')
    expect(recurrenceLabel(med('Lunes y jueves'))).toBe('Lun, Jue')
    expect(upcomingDoseDays(med('Semanal', '2026-11-05'), new Date(2026, 10, 6), 3)).toEqual(['2026-11-12', '2026-11-19', '2026-11-26'])
  })
})
