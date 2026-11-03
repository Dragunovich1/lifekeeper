/**
 * Anticonceptivos: estado de hoy, próxima acción y cumplimiento (puro y testeable).
 * Información general; no reemplaza la indicación de un/a profesional de la salud.
 */
import type { ContraceptiveMethod, ContraceptiveType } from '../types'
import { addDaysKey, diffDays } from './cycle'

export interface MethodMeta {
  label: string
  emoji: string
  hormonal: boolean
  /** Eficacia aproximada (por cada 100 personas/año sin embarazo): uso perfecto / uso típico (OMS-CDC, cifras redondeadas). */
  perfect: number
  typical: number
  blurb: string
  protectsSti: boolean
}

export const METHODS: Record<ContraceptiveType, MethodMeta> = {
  pastilla: { label: 'Pastilla', emoji: '💊', hormonal: true, perfect: 99, typical: 93, blurb: 'Se toma todos los días a la misma hora.', protectsSti: false },
  parche: { label: 'Parche', emoji: '🩹', hormonal: true, perfect: 99, typical: 93, blurb: 'Se cambia una vez por semana durante 3 semanas y se descansa 1.', protectsSti: false },
  anillo: { label: 'Anillo vaginal', emoji: '⭕', hormonal: true, perfect: 99, typical: 93, blurb: '21 días colocado y 7 de descanso.', protectsSti: false },
  inyeccion: { label: 'Inyección', emoji: '💉', hormonal: true, perfect: 99.8, typical: 96, blurb: 'Mensual o trimestral, según el tipo.', protectsSti: false },
  diu_cobre: { label: 'DIU de cobre', emoji: '🔶', hormonal: false, perfect: 99.4, typical: 99.2, blurb: 'Dura varios años (según el modelo).', protectsSti: false },
  diu_hormonal: { label: 'DIU hormonal', emoji: '🔷', hormonal: true, perfect: 99.8, typical: 99.8, blurb: 'Dura varios años (según el modelo).', protectsSti: false },
  implante: { label: 'Implante', emoji: '📏', hormonal: true, perfect: 99.9, typical: 99.9, blurb: 'Varilla bajo la piel; dura unos 3 años.', protectsSti: false },
  preservativo: { label: 'Preservativo', emoji: '🛡️', hormonal: false, perfect: 98, typical: 87, blurb: 'Es el único método que además protege de infecciones de transmisión sexual (ITS).', protectsSti: true },
  otro: { label: 'Otro método', emoji: '➕', hormonal: false, perfect: 0, typical: 0, blurb: '', protectsSti: false },
}

export const isHormonal = (type: ContraceptiveType): boolean => METHODS[type].hormonal

/** ¿Hay algún método hormonal activo? Con uno bien usado la ovulación está suprimida y la "ventana fértil" natural no aplica. */
export const hasActiveHormonal = (list: ContraceptiveMethod[] | undefined): boolean =>
  (list ?? []).some((m) => m.active && isHormonal(m.type))

export type MethodSeverity = 'ok' | 'info' | 'soon' | 'due' | 'overdue'

export interface MethodStatus {
  headline: string
  detail?: string
  severity: MethodSeverity
  /** Próxima fecha relevante (cambio, dosis, vencimiento). */
  nextKey?: string
  daysUntil?: number
  /** Pastillas: hoy corresponde tomar una activa. */
  pillDue?: boolean
  takenToday?: boolean
  packDay?: number
  inPause?: boolean
}

const mod = (n: number, m: number) => ((n % m) + m) % m
const fmt = (key: string) => key.split('-').reverse().join('/')

export function methodStatus(m: ContraceptiveMethod, todayKey: string, nowTime = '00:00'): MethodStatus {
  const start = m.startDate
  if (!m.active) return { headline: 'Método pausado', severity: 'info' }

  switch (m.type) {
    case 'pastilla': {
      const active = Math.max(1, m.packDays ?? 21)
      const pause = Math.max(0, m.pauseDays ?? 7)
      const total = active + pause
      const day = mod(diffDays(start, todayKey), total) + 1
      const taken = (m.takenLog ?? []).includes(todayKey)
      if (day > active) {
        const restart = addDaysKey(todayKey, total - day + 1)
        return {
          headline: `Pausa del blíster (día ${day - active} de ${pause})`,
          detail: `Retomás el ${fmt(restart)}.`,
          severity: 'info',
          nextKey: restart,
          daysUntil: diffDays(todayKey, restart),
          inPause: true,
          packDay: day,
          pillDue: false,
        }
      }
      if (taken) return { headline: 'Pastilla de hoy tomada ✓', detail: `Día ${day} de ${active} del blíster.`, severity: 'ok', packDay: day, takenToday: true, pillDue: false }
      const late = !!m.reminderTime && nowTime > m.reminderTime
      return {
        headline: late ? 'Todavía no registraste la pastilla de hoy' : 'Pastilla de hoy pendiente',
        detail: `Día ${day} de ${active} del blíster${m.reminderTime ? ` · hora: ${m.reminderTime}` : ''}.`,
        severity: late ? 'overdue' : 'due',
        packDay: day,
        takenToday: false,
        pillDue: true,
      }
    }
    case 'parche': {
      const off = mod(diffDays(start, todayKey), 28)
      const next = off < 21 ? addDaysKey(todayKey, 7 - (off % 7)) : addDaysKey(todayKey, 28 - off)
      const changeToday = off < 21 && off % 7 === 0
      if (off >= 21) return { headline: 'Semana sin parche', detail: `Nuevo parche el ${fmt(next)}.`, severity: 'info', nextKey: next, daysUntil: diffDays(todayKey, next), inPause: true }
      return {
        headline: changeToday ? 'Hoy toca cambiar el parche' : `Parche puesto (semana ${Math.floor(off / 7) + 1} de 3)`,
        detail: `Próximo cambio: ${fmt(changeToday ? addDaysKey(todayKey, off === 14 ? 14 : 7) : next)}.`,
        severity: changeToday ? 'due' : 'ok',
        nextKey: changeToday ? todayKey : next,
        daysUntil: changeToday ? 0 : diffDays(todayKey, next),
      }
    }
    case 'anillo': {
      const off = mod(diffDays(start, todayKey), 28)
      if (off >= 21) {
        const next = addDaysKey(todayKey, 28 - off)
        return { headline: off === 21 ? 'Hoy toca sacar el anillo' : 'Semana de descanso del anillo', detail: `Colocás uno nuevo el ${fmt(next)}.`, severity: off === 21 ? 'due' : 'info', nextKey: next, daysUntil: diffDays(todayKey, next), inPause: true }
      }
      const remove = addDaysKey(todayKey, 21 - off)
      return {
        headline: off === 20 ? 'Mañana toca sacar el anillo' : `Anillo colocado (día ${off + 1} de 21)`,
        detail: `Lo retirás el ${fmt(remove)}.`,
        severity: off === 20 ? 'soon' : 'ok',
        nextKey: remove,
        daysUntil: diffDays(todayKey, remove),
      }
    }
    case 'inyeccion': {
      const interval = Math.max(7, m.intervalDays ?? 84)
      const next = addDaysKey(m.lastDoseDate || start, interval)
      const until = diffDays(todayKey, next)
      const kind = interval <= 35 ? 'mensual' : 'trimestral'
      if (until < 0) return { headline: `Inyección ${kind} vencida hace ${-until} día(s)`, detail: 'Pedí turno para aplicarla cuanto antes y consultá si necesitás protección adicional.', severity: 'overdue', nextKey: next, daysUntil: until }
      if (until <= 7) return { headline: until === 0 ? 'Hoy toca la inyección' : `Próxima inyección en ${until} día(s)`, detail: fmt(next), severity: until === 0 ? 'due' : 'soon', nextKey: next, daysUntil: until }
      return { headline: `Próxima inyección: ${fmt(next)}`, detail: `En ${until} días (${kind}).`, severity: 'ok', nextKey: next, daysUntil: until }
    }
    case 'diu_cobre':
    case 'diu_hormonal':
    case 'implante': {
      if (!m.validUntil) return { headline: 'Colocado', detail: 'Cargá hasta cuándo es efectivo para recibir un aviso antes de que venza.', severity: 'info' }
      const until = diffDays(todayKey, m.validUntil)
      if (until < 0) return { headline: `Vencido hace ${-until} día(s)`, detail: 'Consultá para reemplazarlo: pasada esa fecha ya no es confiable.', severity: 'overdue', nextKey: m.validUntil, daysUntil: until }
      if (until <= 60) return { headline: `Vence en ${until} día(s)`, detail: `Fecha límite: ${fmt(m.validUntil)}. Pedí turno para el recambio.`, severity: 'soon', nextKey: m.validUntil, daysUntil: until }
      return { headline: 'Vigente', detail: `Efectivo hasta el ${fmt(m.validUntil)}.`, severity: 'ok', nextKey: m.validUntil, daysUntil: until }
    }
    default:
      return { headline: METHODS[m.type].label, detail: METHODS[m.type].blurb || undefined, severity: 'info' }
  }
}

export type AdherenceStatus = 'taken' | 'missed' | 'pause' | 'pending' | 'before'

export interface AdherenceDay {
  key: string
  status: AdherenceStatus
}

/** Pastilla: estado de cada uno de los últimos `days` días (para el gráfico de cumplimiento). */
export function pillAdherence(m: ContraceptiveMethod, todayKey: string, days = 28): AdherenceDay[] {
  const active = Math.max(1, m.packDays ?? 21)
  const total = active + Math.max(0, m.pauseDays ?? 7)
  const out: AdherenceDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = addDaysKey(todayKey, -i)
    let status: AdherenceStatus
    if (key < m.startDate) status = 'before'
    else if (mod(diffDays(m.startDate, key), total) + 1 > active) status = 'pause'
    else if ((m.takenLog ?? []).includes(key)) status = 'taken'
    else status = key === todayKey ? 'pending' : 'missed'
    out.push({ key, status })
  }
  return out
}

export function adherenceSummary(list: AdherenceDay[]): { taken: number; missed: number; percent: number | null } {
  const taken = list.filter((d) => d.status === 'taken').length
  const missed = list.filter((d) => d.status === 'missed').length
  return { taken, missed, percent: taken + missed > 0 ? Math.round((taken / (taken + missed)) * 100) : null }
}

/** Sugerencia general ante una pastilla olvidada (orientativa; el prospecto de cada marca manda). */
export const MISSED_PILL_TIP =
  'Si te olvidaste una pastilla: tomala apenas te acuerdes y seguí con el horario habitual. Si fueron 2 o más seguidas, o es una pastilla solo de progestágeno y pasaron más de 3 horas de retraso, usá preservativo durante 7 días y consultá con tu profesional (y valorá la anticoncepción de emergencia si hubo relaciones sin protección).'

/** Hechos básicos y verificables sobre anticoncepción de emergencia y test de embarazo. */
export const EMERGENCY_INFO = {
  window: 'La píldora de emergencia es más efectiva cuanto antes se toma (hasta 72 h; algunas hasta 120 h, con menor eficacia). No es un método de uso habitual y no protege de ITS.',
  access: 'En Argentina se consigue en farmacias sin receta y es gratuita en centros de salud y hospitales públicos (verificá disponibilidad en tu zona).',
  test: 'Un test de embarazo es más confiable desde el primer día de atraso o a partir de las 3 semanas de una relación sin protección.',
  sti: 'Los métodos hormonales y el DIU no protegen de infecciones de transmisión sexual: solo el preservativo lo hace. Si hubo una relación sin preservativo con una pareja no testeada, consultá por estudios de ITS.',
}
