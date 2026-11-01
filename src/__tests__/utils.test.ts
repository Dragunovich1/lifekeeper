import { describe, expect, it } from 'vitest'
import { classifyMeasurement } from '../utils/measurements'
import { evaluateExpression } from '../utils/calculator'
import { guessCategory, normalizeProductKey, sumItems } from '../utils/shopping'
import { parseAmount, parseCsv } from '../utils/financeImport'
import { stableId } from '../services/notifications/plan'
import { mapMeasurements, mapQuickNotes, mapShopping } from '../utils/exportRows'
import { buildMeasurementsPdf } from '../utils/measurementsPdf'
import type { AppData } from '../types'

describe('classifyMeasurement', () => {
  it('presión: 120/80 es normal (guía ESC), 140/90 hipertensión grado 1', () => {
    expect(classifyMeasurement({ type: 'presion', value: 120, value2: 80 }).level).toBe('ok')
    expect(classifyMeasurement({ type: 'presion', value: 140, value2: 85 }).label).toBe('Hipertensión grado 1')
    expect(classifyMeasurement({ type: 'presion', value: 185, value2: 100 }).level).toBe('danger')
  })
  it('glucosa depende del momento', () => {
    expect(classifyMeasurement({ type: 'glucosa', value: 110, context: 'En ayunas' }).level).toBe('elevated')
    expect(classifyMeasurement({ type: 'glucosa', value: 130, context: '2 h después de comer' }).level).toBe('ok')
    expect(classifyMeasurement({ type: 'glucosa', value: 50 }).level).toBe('danger')
  })
  it('pulso alto tras ejercicio es esperable', () => {
    expect(classifyMeasurement({ type: 'pulso', value: 150, context: 'Después de hacer ejercicio' }).level).toBe('ok')
  })
})

describe('calculadora', () => {
  it('respeta precedencia, coma decimal y paréntesis abiertos', () => {
    expect(evaluateExpression('2+3×4')).toEqual({ ok: true, value: 14 })
    expect(evaluateExpression('1,5*2')).toEqual({ ok: true, value: 3 })
    expect(evaluateExpression('(2+3')).toEqual({ ok: true, value: 5 })
  })
  it('no ejecuta código y rechaza basura', () => {
    expect(evaluateExpression('alert(1)').ok).toBe(false)
    expect(evaluateExpression('').ok).toBe(false)
  })
})

describe('compras', () => {
  it('normaliza y adivina categoría', () => {
    expect(normalizeProductKey('  LECHÉ  entera ')).toBe('leche entera')
    expect(guessCategory('lavandina')).toBe('Limpieza')
    expect(guessCategory('xyz raro')).toBe('Otros')
  })
  it('suma cantidad × precio', () => {
    expect(sumItems([{ quantity: 2, price: 100 }, { quantity: 1 }] as never)).toBe(200)
  })
})

describe('importador de finanzas', () => {
  it('interpreta formatos de importe argentinos y negativos', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('(500,00)')).toBe(-500)
    expect(parseAmount('-$ 1234.5')).toBe(-1234.5)
    expect(parseAmount('')).toBeNull()
  })
  it('lee CSV con comillas y separador ;', () => {
    const rows = parseCsv('fecha;detalle;monto\n01/10/2026;"Café; con leche";-1500,50')
    expect(rows[1][1]).toBe('Café; con leche')
  })
})

describe('notificaciones', () => {
  it('stableId es estable, positivo y distingue claves', () => {
    expect(stableId('rem:1')).toBe(stableId('rem:1'))
    expect(stableId('rem:1')).toBeGreaterThan(0)
    expect(stableId('rem:1')).not.toBe(stableId('rem:2'))
  })
})

describe('exportes', () => {
  const data = {
    health: { measurements: [{ id: '1', type: 'presion', date: '2026-10-31', time: '09:00', value: 135, value2: 88, pulse: 72, context: 'En reposo' }] },
    personal: { shopping: { lists: [{ name: 'Super', currency: 'ARS', items: [{ name: 'Leche', quantity: 2, price: 1000, category: 'Lácteos', checked: true }] }] } },
    utilities: { quickNotes: [{ text: 'hola', pinned: true, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z' }] },
  } as unknown as AppData
  it('mapea filas legibles', () => {
    expect(mapMeasurements(data)[0]).toMatchObject({ fecha: '31/10/2026', tipo: 'Presión arterial', valor: '135/88' })
    expect(mapShopping(data)[0]).toMatchObject({ lista: 'Super', comprado: 'Sí' })
    expect(mapQuickNotes(data)[0]).toMatchObject({ fijada: 'Sí', creada: '01/10/2026' })
  })
  it('el PDF filtra por período y no falla vacío', async () => {
    const now = new Date('2026-11-01T12:00:00')
    const old = { id: '2', type: 'glucosa', date: '2026-01-01', time: '08:00', value: 90 }
    const doc = await buildMeasurementsPdf({ measurements: [...(data.health.measurements ?? []), old] as never, days: 30, now })
    expect(doc.getNumberOfPages()).toBe(1)
    expect((await buildMeasurementsPdf({ measurements: [], now })).getNumberOfPages()).toBe(1)
  })
})

describe('alertas (insights)', () => {
  it('avisa mediciones altas recientes, topes superados y compras sobre presupuesto', async () => {
    const { computeSmartSummary } = await import('../utils/insights')
    const { ensureAppDataShape } = await import('../utils/defaultData')
    const now = new Date('2026-11-10T12:00:00')
    const data = ensureAppDataShape({}) as AppData
    data.health.measurements = [
      { id: 'a', type: 'presion', date: '2026-11-09', time: '08:00', value: 150, value2: 95 },
      { id: 'b', type: 'glucosa', date: '2026-10-01', time: '08:00', value: 300 },
    ] as never
    data.personal.budgets = { Comida: 1000, Ocio: 1000 }
    data.personal.finances = [
      { id: '1', type: 'expense', amount: 1200, category: 'Comida', date: '2026-11-03' },
      { id: '2', type: 'expense', amount: 100, category: 'Ocio', date: '2026-11-03' },
      { id: '3', type: 'expense', amount: 5000, category: 'Ocio', date: '2026-10-03' },
    ] as never
    data.personal.shopping = { lists: [{ id: 'l', name: 'Super', currency: 'ARS', budget: 100, createdAt: '', items: [{ id: 'i', name: 'x', quantity: 2, price: 100, category: 'Otros', checked: false, addedAt: '' }] }], priceMemory: {} } as never
    const ids = computeSmartSummary(data, now).insights.map((i) => i.id)
    expect(ids).toContain('measurement-presion')
    expect(ids).not.toContain('measurement-glucosa') // vieja: fuera de los 3 días
    expect(ids).toContain('budget-comida')
    expect(ids).not.toContain('budget-ocio') // el gasto de octubre no cuenta
    expect(ids).toContain('shopping-over-l')
  })
})
