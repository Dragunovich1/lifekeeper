/**
 * Cliente de Inteligencia Artificial Local (Ollama) para LifeKeeper.
 * Permite razonamiento conversacional real tipo GPT ejecutado 100% en el servidor local.
 * Arquitectura Zero-Knowledge: El navegador inyecta el contexto de la bóveda desencriptada
 * únicamente hacia la instancia privada de Ollama en la red local.
 */

import type { AppData } from '../../types'
import { toLocalDateKey, formatDate } from '../../utils/dates'
import { fetchWeatherData, describeWeatherCode, type WeatherData } from '../api/weather'

export interface OllamaStatus {
  online: boolean
  models: string[]
  activeModel: string | null
}

const PREFERRED_MODELS = [
  'llama3.2:3b',
  'llama3.2',
  'qwen2.5:3b',
  'qwen2.5:7b',
  'qwen2.5',
  'llama3.1:8b',
  'mistral',
  'gemma2:2b',
  'phi4-mini',
]

/**
 * Comprueba si Ollama está en línea y qué modelos tiene descargados.
 */
export async function checkOllamaStatus(): Promise<OllamaStatus> {
  try {
    const res = await fetch('/api/ai/tags', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) {
      return { online: false, models: [], activeModel: null }
    }

    const data = (await res.json()) as { models?: Array<{ name: string }> }
    const modelNames = (data.models || []).map((m) => m.name)

    if (modelNames.length === 0) {
      return { online: true, models: [], activeModel: null }
    }

    // Elegir el mejor modelo disponible según prioridad
    let selected: string = modelNames[0]
    for (const pref of PREFERRED_MODELS) {
      const match = modelNames.find((m) => m.toLowerCase().startsWith(pref))
      if (match) {
        selected = match
        break
      }
    }

    return {
      online: true,
      models: modelNames,
      activeModel: selected,
    }
  } catch {
    return { online: false, models: [], activeModel: null }
  }
}

/**
 * Construye el prompt de sistema inyectando los datos de la bóveda del usuario
 * y las condiciones meteorológicas en tiempo real.
 */
export function buildVaultSystemPrompt(data: AppData, weather: WeatherData | null): string {
  const now = new Date()
  const todayKey = toLocalDateKey(now)
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // 1. Perfil y Biometría
  const p = data.profile
  const name = p.nickName || p.fullName || 'Usuario'
  const gender = p.gender || 'Masculino'
  const weight = p.weightKg ? `${p.weightKg} kg` : 'Sin registrar'
  const height = p.heightCm ? `${p.heightCm} cm` : 'Sin registrar'
  const imc = p.weightKg && p.heightCm ? (p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1) : null

  // 2. Salud y Ficha Médica
  const ep = data.health.emergencyProfile
  const activeMeds = data.health.medications.filter((m) => m.active)
  const consults = data.health.consultations
  const notes = data.health.clinicalNotes
  const vaccines = data.health.vaccines
  const todayHydration = (data.health.hydrationLogs ?? []).find((l) => l.date === todayKey)

  // 2b. Ciclo Menstrual (si aplica)
  let menstrualText = 'No aplica o sin registros.'
  if (gender === 'Femenino' && data.health.menstrualCycle?.entries?.length) {
    const cycle = data.health.menstrualCycle
    const sorted = [...cycle.entries].sort((a, b) => b.startDate.localeCompare(a.startDate))
    const last = sorted[0]
    const diffDays = Math.max(0, Math.floor((now.getTime() - new Date(last.startDate + 'T00:00:00').getTime()) / 86400000))
    const dayInCycle = (diffDays % cycle.averageCycleDays) + 1
    menstrualText = `Ciclo: día ${dayInCycle} de ${cycle.averageCycleDays}. Último inicio: ${formatDate(last.startDate)} (flujo: ${last.flow || 'moderado'}). Período prom.: ${cycle.averagePeriodDays} días.`
  }

  // 3. Nutrición de hoy
  const nutrition = data.personal.nutrition
  const todayNut = nutrition?.dailyLogs?.find((l) => l.date === todayKey)
  let nutText = 'Sin comidas registradas hoy.'
  if (todayNut && todayNut.meals.length > 0) {
    let totKcal = 0
    let totProt = 0
    let totCarbs = 0
    let totFat = 0
    const foodList: string[] = []
    for (const m of todayNut.meals) {
      for (const f of m.foods) {
        totKcal += f.calories
        totProt += f.protein || 0
        totCarbs += f.carbs || 0
        totFat += f.fats || 0
        foodList.push(`${f.name} (${f.calories} kcal)`)
      }
    }
    const targetKcal = todayNut.targetCalories ?? nutrition?.dailyGoals?.calories ?? 2200
    nutText = `${totKcal} kcal consumidas de ${targetKcal} kcal meta (${Math.round((totKcal / targetKcal) * 100)}%). Macros: Proteína ${totProt.toFixed(0)}g, Carbos ${totCarbs.toFixed(0)}g, Grasas ${totFat.toFixed(0)}g. Comidas: [${foodList.join(', ')}].`
  }

  // 3b. Entrenamientos
  const workouts = data.personal.workouts ?? []
  const lastWorkout = workouts.slice().sort((a, b) => b.date.localeCompare(a.date))[0]
  let workoutText = 'Sin entrenamientos recientes.'
  if (lastWorkout) {
    const exList = lastWorkout.exercises
      .map((e) => {
        const setDetails = e.sets.map((s) => `${s.weight ?? 0}kg×${s.reps}${s.setType && s.setType !== 'normal' ? ` [${s.setType}]` : ''}${s.notes ? ` (${s.notes})` : ''}`).join(', ')
        return `${e.name}: ${setDetails}`
      })
      .join('; ')
    workoutText = `Última sesión: ${lastWorkout.title} (${lastWorkout.type}) el ${formatDate(lastWorkout.date)}. Ejercicios: ${exList}. Total sesiones mes: ${workouts.filter((w) => w.date.startsWith(currentMonth)).length}.`
  }

  // 4. Finanzas del mes
  const monthTxs = data.personal.finances.filter((t) => t.date.startsWith(currentMonth))
  const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense

  // 5. Recordatorios
  const activeReminders = data.utilities.reminders.filter((r) => !r.done)
  const todayReminders = activeReminders.filter((r) => toLocalDateKey(r.dateTime) === todayKey)

  // 5. Clima en tiempo real
  let weatherText = 'Sin datos climáticos disponibles.'
  if (weather) {
    const todayF = weather.daily[0]
    const weekRain = weather.daily
      .map((d) => `${d.date}: ${describeWeatherCode(d.code)}, min ${d.tempMin}°C, max ${d.tempMax}°C, prob lluvia ${d.precipProb}%`)
      .join(' | ')

    weatherText = `Ubicación: ${weather.city}. Actual: ${weather.temp}°C (Sensación: ${weather.apparentTemp}°C), ${weather.description}, Humedad: ${weather.humidity}%, Viento: ${weather.windSpeed} km/h. Hoy mín ${todayF?.tempMin}°C / máx ${todayF?.tempMax}°C (prob. lluvia hoy: ${todayF?.precipProb}%). Pronóstico de la semana: [${weekRain}].`
  }

  // Deudas y Préstamos
  const debts = data.personal.debts ?? []
  const activeDebts = debts.filter((d) => d.status !== 'cancelada')
  const porCobrar = activeDebts.filter((d) => d.direction === 'por_cobrar').reduce((s, d) => s + (d.totalAmount - (d.payments || []).reduce((p, x) => p + x.amount, 0)), 0)
  const porPagar = activeDebts.filter((d) => d.direction === 'por_pagar').reduce((s, d) => s + (d.totalAmount - (d.payments || []).reduce((p, x) => p + x.amount, 0)), 0)
  const debtsSummary = debts.length === 0
    ? 'Sin deudas ni préstamos registrados.'
    : `${activeDebts.length} activas. Por cobrar a favor: ${porCobrar.toLocaleString('es-AR')}, Por pagar adeudado: ${porPagar.toLocaleString('es-AR')}. Detalle: [${activeDebts.map(d => `${d.counterparty} (${d.direction}): ${d.totalAmount}`).join('; ')}].`

  return `Sos el Asistente Personal Inteligente de LifeKeeper, la bóveda personal privada y encriptada del usuario.
Tu personalidad es 100% porteña, tanguera, canchera, cálida y servicial. Hablás con voseo argentino auténtico ('che', 'mirá', 'viste', 'de diez', 'una pinturita', 'tranqui', 'al toque', 'laburo', 'mangos/lucas', 'papá', etc.), manteniendo siempre respeto y empatía genuina por la salud, finanzas y metas del usuario.
Entendés cualquier consulta, modismo lunfardo, falta de ortografía o frase informal sin importar cómo esté dicha.

DATOS ACTUALES DE LA BÓVEDA DEL USUARIO (CONFIDENCIAL Y PRIVADO):
- Fecha y hora actual: ${now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.
- Usuario: ${name} (Género: ${gender}, Email: ${p.auth?.email || 'No registrado'})
- Biometría: Peso: ${weight}, Altura: ${height}${imc ? `, IMC: ${imc}` : ''}.
- Ciclo Menstrual: ${menstrualText}
- Nutrición y Dieta (Hoy): ${nutText}
- Actividad Física y Entrenamientos: ${workoutText}
- Ficha Médica / Historia Clínica:
  • Grupo sanguíneo: ${ep.bloodType || 'Sin especificar'}
  • Alergias: ${ep.allergies?.length ? ep.allergies.join(', ') : 'Ninguna registrada'}
  • Condiciones médicas preexistentes: ${ep.conditions?.length ? ep.conditions.join(', ') : 'Ninguna registrada'}
  • Tratamientos médicos activos (${activeMeds.length}): ${activeMeds.map((m) => `${m.name} (${m.dosage}, horarios: ${m.schedules.map((s) => s.time).join(', ') || 'a demanda'}${m.instructions ? ` - ${m.instructions}` : ''})`).join('; ') || 'Ninguno'}
  • Últimas consultas médicas: ${consults.slice(0, 3).map((c) => `${c.doctor} (${formatDate(c.date)}): ${c.reason} - Diag: ${c.diagnosis || 'N/A'}`).join('; ') || 'Sin consultas recientes'}
  • Notas clínicas del historial: ${notes.slice(0, 3).map((n) => `${n.title} (${formatDate(n.date)}): ${n.description}`).join('; ') || 'Sin notas'}
  • Vacunas: ${vaccines.length} aplicadas.
  • Hidratación de hoy: ${todayHydration?.amountMl ?? 0} ml de ${data.health.hydrationTargetMl ?? 2500} ml meta.
- Finanzas del mes actual (${currentMonth}):
  • Ingresos totales: $${income.toLocaleString('es-AR')}
  • Gastos totales: $${expense.toLocaleString('es-AR')}
  • Balance: $${balance.toLocaleString('es-AR')}
  • Total movimientos: ${monthTxs.length}
- Deudas, Préstamos y Compromisos: ${debtsSummary}
- Recordatorios y Tareas pendientes:
  • Para hoy (${todayReminders.length}): ${todayReminders.map((r) => `${r.title} a las ${r.dateTime.slice(11, 16)}`).join(', ') || 'Ninguno para hoy'}
  • Total activos: ${activeReminders.length}
- Seguridad: ${data.security.passwordEntries.length} contraseñas resguardadas (cifrado local Zero-Knowledge).
- Vehículos: ${data.personal.vehicles.map((v) => `${v.vehicleName} (${v.serviceType}, km: ${v.mileage || 'N/A'})`).join('; ') || 'Ninguno'}
- Clima y Meteorología en Tiempo Real: ${weatherText}

MAPA DE OPCIONES DE LA APLICACIÓN LIFEKEEPER:
• Dashboard: Resumen biométrico, clima en vivo, puntaje de bóveda y accesos.
• Salud: Ficha de Emergencia SOS, Historial Clínico, Medicación y tomas, Consultas, Vacunas, Hidratación diaria, Ciclo Menstrual (para mujeres).
• Personal: Nutrición y macronutrientes, Entrenamientos con series/biseries/dropsets, Finanzas y balances, Vehículos, Proyectos, Documentos.
• Diario: Bitácora de reflexiones y estados de ánimo con cifrado.
• Seguridad: Gestor de contraseñas, Notas seguras, Copias de respaldo cifradas.
• Utilidades: Recordatorios, Calendario integrado (muestra entrenamientos, eventos y ciclos menstruales), Herramientas biométricas.

REGLAS DE RESPUESTA:
1. Sé conciso, directo y útil. No escribas introducciones vacías como "Claro, con gusto te ayudo".
2. Si te preguntan si va a llover hoy o en la semana, respondé con certeza analizando las probabilidades y días específicos del pronóstico.
3. Si te piden su historia clínica o antecedentes, dale un resumen estructurado y profesional de su ficha y consultas.
4. Si te preguntan por gastos, pastillas, tareas o notas, dale las respuestas concretas extraídas de sus datos.
5. Usá formato markdown limpio con negritas y viñetas para que sea muy fácil y cómodo de leer.`
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Envía la conversación a Ollama y transmite los tokens en tiempo real palabra a palabra.
 */
export async function queryOllamaStream(
  userQuery: string,
  history: ChatHistoryItem[],
  data: AppData,
  modelName: string,
  onChunk: (chunk: string, fullText: string) => void,
): Promise<string> {
  let weather: WeatherData | null = null
  try {
    weather = await fetchWeatherData(false)
  } catch {
    // ignore
  }

  const systemPrompt = buildVaultSystemPrompt(data, weather)

  // Tomamos hasta los últimos 6 mensajes del historial
  const recentHistory = history.slice(-6).map((h) => ({
    role: h.role,
    content: h.content,
  }))

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentHistory,
    { role: 'user', content: userQuery },
  ]

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      messages,
      stream: true,
      options: {
        temperature: 0.7,
        num_predict: 600,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Error en Ollama (${response.status}): ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('Respuesta sin stream de Ollama')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let fullText = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const json = JSON.parse(trimmed) as {
          message?: { content?: string }
          done?: boolean
        }
        if (json.message?.content) {
          fullText += json.message.content
          onChunk(json.message.content, fullText)
        }
      } catch {
        // buffer incomplete chunk
      }
    }
  }

  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer.trim()) as {
        message?: { content?: string }
      }
      if (json.message?.content) {
        fullText += json.message.content
        onChunk(json.message.content, fullText)
      }
    } catch {
      // ignore
    }
  }

  return fullText.trim()
}

/**
 * Efecto máquina de escribir palabra a palabra para respuestas locales/fallback.
 */
export async function streamTextTypewriter(
  fullText: string,
  onProgress: (currentText: string) => void,
  intervalMs = 25,
): Promise<void> {
  const tokens = fullText.split(/(\s+)/)
  let current = ''
  for (let i = 0; i < tokens.length; i += 2) {
    const piece = tokens.slice(i, i + 2).join('')
    current += piece
    onProgress(current)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}
