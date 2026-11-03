import { describe, expect, it } from 'vitest'
import type { MenstrualCycleEntry } from '../types'
import { addDaysKey, computeCycle, dayKey, dayStatusFor, diffDays, estimateCycle, normalizeEntries } from '../utils/cycle'

const e = (id: string, startDate: string, endDate?: string): MenstrualCycleEntry => ({ id, startDate, endDate })

describe('fechas del ciclo', () => {
  it('unifica ISO con hora y fecha simple (el bug del NaN)', () => {
    // El formulario guarda un ISO completo; antes se le agregaba "T00:00:00" y daba fecha inválida
    expect(dayKey('2026-11-03T03:00:00.000Z')).toMatch(/^2026-11-0[23]$/)
    expect(dayKey('2026-11-03')).toBe('2026-11-03')
    expect(dayKey('basura')).toBe('')
    expect(addDaysKey('2026-02-27', 3)).toBe('2026-03-02')
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2)
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2) // atraviesa cambio de hora sin desfasar
  })

  it('computeCycle no devuelve NaN con ISO completo ni con fecha simple', () => {
    for (const startDate of ['2026-10-10T03:00:00.000Z', '2026-10-10']) {
      const c = computeCycle([e('1', startDate)], { averageCycleDays: 28, averagePeriodDays: 5 }, '2026-11-03')
      expect(c).not.toBeNull()
      expect(Number.isFinite(c!.cycleDay)).toBe(true)
      expect(Number.isFinite(c!.daysUntilNext)).toBe(true)
      expect(c!.nextPeriodKey).toBe('2026-11-07')
      expect(c!.ovulationKey).toBe('2026-10-23')
    }
  })

  it('ordena bien registros mezclados y descarta inválidos y repetidos', () => {
    const list = normalizeEntries([e('a', '2026-09-12T03:00:00.000Z'), e('b', '2026-10-10'), e('c', 'xx'), e('d', '2026-10-10T03:00:00.000Z')])
    expect(list).toHaveLength(2) // 'c' es inválido y 'b'/'d' son el mismo día
    expect(list.map((r) => r.startKey)).toEqual(['2026-10-10', '2026-09-12'])
    expect(list[0].startKey > list[1].startKey).toBe(true)
  })
})

describe('estimación y honestidad', () => {
  const regular = [e('4', '2026-10-10'), e('3', '2026-09-12'), e('2', '2026-08-15'), e('1', '2026-07-18')] // 28, 28, 28

  it('ciclos regulares → ventana de Ogino-Knaus', () => {
    const s = estimateCycle(normalizeEntries(regular), 28)
    expect(s.avg).toBe(28)
    expect(s.reliability).toBe('media')
    expect(s.window).toEqual({ startDay: 10, endDay: 17, method: 'ogino-knaus' })
  })

  it('ciclos muy variables → NO se estiman días de menor fertilidad', () => {
    const s = estimateCycle(normalizeEntries([e('4', '2026-10-30'), e('3', '2026-09-20'), e('2', '2026-08-01'), e('1', '2026-07-10')]), 28)
    expect(s.reliability).toBe('irregular')
    expect(s.window).toBeNull()
  })

  it('con 1 solo registro usa días estándar solo si el ciclo está entre 26 y 32', () => {
    expect(estimateCycle(normalizeEntries([e('1', '2026-10-10')]), 28).window?.method).toBe('dias-estandar')
    const sin = estimateCycle(normalizeEntries([e('1', '2026-10-10')]), 40)
    expect(sin.window).toBeNull()
    expect(sin.reliability).toBe('sin_datos')
  })

  it('el estado de cada día respeta período, ovulación, fértil y menor fertilidad', () => {
    const cfg = { averageCycleDays: 28, averagePeriodDays: 5 }
    const records = [e('4', '2026-10-10'), e('3', '2026-09-12'), e('2', '2026-08-15'), e('1', '2026-07-18')]
    const st = (k: string) => dayStatusFor(k, records, cfg)
    expect(st('2026-10-10')).toBe('period')
    expect(st('2026-10-14')).toBe('period')
    expect(st('2026-10-16')).toBe('low') // día 7: antes de la ventana
    expect(st('2026-10-19')).toBe('fertile') // día 10
    expect(st('2026-10-23')).toBe('ovulation') // día 14
    expect(st('2026-10-27')).toBe('low') // día 18: después de la ventana
    expect(st('2026-11-07')).toBe('period') // ciclo proyectado
    expect(st('2026-07-01')).toBe('unknown') // antes del primer registro
  })

  it('con el período atrasado no proyecta ventanas fértiles hacia adelante', () => {
    const records = [e('4', '2026-10-10'), e('3', '2026-09-12'), e('2', '2026-08-15'), e('1', '2026-07-18')]
    const cfg = { averageCycleDays: 28, averagePeriodDays: 5 }
    // Hoy es 2026-11-20: la fecha esperada era 2026-11-07 y hay 13 días de atraso
    expect(dayStatusFor('2026-11-20', records, cfg, '2026-11-20')).toBe('unknown')
    expect(dayStatusFor('2026-11-30', records, cfg, '2026-11-20')).toBe('unknown')
    // Los días del ciclo en curso (antes de la fecha esperada) siguen estimándose
    expect(dayStatusFor('2026-10-23', records, cfg, '2026-11-20')).toBe('ovulation')
    // Sin atraso (hoy todavía es antes de lo esperado) sí se proyecta el siguiente ciclo
    expect(dayStatusFor('2026-11-07', records, cfg, '2026-11-03')).toBe('period')
    // Más de 3 ciclos hacia adelante: sin estimación
    expect(dayStatusFor('2027-03-01', records, cfg, '2026-11-03')).toBe('unknown')
  })

  it('sin registros o con ciclo irregular el calendario no afirma nada', () => {
    expect(dayStatusFor('2026-10-20', [], {})).toBe('unknown')
    const irregular = [e('4', '2026-10-30'), e('3', '2026-09-20'), e('2', '2026-08-01'), e('1', '2026-07-10')]
    expect(dayStatusFor('2026-11-15', irregular, {})).not.toBe('low')
  })
})
