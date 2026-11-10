import type { VaccineRecord } from '../types'
import type { ScheduleVaccine } from '../data/vaccineSchedules'
import { suggestNextDose } from './vaccineSchedule'
import { toLocalDateKey } from './dates'

export type VaccineFormState = Omit<VaccineRecord, 'id'> & { nextDoseDate?: string }

export const createInitialVaccineForm = (): VaccineFormState => ({
  vaccine: '',
  dose: '',
  date: new Date().toISOString(),
  location: '',
  lot: '',
  notes: '',
  nextDoseDate: '',
  reminderEnabled: true,
  scheduleVaccineId: undefined,
  doseIndex: undefined,
  attachments: [],
})

/** Elige una vacuna y dosis del calendario: completa nombre, dosis y (si no se tocó) la próxima fecha. */
export function applyScheduleChoice(state: VaccineFormState, vaccine: ScheduleVaccine, doseIndex: number, birthDate?: string, keepNext = false): VaccineFormState {
  const idx = Math.min(Math.max(0, doseIndex), vaccine.doses.length - 1)
  return {
    ...state,
    vaccine: vaccine.name,
    scheduleVaccineId: vaccine.id,
    doseIndex: idx,
    dose: vaccine.doses[idx]?.label ?? state.dose,
    nextDoseDate: keepNext ? state.nextDoseDate : suggestNextDose(vaccine, idx, toLocalDateKey(state.date), birthDate),
  }
}

/** Vuelve a texto libre (otra vacuna que no está en el calendario). */
export function clearScheduleChoice(state: VaccineFormState): VaccineFormState {
  return { ...state, scheduleVaccineId: undefined, doseIndex: undefined }
}

export const MAX_ATTACHMENTS = 3
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024
export const ACCEPTED_ATTACHMENTS = 'image/*,application/pdf'
