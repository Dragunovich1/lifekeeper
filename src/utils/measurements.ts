import type { HealthMeasurement, MeasurementType, MoodLevel } from '../types'

export type MeasurementLevel = 'ok' | 'low' | 'elevated' | 'high' | 'danger'

export interface MeasurementStatus {
  level: MeasurementLevel
  label: string
  /** Aviso extra para valores que requieren atención. */
  hint?: string
}

export interface MeasurementMeta {
  type: MeasurementType
  label: string
  short: string
  unit: string
  contexts: string[]
  /** Rango de referencia que se sombrea en el gráfico. */
  band: [number, number]
  /** Límites razonables para validar lo que se carga. */
  limits: { min: number; max: number }
  placeholder: string
}

export const MEASUREMENT_TYPES: MeasurementMeta[] = [
  {
    type: 'glucosa',
    label: 'Glucosa en sangre',
    short: 'Glucosa',
    unit: 'mg/dL',
    contexts: ['En ayunas', 'Antes de comer', '1 h después de comer', '2 h después de comer', 'Después de hacer ejercicio', 'Antes de dormir', 'Con síntomas'],
    band: [70, 99],
    limits: { min: 20, max: 600 },
    placeholder: '95',
  },
  {
    type: 'presion',
    label: 'Presión arterial',
    short: 'Presión',
    unit: 'mmHg',
    contexts: ['En reposo', 'Al despertar', 'Por la noche', 'Después de comer', 'Después de hacer ejercicio', 'Después de la medicación', 'Con síntomas'],
    band: [80, 129],
    limits: { min: 60, max: 260 },
    placeholder: '120',
  },
  {
    type: 'pulso',
    label: 'Frecuencia cardíaca',
    short: 'Pulso',
    unit: 'lpm',
    contexts: ['En reposo', 'Al despertar', 'Después de comer', 'Después de hacer ejercicio', 'Con síntomas'],
    band: [60, 100],
    limits: { min: 25, max: 220 },
    placeholder: '72',
  },
  {
    type: 'saturacion',
    label: 'Saturación de oxígeno',
    short: 'SpO₂',
    unit: '%',
    contexts: ['En reposo', 'Después de hacer ejercicio', 'Durmiendo', 'Con síntomas'],
    band: [95, 100],
    limits: { min: 50, max: 100 },
    placeholder: '97',
  },
  {
    type: 'temperatura',
    label: 'Temperatura corporal',
    short: 'Temperatura',
    unit: '°C',
    contexts: ['En reposo', 'Por la mañana', 'Por la noche', 'Después de hacer ejercicio', 'Con síntomas'],
    band: [36, 37.2],
    limits: { min: 30, max: 43 },
    placeholder: '36.5',
  },
  {
    type: 'colesterol',
    label: 'Colesterol total',
    short: 'Colesterol',
    unit: 'mg/dL',
    contexts: ['En ayunas', 'Después de comer'],
    band: [120, 199],
    limits: { min: 50, max: 500 },
    placeholder: '180',
  },
]

export const MEASUREMENT_META: Record<MeasurementType, MeasurementMeta> = Object.fromEntries(
  MEASUREMENT_TYPES.map((m) => [m.type, m]),
) as Record<MeasurementType, MeasurementMeta>

export const FEELINGS: { value: MoodLevel; emoji: string; label: string }[] = [
  { value: 'Excelente', emoji: '🤩', label: 'Excelente' },
  { value: 'Bien', emoji: '🙂', label: 'Bien' },
  { value: 'Neutral', emoji: '😐', label: 'Normal' },
  { value: 'Regular', emoji: '😕', label: 'Regular' },
  { value: 'Mal', emoji: '😞', label: 'Mal' },
]

const CONTEXT_KEYWORDS: [string, RegExp][] = [
  ['En ayunas', /\bayunas?\b|\bsin comer\b|\brecien me levante\b/],
  ['1 h después de comer', /\b(1|una|1 ?h|una hora)\b.{0,12}(despues de|luego de|tras) (comer|almorzar|cenar|desayunar|la comida)/],
  ['2 h después de comer', /\b(2|dos)\b.{0,12}(despues de|luego de|tras) (comer|almorzar|cenar|desayunar|la comida)|postprandial|post ?prandial/],
  ['Después de hacer ejercicio', /(despues de|luego de|tras|recien)\b.{0,25}(ejercicio|entrenar|entrenamiento|correr|caminar|gimnasio|gym|bici|deporte|actividad fisica|corri|camine|entrene)|\bpost ?entreno\b/],
  ['Antes de comer', /\bantes de (comer|almorzar|cenar|desayunar|la comida)\b/],
  ['Antes de dormir', /\bantes de (dormir|acostarme)\b|\bpor la noche\b|\bde noche\b/],
  ['Por la noche', /\bpor la noche\b|\bde noche\b|\bantes de (dormir|acostarme)\b/],
  ['Por la mañana', /\bpor la manana\b|\bde manana\b|\btemprano\b/],
  ['Al despertar', /\b(al despertar|al levantarme|recien levantado|por la manana)\b/],
  ['Después de la medicación', /(despues de|luego de|tras) (tomar )?(la |mi )?(medicacion|pastilla|remedio)/],
  ['Durmiendo', /\bdurmiendo\b|\bmientras dormia\b/],
  ['Con síntomas', /\bcon sintomas\b/],
  ['En reposo', /\ben reposo\b|\bdescansando\b|\bsentado\b|\bacostado\b|\btranquilo\b/],
  ['Después de comer', /(despues de|luego de|tras) (comer|almorzar|cenar|desayunar|la comida)/],
]

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Detecta en un texto libre el momento de la medición y lo devuelve con el nombre exacto
 * de las opciones del formulario (solo si ese tipo de medición lo admite).
 */
export function detectContext(type: MeasurementType, text: string): string | undefined {
  const allowed = MEASUREMENT_META[type].contexts
  const n = norm(text)
  for (const [name, rx] of CONTEXT_KEYWORDS) {
    if (!allowed.includes(name)) continue
    if (rx.test(n)) return name
  }
  // "después de comer" sin horas, en glucosa, se toma como 2 h (la referencia más usada)
  if (type === 'glucosa' && /(despues de|luego de|tras) (comer|almorzar|cenar|desayunar|la comida)/.test(n)) return '2 h después de comer'
  return undefined
}

/** Ajusta lo que escribió el LLM a una de las opciones conocidas; si no coincide, conserva el texto. */
export function normalizeContext(type: MeasurementType, raw?: string): string | undefined {
  const value = (raw ?? '').trim()
  if (!value) return undefined
  const allowed = MEASUREMENT_META[type].contexts
  return allowed.find((c) => c.toLowerCase() === value.toLowerCase()) ?? detectContext(type, value) ?? value
}

/** Momento sugerido al abrir el formulario, según el tipo y la hora. */
export function defaultContext(type: MeasurementType, now = new Date()): string {
  const hour = now.getHours()
  if (type === 'glucosa') return hour < 10 ? 'En ayunas' : ''
  if (type === 'presion' || type === 'pulso' || type === 'saturacion') return 'En reposo'
  return ''
}

export const feelingEmoji = (mood?: MoodLevel): string => FEELINGS.find((f) => f.value === mood)?.emoji ?? ''

export const SYMPTOM_OPTIONS = [
  'Sin síntomas',
  'Mareo',
  'Dolor de cabeza',
  'Cansancio',
  'Sed intensa',
  'Visión borrosa',
  'Palpitaciones',
  'Dolor de pecho',
  'Falta de aire',
  'Náuseas',
  'Sudoración',
  'Temblores',
  'Ansiedad',
  'Escalofríos',
]

const DANGER_HINT =
  'Si te sentís mal o el valor se repite, consultá con un profesional. Ante dolor de pecho, falta de aire o desmayo, llamá a emergencias.'

/**
 * Clasificación ORIENTATIVA según rangos de referencia generales para adultos.
 * No reemplaza la valoración de un profesional de la salud.
 */
export function classifyMeasurement(m: Pick<HealthMeasurement, 'type' | 'value' | 'value2' | 'context'>): MeasurementStatus {
  const v = m.value
  switch (m.type) {
    case 'glucosa': {
      const ctx = m.context ?? ''
      const afterMeal = ctx.includes('2 h después de comer') || ctx === 'Después de comer'
      const oneHour = ctx.includes('1 h después de comer')
      if (v < 54) return { level: 'danger', label: 'Muy baja', hint: DANGER_HINT }
      if (v < 70) return { level: 'low', label: 'Baja' }
      if (v >= 300) return { level: 'danger', label: 'Muy alta', hint: DANGER_HINT }
      if (oneHour) {
        if (v < 180) return { level: 'ok', label: 'Normal' }
        if (v < 200) return { level: 'elevated', label: 'Elevada' }
        return { level: 'high', label: 'Alta' }
      }
      if (afterMeal) {
        if (v < 140) return { level: 'ok', label: 'Normal' }
        if (v < 200) return { level: 'elevated', label: 'Elevada' }
        return { level: 'high', label: 'Alta' }
      }
      if (v < 100) return { level: 'ok', label: 'Normal' }
      if (v < 126) return { level: 'elevated', label: 'Elevada' }
      return { level: 'high', label: 'Alta' }
    }
    case 'presion': {
      // Categorías de la guía europea (ESC), la referencia que usan las sociedades de hipertensión de Argentina
      const sys = v
      const dia = m.value2 ?? 0
      if (sys >= 180 || dia >= 120) return { level: 'danger', label: 'Muy alta', hint: DANGER_HINT }
      // Tras el ejercicio es esperable que suba: no se la marca como hipertensión
      if ((m.context ?? '').includes('ejercicio') && sys < 170 && dia < 100) return { level: 'ok', label: 'Esperable tras ejercicio' }
      if (sys >= 160 || dia >= 100) return { level: 'high', label: 'Hipertensión grado 2' }
      if (sys >= 140 || dia >= 90) return { level: 'high', label: 'Hipertensión grado 1' }
      if (sys >= 130 || dia >= 85) return { level: 'elevated', label: 'Normal-alta' }
      if (sys < 90 || (dia && dia < 60)) return { level: 'low', label: 'Baja' }
      return { level: 'ok', label: 'Normal' }
    }
    case 'pulso':
      if ((m.context ?? '').includes('ejercicio')) {
        if (v <= 185) return { level: 'ok', label: 'Esperable tras ejercicio' }
        return { level: 'high', label: 'Muy alta incluso para ejercicio' }
      }
      if (v < 60) return { level: v < 40 ? 'danger' : 'low', label: 'Baja', hint: v < 40 ? DANGER_HINT : undefined }
      if (v <= 100) return { level: 'ok', label: 'Normal' }
      if (v <= 120) return { level: 'elevated', label: 'Elevada' }
      return { level: v > 150 ? 'danger' : 'high', label: 'Alta', hint: v > 150 ? DANGER_HINT : undefined }
    case 'saturacion':
      if (v >= 95) return { level: 'ok', label: 'Normal' }
      if (v >= 92) return { level: 'elevated', label: 'Levemente baja' }
      if (v >= 90) return { level: 'high', label: 'Baja' }
      return { level: 'danger', label: 'Muy baja', hint: DANGER_HINT }
    case 'temperatura':
      if (v < 35) return { level: 'low', label: 'Baja' }
      if (v <= 37.2) return { level: 'ok', label: 'Normal' }
      if (v < 38) return { level: 'elevated', label: 'Febrícula' }
      if (v < 39.5) return { level: 'high', label: 'Fiebre' }
      return { level: 'danger', label: 'Fiebre alta', hint: DANGER_HINT }
    case 'colesterol':
      if (v < 200) return { level: 'ok', label: 'Deseable' }
      if (v < 240) return { level: 'elevated', label: 'Límite alto' }
      return { level: 'high', label: 'Alto' }
  }
}

export function formatMeasurement(m: HealthMeasurement): string {
  return m.type === 'presion' ? `${m.value}/${m.value2 ?? '—'}` : String(m.value)
}

export const formatMeasurementUnit = (m: HealthMeasurement): string => {
  const meta = MEASUREMENT_META[m.type]
  return m.type === 'presion' && m.pulse ? `${meta.unit} · ${m.pulse} lpm` : meta.unit
}

export const measurementTimestamp = (m: Pick<HealthMeasurement, 'date' | 'time'>): number => {
  const [y, mo, d] = m.date.split('-').map(Number)
  const [h, mi] = (m.time || '00:00').split(':').map(Number)
  return new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0).getTime()
}

export interface MeasurementStats {
  count: number
  last: HealthMeasurement
  avg: number
  avg2?: number
  min: number
  max: number
}

export function statsFor(items: HealthMeasurement[]): MeasurementStats | null {
  if (items.length === 0) return null
  const sorted = [...items].sort((a, b) => measurementTimestamp(b) - measurementTimestamp(a))
  const avg = items.reduce((s, i) => s + i.value, 0) / items.length
  const withDia = items.filter((i) => i.value2 !== undefined)
  return {
    count: items.length,
    last: sorted[0],
    avg,
    avg2: withDia.length ? withDia.reduce((s, i) => s + (i.value2 ?? 0), 0) / withDia.length : undefined,
    min: Math.min(...items.map((i) => i.value)),
    max: Math.max(...items.map((i) => i.value)),
  }
}

/** Resumen de texto para compartir con el médico. */
export function buildDoctorSummary(measurements: HealthMeasurement[], days: number, now = new Date()): string {
  const since = now.getTime() - days * 86_400_000
  const lines = [`Resumen de mediciones — últimos ${days} días`, '']
  for (const meta of MEASUREMENT_TYPES) {
    const items = measurements.filter((m) => m.type === meta.type && measurementTimestamp(m) >= since)
    const stats = statsFor(items)
    if (!stats) continue
    const avg = meta.type === 'presion' ? `${Math.round(stats.avg)}/${Math.round(stats.avg2 ?? 0)}` : stats.avg.toFixed(meta.type === 'temperatura' ? 1 : 0)
    lines.push(`• ${meta.label}: ${stats.count} registros, promedio ${avg} ${meta.unit}`)
    const recent = [...items].sort((a, b) => measurementTimestamp(b) - measurementTimestamp(a)).slice(0, 5)
    for (const m of recent) {
      const feel = m.feeling ? ` — se sentía ${m.feeling.toLowerCase()}` : ''
      const sym = m.symptoms?.length && !m.symptoms.includes('Sin síntomas') ? ` (${m.symptoms.join(', ')})` : ''
      lines.push(`   ${m.date.split('-').reverse().join('/')} ${m.time}: ${formatMeasurement(m)} ${meta.unit}${m.context ? ` · ${m.context}` : ''}${feel}${sym}`)
    }
    lines.push('')
  }
  if (lines.length === 2) lines.push('Sin mediciones en el período.')
  lines.push('Valores cargados por el paciente; no reemplazan una evaluación médica.')
  return lines.join('\n')
}
