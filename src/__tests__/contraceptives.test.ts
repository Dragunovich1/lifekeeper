import { describe, expect, it } from 'vitest'
import type { ContraceptiveMethod } from '../types'
import { adherenceSummary, hasActiveHormonal, methodStatus, pillAdherence } from '../utils/contraceptives'

const base = (over: Partial<ContraceptiveMethod>): ContraceptiveMethod => ({ id: 'm', type: 'pastilla', startDate: '2026-10-01', active: true, ...over })

describe('pastilla (21 + 7 de pausa)', () => {
  it('día activo sin tomar: pendiente; pasada la hora: atrasada', () => {
    const m = base({ reminderTime: '21:00', takenLog: [] })
    expect(methodStatus(m, '2026-10-05', '10:00')).toMatchObject({ severity: 'due', packDay: 5, pillDue: true })
    expect(methodStatus(m, '2026-10-05', '22:30').severity).toBe('overdue')
  })
  it('ya tomada → ok', () => {
    expect(methodStatus(base({ takenLog: ['2026-10-05'] }), '2026-10-05').severity).toBe('ok')
  })
  it('día 22 en adelante es pausa, y el blíster se retoma el día 29', () => {
    const s = methodStatus(base({}), '2026-10-23') // día 23 → pausa 2 de 7
    expect(s).toMatchObject({ inPause: true, severity: 'info', pillDue: false })
    expect(s.nextKey).toBe('2026-10-29')
    expect(methodStatus(base({}), '2026-10-29').packDay).toBe(1)
  })
  it('continua (sin pausa) nunca entra en pausa', () => {
    expect(methodStatus(base({ packDays: 28, pauseDays: 0 }), '2026-12-31').inPause).toBeUndefined()
  })
})

describe('otros métodos', () => {
  it('parche: cambio cada 7 días y semana libre', () => {
    const m = base({ type: 'parche', startDate: '2026-10-01' })
    expect(methodStatus(m, '2026-10-08').severity).toBe('due') // día de cambio
    expect(methodStatus(m, '2026-10-10').nextKey).toBe('2026-10-15')
    expect(methodStatus(m, '2026-10-24')).toMatchObject({ inPause: true }) // semana sin parche (offset 23)
  })
  it('anillo: 21 colocado + 7 de descanso', () => {
    const m = base({ type: 'anillo', startDate: '2026-10-01' })
    expect(methodStatus(m, '2026-10-10').headline).toContain('día 10 de 21')
    expect(methodStatus(m, '2026-10-21').severity).toBe('soon') // mañana se saca (día 21)
    expect(methodStatus(m, '2026-10-22').headline).toBe('Hoy toca sacar el anillo')
    expect(methodStatus(m, '2026-10-25').inPause).toBe(true)
  })
  it('inyección trimestral: vence a los 84 días', () => {
    const m = base({ type: 'inyeccion', lastDoseDate: '2026-08-01', intervalDays: 84 })
    expect(methodStatus(m, '2026-10-20', '').nextKey).toBe('2026-10-24')
    expect(methodStatus(m, '2026-10-20').severity).toBe('soon')
    expect(methodStatus(m, '2026-11-03').severity).toBe('overdue')
  })
  it('DIU/implante: avisa 60 días antes del vencimiento', () => {
    const m = base({ type: 'implante', validUntil: '2026-12-15' })
    expect(methodStatus(m, '2026-11-03').severity).toBe('soon')
    expect(methodStatus(m, '2026-06-01').severity).toBe('ok')
    expect(methodStatus(m, '2027-01-10').severity).toBe('overdue')
  })
  it('un método pausado no genera avisos', () => {
    expect(methodStatus(base({ active: false }), '2026-10-05').severity).toBe('info')
  })
})

describe('cumplimiento y flags', () => {
  it('cuenta tomadas, olvidadas y excluye las pausas', () => {
    const m = base({ startDate: '2026-10-01', takenLog: ['2026-10-01', '2026-10-02', '2026-10-04'] })
    const days = pillAdherence(m, '2026-10-05', 5) // 1..5 de octubre
    expect(days.map((d) => d.status)).toEqual(['taken', 'taken', 'missed', 'taken', 'pending'])
    expect(adherenceSummary(days)).toEqual({ taken: 3, missed: 1, percent: 75 })
    expect(pillAdherence(m, '2026-10-25', 2).map((d) => d.status)).toEqual(['pause', 'pause'])
  })
  it('detecta método hormonal activo', () => {
    expect(hasActiveHormonal([base({})])).toBe(true)
    expect(hasActiveHormonal([base({ type: 'diu_cobre' })])).toBe(false)
    expect(hasActiveHormonal([base({ active: false })])).toBe(false)
    expect(hasActiveHormonal(undefined)).toBe(false)
  })
})
