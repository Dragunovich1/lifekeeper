import { useCallback, useMemo } from 'react'
import { v4 as uuid } from 'uuid'
import { useAppData } from '../../../hooks/useAppData'
import type { ContraceptiveMethod, IntimacyEntry, IntimacyProtection, MenstrualCycleData } from '../../../types'
import { addDaysKey, dayKey } from '../../../utils/cycle'

const EMPTY: MenstrualCycleData = { enabled: true, averageCycleDays: 28, averagePeriodDays: 5, entries: [], contraceptives: [], intimacy: [] }

/** Acceso y cambios sobre los datos del ciclo (períodos, anticonceptivos y registro íntimo). */
export function useCycleData() {
  const { data, updateData } = useAppData()
  const cycle = useMemo<MenstrualCycleData>(() => ({ ...EMPTY, ...(data.health.menstrualCycle ?? {}) }), [data.health.menstrualCycle])

  const patch = useCallback(
    (fn: (c: MenstrualCycleData) => MenstrualCycleData) => {
      updateData((prev) => {
        const current = { ...EMPTY, ...(prev.health.menstrualCycle ?? {}) }
        return { ...prev, health: { ...prev.health, menstrualCycle: { ...fn(current), enabled: true } } }
      })
    },
    [updateData],
  )

  const startPeriod = useCallback(
    (key: string) => {
      patch((c) => {
        if (c.entries.some((e) => dayKey(e.startDate) === key)) return c
        return { ...c, lastPeriodStart: key, entries: [{ id: uuid(), startDate: key, flow: 'moderado' }, ...c.entries] }
      })
    },
    [patch],
  )

  const saveMethod = useCallback(
    (method: Omit<ContraceptiveMethod, 'id'> & { id?: string }) => {
      patch((c) => {
        const full: ContraceptiveMethod = { ...method, id: method.id ?? uuid() }
        const list = c.contraceptives ?? []
        return { ...c, contraceptives: list.some((m) => m.id === full.id) ? list.map((m) => (m.id === full.id ? full : m)) : [full, ...list] }
      })
    },
    [patch],
  )

  const removeMethod = useCallback((id: string) => patch((c) => ({ ...c, contraceptives: (c.contraceptives ?? []).filter((m) => m.id !== id) })), [patch])

  const setPillTaken = useCallback(
    (id: string, key: string, taken: boolean) => {
      patch((c) => ({
        ...c,
        contraceptives: (c.contraceptives ?? []).map((m) => {
          if (m.id !== id) return m
          const log = new Set(m.takenLog ?? [])
          if (taken) log.add(key)
          else log.delete(key)
          // Solo se guardan los últimos 120 días
          const cutoff = addDaysKey(key, -120)
          return { ...m, takenLog: [...log].filter((k) => k >= cutoff).sort() }
        }),
      }))
    },
    [patch],
  )

  /** Parche / anillo / inyección: registra el cambio o la aplicación de hoy. */
  const markApplied = useCallback(
    (id: string, key: string) => patch((c) => ({ ...c, contraceptives: (c.contraceptives ?? []).map((m) => (m.id === id ? { ...m, lastDoseDate: key } : m)) })),
    [patch],
  )

  const addIntimacy = useCallback(
    (entry: { date: string; protection: IntimacyProtection; emergencyPill?: boolean; notes?: string }) => {
      patch((c) => {
        const e: IntimacyEntry = { id: uuid(), date: entry.date, protection: entry.protection, emergencyPill: entry.emergencyPill || undefined, notes: entry.notes?.trim() || undefined }
        return { ...c, intimacy: [e, ...(c.intimacy ?? [])] }
      })
    },
    [patch],
  )

  const removeIntimacy = useCallback((id: string) => patch((c) => ({ ...c, intimacy: (c.intimacy ?? []).filter((e) => e.id !== id) })), [patch])

  return {
    cycle,
    gender: data.profile.gender,
    startPeriod,
    saveMethod,
    removeMethod,
    setPillTaken,
    markApplied,
    addIntimacy,
    removeIntimacy,
  }
}
