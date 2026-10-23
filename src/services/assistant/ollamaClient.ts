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

  // 3. Finanzas del mes
  const monthTxs = data.personal.finances.filter((t) => t.date.startsWith(currentMonth))
  const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense

  // 4. Recordatorios
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

  return `Sos el Asistente Personal Inteligente de LifeKeeper, la bóveda personal privada y encriptada del usuario.
Tu objetivo es responder de forma inteligente, natural, precisa y empática en español (tono argentino/latinoamericano cercano, amigable y respetuoso).
Entendés cualquier pregunta, modismo, falta de ortografía o frase informal sin importar cómo esté dicha.

DATOS ACTUALES DE LA BÓVEDA DEL USUARIO (CONFIDENCIAL Y PRIVADO):
- Fecha y hora actual: ${now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.
- Usuario: ${name} (Email: ${p.auth?.email || 'No registrado'})
- Biometría: Peso: ${weight}, Altura: ${height}${imc ? `, IMC: ${imc}` : ''}.
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
- Recordatorios y Tareas pendientes:
  • Para hoy (${todayReminders.length}): ${todayReminders.map((r) => `${r.title} a las ${r.dateTime.slice(11, 16)}`).join(', ') || 'Ninguno para hoy'}
  • Total activos: ${activeReminders.length}
- Seguridad: ${data.security.passwordEntries.length} contraseñas resguardadas (cifrado local Zero-Knowledge).
- Vehículos: ${data.personal.vehicles.map((v) => `${v.vehicleName} (${v.serviceType}, km: ${v.mileage || 'N/A'})`).join('; ') || 'Ninguno'}
- Clima y Meteorología en Tiempo Real: ${weatherText}

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
 * Envía la conversación a Ollama y retorna la respuesta generada por el LLM.
 */
export async function queryOllama(
  userQuery: string,
  history: ChatHistoryItem[],
  data: AppData,
  modelName: string,
): Promise<string> {
  let weather: WeatherData | null = null
  try {
    weather = await fetchWeatherData(false)
  } catch {
    // ignore
  }

  const systemPrompt = buildVaultSystemPrompt(data, weather)

  // Tomamos hasta los últimos 6 mensajes del historial para no saturar la ventana de contexto
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
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 600,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Error en Ollama (${response.status}): ${response.statusText}`)
  }

  const result = (await response.json()) as {
    message?: { content: string }
  }

  if (!result.message?.content) {
    throw new Error('Respuesta vacía recibida desde Ollama')
  }

  return result.message.content.trim()
}
