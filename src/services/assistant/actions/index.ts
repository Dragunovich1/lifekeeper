import { HEALTH_ACTIONS } from './health'
import { MONEY_ACTIONS } from './money'
import { ORGANIZER_ACTIONS } from './organizer'
import { VEHICLE_ACTIONS } from './vehicles'
import { WELLBEING_ACTIONS } from './wellbeing'
import type { ActionDef } from './types'

/** Todo lo que el asistente puede guardar hablando. Para sumar un área nueva alcanza con agregar su definición acá. */
export const ALL_ACTIONS: ActionDef[] = [
  ...WELLBEING_ACTIONS,
  ...MONEY_ACTIONS,
  ...HEALTH_ACTIONS,
  ...VEHICLE_ACTIONS,
  ...ORGANIZER_ACTIONS,
]

export * from './types'
