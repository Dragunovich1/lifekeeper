import type { DiaryEntry, MealFoodItem, MealType, MoodLevel, WorkoutSession } from '../../../types'
import { capitalize, normalizeText, num, oneOf, str, uid } from './helpers'
import type { ActionDef, RawAction } from './types'

const MOODS = ['Excelente', 'Bien', 'Neutral', 'Regular', 'Mal'] as const
const MEALS = ['desayuno', 'almuerzo', 'merienda', 'cena', 'snack', 'suplemento'] as const
const WORKOUT_TYPES = ['fuerza', 'cardio', 'running', 'caminata', 'ciclismo', 'natacion', 'trekking', 'funcional', 'flexibilidad', 'otro'] as const

/** 5.6 min/km → "5:36 min/km" */
const formatPace = (minutesPerKm: number) => {
  const totalSeconds = Math.round(minutesPerKm * 60)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')} min/km`
}

// ---------------------------------------------------------------------------
// Agua
// ---------------------------------------------------------------------------
export const waterAction: ActionDef = {
  type: 'water',
  about: 'tomó agua (vasos, botellas, litros, ml)',
  hints: /agua|vaso|botella|litro|\bml\b|hidrat|\bsed\b/,
  schema: '{"type":"water","ml":número}',
  example: '"tomé 3 vasos de agua" → {"type":"water","ml":750}   (un vaso = 250 ml, una botella = 500 ml, un litro = 1000 ml)',
  build(raw, { data, todayKey }) {
    const ml = Math.round(num(raw.ml) ?? 0)
    if (ml < 50 || ml > 5000) return null

    const target = data.health.hydrationTargetMl ?? 2500
    const current = (data.health.hydrationLogs ?? []).find((l) => l.date === todayKey)?.amountMl ?? 0
    const total = current + ml
    const pct = Math.round((total / target) * 100)

    return {
      apply: (prev) => {
        const logs = [...(prev.health.hydrationLogs ?? [])]
        const idx = logs.findIndex((l) => l.date === todayKey)
        if (idx >= 0) logs[idx] = { ...logs[idx], amountMl: (logs[idx].amountMl || 0) + ml }
        else logs.push({ date: todayKey, amountMl: ml })
        return { ...prev, health: { ...prev.health, hydrationLogs: logs } }
      },
      line: `• 💧 **Agua:** +${ml} ml — hoy llevás ${total} ml de ${target} ml (${pct}%)`,
      card: { category: 'agua', title: `+${ml} ml de Agua`, details: `Total de hoy: ${total} ml (${pct}%)`, badge: `${pct}%` },
      link: { label: 'Ver Hidratación', hash: '#health:hydration' },
      note: pct >= 100 ? '🎉 ¡Meta de agua cumplida hoy!' : undefined,
    }
  },
}

// ---------------------------------------------------------------------------
// Estado de ánimo / diario
// ---------------------------------------------------------------------------
const MOOD_EMOJI: Record<MoodLevel, string> = { Excelente: '🤩', Bien: '🙂', Neutral: '😐', Regular: '😕', Mal: '😞' }
const PHYSICAL = /\b(dolor|fiebre|gripe|panza|estomago|cabeza|nausea|vomit|resfri|mareo|garganta|tos|diarrea)\b/

export function detectMood(text: string): MoodLevel | null {
  const n = normalizeText(text)
  const talksAboutSelf = /\b(me siento|me senti|me siento|estoy|ando|hoy|tengo el animo|amanecí|amanecio)\b/.test(n) || /\banimo\b/.test(n)
  if (!talksAboutSelf) return null
  if (PHYSICAL.test(n) && !/\banimo\b/.test(n)) return null

  if (/(mal de animo|muy mal|pesimo|horrible|destrozad|deprimid|angustiad|desesperad|no doy mas|con ganas de llorar|hecho pelota|para atras)/.test(n)) return 'Mal'
  const mitigated = /\b(medio|medio|un poco|algo|poquito|levemente)\b/.test(n)
  if (/(bajon|triste|desanimad|decaid|de capa caida|apagad|melancoli|abatid|agobiad|ansios|estresad|de mal humor|enojad)/.test(n)) return mitigated ? 'Regular' : 'Mal'
  if (/(asi asi|mas o menos|regular|\bmeh\b|normalito|ni fu ni fa)/.test(n)) return 'Regular'
  if (/(excelente|de diez|a full|chocho|pletoric|genial|el mejor dia|re contento|super feliz|eufori)/.test(n)) return 'Excelente'
  if (/(contento|content[ao]|feliz|de buen humor|tranquil[ao]|bien de animo|motivad|con energia|relajad)/.test(n)) return 'Bien'
  return null
}

const CARING_NOTE: Record<string, string> = {
  Mal: '💙 Gracias por contármelo, che. Un día bajón le pasa a cualquiera y anotarlo ya es cuidarte. Si querés, charlamos un rato o probá algo suave: tomar agua, salir a caminar unos minutos o hablar con alguien de confianza.',
  Regular: '🫶 Anotado. Si en algún momento querés charlar o te viene una racha, acá estoy.',
}

export const diaryAction: ActionDef = {
  type: 'diary',
  about: 'cuenta cómo se siente emocionalmente o escribe una reflexión del día',
  hints: /siento|sentir|animo|bajon|triste|deprim|ansios|estres|angusti|content|feliz|enojad|cansad|agotad|diario|reflexion|humor|dia (horrible|pesado|dificil|hermoso|lindo)/,
  schema: '{"type":"diary","mood":"Excelente|Bien|Neutral|Regular|Mal","content":"lo que cuenta el usuario, en primera persona"}',
  example: '"hoy me siento medio bajón, mal de ánimo" → {"type":"diary","mood":"Mal","content":"Hoy me siento medio bajón, mal de ánimo."}   (solo emociones o reflexiones; los síntomas físicos NO van acá)',
  local(text) {
    const mood = detectMood(text)
    if (!mood) return null
    return [{ type: 'diary', mood, content: capitalize(text.replace(/^(che|porfa|amigo)[, ]+/i, '').trim()) }]
  },
  build(raw, { todayKey, now }) {
    const mood = oneOf(raw.mood, MOODS) ?? 'Neutral'
    const content = str(raw.content, 1000)
    if (!content) return null

    const entry: DiaryEntry = {
      id: uid('entry'),
      date: todayKey,
      title: `${MOOD_EMOJI[mood]} Cómo me siento hoy (${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })})`,
      content,
      mood,
      tags: ['ánimo', 'asistente'],
    }

    return {
      apply: (prev) => ({ ...prev, diary: { ...prev.diary, entries: [entry, ...(prev.diary.entries ?? [])] } }),
      line: `• ${MOOD_EMOJI[mood]} **Estado de ánimo:** ${mood} — "${content.length > 90 ? content.slice(0, 90) + '…' : content}"`,
      card: { category: 'diario', title: `Ánimo: ${mood}`, details: content.slice(0, 60), badge: mood, entityId: entry.id },
      link: { label: 'Ver Estado de Ánimo', hash: '#diary:mood' },
      note: CARING_NOTE[mood],
    }
  },
}

// ---------------------------------------------------------------------------
// Comidas
// ---------------------------------------------------------------------------
const DEFAULT_KCAL: Record<MealType, number> = { desayuno: 300, almuerzo: 600, merienda: 250, cena: 550, snack: 150, suplemento: 120 }

export const mealAction: ActionDef = {
  type: 'meal',
  about: 'comió o bebió algo (desayuno, almuerzo, merienda, cena, snack)',
  hints: /comi|desayun|almorc|cene|merend|snack|kcal|calori|comida|almuerzo|cena\b|milanesa|ensalada|pizza|asado|fideos|tostada|sandwich|empanada/,
  schema: '{"type":"meal","mealType":"desayuno|almuerzo|merienda|cena|snack|suplemento","name":"qué comió","calories":número estimado,"protein":g,"carbs":g,"fats":g}',
  example: '"almorcé milanesa con puré" → {"type":"meal","mealType":"almuerzo","name":"Milanesa con puré","calories":750,"protein":38,"carbs":70,"fats":32}   (estimá las calorías si no las dice)',
  build(raw, { data, todayKey, now }) {
    const name = str(raw.name, 80)
    if (!name) return null
    const hour = now.getHours()
    const fallbackType: MealType = hour < 11 ? 'desayuno' : hour < 15 ? 'almuerzo' : hour < 19 ? 'merienda' : 'cena'
    const mealType = oneOf(raw.mealType, MEALS) ?? fallbackType
    const given = num(raw.calories)
    const calories = Math.round(given && given > 0 ? given : DEFAULT_KCAL[mealType])

    const food: MealFoodItem = {
      id: uid('food'),
      name: capitalize(name),
      calories,
      protein: num(raw.protein) ?? undefined,
      carbs: num(raw.carbs) ?? undefined,
      fats: num(raw.fats) ?? undefined,
    }
    const goal = data.personal.nutrition?.dailyGoals?.calories ?? 2200

    return {
      apply: (prev) => {
        const nutrition = prev.personal.nutrition ?? { dailyLogs: [] }
        const logs = [...nutrition.dailyLogs]
        let log = logs.find((l) => l.date === todayKey)
        if (!log) {
          log = { id: uid('log'), date: todayKey, targetCalories: goal, meals: [] }
          logs.push(log)
        }
        const meals = [...log.meals]
        const idx = meals.findIndex((m) => m.type === mealType)
        if (idx >= 0) meals[idx] = { ...meals[idx], foods: [...meals[idx].foods, food] }
        else meals.push({ id: uid('meal'), type: mealType, foods: [food] })
        return {
          ...prev,
          personal: { ...prev.personal, nutrition: { ...nutrition, dailyLogs: logs.map((l) => (l.date === todayKey ? { ...log!, meals } : l)) } },
        }
      },
      line: `• 🥗 **${capitalize(mealType)}:** ${food.name} — ${calories} kcal${given ? '' : ' (estimado)'}`,
      card: { category: 'nutricion', title: `${food.name} (${mealType})`, details: `+${calories} kcal`, badge: `${calories} kcal`, entityId: food.id },
      link: { label: 'Ver Nutrición', hash: '#personal:nutrition' },
    }
  },
}

// ---------------------------------------------------------------------------
// Peso
// ---------------------------------------------------------------------------
export const weightAction: ActionDef = {
  type: 'weight',
  about: 'informa su peso corporal',
  hints: /\bpeso\b|pese|balanza|kilos|\bkg\b/,
  schema: '{"type":"weight","kg":número}',
  example: '"me pesé, 78,4 kilos" → {"type":"weight","kg":78.4}',
  build(raw, { data }) {
    const kg = num(raw.kg)
    if (!kg || kg < 25 || kg > 300) return null
    const heightM = (data.profile.heightCm || 175) / 100
    const imc = (kg / (heightM * heightM)).toFixed(1)
    return {
      apply: (prev) => ({ ...prev, profile: { ...prev.profile, weightKg: kg, updatedAt: new Date().toISOString() } }),
      line: `• ⚖️ **Peso:** ${kg} kg (IMC ${imc})`,
      card: { category: 'biometria', title: 'Peso actualizado', details: `${kg} kg (IMC ${imc})`, badge: `${kg} kg` },
      link: { label: 'Ver Perfil', hash: '#profile:settings' },
    }
  },
}

// ---------------------------------------------------------------------------
// Entrenamientos
// ---------------------------------------------------------------------------
export const workoutAction: ActionDef = {
  type: 'workout',
  about: 'hizo ejercicio o deporte (gym, correr, caminar, bici, natación, etc.)',
  hints: /entren|gym|gimnasio|corri|camine|nade|pedale|bici|running|trekking|rutina|ejercicio|yoga|pilates|futbol|padel|tenis|natacion|caminata/,
  schema:
    '{"type":"workout","title":"...","workoutType":"fuerza|cardio|running|caminata|ciclismo|natacion|trekking|funcional|flexibilidad|otro","durationMinutes":número,"distanceKm":número,"calories":número,"exercises":[{"name":"...","sets":número,"reps":número,"weight":kg}]}',
  example: '"hoy corrí 5 km en 28 minutos" → {"type":"workout","title":"Running","workoutType":"running","durationMinutes":28,"distanceKm":5,"exercises":[]}   (la ergometría NO es un entrenamiento: es un estudio médico)',
  build(raw, { todayKey, now }) {
    const title = capitalize(str(raw.title, 60)) || 'Entrenamiento'
    const type = oneOf(raw.workoutType, WORKOUT_TYPES) ?? 'otro'
    const duration = num(raw.durationMinutes)
    const distance = num(raw.distanceKm)
    const calories = num(raw.calories)
    const rawExercises = Array.isArray(raw.exercises) ? (raw.exercises as RawAction[]) : []

    const exercises = rawExercises.slice(0, 12).flatMap((e) => {
      const name = capitalize(str(e.name, 50))
      if (!name) return []
      const sets = Math.min(Math.max(Math.round(num(e.sets) ?? 1), 1), 12)
      const reps = Math.round(num(e.reps) ?? 10)
      const weight = num(e.weight) ?? 0
      return [{ id: uid('ex'), name, sets: Array.from({ length: sets }, () => ({ reps, weight, done: true })) }]
    })

    if (!duration && !distance && exercises.length === 0) return null

    const session: WorkoutSession = {
      id: uid('w'),
      date: todayKey,
      title,
      type,
      durationMinutes: duration ? Math.round(duration) : undefined,
      distanceKm: distance ?? undefined,
      pace: duration && distance ? formatPace(duration / distance) : undefined,
      calories: calories ? Math.round(calories) : undefined,
      exercises,
      notes: `Registrado por el asistente a las ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
    }
    const detail = [duration && `${Math.round(duration)} min`, distance && `${distance} km`, exercises.length && `${exercises.length} ejercicios`].filter(Boolean).join(' · ')

    return {
      apply: (prev) => ({ ...prev, personal: { ...prev.personal, workouts: [session, ...(prev.personal.workouts ?? [])] } }),
      line: `• 🏋️ **Entrenamiento:** ${title}${detail ? ` — ${detail}` : ''}`,
      card: { category: 'entrenamiento', title, details: detail || 'Sesión registrada', badge: type, entityId: session.id },
      link: { label: 'Ver Entrenamientos', hash: '#personal:workouts' },
    }
  },
}

export const WELLBEING_ACTIONS = [waterAction, diaryAction, mealAction, weightAction, workoutAction]
