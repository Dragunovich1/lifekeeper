import type { WorkoutType } from '../../../types'

export const WORKOUT_TYPES: Array<{ value: WorkoutType; label: string; isDistance?: boolean }> = [
  { value: 'fuerza', label: '🏋️ Fuerza / Hipertrofia' },
  { value: 'running', label: '🏃 Running / Carrera', isDistance: true },
  { value: 'ciclismo', label: '🚴 Ciclismo / Bici', isDistance: true },
  { value: 'caminata', label: '🚶 Caminata / Paseo', isDistance: true },
  { value: 'trekking', label: '🥾 Trekking / Senderismo', isDistance: true },
  { value: 'natacion', label: '🏊 Natación', isDistance: true },
  { value: 'funcional', label: '⚡ Funcional / HIIT' },
  { value: 'cardio', label: '❤️ Cardio general', isDistance: true },
  { value: 'flexibilidad', label: '🧘 Flexibilidad / Yoga' },
  { value: 'otro', label: 'Otro' },
]

export const typeLabel = (t: WorkoutType) => WORKOUT_TYPES.find((x) => x.value === t)?.label ?? t

export const QUICK_EXERCISES = [
  'Press de banca',
  'Sentadilla',
  'Peso muerto',
  'Press militar',
  'Remo con barra',
  'Dominadas',
  'Fondos',
  'Hip Thrust',
  'Curl de bíceps',
  'Elevaciones laterales',
  'Prensa de piernas',
  'Extensión de cuádriceps',
  'Gemelos en máquina',
  'Plancha',
  'Cinta',
]

export const DISTANCE_TYPES: WorkoutType[] = ['running', 'ciclismo', 'caminata', 'trekking', 'natacion', 'cardio']

export function computePace(distanceKm: number | '', durationMinutes: number | '', type: WorkoutType): string {
  if (typeof distanceKm !== 'number' || typeof durationMinutes !== 'number' || distanceKm <= 0 || durationMinutes <= 0) return ''
  if (type === 'ciclismo') return `${(distanceKm / (durationMinutes / 60)).toFixed(1)} km/h`
  if (type === 'natacion') {
    const per100 = durationMinutes / (distanceKm * 10)
    const mins = Math.floor(per100)
    return `${mins}:${String(Math.round((per100 - mins) * 60)).padStart(2, '0')} /100m`
  }
  const perKm = durationMinutes / distanceKm
  const mins = Math.floor(perKm)
  return `${mins}:${String(Math.round((perKm - mins) * 60)).padStart(2, '0')} min/km`
}
