import { describe, expect, it } from 'vitest'
import { scheduleForCountry, VACCINE_SCHEDULES } from '../data/vaccineSchedules'
import { addMonths, ageInMonths, computeSchedule } from '../utils/vaccineSchedule'
import type { VaccineRecord } from '../types'

const rec = (id: string, vaccine: string, date: string): VaccineRecord => ({ id, vaccine, dose: '', date, location: '', lot: '', reminderEnabled: false })
const AR = VACCINE_SCHEDULES.AR
const find = (r: ReturnType<typeof computeSchedule>, id: string) => r.results.find((x) => x.vaccine.id === id)!

describe('scheduleForCountry', () => {
  it('usa el calendario argentino para AR y la referencia OMS/CDC para el resto', () => {
    expect(scheduleForCountry('AR').id).toBe('AR')
    expect(scheduleForCountry(undefined, 'Argentina').id).toBe('AR')
    expect(scheduleForCountry('ES').id).toBe('INTL')
    expect(scheduleForCountry().id).toBe('INTL')
  })
})

describe('fechas', () => {
  it('addMonths respeta fin de mes', () => {
    expect(addMonths(new Date(2024, 0, 31), 1).getDate()).toBe(29)
  })
  it('ageInMonths', () => {
    expect(ageInMonths(new Date(2026, 0, 15), new Date(2026, 5, 14))).toBe(4)
    expect(ageInMonths(new Date(2026, 0, 15), new Date(2026, 5, 15))).toBe(5)
  })
})

describe('computeSchedule (Argentina)', () => {
  const birth = '2026-01-10T12:00:00'
  const now = new Date(2026, 5, 20) // 5 meses y 10 días

  it('marca vencidas las dosis cuya edad ya pasó y sin registro', () => {
    const r = computeSchedule(AR, birth, [], now)
    expect(find(r, 'neumo').items.map((i) => i.status)).toEqual(['overdue', 'overdue', 'future'])
    expect(find(r, 'mening').items[1].status).toBe('overdue') // 5 meses
    expect(find(r, 'polio').items[2].status).toBe('soon') // 6 meses se cumplen el 10/7: faltan 20 días
  })

  it('las dosis registradas se asignan en orden', () => {
    const r = computeSchedule(AR, birth, [rec('a', 'Neumococo conjugada', '2026-03-12'), rec('b', 'Neumococo', '2026-05-15')], now)
    const items = find(r, 'neumo').items
    expect(items[0].status).toBe('done')
    expect(items[1].status).toBe('done')
    expect(items[2].status).toBe('future')
    expect(items[0].record?.id).toBe('a')
  })

  it('triple viral no se confunde con triple bacteriana', () => {
    const r = computeSchedule(AR, '2020-01-10T12:00:00', [rec('a', 'Triple bacteriana acelular', '2031-01-10')], new Date(2032, 0, 1))
    expect(find(r, 'triple-viral').items.every((i) => i.status !== 'done')).toBe(true)
    expect(find(r, 'dtpa').items[0].status).toBe('done')
    expect(find(r, 'dtp').items[0].status).not.toBe('done')
  })

  it('las vacunas con condición no cuentan como pendientes', () => {
    const r = computeSchedule(AR, birth, [], new Date(2027, 11, 1))
    expect(r.attention.some((i) => i.vaccineId === 'fiebre-amarilla')).toBe(false)
    expect(find(r, 'fiebre-amarilla').optional).toBe(true)
  })

  it('en un adulto no evalúa la infancia pero sí el refuerzo de doble bacteriana', () => {
    const adult = computeSchedule(AR, '1990-05-05T12:00:00', [], new Date(2026, 5, 1))
    expect(adult.attention.every((i) => i.vaccineId === 'td')).toBe(true)
    expect(adult.attention.length).toBe(1)
  })

  it('refuerzo cada 10 años desde la última aplicación', () => {
    const base = computeSchedule(AR, '1990-05-05T12:00:00', [rec('a', 'Doble bacteriana', '2010-03-01'), rec('b', 'Doble bacteriana', '2010-04-01'), rec('c', 'Doble bacteriana', '2010-10-01')], new Date(2026, 5, 1))
    const last = find(base, 'td').items.at(-1)!
    expect(last.dueDate).toBe('2020-10-01')
    expect(last.status).toBe('overdue')
  })
})
