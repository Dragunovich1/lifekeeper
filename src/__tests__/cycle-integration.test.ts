import { describe, expect, it } from 'vitest'
import type { AppData } from '../types'
import { ensureAppDataShape } from '../utils/defaultData'
import { computeSmartSummary } from '../utils/insights'
import { buildNotificationPlan } from '../services/notifications/plan'
import { planLocalActions } from '../services/assistant/actionExtractor'

const NOW = new Date(2026, 10, 3, 22, 0, 0) // 03/11/2026 22:00
const key = (off: number) => {
  const d = new Date(2026, 10, 3 + off)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function femaleData(over: Partial<NonNullable<AppData['health']['menstrualCycle']>> = {}): AppData {
  const d = ensureAppDataShape({}) as AppData
  d.profile.gender = 'Femenino'
  d.health.menstrualCycle = {
    enabled: true,
    averageCycleDays: 28,
    averagePeriodDays: 5,
    entries: [{ id: 'a', startDate: new Date(2026, 9, 10).toISOString() }], // ISO completo: el formato que daba NaN
    contraceptives: [],
    intimacy: [],
    ...over,
  }
  return d
}

describe('alertas del ciclo (Dashboard)', () => {
  it('avisa un atraso de 7+ días sin NaN en los textos', () => {
    // Inicio el 20/09 → esperado el 18/10 → hoy (3/11) lleva 16 días de atraso
    const d = femaleData({ entries: [{ id: 'a', startDate: new Date(2026, 8, 20).toISOString() }] })
    const s = computeSmartSummary(d, NOW)
    const late = s.insights.find((i) => i.id === 'cycle-late')
    expect(late?.title).toBe('Ciclo: 16 días de atraso')
    expect(JSON.stringify(s.insights)).not.toContain('NaN')
  })

  it('avisa una pastilla del día pendiente después de la hora', () => {
    const d = femaleData({ contraceptives: [{ id: 'p', type: 'pastilla', startDate: key(-5), active: true, reminderTime: '21:00', packDays: 21, pauseDays: 7, takenLog: [] }] })
    const ins = computeSmartSummary(d, NOW).insights.find((i) => i.id === 'contra-p')
    expect(ins?.severity).toBe('warning')
    // Ya tomada: no hay alerta
    d.health.menstrualCycle!.contraceptives![0].takenLog = [key(0)]
    expect(computeSmartSummary(d, NOW).insights.find((i) => i.id === 'contra-p')).toBeUndefined()
  })

  it('no genera nada para perfiles no femeninos', () => {
    const d = femaleData()
    d.profile.gender = 'Masculino'
    expect(computeSmartSummary(d, NOW).insights.some((i) => i.id.startsWith('cycle') || i.id.startsWith('contra'))).toBe(false)
  })
})

describe('avisos nativos de anticonceptivos', () => {
  const pill = { id: 'p', type: 'pastilla' as const, startDate: key(-5), active: true, reminderTime: '21:00', packDays: 21, pauseDays: 7 }

  it('programa la pastilla a su hora, omite la ya tomada y la pausa', () => {
    const d = femaleData({ contraceptives: [{ ...pill, takenLog: [key(0)] }] })
    const plan = buildNotificationPlan(d, { now: new Date(2026, 10, 3, 12, 0), showDetails: true }).filter((n) => n.key.startsWith('contra:'))
    const days = plan.map((n) => n.key.split(':')[2])
    expect(days).not.toContain(key(0)) // hoy ya tomada
    expect(days).toContain(key(1))
    expect(plan[0].at.getHours()).toBe(21)
    expect(plan[0].body).toContain('Pastilla anticonceptiva')
    // día 22 del blíster (iniciado hace 5 días → pausa desde key(16)) no se avisa
    expect(days).not.toContain(key(16))
  })

  it('con el detalle apagado el texto es genérico', () => {
    const d = femaleData({ contraceptives: [{ ...pill, takenLog: [] }] })
    const plan = buildNotificationPlan(d, { now: new Date(2026, 10, 3, 12, 0), showDetails: false }).filter((n) => n.key.startsWith('contra:'))
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.every((n) => !/anticonceptiv/i.test(n.body))).toBe(true)
  })

  it('métodos pausados no generan avisos', () => {
    const d = femaleData({ contraceptives: [{ ...pill, active: false }] })
    expect(buildNotificationPlan(d, { now: NOW, showDetails: true }).some((n) => n.key.startsWith('contra'))).toBe(false)
  })
})

describe('asistente: pastilla anticonceptiva', () => {
  it('"ya me tomé la pastilla" registra la toma de hoy', () => {
    const d = femaleData({ contraceptives: [{ id: 'p', type: 'pastilla', startDate: key(-5), active: true, takenLog: [] }] })
    const res = planLocalActions('ya me tomé la pastilla anticonceptiva', d)
    expect(res).not.toBeNull()
    const next = res!.updater(d)
    expect(next.health.menstrualCycle!.contraceptives![0].takenLog).toHaveLength(1)
  })

  it('sin pastilla cargada, pregunta en vez de inventar', () => {
    const d = femaleData()
    // Sin una pastilla activa cargada la regla local no actúa (y el extractor del LLM respondería con una pregunta)
    expect(planLocalActions('ya me tomé la pastilla', d)).toBeNull()
  })
})
