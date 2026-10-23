/**
 * Asistente Inteligente Conversacional Local de LifeKeeper (100% privado y offline).
 * Interpreta consultas en lenguaje natural en español rioplatense/neutro sin depender de tildes o sintaxis estricta.
 * Soporta clima en tiempo real, lluvia hoy/semana, historia clínica completa, finanzas, medicación, biometría y más.
 */

import type { AppData } from '../../types'
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

export async function processAssistantQuery(query: string, data: AppData): Promise<AssistantMessage> {
  const norm = normalizeText(query)
  const now = new Date()
  const todayKey = toLocalDateKey(now)
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const createMsg = (text: string, action?: { label: string; hash: string }): AssistantMessage => ({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sender: 'assistant',
    text,
    timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    action,
  })

  // ==========================================
  // 1. CLIMA / LLUVIA / PRONÓSTICO (TIEMPO REAL)
  // ==========================================
  const isRainQuery = norm.includes('lluv') || norm.includes('llover') || norm.includes('llueve') || norm.includes('paragua') || norm.includes('torment')
  const isWeatherGeneral = norm.includes('clim') || norm.includes('tiemp') || norm.includes('temperat') || norm.includes('termomet') || norm.includes('calor') || norm.includes('frio') || norm.includes('pronostic')

  if (isRainQuery || isWeatherGeneral) {
    const weather = await fetchWeatherData(false)

    if (!weather) {
      return createMsg(
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
        return createMsg(
          `☀️ **No se prevén lluvias para esta semana en ${weather.city}.**\n\nTodos los días presentan probabilidades bajas (inferiores al 25%) con cielo predominantemente ${weather.description.toLowerCase()}.\n\n• **Rango térmico semanal:** ${Math.min(...weather.daily.map((d) => d.tempMin))}°C a ${Math.max(...weather.daily.map((d) => d.tempMax))}°C.`,
          { label: 'Ver widget en Dashboard', hash: '#dashboard' },
        )
      }

      const list = rainyDays
        .map((d) => `• 🌧️ **${formatDayName(d.date)} (${d.date.slice(8, 10)}/${d.date.slice(5, 7)}):** ${d.precipProb}% prob. — ${describeWeatherCode(d.code)} (Min: ${d.tempMin}°C / Max: ${d.tempMax}°C)`)
        .join('\n')

      return createMsg(
        `🌧️ **Pronóstico de lluvia para esta semana en ${weather.city}:**\n\nSe detectaron probabilidades significativas de precipitación en los siguientes días:\n\n${list}\n\n💡 El resto de los días se mantendrá con bajas probabilidades de lluvia.`,
        { label: 'Ver Pronóstico en Dashboard', hash: '#dashboard' },
      )
    }

    // B. ¿Va a llover hoy?
    if (isRainQuery) {
      const prob = todayForecast.precipProb
      const desc = describeWeatherCode(todayForecast.code)

      if (prob >= 60 || (todayForecast.code >= 51 && todayForecast.code <= 67) || todayForecast.code >= 80) {
        return createMsg(
          `🌧️ **Sí, es muy probable que llueva hoy en ${weather.city}.**\n\n• **Probabilidad de precipitación:** **${prob}%**\n• **Condición:** ${desc}\n• **Temperatura actual:** ${weather.temp}°C (Máx: ${todayForecast.tempMax}°C)\n\n🌂 ¡Llevá paraguas o impermeable antes de salir!`,
          { label: 'Ver Clima en Dashboard', hash: '#dashboard' },
        )
      }

      if (prob >= 25) {
        return createMsg(
          `🌦️ **Hay probabilidad moderada/baja de lluvia hoy en ${weather.city} (${prob}%).**\n\n• **Condición:** ${desc}\n• **Temperatura:** ${weather.temp}°C (Sensación: ${weather.apparentTemp}°C)\n• **Mín / Máx:** ${todayForecast.tempMin}°C / ${todayForecast.tempMax}°C\n\nPuede presentarse alguna llovizna o chaparrón aislado. Conviene salir con precaución.`,
          { label: 'Ver Clima en Dashboard', hash: '#dashboard' },
        )
      }

      return createMsg(
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

      return createMsg(
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

    return createMsg(
      `🌤️ **Clima actual en ${weather.city}:**\n\n• **Temperatura:** **${weather.temp}°C** (Sensación térmica: ${weather.apparentTemp}°C)\n• **Condición del cielo:** ${weather.description}\n• **Mínima / Máxima de hoy:** ${todayForecast.tempMin}°C / ${todayForecast.tempMax}°C\n• **Humedad:** ${weather.humidity}%\n• **Viento:** ${weather.windSpeed} km/h\n• **Probabilidad de lluvia:** ${todayForecast.precipProb}%\n\n${advice}`,
      { label: 'Ver Clima en Dashboard', hash: '#dashboard' },
    )
  }

  // ==========================================
  // 2. HISTORIA CLÍNICA / ANTECEDENTES / SALUD INTEGRAL
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

    // Ficha biológica SOS
    const bioParts: string[] = []
    if (ep.bloodType) bioParts.push(`**Grupo sanguíneo:** ${ep.bloodType}`)
    if (ep.allergies?.length) bioParts.push(`**Alergias:** ${ep.allergies.join(', ')}`)
    else bioParts.push('**Alergias:** Ninguna registrada')
    if (ep.conditions?.length) bioParts.push(`**Condiciones preexistentes:** ${ep.conditions.join(', ')}`)
    sections.push(`📋 **Ficha Base y Antecedentes:**\n• ${bioParts.join('\n• ')}`)

    // Medicación activa
    if (meds.length > 0) {
      const medList = meds.map((m) => `${m.name} (${m.dosage})`).join(', ')
      sections.push(`💊 **Tratamientos en curso (${meds.length}):** ${medList}`)
    } else {
      sections.push('💊 **Tratamientos en curso:** Sin tratamientos activos')
    }

    // Últimas notas clínicas
    if (notes.length > 0) {
      const sortedNotes = notes.slice().sort((a, b) => b.date.localeCompare(a.date))
      const recent = sortedNotes.slice(0, 3)
      const noteLines = recent.map((n) => `  • **${formatDate(n.date)}:** ${n.title} ${n.description ? `— ${n.description.slice(0, 70)}...` : ''}`).join('\n')
      sections.push(`📝 **Últimas notas del historial (${notes.length} en total):**\n${noteLines}`)
    }

    // Última consulta médica
    if (consults.length > 0) {
      const sortedConsults = consults.slice().sort((a, b) => b.date.localeCompare(a.date))
      const last = sortedConsults[0]
      sections.push(`🩺 **Última consulta médica registrada:**\n  • ${last.doctor} (${formatDate(last.date)})\n  • **Motivo:** ${last.reason}${last.diagnosis ? `\n  • **Diagnóstico:** ${last.diagnosis}` : ''}`)
    }

    // Vacunas
    if (vacs.length > 0) {
      sections.push(`💉 **Libreta de vacunas:** ${vacs.length} aplicaciones registradas`)
    }

    return createMsg(
      `🩺 **Resumen de tu Historia Clínica y Ficha Médica:**\n\n${sections.join('\n\n')}\n\nPodés ingresar a la sección de Historial Clínico para ver la línea de tiempo completa o adjuntar estudios.`,
      { label: 'Abrir Historial Clínico', hash: '#health:clinical' },
    )
  }

  // ==========================================
  // 3. SALUDOS Y AYUDA INICIAL
  // ==========================================
  if (
    ['hola', 'buen dia', 'buenas', 'buenas tardes', 'buenas noches', 'que tal', 'inicio', 'hello', 'hey', 'quien sos', 'ayuda'].some(
      (g) => norm.startsWith(g) || norm === g,
    )
  ) {
    const name = data.profile.nickName || data.profile.fullName || 'amigo'
    return createMsg(
      `¡Hola ${name}! 👋 Soy tu asistente personal e inteligente de LifeKeeper.\n\nPodés consultarme en lenguaje natural sobre cualquier tema de tu vida:\n• 🌦️ **Clima:** "¿Cómo está el clima hoy?", "¿va a llover hoy o esta semana?"\n• 🩺 **Salud:** "Decime mi historia clínica", "¿cuándo tengo médico?", "¿qué vacunas tengo?"\n• 💊 **Medicación:** "¿Qué pastillas tomo hoy?", "¿a qué hora tomo el remedio?"\n• 💳 **Finanzas:** "¿Cuánto gasté este mes?", "¿cómo vengo con la plata?", "¿cuánto ingresé?"\n• 💧 **Agua:** "¿Cuánta agua tomé hoy?", "¿estoy bien hidratado?"\n• 🔐 **Seguridad:** "¿Cómo están mis contraseñas?", "¿tengo claves débiles?"\n• 🗓️ **Recordatorios:** "¿Qué tengo que hacer hoy?", "¿qué pendientes tengo?"\n• ⚖️ **Biometría:** "¿Cómo está mi peso o IMC?"\n• 📋 **General:** "Haceme un resumen de cómo vengo"`,
    )
  }

  // ==========================================
  // 4. FINANZAS / GASTOS / PLATA / DINERO / BALANCE
  // ==========================================
  if (
    norm.includes('gast') || // gasté, gaste, gasto, gastos, gastar
    norm.includes('plat') || // plata, guita
    norm.includes('guita') ||
    norm.includes('diner') || // dinero
    norm.includes('financ') || // finanzas, financiero
    norm.includes('ingres') || // ingreso, ingresos
    norm.includes('balanc') || // balance
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

    // Chequear si preguntó por una categoría específica (ej. comida, supermercado, salidas)
    const categories = Array.from(new Set(monthTxs.map((t) => t.category.toLowerCase())))
    const mentionedCat = categories.find((c) => norm.includes(normalizeText(c)))

    if (mentionedCat) {
      const catSpent = monthTxs
        .filter((t) => t.type === 'expense' && t.category.toLowerCase() === mentionedCat)
        .reduce((s, t) => s + t.amount, 0)
      return createMsg(
        `💳 En lo que va del mes, tu gasto total en **"${mentionedCat}"** es de **$${catSpent.toLocaleString('es-AR')}**.`,
        { label: 'Ver movimientos en Finanzas', hash: '#personal:finances' },
      )
    }

    const state = balance >= 0 ? '🟢 Superávit neto' : '🔴 Déficit mensual'
    return createMsg(
      `📊 **Balance financiero de este mes:**\n\n• **Ingresos totales:** $${income.toLocaleString('es-AR')}\n• **Gastos / Egresos:** $${expense.toLocaleString('es-AR')}\n• **Balance disponible:** ${balance >= 0 ? '+' : ''}$${balance.toLocaleString('es-AR')} (${state})\n• **Movimientos registrados:** ${monthTxs.length}\n\n¿Querés revisar las transacciones detalladas o registrar un nuevo gasto?`,
      { label: 'Ir a Finanzas', hash: '#personal:finances' },
    )
  }

  // ==========================================
  // 5. MEDICACIÓN / PASTILLAS / REMEDIOS / TRATAMIENTOS
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
      return createMsg(
        '💊 No tenés tratamientos médicos activos registrados en este momento.\n\nPodés ingresar a la sección de Medicación para cargar un tratamiento con sus horarios programados.',
        { label: 'Cargar Medicación', hash: '#health:medications' },
      )
    }

    const lines: string[] = []
    activeMeds.forEach((m) => {
      const schedules = m.schedules.map((s) => s.time).join(', ')
      lines.push(`• **${m.name}** (${m.dosage}) — Horarios: ${schedules || 'A demanda'}${m.instructions ? ` · Indicación: ${m.instructions}` : ''}`)
    })

    return createMsg(
      `💊 **Tenés ${activeMeds.length} tratamiento(s) médico(s) activo(s):**\n\n${lines.join('\n')}\n\nRecordá registrar cada toma diaria para mantener al día el historial.`,
      { label: 'Gestionar Medicación', hash: '#health:medications' },
    )
  }

  // ==========================================
  // 6. HIDRATACIÓN / AGUA / LÍQUIDOS
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

    return createMsg(
      `💧 **Monitoreo de Hidratación de Hoy:**\n\n• **Consumo registrado:** **${current} ml** de **${target} ml** (**${pct}%**)\n\n${advice}`,
      { label: 'Registrar agua tomada', hash: '#health:hydration' },
    )
  }

  // ==========================================
  // 7. PESO / IMC / BIOMETRÍA / ALTURA
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
    if (!w || !h) {
      return createMsg(
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

    return createMsg(
      `⚖️ **Tus métricas biométricas actuales:**\n\n• **Peso:** ${w} kg\n• **Altura:** ${h} cm\n• **Índice de Masa Corporal (IMC):** **${imc.toFixed(1)} kg/m²** ${emoji} (${cat})\n\nPodés registrar una actualización cuando quieras desde el Perfil o desde el widget del Dashboard.`,
      { label: 'Ver Perfil Biométrico', hash: '#profile:settings' },
    )
  }

  // ==========================================
  // 8. CONTRASEÑAS / SEGURIDAD / CLAVES / HACKEOS
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
    return createMsg(
      `🔐 **Estado de tu Gestor de Contraseñas:**\n\n• **Total de credenciales guardadas:** ${pwds.length}\n• **Contraseñas cortas (<12 caracteres):** ${weak} ${weak > 0 ? '⚠️ (conviene robustecerlas)' : '✅ Todas robustas'}\n• **Cifrado local:** AES-256-GCM Zero-Knowledge.\n\nPodés auditar si alguna de tus claves se filtró en la web con el botón de auditoría HIBP.`,
      { label: 'Ir al Gestor de Contraseñas', hash: '#security:passwords' },
    )
  }

  // ==========================================
  // 9. RECORDATORIOS / TAREAS / PENDIENTES / AGENDA
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
      return createMsg(
        `🗓️ **Tenés ${todayRem.length} recordatorio(s) programado(s) para hoy:**\n\n${list}`,
        { label: 'Ver todos los recordatorios', hash: '#utilities:reminders' },
      )
    }

    return createMsg(
      active.length > 0
        ? `No tenés recordatorios programados para hoy, pero sí **${active.length} activos** en el calendario futuro.`
        : '✨ ¡Estás completamente al día! No tenés recordatorios ni tareas pendientes en tu lista.',
      { label: 'Ver Recordatorios', hash: '#utilities:reminders' },
    )
  }

  // ==========================================
  // 10. CONSULTAS MÉDICAS / TURNOS / DOCTORES
  // ==========================================
  if (norm.includes('doctor') || norm.includes('medic') || norm.includes('consult') || norm.includes('turno') || norm.includes('especialista')) {
    const upcoming = data.health.consultations
      .filter((c) => toLocalDateKey(c.date) >= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date))

    if (upcoming.length > 0) {
      const next = upcoming[0]
      return createMsg(
        `🩺 **Tu próxima consulta médica programada:**\n\n• **Motivo:** ${next.reason || 'Consulta general'}\n• **Profesional:** ${next.doctor}\n• **Fecha:** ${formatDate(next.date)}\n\n¿Querés revisar el historial de consultas anteriores?`,
        { label: 'Ver Consultas Médicas', hash: '#health:consultations' },
      )
    }

    return createMsg(
      `🩺 Tenés un total de **${data.health.consultations.length} consultas** registradas en tu historial clínico, y ninguna pendiente a futuro próximo.`,
      { label: 'Registrar nueva consulta', hash: '#health:consultations' },
    )
  }

  // ==========================================
  // 11. VACUNAS
  // ==========================================
  if (norm.includes('vacun') || norm.includes('refuerz') || norm.includes('inmun') || norm.includes('carnet')) {
    const total = data.health.vaccines.length
    const nextVaccines = data.health.vaccines.filter((v) => v.nextDoseDate && toLocalDateKey(v.nextDoseDate) >= todayKey)

    return createMsg(
      `💉 **Tu libreta de vacunación:**\n\n• **Total aplicadas:** ${total}\n• **Próximos refuerzos:** ${nextVaccines.length > 0 ? nextVaccines.map((v) => `\n  • ${v.vaccine}: ${formatDate(v.nextDoseDate!)}`).join('') : 'No tenés refuerzos próximos agendados.'}`,
      { label: 'Ver Vacunas', hash: '#health:vaccines' },
    )
  }

  // ==========================================
  // 12. VEHÍCULOS / AUTO / MOTO / SERVICE
  // ==========================================
  if (norm.includes('auto') || norm.includes('vehicul') || norm.includes('servic') || norm.includes('kilometr') || norm.includes('km') || norm.includes('moto') || norm.includes('camioneta') || norm.includes('aceite')) {
    const v = data.personal.vehicles
    if (v.length === 0) {
      return createMsg('Todavía no registraste vehículos ni mantenimientos en tu bóveda.', {
        label: 'Cargar Vehículo',
        hash: '#personal:vehicles',
      })
    }
    const lastService = v.slice().sort((a, b) => b.date.localeCompare(a.date))[0]
    return createMsg(
      `🚗 **Información de vehículos y mantenimientos:**\n\n• **Total de servicios registrados:** ${v.length}\n• **Último registro:** ${lastService.vehicleName} (${lastService.serviceType})\n• **Fecha del servicio:** ${formatDate(lastService.date)}${lastService.mileage ? `\n• **Kilometraje:** ${lastService.mileage.toLocaleString('es-AR')} km` : ''}${lastService.nextServiceDate ? `\n• **Próximo service:** ${formatDate(lastService.nextServiceDate)}` : ''}`,
      { label: 'Ver Mantenimiento Vehicular', hash: '#personal:vehicles' },
    )
  }

  // ==========================================
  // 13. ESTADO DE ÁNIMO / DIARIO
  // ==========================================
  if (norm.includes('anim') || norm.includes('humor') || norm.includes('sent') || norm.includes('diari') || norm.includes('nota') || norm.includes('emocion')) {
    const entries = data.diary.entries
    const lastEntry = entries.length > 0 ? entries.slice().sort((a, b) => b.date.localeCompare(a.date))[0] : null

    return createMsg(
      `📓 **Tu Diario Personal y Estado de Ánimo:**\n\n• **Entradas escritas:** ${entries.length}\n• **Último estado registrado:** ${lastEntry ? `${lastEntry.mood} (el ${formatDate(lastEntry.date)})` : 'Aún no registraste tu ánimo hoy'}\n\n¿Querés dejar una reflexión o escribir cómo te sentís hoy?`,
      { label: 'Abrir Diario', hash: '#diary:notes' },
    )
  }

  // ==========================================
  // 14. ENTRENAMIENTOS / RUTINA DEPORTIVA / GYM
  // ==========================================
  if (norm.includes('entren') || norm.includes('gym') || norm.includes('gimnasio') || norm.includes('rutina') || norm.includes('ejercicio') || norm.includes('workout')) {
    const workouts = data.personal.workouts ?? []
    const thisMonth = workouts.filter((w) => w.date.startsWith(currentMonth))
    const lastWorkout = workouts.slice().sort((a, b) => b.date.localeCompare(a.date))[0]

    return createMsg(
      `🏋️ **Tus entrenamientos y actividad física:**\n\n• **Sesiones este mes:** ${thisMonth.length}\n• **Total histórico:** ${workouts.length} sesiones\n• **Último entrenamiento:** ${lastWorkout ? `${lastWorkout.title} (${lastWorkout.type}) el ${formatDate(lastWorkout.date)}` : 'Aún no cargaste sesiones de entrenamiento'}\n\n¡La constancia física es el pilar de tu bienestar!`,
      { label: 'Ver Entrenamientos', hash: '#personal:workouts' },
    )
  }

  // ==========================================
  // 15. PROYECTOS / METAS
  // ==========================================
  if (norm.includes('proyect') || norm.includes('meta') || norm.includes('tare') || norm.includes('objetiv')) {
    const projs = data.personal.projects
    return createMsg(
      `🎯 Tenés **${projs.length} proyecto(s)** en seguimiento.\n\nPodés ingresar a la sección de Proyectos para gestionar el checklist de tareas y medir el porcentaje de avance.`,
      { label: 'Ver Proyectos', hash: '#personal:projects' },
    )
  }

  // ==========================================
  // 16. VAULT HEALTH SCORE
  // ==========================================
  if (norm.includes('score') || norm.includes('puntaj') || norm.includes('nivel') || norm.includes('salud de la boveda')) {
    const res = computeVaultHealthScore(data)
    return createMsg(
      `🏆 **Tu Vault Health Score es ${res.totalScore}/100 (${res.levelLabel}):**\n\n• **Seguridad:** ${res.pillars.security.score}/25\n• **Salud:** ${res.pillars.health.score}/25\n• **Finanzas:** ${res.pillars.finances.score}/25\n• **Bienestar:** ${res.pillars.wellness.score}/25\n\n💡 **Recomendación clave:** ${res.topRecommendations[0] || '¡Excelente balance integral en tu bóveda!'}`,
      { label: 'Ver Métricas en Dashboard', hash: '#dashboard' },
    )
  }

  // ==========================================
  // 17. RESUMEN GENERAL / COMPLETO
  // ==========================================
  if (norm.includes('resumen') || norm.includes('general') || norm.includes('todo') || norm.includes('como vengo')) {
    const score = computeVaultHealthScore(data)
    const activeMeds = data.health.medications.filter((m) => m.active).length
    const activeReminders = data.utilities.reminders.filter((r) => !r.done).length

    return createMsg(
      `📋 **Resumen Integral de tu Bóveda LifeKeeper:**\n\n• **Puntaje de salud integral:** ${score.totalScore}/100 (${score.levelLabel})\n• **Tratamientos activos:** ${activeMeds}\n• **Recordatorios pendientes:** ${activeReminders}\n• **Contraseñas resguardadas:** ${data.security.passwordEntries.length}\n• **Reflexiones en diario:** ${data.diary.entries.length}\n\n¿Querés profundizar en alguna de estas áreas?`,
      { label: 'Ir al Dashboard', hash: '#dashboard' },
    )
  }

  // ==========================================
  // FALLBACK INTELIGENTE CONVERSACIONAL
  // ==========================================
  return createMsg(
    `Comprendo tu consulta sobre **"${query}"**, pero no tengo una regla directa o datos asociados a esa frase exacta en tu bóveda.\n\nComo tu asistente personal de LifeKeeper, puedo responderte de inmediato sobre:\n\n• 🌦️ **Clima:** "¿Cómo está el clima hoy?", "¿va a llover hoy?", "¿va a llover esta semana?"\n• 🩺 **Salud:** "Decime mi historia clínica", "¿cuándo tengo turno?", "mis vacunas"\n• 💊 **Medicación:** "¿Qué pastillas tomo hoy?", "¿a qué hora?"\n• 💳 **Finanzas:** "¿Cuánto gasté este mes?", "¿cuánto ingresé?", "¿cuánto me queda?"\n• 💧 **Agua:** "¿Cuánta agua tomé hoy?"\n• 🔐 **Seguridad:** "¿Cómo están mis contraseñas?"\n• 🗓️ **Recordatorios:** "¿Qué tengo que hacer hoy?"\n• 📋 **General:** "Haceme un resumen general"`,
    { label: 'Ver Resumen General', hash: '#dashboard' },
  )
}
