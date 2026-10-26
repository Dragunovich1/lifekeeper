/**
 * Asistente Inteligente Conversacional Local de LifeKeeper (100% privado y offline).
 * Interpreta consultas y COMANDOS DE MUTACIÓN en lenguaje natural en español rioplatense/neutro.
 * Soporta clima en tiempo real, carga y consulta de hidratación, finanzas, nutrición,
 * ciclo menstrual, entrenamientos (con biseries/dropsets), biometría, medicación y opciones totales de la app.
 */

import type {
  AppData,
  FinanceTransaction,
  MealType,
  MealFoodItem,
  WorkoutSetType,
  MenstrualFlow,
  WorkoutExerciseSet,
  DiaryEntry,
  MenstrualCycleEntry,
} from '../../types'
import { toLocalDateKey, formatDate } from '../../utils/dates'
import { computeVaultHealthScore } from '../../utils/vaultScore'
import { fetchWeatherData, describeWeatherCode } from '../api/weather'

export interface AssistantMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
  action?: {
    label: string
    hash: string
  }
}

export interface AssistantMutationResult {
  message: AssistantMessage
  updater: (previous: AppData) => AppData
}

/**
 * Normaliza texto eliminando acentos, tildes, signos de puntuación y espacios redundantes.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita diacríticos: á->a, é->e, í->i, ó->o, ú->u, ñ->n
    .replace(/[¿?¡!.,;:()_"\'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const formatDayName = (dateStr: string): string => {
  const d = new Date(dateStr + 'T12:00:00')
  if (isNaN(d.getTime())) return dateStr
  const name = d.toLocaleDateString('es-AR', { weekday: 'long' })
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function createAssistantMessage(text: string, action?: { label: string; hash: string }): AssistantMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sender: 'assistant',
    text,
    timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    action,
  }
}

// ============================================================================
// MOTOR DE MUTACIONES / CARGA DE DATOS EN LENGUAJE NATURAL
// Permite que el usuario diga: "porfa anota que tome 500ml de agua", "gaste $4500 en comida", etc.
// ============================================================================

export function tryExecuteAssistantMutation(query: string, data: AppData): AssistantMutationResult | null {
  const norm = normalizeText(query)
  const now = new Date()
  const todayKey = toLocalDateKey(now)

  // --------------------------------------------------------------------------
  // A. MUTACIÓN: HIDRATACIÓN / AGUA ("tome 500ml de agua", "anota 2 vasos de agua", etc.)
  // --------------------------------------------------------------------------
  const hasWaterWord = norm.includes('agua') || norm.includes('vaso') || norm.includes('botella') || norm.includes('sed') || norm.includes('hidrat')
  const hasWaterAction =
    norm.includes('tome') ||
    norm.includes('tomi') ||
    norm.includes('bebi') ||
    norm.includes('anota') ||
    norm.includes('registra') ||
    norm.includes('carga') ||
    norm.includes('agrega') ||
    norm.includes('sumar') ||
    norm.includes('sumale')

  if ((hasWaterWord && hasWaterAction) || norm.includes('ml de agua') || norm.includes('cc de agua')) {
    let ml = 0

    // Caso 1: ML o CC explícitos (ej. "500ml", "500 ml", "750 cc")
    const mlMatch = query.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|cc)/i)
    if (mlMatch) {
      ml = Math.round(parseFloat(mlMatch[1].replace(',', '.')))
    }

    // Caso 2: Litros (ej. "1 litro", "1.5 litros", "1.5 l")
    if (!ml) {
      const literMatch = query.match(/(\d+(?:[.,]\d+)?)\s*(?:litro|litros|l\b)/i)
      if (literMatch) {
        ml = Math.round(parseFloat(literMatch[1].replace(',', '.')) * 1000)
      } else if (norm.includes('un litro')) {
        ml = 1000
      } else if (norm.includes('medio litro')) {
        ml = 500
      } else if (norm.includes('dos litros')) {
        ml = 2000
      }
    }

    // Caso 3: Vasos (1 vaso ~ 250 ml)
    if (!ml) {
      const glassMatch = query.match(/(\d+)\s*(?:vaso|vasos)/i)
      if (glassMatch) {
        ml = parseInt(glassMatch[1], 10) * 250
      } else if (norm.includes('un vaso')) {
        ml = 250
      } else if (norm.includes('dos vasos')) {
        ml = 500
      } else if (norm.includes('tres vasos')) {
        ml = 750
      } else if (norm.includes('cuatro vasos')) {
        ml = 1000
      }
    }

    // Caso 4: Botella (1 botella ~ 500 ml)
    if (!ml) {
      const bottleMatch = query.match(/(\d+)\s*(?:botella|botellas)/i)
      if (bottleMatch) {
        ml = parseInt(bottleMatch[1], 10) * 500
      } else if (norm.includes('una botella')) {
        ml = 500
      } else if (norm.includes('dos botellas')) {
        ml = 1000
      }
    }

    // Caso 5: Número genérico con agua (ej. "anota 500 de agua")
    if (!ml) {
      const genericNumber = query.match(/(\d+)/)
      if (genericNumber) {
        const val = parseInt(genericNumber[1], 10)
        ml = val > 20 ? val : val * 250
      }
    }

    // Si no hubo número pero dijo "tome agua", se asume 1 vaso (250ml)
    if (!ml && (norm.includes('tome agua') || norm.includes('bebi agua'))) {
      ml = 250
    }

    if (ml > 0) {
      const target = data.health.hydrationTargetMl ?? 2500
      const currentToday = (data.health.hydrationLogs ?? []).find((l) => l.date === todayKey)?.amountMl ?? 0
      const newTotal = currentToday + ml
      const pct = Math.round((newTotal / target) * 100)

      const updater = (prev: AppData): AppData => {
        const logs = [...(prev.health.hydrationLogs ?? [])]
        const idx = logs.findIndex((l) => l.date === todayKey)
        if (idx >= 0) {
          logs[idx] = { ...logs[idx], amountMl: (logs[idx].amountMl || 0) + ml }
        } else {
          logs.push({ date: todayKey, amountMl: ml })
        }
        return {
          ...prev,
          health: {
            ...prev.health,
            hydrationLogs: logs,
          },
        }
      }

      const celebration =
        pct >= 100
          ? '🎉 **¡Alcanzaste y completaste tu meta diaria del 100%!**'
          : `💧 Te faltan **${Math.max(0, target - newTotal)} ml** para tu objetivo del día.`

      return {
        message: createAssistantMessage(
          `💧 **¡Excelente! Ya anoté ${ml} ml de agua en tu registro.**\n\n• **Consumo de hoy:** **${newTotal} ml** de ${target} ml (**${pct}%**)\n• ${celebration}`,
          { label: 'Ver Hidratación', hash: '#health:hydration' },
        ),
        updater,
      }
    }
  }

  // --------------------------------------------------------------------------
  // B. MUTACIÓN: FINANZAS / GASTOS E INGRESOS ("gaste 5000 en comida", "ingrese 80000 sueldo", etc.)
  // --------------------------------------------------------------------------
  const isFinanceAction =
    norm.includes('gaste') ||
    norm.includes('gasto') ||
    norm.includes('compre') ||
    norm.includes('pague') ||
    norm.includes('ingrese') ||
    norm.includes('ingreso') ||
    norm.includes('cobre') ||
    ((norm.includes('anota') || norm.includes('registra') || norm.includes('carga')) &&
      (norm.includes('gasto') || norm.includes('ingreso') || norm.includes('plata') || norm.includes('$')))

  if (isFinanceAction) {
    const isIncome = norm.includes('ingres') || norm.includes('cobre') || norm.includes('sueldo') || norm.includes('cobro')

    // Extracción de monto
    const amountMatch = query.match(/(?:\$|ars\s*|usd\s*)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)/i)
    if (amountMatch) {
      let rawNum = amountMatch[1].replace(/\./g, '').replace(',', '.')
      const amount = parseFloat(rawNum)

      if (amount > 0) {
        // Inferencia de concepto y categoría
        let category = isIncome ? 'Ingreso' : 'Varios'
        let description = ''

        if (norm.includes('comida') || norm.includes('super') || norm.includes('almuerzo') || norm.includes('cena') || norm.includes('verduleria')) {
          category = 'Alimentación'
        } else if (norm.includes('nafta') || norm.includes('combustible') || norm.includes('uber') || norm.includes('taxi') || norm.includes('colectivo') || norm.includes('sube')) {
          category = 'Transporte'
        } else if (norm.includes('luz') || norm.includes('gas') || norm.includes('internet') || norm.includes('expensas') || norm.includes('alquiler') || norm.includes('servicio')) {
          category = 'Servicios'
        } else if (norm.includes('farmacia') || norm.includes('medic') || norm.includes('remedio') || norm.includes('consulta')) {
          category = 'Salud'
        } else if (norm.includes('gimnasio') || norm.includes('gym') || norm.includes('cuota')) {
          category = 'Deporte'
        } else if (norm.includes('ropa') || norm.includes('zapatillas') || norm.includes('shopping')) {
          category = 'Compras'
        } else if (isIncome && (norm.includes('sueldo') || norm.includes('honorarios') || norm.includes('venta'))) {
          category = 'Sueldo/Honorarios'
        }

        // Extraer texto descriptivo después de "en", "de", "para", "por"
        const prepMatch = query.match(/(?:en|de|para|por)\s+([a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]{3,35})/i)
        if (prepMatch) {
          description = prepMatch[1].trim()
        } else {
          description = isIncome ? 'Ingreso registrado por asistente' : `Gasto en ${category}`
        }

        const newTx: FinanceTransaction = {
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: isIncome ? 'income' : 'expense',
          amount,
          category,
          description: description.charAt(0).toUpperCase() + description.slice(1),
          date: todayKey,
        }

        const updater = (prev: AppData): AppData => ({
          ...prev,
          personal: {
            ...prev.personal,
            finances: [newTx, ...(prev.personal.finances ?? [])],
          },
        })

        return {
          message: createAssistantMessage(
            `💳 **¡Movimiento guardado con éxito!**\n\n• **Tipo:** ${isIncome ? '🟢 Ingreso' : '🔴 Gasto'}\n• **Monto:** **$${amount.toLocaleString('es-AR')}**\n• **Detalle:** ${newTx.description}\n• **Categoría:** ${category}\n• **Fecha:** Hoy (${todayKey})\n\nTu balance financiero mensual se actualizó al instante.`,
            { label: 'Ver Finanzas', hash: '#personal:finances' },
          ),
          updater,
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // C. MUTACIÓN: NUTRICIÓN / COMIDAS / CALORÍAS ("anota que comi 200g de pollo con 350 calorias", etc.)
  // --------------------------------------------------------------------------
  const isNutritionAction =
    norm.includes('comi') ||
    norm.includes('desayune') ||
    norm.includes('almorce') ||
    norm.includes('cene') ||
    norm.includes('merende') ||
    ((norm.includes('anota') || norm.includes('registra') || norm.includes('carga')) &&
      (norm.includes('comida') || norm.includes('alimento') || norm.includes('calorias') || norm.includes('kcal') || norm.includes('almuerzo') || norm.includes('cena') || norm.includes('desayuno') || norm.includes('merienda')))

  if (isNutritionAction) {
    let mealType: MealType = 'almuerzo'
    if (norm.includes('desayun')) mealType = 'desayuno'
    else if (norm.includes('merend')) mealType = 'merienda'
    else if (norm.includes('cen')) mealType = 'cena'
    else if (norm.includes('snack') || norm.includes('colacion')) mealType = 'snack'
    else if (norm.includes('suplement')) mealType = 'suplemento'

    // Extracción de calorías
    let calories = 0
    const calMatch = query.match(/(\d+)\s*(?:kcal|calorias|cal\b)/i)
    if (calMatch) {
      calories = parseInt(calMatch[1], 10)
    }

    // Extracción de gramos
    let grams: number | undefined
    const gMatch = query.match(/(\d+)\s*(?:g|gr|gramos)\b/i)
    if (gMatch) {
      grams = parseInt(gMatch[1], 10)
    }

    // Inferencia de alimento
    let foodName = 'Comida registrada por asistente'
    const foodClean = query
      .replace(/(?:porfa|por favor|anota|anotame|registra|registrame|carga|comi|desayune|almorce|cene|merende|que)\s+/gi, '')
      .replace(/(\d+)\s*(?:kcal|calorias|cal|g|gr|gramos)\b/gi, '')
      .replace(/(?:con|de|en el|en la|para el|para la)\s+/gi, ' ')
      .trim()

    if (foodClean.length >= 3) {
      foodName = foodClean.charAt(0).toUpperCase() + foodClean.slice(1)
    }

    // Si no especificó calorías, estimamos razonable según tipo de comida
    if (!calories) {
      calories = mealType === 'almuerzo' || mealType === 'cena' ? 450 : mealType === 'desayuno' || mealType === 'merienda' ? 250 : 150
    }

    const newFood: MealFoodItem = {
      id: `food-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: foodName,
      calories,
      portion: grams ? `${grams} g` : undefined,
    }

    const updater = (prev: AppData): AppData => {
      const nutrition = prev.personal.nutrition ?? {
        dailyLogs: [],
      }

      const dailyLogs = [...nutrition.dailyLogs]
      let todayLog = dailyLogs.find((l) => l.date === todayKey)

      if (!todayLog) {
        todayLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: todayKey,
          targetCalories: nutrition.dailyGoals?.calories ?? 2200,
          meals: [],
        }
        dailyLogs.push(todayLog)
      }

      // Buscar si ya existe la comida (ej. almuerzo) o crearla
      const meals = [...todayLog.meals]
      const mealIdx = meals.findIndex((m) => m.type === mealType)

      if (mealIdx >= 0) {
        meals[mealIdx] = {
          ...meals[mealIdx],
          foods: [...meals[mealIdx].foods, newFood],
        }
      } else {
        meals.push({
          id: `meal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: mealType,
          foods: [newFood],
        })
      }

      const updatedTodayLog = { ...todayLog, meals }
      const finalDailyLogs = dailyLogs.map((l) => (l.date === todayKey ? updatedTodayLog : l))

      return {
        ...prev,
        personal: {
          ...prev.personal,
          nutrition: {
            ...nutrition,
            dailyLogs: finalDailyLogs,
          },
        },
      }
    }

    const mealTypeLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1)

    return {
      message: createAssistantMessage(
        `🥗 **¡Comida registrada en tu Plan de Nutrición!**\n\n• **Momento:** ${mealTypeLabel}\n• **Alimento:** ${foodName}\n• **Calorías:** ${calories} kcal${grams ? ` (${grams} g)` : ''}\n• **Fecha:** Hoy (${todayKey})\n\nYa podés ver tu balance de calorías y macronutrientes en la sección de Nutrición.`,
        { label: 'Ver Nutrición', hash: '#personal:nutrition' },
      ),
      updater,
    }
  }

  // --------------------------------------------------------------------------
  // D. MUTACIÓN: PESO CORPORAL / BIOMETRÍA ("anota mi peso 75.5 kg", "pese 80 kg", etc.)
  // --------------------------------------------------------------------------
  const isWeightAction =
    (norm.includes('peso') || norm.includes('pese') || norm.includes('pesando')) &&
    (norm.includes('anota') || norm.includes('registra') || norm.includes('carga') || norm.includes('estoy') || norm.includes('subi') || norm.includes('baje') || norm.includes('kg') || norm.includes('kilo'))

  if (isWeightAction) {
    const weightMatch = query.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)?/i)
    if (weightMatch) {
      const weightKg = parseFloat(weightMatch[1].replace(',', '.'))
      if (weightKg >= 30 && weightKg <= 300) {
        const height = data.profile.heightCm
        const imc = height ? (weightKg / Math.pow(height / 100, 2)).toFixed(1) : null

        const updater = (prev: AppData): AppData => ({
          ...prev,
          profile: {
            ...prev.profile,
            weightKg,
          },
        })

        return {
          message: createAssistantMessage(
            `⚖️ **¡Peso biométrico actualizado!**\n\n• **Nuevo peso:** **${weightKg} kg**\n${imc ? `• **IMC calculado:** **${imc} kg/m²** (con tu altura de ${height} cm)\n` : ''}Tus metas y recomendaciones de salud se sincronizaron con esta nueva medida.`,
            { label: 'Ver Perfil Biométrico', hash: '#profile:settings' },
          ),
          updater,
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // E. MUTACIÓN: CICLO MENSTRUAL ("me vino hoy", "empezo mi periodo", "anota inicio de regla")
  // --------------------------------------------------------------------------
  const isMenstrualPeriodStart =
    (norm.includes('periodo') || norm.includes('regla') || norm.includes('menstruacion') || norm.includes('ciclo')) &&
    (norm.includes('vino') || norm.includes('empezo') || norm.includes('llego') || norm.includes('inicio') || norm.includes('anota') || norm.includes('registra'))

  if (isMenstrualPeriodStart) {
    const updater = (prev: AppData): AppData => {
      const cycleData = prev.health.menstrualCycle ?? {
        enabled: true,
        averageCycleDays: 28,
        averagePeriodDays: 5,
        entries: [],
      }

      const existingEntries = cycleData.entries ?? []
      const newEntry: MenstrualCycleEntry = {
        id: `period-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        startDate: todayKey,
        flow: 'moderado' as MenstrualFlow,
        symptoms: ['Sensibilidad', 'Cólicos leves'],
        notes: 'Inicio registrado automáticamente vía Asistente LifeKeeper',
      }

      return {
        ...prev,
        profile: {
          ...prev.profile,
          gender: 'Femenino', // Asegura perfil femenino
        },
        health: {
          ...prev.health,
          menstrualCycle: {
            ...cycleData,
            entries: [newEntry, ...existingEntries.filter((e) => e.startDate !== todayKey)],
          },
        },
      }
    }

    return {
      message: createAssistantMessage(
        `🌸 **¡Período registrado con éxito!**\n\n• **Fecha de inicio:** Hoy (${todayKey})\n• **Fase activa:** Menstruación (Día 1)\n\nActualicé tus fases hormonales y proyecté los próximos ciclos y la ventana fértil en el Calendario. ¡Recordá descansar y mantenerte hidratada! 💖`,
        { label: 'Ver Ciclo Menstrual', hash: '#health:menstrual' },
      ),
      updater,
    }
  }

  // --------------------------------------------------------------------------
  // F. MUTACIÓN: RECORDATORIOS ("recordame comprar remedio mañana a las 10", etc.)
  // --------------------------------------------------------------------------
  const isReminderAction =
    norm.includes('recordame') ||
    norm.includes('recordar') ||
    norm.includes('agendame') ||
    norm.includes('agenda') ||
    ((norm.includes('anota') || norm.includes('crea') || norm.includes('agrega')) && (norm.includes('recordatorio') || norm.includes('alarma') || norm.includes('tarea')))

  if (isReminderAction) {
    let cleanTitle = query
      .replace(/(?:porfa|por favor|recordame|recordar|agendame|agenda|anota|crea|agrega|un recordatorio|una alarma|una tarea|de|que|para)\s+/gi, ' ')
      .replace(/(?:hoy|mañana|a las \d+:\d+|a las \d+)\b/gi, '')
      .trim()

    if (!cleanTitle) cleanTitle = 'Recordatorio general'
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1)

    // Determinar fecha/hora
    const d = new Date()
    if (norm.includes('manana')) {
      d.setDate(d.getDate() + 1)
    }

    // Hora
    const hourMatch = query.match(/(?:a las|las)\s*(\d{1,2})(?::(\d{2}))?/i)
    if (hourMatch) {
      const h = parseInt(hourMatch[1], 10)
      const m = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0
      d.setHours(h, m, 0, 0)
    } else {
      d.setHours(10, 0, 0, 0)
    }

    const dateTimeStr = d.toISOString().slice(0, 16)

    const updater = (prev: AppData): AppData => ({
      ...prev,
      utilities: {
        ...prev.utilities,
        reminders: [
          {
            id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: cleanTitle,
            dateTime: dateTimeStr,
            done: false,
            category: 'general',
          },
          ...(prev.utilities.reminders ?? []),
        ],
      },
    })

    return {
      message: createAssistantMessage(
        `⏰ **¡Recordatorio agendado!**\n\n• **Título:** ${cleanTitle}\n• **Fecha y hora:** ${d.toLocaleDateString('es-AR')} a las ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}\n\nQuedó agregado a tu lista de recordatorios y al calendario de LifeKeeper.`,
        { label: 'Ver Recordatorios', hash: '#utilities:reminders' },
      ),
      updater,
    }
  }

  // --------------------------------------------------------------------------
  // G. MUTACIÓN: ENTRENAMIENTOS Y SERIES ("anota una serie de press banca 80kg x 8 reps con dropset", etc.)
  // --------------------------------------------------------------------------
  const isWorkoutAction =
    (norm.includes('serie') || norm.includes('entrenamiento') || norm.includes('gym') || norm.includes('rutina') || norm.includes('ejercicio')) &&
    (norm.includes('anota') || norm.includes('registra') || norm.includes('hice') || norm.includes('carga') || norm.includes('entrene'))

  if (isWorkoutAction) {
    let reps = 10
    const repsMatch = query.match(/(\d+)\s*(?:rep|reps|repeticiones)/i)
    if (repsMatch) reps = parseInt(repsMatch[1], 10)

    let weight = 0
    const wMatch = query.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)/i)
    if (wMatch) weight = parseFloat(wMatch[1].replace(',', '.'))

    let setType: WorkoutSetType = 'normal'
    if (norm.includes('dropset') || norm.includes('drop set')) setType = 'dropset'
    else if (norm.includes('biserie') || norm.includes('superset')) setType = 'biserie'
    else if (norm.includes('calentamiento') || norm.includes('warmup')) setType = 'warmup'
    else if (norm.includes('fallo') || norm.includes('failure')) setType = 'failure'

    let exerciseName = 'Ejercicio de fuerza'
    const nameMatch = query.match(/(?:de|en)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{3,30})/i)
    if (nameMatch) {
      exerciseName = nameMatch[1].replace(/(?:con|por|\d+|kg|reps|dropset|biserie)/gi, '').trim()
      exerciseName = exerciseName.charAt(0).toUpperCase() + exerciseName.slice(1)
    }

    const updater = (prev: AppData): AppData => {
      const workouts = [...(prev.personal.workouts ?? [])]
      let todaySession = workouts.find((w) => w.date === todayKey)

      if (!todaySession) {
        todaySession = {
          id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: `Entrenamiento del ${formatDate(todayKey)}`,
          date: todayKey,
          durationMinutes: 45,
          type: 'fuerza',
          exercises: [],
        }
        workouts.unshift(todaySession)
      }

      const exercises = [...todaySession.exercises]
      let ex = exercises.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase())

      if (!ex) {
        ex = {
          id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: exerciseName,
          sets: [],
        }
        exercises.push(ex)
      }

      const newSet: WorkoutExerciseSet = {
        reps,
        weight,
        setType,
        notes: 'Registrado vía asistente',
      }
      ex.sets = [...ex.sets, newSet]

      todaySession.exercises = exercises
      return {
        ...prev,
        personal: {
          ...prev.personal,
          workouts,
        },
      }
    }

    const typeBadge =
      setType === 'dropset'
        ? '⚡ Drop Set'
        : setType === 'biserie'
        ? '🔗 Biserie'
        : setType === 'warmup'
        ? '🔥 Calentamiento'
        : setType === 'failure'
        ? '💥 Al Fallo'
        : 'Normal'

    return {
      message: createAssistantMessage(
        `🏋️ **¡Serie registrada en tus Entrenamientos!**\n\n• **Ejercicio:** ${exerciseName}\n• **Carga y reps:** ${weight} kg × ${reps} repeticiones\n• **Modalidad:** ${typeBadge}\n• **Fecha:** Hoy (${todayKey})\n\n¡Excelente trabajo! Ya quedó guardado en tu historial deportivo.`,
        { label: 'Ver Entrenamientos', hash: '#personal:workouts' },
      ),
      updater,
    }
  }

  // --------------------------------------------------------------------------
  // H. MUTACIÓN: DIARIO PERSONAL ("anota en el diario que hoy tuve un excelente dia")
  // --------------------------------------------------------------------------
  const isDiaryAction =
    (norm.includes('diario') || norm.includes('reflexion') || norm.includes('pensamiento')) &&
    (norm.includes('anota') || norm.includes('escribe') || norm.includes('guarda') || norm.includes('agrega'))

  if (isDiaryAction) {
    let content = query
      .replace(/(?:porfa|por favor|anota|anotame|escribe|guarda|agrega|en el diario|al diario|en mi diario|que|:)\s+/gi, ' ')
      .trim()

    if (!content) content = 'Reflexión del día'

    const newEntry: DiaryEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: todayKey,
      mood: 'Bien',
      title: 'Nota guardada con asistente',
      content,
      tags: ['asistente', 'reflexión'],
    }

    const updater = (prev: AppData): AppData => ({
      ...prev,
      diary: {
        ...prev.diary,
        entries: [newEntry, ...(prev.diary.entries ?? [])],
      },
    })

    return {
      message: createAssistantMessage(
        `📓 **¡Nota resguardada en tu Diario Personal!**\n\n• **Texto:** "${content.length > 120 ? content.slice(0, 120) + '...' : content}"\n• **Fecha:** Hoy (${todayKey})\n\nTu entrada está resguardada de forma segura bajo cifrado Zero-Knowledge.`,
        { label: 'Abrir Diario', hash: '#diary:notes' },
      ),
      updater,
    }
  }

  return null
}

// ============================================================================
// MOTOR DE CONSULTAS CONVERSACIONALES
// Responde preguntas sobre cualquier aspecto de LifeKeeper
// ============================================================================

export async function processAssistantQuery(query: string, data: AppData): Promise<AssistantMessage> {
  const norm = normalizeText(query)
  const now = new Date()
  const todayKey = toLocalDateKey(now)
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Primero: Verificar si la consulta es un comando de mutación/acción
  const mutationResult = tryExecuteAssistantMutation(query, data)
  if (mutationResult) {
    return mutationResult.message
  }

  // ==========================================
  // 1. CLIMA / LLUVIA / PRONÓSTICO (TIEMPO REAL)
  // ==========================================
  const isRainQuery = norm.includes('lluv') || norm.includes('llover') || norm.includes('llueve') || norm.includes('paragua') || norm.includes('torment')
  const isWeatherGeneral = norm.includes('clim') || norm.includes('tiemp') || norm.includes('temperat') || norm.includes('termomet') || norm.includes('calor') || norm.includes('frio') || norm.includes('pronostic')

  if (isRainQuery || isWeatherGeneral) {
    const weather = await fetchWeatherData(false)

    if (!weather) {
      return createAssistantMessage(
        '🌦️ No pude conectar con el servicio de meteorología en este momento. Verificá tu conexión a internet o consultá el widget de clima en el Dashboard.',
        { label: 'Ir al Dashboard', hash: '#dashboard' },
      )
    }

    const todayForecast = weather.daily[0] || {
      date: todayKey,
      code: weather.code,
      tempMax: weather.temp,
      tempMin: weather.temp,
      precipProb: 0,
    }

    // A. ¿Va a llover esta semana / en los próximos días?
    const isWeekQuery = norm.includes('seman') || norm.includes('proximos dias') || norm.includes('dias') || norm.includes('finde') || norm.includes('fin de semana')

    if (isRainQuery && isWeekQuery) {
      const rainyDays = weather.daily.filter((d) => d.precipProb >= 35 || ((d.code >= 51 && d.code <= 67) || (d.code >= 80 && d.code <= 82) || d.code >= 95))

      if (rainyDays.length === 0) {
        return createAssistantMessage(
          `☀️ **No se prevén lluvias para esta semana en ${weather.city}.**\n\nTodos los días presentan probabilidades bajas (inferiores al 25%) con cielo predominantemente ${weather.description.toLowerCase()}.\n\n• **Rango térmico semanal:** ${Math.min(...weather.daily.map((d) => d.tempMin))}°C a ${Math.max(...weather.daily.map((d) => d.tempMax))}°C.`,
          { label: 'Ver widget en Dashboard', hash: '#dashboard' },
        )
      }

      const list = rainyDays
        .map((d) => `• 🌧️ **${formatDayName(d.date)} (${d.date.slice(8, 10)}/${d.date.slice(5, 7)}):** ${d.precipProb}% prob. — ${describeWeatherCode(d.code)} (Min: ${d.tempMin}°C / Max: ${d.tempMax}°C)`)
        .join('\n')

      return createAssistantMessage(
        `🌧️ **Pronóstico de lluvia para esta semana en ${weather.city}:**\n\nSe detectaron probabilidades significativas de precipitación en los siguientes días:\n\n${list}\n\n💡 El resto de los días se mantendrá con bajas probabilidades de lluvia.`,
        { label: 'Ver Pronóstico en Dashboard', hash: '#dashboard' },
      )
    }

    // B. ¿Va a llover hoy?
    if (isRainQuery) {
      const prob = todayForecast.precipProb
      const desc = describeWeatherCode(todayForecast.code)

      if (prob >= 60 || (todayForecast.code >= 51 && todayForecast.code <= 67) || todayForecast.code >= 80) {
        return createAssistantMessage(
          `🌧️ **Sí, es muy probable que llueva hoy en ${weather.city}.**\n\n• **Probabilidad de precipitación:** **${prob}%**\n• **Condición:** ${desc}\n• **Temperatura actual:** ${weather.temp}°C (Máx: ${todayForecast.tempMax}°C)\n\n🌂 ¡Llevá paraguas o impermeable antes de salir!`,
          { label: 'Ver Clima en Dashboard', hash: '#dashboard' },
        )
      }

      if (prob >= 25) {
        return createAssistantMessage(
          `🌦️ **Hay probabilidad moderada/baja de lluvia hoy en ${weather.city} (${prob}%).**\n\n• **Condición:** ${desc}\n• **Temperatura:** ${weather.temp}°C (Sensación: ${weather.apparentTemp}°C)\n• **Mín / Máx:** ${todayForecast.tempMin}°C / ${todayForecast.tempMax}°C\n\nPuede presentarse alguna llovizna o chaparrón aislado. Conviene salir con precaución.`,
          { label: 'Ver Clima en Dashboard', hash: '#dashboard' },
        )
      }

      return createAssistantMessage(
        `☀️ **No, no se esperan lluvias para hoy en ${weather.city}.**\n\n• **Probabilidad de precipitación:** solo **${prob}%**\n• **Cielo:** ${desc}\n• **Temperatura actual:** ${weather.temp}°C (Mín: ${todayForecast.tempMin}°C / Máx: ${todayForecast.tempMax}°C)\n• **Viento:** ${weather.windSpeed} km/h`,
        { label: 'Ver Clima en Dashboard', hash: '#dashboard' },
      )
    }

    // C. Pronóstico semanal completo
    if (isWeekQuery) {
      const weekList = weather.daily
        .map(
          (d) =>
            `• **${formatDayName(d.date)}:** ${d.tempMin}°C a ${d.tempMax}°C · ${describeWeatherCode(d.code)} ${d.precipProb > 20 ? `(${d.precipProb}% lluvia)` : ''}`,
        )
        .join('\n')

      return createAssistantMessage(
        `📅 **Pronóstico extendido para la semana en ${weather.city}:**\n\n${weekList}\n\n¿Querés consultar sobre algún día en particular?`,
        { label: 'Ver Clima en Dashboard', hash: '#dashboard' },
      )
    }

    // D. Clima general de hoy
    const advice =
      weather.temp >= 30
        ? '☀️ Hace bastante calor. Mantené una hidratación constante y protegé tu piel del sol.'
        : weather.temp <= 12
        ? '🧣 Está fresco. Salí bien abrigado para evitar resfríos.'
        : '🌿 El clima está templado y agradable para realizar actividades al aire libre.'

    return createAssistantMessage(
      `🌤️ **Clima actual en ${weather.city}:**\n\n• **Temperatura:** **${weather.temp}°C** (Sensación térmica: ${weather.apparentTemp}°C)\n• **Condición del cielo:** ${weather.description}\n• **Mínima / Máxima de hoy:** ${todayForecast.tempMin}°C / ${todayForecast.tempMax}°C\n• **Humedad:** ${weather.humidity}%\n• **Viento:** ${weather.windSpeed} km/h\n• **Probabilidad de lluvia:** ${todayForecast.precipProb}%\n\n${advice}`,
      { label: 'Ver Clima en Dashboard', hash: '#dashboard' },
    )
  }

  // ==========================================
  // 2. NUTRICIÓN / CALORÍAS / MACRONUTRIENTES / DIETA
  // ==========================================
  if (
    norm.includes('nutricion') ||
    norm.includes('caloria') ||
    norm.includes('kcal') ||
    norm.includes('macro') ||
    norm.includes('proteina') ||
    norm.includes('carbohidrato') ||
    norm.includes('grasa') ||
    norm.includes('comi hoy') ||
    norm.includes('comida') ||
    norm.includes('dieta')
  ) {
    const nutrition = data.personal.nutrition
    const todayLog = nutrition?.dailyLogs?.find((l) => l.date === todayKey)
    const targetKcal = todayLog?.targetCalories ?? nutrition?.dailyGoals?.calories ?? 2200

    let totalKcal = 0
    let totalProt = 0
    let totalCarbs = 0
    let totalFat = 0
    const mealNames: string[] = []

    if (todayLog?.meals) {
      for (const meal of todayLog.meals) {
        for (const food of meal.foods) {
          totalKcal += food.calories
          totalProt += food.protein || 0
          totalCarbs += food.carbs || 0
          totalFat += food.fats || 0
          mealNames.push(`${food.name} (${food.calories} kcal)`)
        }
      }
    }

    const pct = Math.round((totalKcal / targetKcal) * 100)
    const remaining = targetKcal - totalKcal

    if (!todayLog || todayLog.meals.length === 0) {
      return createAssistantMessage(
        `🥗 **Nutrición de hoy (${todayKey}):**\n\nTodavía no registraste comidas el día de hoy.\n• **Meta diaria:** ${targetKcal} kcal\n\n💡 Podés decirme: *"Anotá que almorcé ensalada de pollo 350 kcal"* y lo guardo de inmediato.`,
        { label: 'Ir a Nutrición', hash: '#personal:nutrition' },
      )
    }

    return createAssistantMessage(
      `🥗 **Balance Nutricional de Hoy:**\n\n• **Calorías consumidas:** **${totalKcal} kcal** de **${targetKcal} kcal** (**${pct}%**)\n• **Margen restante:** ${remaining >= 0 ? `${remaining} kcal disponibles` : `Superado por ${Math.abs(remaining)} kcal`}\n\n**Macronutrientes acumulados:**\n• 🍗 **Proteínas:** ${totalProt.toFixed(0)} g\n• 🍚 **Carbohidratos:** ${totalCarbs.toFixed(0)} g\n• 🥑 **Grasas:** ${totalFat.toFixed(0)} g\n\n**Comidas registradas (${mealNames.length}):**\n${mealNames.slice(0, 5).map((m) => `• ${m}`).join('\n')}${mealNames.length > 5 ? `\n• ...y ${mealNames.length - 5} más` : ''}`,
      { label: 'Ver Detalle en Nutrición', hash: '#personal:nutrition' },
    )
  }

  // ==========================================
  // 3. CICLO MENSTRUAL / OVULACIÓN / FERTILIDAD / PERÍODO
  // ==========================================
  if (
    norm.includes('ciclo') ||
    norm.includes('periodo') ||
    norm.includes('regla') ||
    norm.includes('menstrua') ||
    norm.includes('ovula') ||
    norm.includes('fertil') ||
    norm.includes('lutea') ||
    norm.includes('folicular')
  ) {
    const cycle = data.health.menstrualCycle
    const entries = cycle?.entries ?? []

    if (entries.length === 0) {
      return createAssistantMessage(
        '🌸 Todavía no tenés ciclos menstruales registrados en tu bóveda.\n\nPodés ingresar a la sección de Ciclo Menstrual para registrar la fecha de tu último período y calcular tus fases hormonales.',
        { label: 'Abrir Ciclo Menstrual', hash: '#health:menstrual' },
      )
    }

    const sorted = [...entries].sort((a, b) => b.startDate.localeCompare(a.startDate))
    const lastEntry = sorted[0]
    const cycleLength = cycle?.averageCycleDays || 28
    const periodLength = cycle?.averagePeriodDays || 5

    const lastStart = new Date(lastEntry.startDate + 'T00:00:00')
    const diffDays = Math.max(0, Math.floor((now.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24)))
    const currentDay = (diffDays % cycleLength) + 1

    let currentPhase = 'Fase Folicular'
    let phaseDescription = 'Aumento gradual de energía y bienestar físico.'
    if (currentDay <= periodLength) {
      currentPhase = 'Menstruación 🩸'
      phaseDescription = 'Fase de descanso, flujo activo y mayor introspección.'
    } else if (currentDay >= 12 && currentDay <= 16) {
      currentPhase = 'Ventana de Ovulación 🌺'
      phaseDescription = 'Pico de estrógeno y fertilidad máxima.'
    } else if (currentDay > 16) {
      currentPhase = 'Fase Lútea 🌙'
      phaseDescription = 'Progesterona alta. Posible presencia de síntomas premenstruales.'
    }

    const nextPeriodDate = new Date(lastStart.getTime() + cycleLength * 86400000)
    const daysToNext = Math.ceil((nextPeriodDate.getTime() - now.getTime()) / 86400000)

    return createAssistantMessage(
      `🌸 **Monitoreo de tu Ciclo Menstrual:**\n\n• **Fase actual:** **${currentPhase}** (Día ${currentDay} de ${cycleLength})\n• **Estado:** ${phaseDescription}\n• **Último período:** ${formatDate(lastEntry.startDate)}${lastEntry.flow ? ` (Flujo ${lastEntry.flow})` : ''}\n• **Próximo período estimado:** ${formatDate(toLocalDateKey(nextPeriodDate))} (en ~${daysToNext} días)\n\nLas fechas estimadas y ventanas fértiles están sincronizadas en tu Calendario.`,
      { label: 'Ver Ciclo Menstrual', hash: '#health:menstrual' },
    )
  }

  // ==========================================
  // 4. ENTRENAMIENTOS / GYM / SERIES / BISERIES / DROPSETS
  // ==========================================
  if (
    norm.includes('entren') ||
    norm.includes('gym') ||
    norm.includes('gimnasio') ||
    norm.includes('rutina') ||
    norm.includes('ejercicio') ||
    norm.includes('workout') ||
    norm.includes('biserie') ||
    norm.includes('dropset') ||
    norm.includes('serie')
  ) {
    const workouts = data.personal.workouts ?? []
    const thisMonth = workouts.filter((w) => w.date.startsWith(currentMonth))
    const lastWorkout = workouts.slice().sort((a, b) => b.date.localeCompare(a.date))[0]

    let exercisesText = ''
    if (lastWorkout && lastWorkout.exercises.length > 0) {
      exercisesText = lastWorkout.exercises
        .map((e) => {
          const setsDetails = e.sets
            .map((s) => `${s.weight ?? 0}kg×${s.reps}${s.setType && s.setType !== 'normal' ? ` [${s.setType}]` : ''}${s.notes ? ` ("${s.notes}")` : ''}`)
            .join(', ')
          return `  • **${e.name}:** ${e.sets.length} serie(s) (${setsDetails})`
        })
        .join('\n')
    }

    return createAssistantMessage(
      `🏋️ **Tus entrenamientos y actividad física:**\n\n• **Sesiones este mes:** ${thisMonth.length}\n• **Total histórico:** ${workouts.length} sesiones\n• **Último entrenamiento:** ${lastWorkout ? `${lastWorkout.title} (${lastWorkout.type}) el ${formatDate(lastWorkout.date)}` : 'Aún no cargaste entrenamientos'}${exercisesText ? `\n\n**Detalle de ejercicios y series:**\n${exercisesText}` : ''}\n\n💡 Podés pedirme: *"Anotá una serie de press banca 80kg x 8 reps con dropset"* y lo cargo directamente.`,
      { label: 'Ver Entrenamientos', hash: '#personal:workouts' },
    )
  }

  // ==========================================
  // 5. HISTORIA CLÍNICA / ANTECEDENTES / SALUD INTEGRAL
  // ==========================================
  if (
    norm.includes('historia clinic') ||
    norm.includes('historial clinic') ||
    norm.includes('historia medica') ||
    norm.includes('antecedent') ||
    norm.includes('ficha medic') ||
    norm.includes('mi salud') ||
    norm.includes('diagnostico') ||
    norm.includes('enfermedad') ||
    norm.includes('alergia') ||
    norm.includes('sangre') ||
    norm.includes('grupo sanguineo')
  ) {
    const ep = data.health.emergencyProfile
    const notes = data.health.clinicalNotes
    const consults = data.health.consultations
    const meds = data.health.medications.filter((m) => m.active)
    const vacs = data.health.vaccines

    const sections: string[] = []

    const bioParts: string[] = []
    if (ep.bloodType) bioParts.push(`**Grupo sanguíneo:** ${ep.bloodType}`)
    if (ep.allergies?.length) bioParts.push(`**Alergias:** ${ep.allergies.join(', ')}`)
    else bioParts.push('**Alergias:** Ninguna registrada')
    if (ep.conditions?.length) bioParts.push(`**Condiciones preexistentes:** ${ep.conditions.join(', ')}`)
    sections.push(`📋 **Ficha Base y Antecedentes:**\n• ${bioParts.join('\n• ')}`)

    if (meds.length > 0) {
      const medList = meds.map((m) => `${m.name} (${m.dosage})`).join(', ')
      sections.push(`💊 **Tratamientos en curso (${meds.length}):** ${medList}`)
    } else {
      sections.push('💊 **Tratamientos en curso:** Sin tratamientos activos')
    }

    if (notes.length > 0) {
      const sortedNotes = notes.slice().sort((a, b) => b.date.localeCompare(a.date))
      const recent = sortedNotes.slice(0, 3)
      const noteLines = recent.map((n) => `  • **${formatDate(n.date)}:** ${n.title} ${n.description ? `— ${n.description.slice(0, 70)}...` : ''}`).join('\n')
      sections.push(`📝 **Últimas notas del historial (${notes.length} en total):**\n${noteLines}`)
    }

    if (consults.length > 0) {
      const sortedConsults = consults.slice().sort((a, b) => b.date.localeCompare(a.date))
      const last = sortedConsults[0]
      sections.push(`🩺 **Última consulta médica registrada:**\n  • ${last.doctor} (${formatDate(last.date)})\n  • **Motivo:** ${last.reason}${last.diagnosis ? `\n  • **Diagnóstico:** ${last.diagnosis}` : ''}`)
    }

    if (vacs.length > 0) {
      sections.push(`💉 **Libreta de vacunas:** ${vacs.length} aplicaciones registradas`)
    }

    return createAssistantMessage(
      `🩺 **Resumen de tu Historia Clínica y Ficha Médica:**\n\n${sections.join('\n\n')}\n\nPodés ingresar a la sección de Historial Clínico para ver la línea de tiempo completa o adjuntar estudios.`,
      { label: 'Abrir Historial Clínico', hash: '#health:clinical' },
    )
  }

  // ==========================================
  // 6. CATÁLOGO COMPLETO DE OPCIONES / MAPA DE LA APP
  // ==========================================
  if (
    norm.includes('que podes hacer') ||
    norm.includes('que sabes hacer') ||
    norm.includes('que opciones') ||
    norm.includes('opciones de la app') ||
    norm.includes('secciones') ||
    norm.includes('menu') ||
    norm.includes('funcionalidades') ||
    norm.includes('como funciona')
  ) {
    const isFemale = data.profile.gender === 'Femenino'
    return createAssistantMessage(
      `🏛️ **Mapa Integral de Funcionalidades de LifeKeeper:**\n\n` +
        `• 📊 **Dashboard:** Métricas clave, clima en tiempo real, score de la bóveda y accesos rápidos.\n` +
        `• 🩺 **Salud:** Ficha de Emergencia SOS, Historial Clínico, Medicación y tomas, Consultas médicas, Libreta de Vacunas, Hidratación diaria${isFemale ? ' y Ciclo Menstrual integrado' : ''}.\n` +
        `• 🏋️ **Personal:** Nutrición y calorías con desglose de macros, Entrenamientos (con series normales, biseries y dropsets), Finanzas y presupuestos, Vehículos, Proyectos y Documentos cifrados.\n` +
        `• 📓 **Diario:** Registro de reflexiones personales y estado de ánimo.\n` +
        `• 🔐 **Seguridad Zero-Knowledge:** Gestor de contraseñas con auditoría, Notas secretas y Backups encriptados.\n` +
        `• 🛠️ **Utilidades:** Recordatorios inteligentes, Calendario unificado y Herramientas biométricas.\n\n` +
        `💬 **¡Además puedo cargar datos por vos!** Decime *"Anotá que tomé 500ml de agua"*, *"Gasté $3000 en comida"*, o *"Anotá mi peso 75 kg"* y lo hago al instante.`,
      { label: 'Explorar Dashboard', hash: '#dashboard' },
    )
  }

  // ==========================================
  // 7. SALUDOS Y AYUDA INICIAL
  // ==========================================
  if (
    ['hola', 'buen dia', 'buenas', 'buenas tardes', 'buenas noches', 'que tal', 'inicio', 'hello', 'hey', 'quien sos', 'ayuda'].some(
      (g) => norm.startsWith(g) || norm === g,
    )
  ) {
    const name = data.profile.nickName || data.profile.fullName || 'amigo'
    const isFemale = data.profile.gender === 'Femenino'
    return createAssistantMessage(
      `¡Hola ${name}! 👋 Soy tu asistente personal e inteligente de LifeKeeper.\n\nTengo contexto total de tu bóveda y **puedo consultar y cargar datos en tiempo real**:\n` +
        `• 💧 **Agua:** "¿Cuánta agua tomé hoy?" o *"Anotá que tomé 500ml de agua"*\n` +
        `• 🥗 **Nutrición:** "¿Cómo vengo con las calorías?" o *"Anotá que comí pollo con arroz 400 kcal"*\n` +
        `• 🏋️ **Gym:** "¿Qué entrené últimamente?" o *"Anotá serie de press banca 80kg x 8 con dropset"*\n` +
        (isFemale ? `• 🌸 **Ciclo Menstrual:** "¿En qué fase estoy?" o *"Anotá que empezó mi período hoy"*\n` : '') +
        `• 💳 **Finanzas:** "¿Cuánto gasté este mes?" o *"Gasté $4500 en supermercado"*\n` +
        `• 🌦️ **Clima:** "¿Cómo está el clima hoy?", "¿va a llover hoy o esta semana?"\n` +
        `• 🩺 **Salud:** "Decime mi historia clínica", "¿qué pastillas tomo hoy?"\n` +
        `• ⚖️ **Peso:** "Anotá mi peso 74.5 kg"\n` +
        `• 🗓️ **Recordatorios:** "Recordame comprar remedio mañana a las 10"`,
    )
  }

  // ==========================================
  // 8. FINANZAS / GASTOS / PLATA / DINERO / BALANCE
  // ==========================================
  if (
    norm.includes('gast') ||
    norm.includes('plat') ||
    norm.includes('guita') ||
    norm.includes('diner') ||
    norm.includes('financ') ||
    norm.includes('ingres') ||
    norm.includes('balanc') ||
    norm.includes('cuanto tengo') ||
    norm.includes('cuanto me queda') ||
    norm.includes('egres') ||
    norm.includes('sueldo') ||
    norm.includes('ahorr')
  ) {
    const monthTxs = data.personal.finances.filter((t) => t.date.startsWith(currentMonth))
    const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const balance = income - expense

    const categories = Array.from(new Set(monthTxs.map((t) => t.category.toLowerCase())))
    const mentionedCat = categories.find((c) => norm.includes(normalizeText(c)))

    if (mentionedCat) {
      const catSpent = monthTxs
        .filter((t) => t.type === 'expense' && t.category.toLowerCase() === mentionedCat)
        .reduce((s, t) => s + t.amount, 0)
      return createAssistantMessage(
        `💳 En lo que va del mes, tu gasto total en **"${mentionedCat}"** es de **$${catSpent.toLocaleString('es-AR')}**.`,
        { label: 'Ver movimientos en Finanzas', hash: '#personal:finances' },
      )
    }

    const state = balance >= 0 ? '🟢 Superávit neto' : '🔴 Déficit mensual'
    return createAssistantMessage(
      `📊 **Balance financiero de este mes (${currentMonth}):**\n\n• **Ingresos totales:** $${income.toLocaleString('es-AR')}\n• **Gastos / Egresos:** $${expense.toLocaleString('es-AR')}\n• **Balance disponible:** ${balance >= 0 ? '+' : ''}$${balance.toLocaleString('es-AR')} (${state})\n• **Movimientos registrados:** ${monthTxs.length}\n\n💡 Podés registrar nuevos gastos diciéndome: *"Gasté $3500 en combustible"*`,
      { label: 'Ir a Finanzas', hash: '#personal:finances' },
    )
  }

  // ==========================================
  // 9. MEDICACIÓN / PASTILLAS / REMEDIOS / TRATAMIENTOS
  // ==========================================
  if (
    norm.includes('pastill') ||
    norm.includes('remedi') ||
    norm.includes('medic') ||
    norm.includes('tomar') ||
    norm.includes('tomo') ||
    norm.includes('tomas') ||
    norm.includes('dosis') ||
    norm.includes('tratamiento')
  ) {
    const activeMeds = data.health.medications.filter((m) => m.active)
    if (activeMeds.length === 0) {
      return createAssistantMessage(
        '💊 No tenés tratamientos médicos activos registrados en este momento.\n\nPodés ingresar a la sección de Medicación para cargar un tratamiento con sus horarios programados.',
        { label: 'Cargar Medicación', hash: '#health:medications' },
      )
    }

    const lines: string[] = []
    activeMeds.forEach((m) => {
      const schedules = m.schedules.map((s) => s.time).join(', ')
      lines.push(`• **${m.name}** (${m.dosage}) — Horarios: ${schedules || 'A demanda'}${m.instructions ? ` · Indicación: ${m.instructions}` : ''}`)
    })

    return createAssistantMessage(
      `💊 **Tenés ${activeMeds.length} tratamiento(s) médico(s) activo(s):**\n\n${lines.join('\n')}\n\nRecordá registrar cada toma diaria para mantener al día el historial.`,
      { label: 'Gestionar Medicación', hash: '#health:medications' },
    )
  }

  // ==========================================
  // 10. HIDRATACIÓN / AGUA / LÍQUIDOS
  // ==========================================
  if (
    norm.includes('agu') ||
    norm.includes('hidrat') ||
    norm.includes('liquid') ||
    norm.includes('sed') ||
    norm.includes('vaso') ||
    norm.includes('botella')
  ) {
    const todayLog = (data.health.hydrationLogs ?? []).find((l) => l.date === todayKey)
    const target = data.health.hydrationTargetMl ?? 2500
    const current = todayLog?.amountMl ?? 0
    const pct = Math.round((current / target) * 100)
    const remaining = Math.max(0, target - current)

    let advice = ''
    if (pct >= 100) {
      advice = '🎉 ¡Felicitaciones! Ya alcanzaste el 100% de tu meta diaria de hidratación.'
    } else if (pct >= 60) {
      advice = `💧 Venís muy bien. Solo te faltan **${remaining} ml** (unos 2 o 3 vasos) para completar el día.`
    } else {
      advice = `⚠️ Llevás menos de la mitad. Te faltan **${remaining} ml** para llegar a tu meta. ¡Tomate un vaso ahora mismo!`
    }

    return createAssistantMessage(
      `💧 **Monitoreo de Hidratación de Hoy:**\n\n• **Consumo registrado:** **${current} ml** de **${target} ml** (**${pct}%**)\n\n${advice}\n\n💡 Decime *"Anotá que tomé 500ml de agua"* para sumar a tu total en cualquier momento.`,
      { label: 'Registrar agua tomada', hash: '#health:hydration' },
    )
  }

  // ==========================================
  // 11. PESO / IMC / BIOMETRÍA / ALTURA
  // ==========================================
  if (
    norm.includes('pes') ||
    norm.includes('imc') ||
    norm.includes('altur') ||
    norm.includes('kilo') ||
    norm.includes('corporal') ||
    norm.includes('engord') ||
    norm.includes('adelgac')
  ) {
    const w = data.profile.weightKg
    const h = data.profile.heightCm
    const gender = data.profile.gender || 'Masculino'
    if (!w || !h) {
      return createAssistantMessage(
        'Todavía no tenés cargados tu peso y altura en el Perfil. Con esos datos puedo calcularte el Índice de Masa Corporal (IMC) y darte sugerencias saludables.',
        { label: 'Cargar en mi Perfil', hash: '#profile:settings' },
      )
    }

    const heightM = h / 100
    const imc = w / (heightM * heightM)
    let cat = 'Peso normal'
    let emoji = '🟢'
    if (imc < 18.5) {
      cat = 'Bajo peso'
      emoji = '🟡'
    } else if (imc < 25) {
      cat = 'Peso saludable'
      emoji = '🟢'
    } else if (imc < 30) {
      cat = 'Sobrepeso'
      emoji = '🟠'
    } else {
      cat = 'Obesidad'
      emoji = '🔴'
    }

    return createAssistantMessage(
      `⚖️ **Tus métricas biométricas actuales:**\n\n• **Género:** ${gender}\n• **Peso:** ${w} kg\n• **Altura:** ${h} cm\n• **Índice de Masa Corporal (IMC):** **${imc.toFixed(1)} kg/m²** ${emoji} (${cat})\n\n💡 Podés actualizar tu peso diciéndome: *"Anotá mi peso 74.8 kg"*`,
      { label: 'Ver Perfil Biométrico', hash: '#profile:settings' },
    )
  }

  // ==========================================
  // 12. CONTRASEÑAS / SEGURIDAD / CLAVES / HACKEOS
  // ==========================================
  if (
    norm.includes('clav') ||
    norm.includes('contrasen') ||
    norm.includes('password') ||
    norm.includes('segur') ||
    norm.includes('hack') ||
    norm.includes('filtr')
  ) {
    const pwds = data.security.passwordEntries
    const weak = pwds.filter((p) => p.password.length < 12).length
    return createAssistantMessage(
      `🔐 **Estado de tu Gestor de Contraseñas:**\n\n• **Total de credenciales guardadas:** ${pwds.length}\n• **Contraseñas cortas (<12 caracteres):** ${weak} ${weak > 0 ? '⚠️ (conviene robustecerlas)' : '✅ Todas robustas'}\n• **Cifrado local:** AES-256-GCM Zero-Knowledge.\n\nPodés auditar si alguna de tus claves se filtró en la web con el botón de auditoría HIBP.`,
      { label: 'Ir al Gestor de Contraseñas', hash: '#security:passwords' },
    )
  }

  // ==========================================
  // 13. RECORDATORIOS / TAREAS / PENDIENTES / AGENDA
  // ==========================================
  if (
    norm.includes('record') ||
    norm.includes('pendient') ||
    norm.includes('hacer') ||
    norm.includes('tengo hoy') ||
    norm.includes('venc') ||
    norm.includes('alarm') ||
    norm.includes('agend')
  ) {
    const active = data.utilities.reminders.filter((r) => !r.done)
    const todayRem = active.filter((r) => toLocalDateKey(r.dateTime) === todayKey)

    if (todayRem.length > 0) {
      const list = todayRem.map((r) => `• ⏰ **${r.title}** (${r.dateTime.slice(11, 16) || 'Horario pactado'})`).join('\n')
      return createAssistantMessage(
        `🗓️ **Tenés ${todayRem.length} recordatorio(s) programado(s) para hoy:**\n\n${list}`,
        { label: 'Ver todos los recordatorios', hash: '#utilities:reminders' },
      )
    }

    return createAssistantMessage(
      active.length > 0
        ? `No tenés recordatorios programados para hoy, pero sí **${active.length} activos** en el calendario futuro.`
        : '✨ ¡Estás completamente al día! No tenés recordatorios ni tareas pendientes en tu lista.',
      { label: 'Ver Recordatorios', hash: '#utilities:reminders' },
    )
  }

  // ==========================================
  // 14. CONSULTAS MÉDICAS / TURNOS / DOCTORES
  // ==========================================
  if (norm.includes('doctor') || norm.includes('medic') || norm.includes('consult') || norm.includes('turno') || norm.includes('especialista')) {
    const upcoming = data.health.consultations
      .filter((c) => toLocalDateKey(c.date) >= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date))

    if (upcoming.length > 0) {
      const next = upcoming[0]
      return createAssistantMessage(
        `🩺 **Tu próxima consulta médica programada:**\n\n• **Motivo:** ${next.reason || 'Consulta general'}\n• **Profesional:** ${next.doctor}\n• **Fecha:** ${formatDate(next.date)}\n\n¿Querés revisar el historial de consultas anteriores?`,
        { label: 'Ver Consultas Médicas', hash: '#health:consultations' },
      )
    }

    return createAssistantMessage(
      `🩺 Tenés un total de **${data.health.consultations.length} consultas** registradas en tu historial clínico, y ninguna pendiente a futuro próximo.`,
      { label: 'Registrar nueva consulta', hash: '#health:consultations' },
    )
  }

  // ==========================================
  // 15. VACUNAS
  // ==========================================
  if (norm.includes('vacun') || norm.includes('refuerz') || norm.includes('inmun') || norm.includes('carnet')) {
    const total = data.health.vaccines.length
    const nextVaccines = data.health.vaccines.filter((v) => v.nextDoseDate && toLocalDateKey(v.nextDoseDate) >= todayKey)

    return createAssistantMessage(
      `💉 **Tu libreta de vacunación:**\n\n• **Total aplicadas:** ${total}\n• **Próximos refuerzos:** ${nextVaccines.length > 0 ? nextVaccines.map((v) => `\n  • ${v.vaccine}: ${formatDate(v.nextDoseDate!)}`).join('') : 'No tenés refuerzos próximos agendados.'}`,
      { label: 'Ver Vacunas', hash: '#health:vaccines' },
    )
  }

  // ==========================================
  // 16. VEHÍCULOS / AUTO / MOTO / SERVICE
  // ==========================================
  if (norm.includes('auto') || norm.includes('vehicul') || norm.includes('servic') || norm.includes('kilometr') || norm.includes('km') || norm.includes('moto') || norm.includes('camioneta') || norm.includes('aceite')) {
    const v = data.personal.vehicles
    if (v.length === 0) {
      return createAssistantMessage('Todavía no registraste vehículos ni mantenimientos en tu bóveda.', {
        label: 'Cargar Vehículo',
        hash: '#personal:vehicles',
      })
    }
    const lastService = v.slice().sort((a, b) => b.date.localeCompare(a.date))[0]
    return createAssistantMessage(
      `🚗 **Información de vehículos y mantenimientos:**\n\n• **Total de servicios registrados:** ${v.length}\n• **Último registro:** ${lastService.vehicleName} (${lastService.serviceType})\n• **Fecha del servicio:** ${formatDate(lastService.date)}${lastService.mileage ? `\n• **Kilometraje:** ${lastService.mileage.toLocaleString('es-AR')} km` : ''}${lastService.nextServiceDate ? `\n• **Próximo service:** ${formatDate(lastService.nextServiceDate)}` : ''}`,
      { label: 'Ver Mantenimiento Vehicular', hash: '#personal:vehicles' },
    )
  }

  // ==========================================
  // 17. ESTADO DE ÁNIMO / DIARIO
  // ==========================================
  if (norm.includes('anim') || norm.includes('humor') || norm.includes('sent') || norm.includes('diari') || norm.includes('nota') || norm.includes('emocion')) {
    const entries = data.diary.entries
    const lastEntry = entries.length > 0 ? entries.slice().sort((a, b) => b.date.localeCompare(a.date))[0] : null

    return createAssistantMessage(
      `📓 **Tu Diario Personal y Estado de Ánimo:**\n\n• **Entradas escritas:** ${entries.length}\n• **Último estado registrado:** ${lastEntry ? `${lastEntry.mood} (el ${formatDate(lastEntry.date)})` : 'Aún no registraste tu ánimo hoy'}\n\n¿Querés dejar una reflexión o escribir cómo te sentís hoy?`,
      { label: 'Abrir Diario', hash: '#diary:notes' },
    )
  }

  // ==========================================
  // 18. PROYECTOS / METAS
  // ==========================================
  if (norm.includes('proyect') || norm.includes('meta') || norm.includes('tare') || norm.includes('objetiv')) {
    const projs = data.personal.projects
    return createAssistantMessage(
      `🎯 Tenés **${projs.length} proyecto(s)** en seguimiento.\n\nPodés ingresar a la sección de Proyectos para gestionar el checklist de tareas y medir el porcentaje de avance.`,
      { label: 'Ver Proyectos', hash: '#personal:projects' },
    )
  }

  // ==========================================
  // 19. VAULT HEALTH SCORE
  // ==========================================
  if (norm.includes('score') || norm.includes('puntaj') || norm.includes('nivel') || norm.includes('salud de la boveda')) {
    const res = computeVaultHealthScore(data)
    return createAssistantMessage(
      `🏆 **Tu Vault Health Score es ${res.totalScore}/100 (${res.levelLabel}):**\n\n• **Seguridad:** ${res.pillars.security.score}/25\n• **Salud:** ${res.pillars.health.score}/25\n• **Finanzas:** ${res.pillars.finances.score}/25\n• **Bienestar:** ${res.pillars.wellness.score}/25\n\n💡 **Recomendación clave:** ${res.topRecommendations[0] || '¡Excelente balance integral en tu bóveda!'}`,
      { label: 'Ver Métricas en Dashboard', hash: '#dashboard' },
    )
  }

  // ==========================================
  // 20. RESUMEN GENERAL / COMPLETO
  // ==========================================
  if (norm.includes('resumen') || norm.includes('general') || norm.includes('todo') || norm.includes('como vengo')) {
    const score = computeVaultHealthScore(data)
    const activeMeds = data.health.medications.filter((m) => m.active).length
    const activeReminders = data.utilities.reminders.filter((r) => !r.done).length

    return createAssistantMessage(
      `📋 **Resumen Integral de tu Bóveda LifeKeeper:**\n\n• **Puntaje de salud integral:** ${score.totalScore}/100 (${score.levelLabel})\n• **Tratamientos activos:** ${activeMeds}\n• **Recordatorios pendientes:** ${activeReminders}\n• **Contraseñas resguardadas:** ${data.security.passwordEntries.length}\n• **Reflexiones en diario:** ${data.diary.entries.length}\n\n¿Querés profundizar en alguna de estas áreas?`,
      { label: 'Ir al Dashboard', hash: '#dashboard' },
    )
  }

  // ==========================================
  // FALLBACK INTELIGENTE CONVERSACIONAL
  // ==========================================
  return createAssistantMessage(
    `Comprendo tu consulta sobre **"${query}"**, pero no encontré datos o una acción específica con esa frase exacta en tu bóveda.\n\nComo tu asistente personal de LifeKeeper, podés:\n\n• 💧 **Cargar agua:** *"Anotá que tomé 500ml de agua"*\n• 🥗 **Registrar comida:** *"Anotá que almorcé 400 kcal"*\n• 💳 **Cargar gasto:** *"Gasté $3500 en comida"*\n• ⚖️ **Actualizar peso:** *"Anotá mi peso 75 kg"*\n• 🏋️ **Gym:** *"Anotá una serie de press banca 80kg x 8 reps"*\n• 🌦️ **Consultar clima:** *"¿Cómo está el clima hoy?", "¿va a llover hoy o esta semana?"*\n• 🩺 **Consultar salud:** *"Decime mi historia clínica", "¿qué remedios tomo?"*`,
    { label: 'Ver Resumen General', hash: '#dashboard' },
  )
}
