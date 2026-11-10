import { describe, expect, it } from 'vitest'
import { VACCINE_SCHEDULES } from '../data/vaccineSchedules'
import { computeSchedule, nextPendingDoseIndex, suggestNextDose } from '../utils/vaccineSchedule'
import { applyScheduleChoice, clearScheduleChoice, createInitialVaccineForm } from '../utils/vaccineForm'
import { matchPlaceHistory, rankPlaceHistory } from '../utils/placeHistory'
import type { VaccineRecord } from '../types'

const AR = VACCINE_SCHEDULES.AR
const vac = (id: string) => AR.vaccines.find((v) => v.id === id)!
const rec = (p: Partial<VaccineRecord> & { id: string; vaccine: string; date: string }): VaccineRecord => ({ dose: '', location: '', lot: '', reminderEnabled: false, ...p })

describe('suggestNextDose', () => {
  it('usa la fecha del calendario si todavía no llegó', () => {
    // nació 10/1/2026; neumococo: 2m, 4m, 12m → aplicada la 1ª el 15/3 → la 2ª toca el 10/5
    expect(suggestNextDose(vac('neumo'), 0, '2026-03-15', '2026-01-10T12:00:00')).toBe('2026-05-10')
  })
  it('si la persona se atrasó, 4 semanas después de la aplicación', () => {
    expect(suggestNextDose(vac('neumo'), 0, '2026-09-01', '2026-01-10T12:00:00')).toBe('2026-09-29')
  })
  it('sin más dosis no sugiere nada; con refuerzo periódico, a los 10 años', () => {
    expect(suggestNextDose(vac('hepa'), 0, '2026-03-15', '2025-03-10T12:00:00')).toBe('')
    expect(suggestNextDose(vac('td'), 0, '2026-03-15', '1990-01-01T12:00:00')).toBe('2036-03-15')
  })
})

describe('applyScheduleChoice', () => {
  it('completa vacuna, dosis e id; y se puede volver a texto libre', () => {
    const base = { ...createInitialVaccineForm(), date: '2026-03-15T12:00:00' }
    const f = applyScheduleChoice(base, vac('neumo'), 0, '2026-01-10T12:00:00')
    expect(f).toMatchObject({ vaccine: 'Neumococo conjugada', scheduleVaccineId: 'neumo', doseIndex: 0, dose: '1ª dosis', nextDoseDate: '2026-05-10' })
    expect(clearScheduleChoice(f)).toMatchObject({ scheduleVaccineId: undefined, doseIndex: undefined })
  })
  it('keepNext conserva la fecha elegida a mano', () => {
    const base = { ...createInitialVaccineForm(), date: '2026-03-15T12:00:00', nextDoseDate: '2026-12-01' }
    expect(applyScheduleChoice(base, vac('neumo'), 1, '2026-01-10T12:00:00', true).nextDoseDate).toBe('2026-12-01')
  })
})

describe('registros con vacuna del calendario', () => {
  const birth = '2026-01-10T12:00:00'
  const now = new Date(2026, 8, 1)

  it('la dosis marcada explícitamente ocupa su lugar aunque el nombre no coincida', () => {
    const r = computeSchedule(AR, birth, [rec({ id: 'a', vaccine: 'mi vacuna rara', date: '2026-09-01', scheduleVaccineId: 'neumo', doseIndex: 1 })], now)
    const items = r.results.find((x) => x.vaccine.id === 'neumo')!.items
    expect(items[1].status).toBe('done')
    expect(items[0].status).toBe('overdue')
  })

  it('un registro de neumococo (infancia) no se cuenta para el de 65 años', () => {
    const r = computeSchedule(AR, birth, [rec({ id: 'a', vaccine: 'Neumococo', date: '2026-03-12', scheduleVaccineId: 'neumo', doseIndex: 0 })], now)
    expect(r.results.find((x) => x.vaccine.id === 'neumo65')!.items[0].status).not.toBe('done')
  })

  it('nextPendingDoseIndex propone la primera sin aplicar', () => {
    const r = computeSchedule(AR, birth, [rec({ id: 'a', vaccine: 'Rotavirus', date: '2026-03-12' })], now)
    expect(nextPendingDoseIndex(r, 'rota')).toBe(1)
    expect(nextPendingDoseIndex(null, 'rota')).toBe(0)
  })
})

describe('historial de lugares', () => {
  const entries = [
    { place: 'Hospital Italiano', date: '2025-01-01' },
    { place: 'hospital italiano ', date: '2026-02-01' },
    { place: 'Vacunatorio Central', date: '2026-03-01' },
    { place: '', date: '2026-03-01' },
  ]
  it('agrupa sin importar mayúsculas y ordena por uso', () => {
    const h = rankPlaceHistory(entries, Date.parse('2026-04-01'))
    expect(h).toHaveLength(2)
    expect(h[0]).toMatchObject({ place: 'hospital italiano', count: 2 })
  })
  it('filtra sin tildes y sin texto devuelve los más usados', () => {
    const h = rankPlaceHistory(entries)
    expect(matchPlaceHistory(h, 'VACUNATÓRIO'.replace('Ó', 'O')).map((x) => x.place)).toEqual(['Vacunatorio Central'])
    expect(matchPlaceHistory(h, '', 1)).toHaveLength(1)
  })
})
