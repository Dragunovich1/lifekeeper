import { describe, expect, it } from 'vitest'
import type { Pet } from '../types'
import { activeMedications, daysUntil, dueStatus, expenseTotals, latestByName, newPet, petAge, petAlerts, weightSummary } from '../utils/pets'

const NOW = new Date(2026, 8, 15) // 15/09/2026
let n = 0
const id = () => `p${++n}`
const pet = (extra: Partial<Pet> = {}): Pet => ({ ...newPet('Luna', 'perro', id, NOW), ...extra })

describe('fechas y edad', () => {
  it('cuenta los días hasta una fecha', () => {
    expect(daysUntil('2026-09-15', NOW)).toBe(0)
    expect(daysUntil('2026-09-20', NOW)).toBe(5)
    expect(daysUntil('2026-09-10T22:00:00', NOW)).toBe(-5)
  })

  it('clasifica los vencimientos', () => {
    expect(dueStatus('2026-09-14', NOW)).toMatchObject({ status: 'overdue', label: 'Venció ayer' })
    expect(dueStatus('2026-09-05', NOW)).toMatchObject({ status: 'overdue', label: 'Venció hace 10 días' })
    expect(dueStatus('2026-09-15', NOW)).toMatchObject({ status: 'soon', label: 'Vence hoy' })
    expect(dueStatus('2026-09-16', NOW).label).toBe('Vence mañana')
    expect(dueStatus('2026-10-10', NOW)).toMatchObject({ status: 'soon', days: 25 })
    expect(dueStatus('2026-12-01', NOW).status).toBe('ok')
  })

  it('arma la edad en años y meses', () => {
    expect(petAge({ birthDate: '2023-07-10' }, NOW)).toBe('3 años y 2 meses')
    expect(petAge({ birthDate: '2025-09-15' }, NOW)).toBe('1 año')
    expect(petAge({ birthDate: '2026-04-20' }, NOW)).toBe('4 meses')
    expect(petAge({ birthDate: '2026-09-10' }, NOW)).toBe('5 días')
    expect(petAge({}, NOW)).toBe('')
    expect(petAge({ birthDate: '2020-01-01', deceasedDate: '2024-03-01' }, NOW)).toBe('4 años y 2 meses')
  })
})

describe('salud y avisos', () => {
  const p = pet({
    health: [
      { id: 'a', kind: 'vacuna', name: 'Antirrábica', date: '2025-09-01', nextDate: '2026-09-01' }, // vieja: ya hay una más nueva
      { id: 'b', kind: 'vacuna', name: 'antirrábica', date: '2026-09-01', nextDate: '2027-09-01' },
      { id: 'c', kind: 'vacuna', name: 'Séxtuple', date: '2025-09-20', nextDate: '2026-09-10' },
      { id: 'd', kind: 'desparasitacion', name: 'Interna', date: '2026-08-01', nextDate: '2026-10-01' },
      { id: 'e', kind: 'control', name: 'Anual', date: '2026-01-01' },
    ],
    appointments: [
      { id: 't1', date: '2026-09-18', reason: 'Control', done: false },
      { id: 't2', date: '2026-09-18', reason: 'Hecho', done: true },
      { id: 't3', date: '2026-12-18', reason: 'Lejano' },
    ],
    insurance: { company: 'Petcare', validUntil: '2026-09-25' },
  })

  it('se queda con el último registro de cada nombre', () => {
    const latest = latestByName(p.health)
    expect(latest.find((r) => r.name.toLowerCase() === 'antirrábica')?.id).toBe('b')
    expect(latest).toHaveLength(4)
  })

  it('avisa vencidos y próximos, sin repetir vacunas ya renovadas', () => {
    const alerts = petAlerts(p, NOW)
    expect(alerts.map((a) => a.title)).toEqual([
      'Vacuna: Séxtuple', // venció hace 5 días
      'Turno: Control', // en 3 días
      'Seguro (Petcare)', // en 10 días
      'Desparasitación: Interna', // en 16 días
    ])
    expect(alerts[0].status).toBe('overdue')
    expect(alerts.some((a) => a.title.includes('Antirrábica'))).toBe(false)
  })

  it('una mascota fallecida no genera avisos', () => {
    expect(petAlerts({ ...p, deceasedDate: '2026-08-01' }, NOW)).toEqual([])
  })

  it('medicación en curso', () => {
    const m = pet({
      medications: [
        { id: '1', name: 'A', startDate: '2026-09-01', endDate: '2026-09-10' },
        { id: '2', name: 'B', startDate: '2026-09-01', endDate: '2026-09-15' },
        { id: '3', name: 'C', startDate: '2026-09-01' },
      ],
    })
    expect(activeMedications(m, NOW).map((x) => x.name)).toEqual(['B', 'C'])
  })
})

describe('peso y gastos', () => {
  it('resume el peso con el cambio respecto de la última pesada', () => {
    expect(weightSummary([])).toBeNull()
    const s = weightSummary([
      { id: '2', date: '2026-08-01', kg: 11.2 },
      { id: '1', date: '2026-07-01', kg: 10.5 },
      { id: '3', date: '2026-09-01', kg: 11.0 },
    ])
    expect(s?.last.kg).toBe(11)
    expect(s?.change).toBe(-0.2)
    expect(s?.min).toBe(10.5)
    expect(s?.max).toBe(11.2)
  })

  it('suma gastos por mes, año y categoría', () => {
    const t = expenseTotals(
      [
        { id: '1', date: '2026-09-02', category: 'alimento', amount: 100.5 },
        { id: '2', date: '2026-09-10', category: 'veterinario', amount: 200 },
        { id: '3', date: '2026-03-10', category: 'alimento', amount: 50 },
        { id: '4', date: '2025-12-10', category: 'alimento', amount: 999 },
      ],
      NOW,
    )
    expect(t.thisMonth).toBe(300.5)
    expect(t.thisYear).toBe(350.5)
    expect(t.all).toBe(1349.5)
    expect(t.byCategory.alimento).toBe(150.5)
  })
})
