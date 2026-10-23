/**
 * Asistente Inteligente Conversacional Local de LifeKeeper (100% privado y offline).
 * Interpreta consultas en lenguaje natural en español rioplatense/neutro sin depender de tildes o sintaxis estricta.
 */

import type { AppData } from '../../types'
import { toLocalDateKey, formatDate } from '../../utils/dates'
import { computeVaultHealthScore } from '../../utils/vaultScore'

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

export function processAssistantQuery(query: string, data: AppData): AssistantMessage {
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

  // 1. SALUDOS Y AYUDA INICIAL
  if (
    ['hola', 'buen dia', 'buenas', 'que tal', 'inicio', 'hello', 'hey', 'quien sos', 'ayuda'].some((g) =>
      norm.startsWith(g) || norm === g,
    )
  ) {
    const name = data.profile.nickName || data.profile.fullName || 'amigo'
    return createMsg(
      `¡Hola ${name}! 👋 Soy tu asistente personal de LifeKeeper.\n\nPodés preguntarme de forma natural sobre cualquier aspecto de tu vida:\n• "¿Cuánto gasté este mes?" o "¿cómo vengo con la plata?"\n• "¿Qué pastillas tomo hoy?" o "¿a qué hora tomo el remedio?"\n• "¿Cuánta agua tomé?" o "¿estoy bien hidratado?"\n• "¿Tengo contraseñas débiles?" o "¿mis claves están seguras?"\n• "¿Qué tengo que hacer hoy?" o "¿qué recordatorios tengo?"\n• "¿Cómo está el puntaje de mi bóveda?"`,
    )
  }

  // 2. FINANZAS / GASTOS / PLATA / DINERO
  if (
    norm.includes('gast') || // gasté, gaste, gasto, gastos, gastar
    norm.includes('plat') || // plata
    norm.includes('diner') || // dinero
    norm.includes('financ') || // finanzas, financiero
    norm.includes('ingres') || // ingreso, ingresos
    norm.includes('balanc') || // balance
    norm.includes('cuanto tengo') ||
    norm.includes('cuanto me queda') ||
    norm.includes('egres') ||
    norm.includes('sueldo')
  ) {
    const monthTxs = data.personal.finances.filter((t) => t.date.startsWith(currentMonth))
    const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const balance = income - expense

    // Chequear si preguntó por una categoría específica (ej. "cuanto gasté en comida", "salidas", "super")
    const categories = Array.from(new Set(monthTxs.map((t) => t.category.toLowerCase())))
    const mentionedCat = categories.find((c) => norm.includes(normalizeText(c)))

    if (mentionedCat) {
      const catSpent = monthTxs
        .filter((t) => t.type === 'expense' && t.category.toLowerCase() === mentionedCat)
        .reduce((s, t) => s + t.amount, 0)
      return createMsg(
        `💳 En lo que va del mes actual, registrás un total gastado de **$${catSpent.toLocaleString('es-AR')}** en la categoría **"${mentionedCat}"**.`,
        { label: 'Ver movimientos en Finanzas', hash: '#personal:finances' },
      )
    }

    const state = balance >= 0 ? '🟢 Superávit' : '🔴 Déficit'
    return createMsg(
      `📊 **Resumen financiero de este mes:**\n\n• **Ingresos totales:** $${income.toLocaleString('es-AR')}\n• **Gastos / Egresos:** $${expense.toLocaleString('es-AR')}\n• **Balance neto:** ${balance >= 0 ? '+' : ''}$${balance.toLocaleString('es-AR')} (${state})\n\n¿Querés revisar los movimientos detallados o cargar un nuevo gasto?`,
      { label: 'Ir a Finanzas', hash: '#personal:finances' },
    )
  }

  // 3. MEDICACIÓN / PASTILLAS / REMEDIOS / TRATAMIENTOS
  if (
    norm.includes('pastill') || // pastilla, pastillas
    norm.includes('remedi') || // remedio, remedios
    norm.includes('medic') || // medicación, medicacion, medicamento, medicamentos
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
      lines.push(`• **${m.name}** (${m.dosage}) — Horarios: ${schedules || 'A demanda'}`)
    })

    return createMsg(
      `💊 **Tenés ${activeMeds.length} tratamiento(s) médico(s) activo(s):**\n\n${lines.join('\n')}\n\nRecordá registrar cada toma para mantener la constancia en tu historial.`,
      { label: 'Gestionar tomas de hoy', hash: '#health:medications' },
    )
  }

  // 4. HIDRATACIÓN / AGUA / LÍQUIDOS
  if (
    norm.includes('agu') || // agua
    norm.includes('hidrat') || // hidratación, hidratacion, hidratarme
    norm.includes('liquid') || // líquido, liquido
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
      `💧 **Monitoreo de Hidratación de Hoy:**\n\n• **Consumo actual:** ${current} ml de ${target} ml (**${pct}%**)\n\n${advice}`,
      { label: 'Registrar agua tomada', hash: '#health:hydration' },
    )
  }

  // 5. PESO / IMC / BIOMETRÍA / ALTURA
  if (
    norm.includes('pes') || // peso, pesé, pesar
    norm.includes('imc') ||
    norm.includes('altur') || // altura
    norm.includes('kilo') ||
    norm.includes('corporal')
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
      `⚖️ **Tus métricas biométricas actuales:**\n\n• **Peso:** ${w} kg\n• **Altura:** ${h} cm\n• **Índice de Masa Corporal (IMC):** ${imc.toFixed(1)} kg/m² ${emoji} (${cat})\n\nPodés actualizar tu peso periódicamente desde tu perfil o desde el widget del Dashboard.`,
      { label: 'Ver Perfil Biométrico', hash: '#profile:settings' },
    )
  }

  // 6. CONTRASEÑAS / SEGURIDAD / HACKEOS / CLAVES
  if (
    norm.includes('clav') || // clave, claves
    norm.includes('contrasen') || // contraseña, contrasenas, contraseñas
    norm.includes('password') ||
    norm.includes('segur') || // seguridad
    norm.includes('hack') ||
    norm.includes('filtr')
  ) {
    const pwds = data.security.passwordEntries
    const weak = pwds.filter((p) => p.password.length < 12).length
    return createMsg(
      `🔐 **Estado de tu Gestor de Contraseñas:**\n\n• **Total de credenciales guardadas:** ${pwds.length}\n• **Contraseñas cortas (<12 caracteres):** ${weak} ${weak > 0 ? '⚠️ (conviene robustecerlas)' : '✅'}\n• **Cifrado local:** AES-256-GCM Zero-Knowledge.\n\nPodés auditar si alguna de tus claves se filtró en la web con el botón de auditoría HIBP.`,
      { label: 'Ir al Gestor de Contraseñas', hash: '#security:passwords' },
    )
  }

  // 7. RECORDATORIOS / TAREAS / PENDIENTES / QUÉ TENGO QUE HACER
  if (
    norm.includes('record') || // recordatorio, recordatorios
    norm.includes('pendient') || // pendiente, pendientes
    norm.includes('hacer') ||
    norm.includes('tengo hoy') ||
    norm.includes('venc') || // vence, vencimiento
    norm.includes('alarm') // alarma, alarmas
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

  // 8. CONSULTAS MÉDICAS / DOCTORES / TURNOS
  if (norm.includes('doctor') || norm.includes('medic') || norm.includes('consult') || norm.includes('turno')) {
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

  // 9. VACUNAS
  if (norm.includes('vacun') || norm.includes('refuerz') || norm.includes('inmun')) {
    const total = data.health.vaccines.length
    const nextVaccines = data.health.vaccines.filter((v) => v.nextDoseDate && toLocalDateKey(v.nextDoseDate) >= todayKey)

    return createMsg(
      `💉 **Tu libreta de vacunación:**\n\n• **Total aplicadas:** ${total}\n• **Próximos refuerzos:** ${nextVaccines.length > 0 ? nextVaccines.map((v) => `\n  • ${v.vaccine}: ${formatDate(v.nextDoseDate!)}`).join('') : 'No tenés refuerzos próximos agendados.'}`,
      { label: 'Ver Vacunas', hash: '#health:vaccines' },
    )
  }

  // 10. VEHÍCULOS / AUTO / SERVICE
  if (norm.includes('auto') || norm.includes('vehicul') || norm.includes('servic') || norm.includes('kilometr') || norm.includes('km')) {
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

  // 11. ESTADO DE ÁNIMO / DIARIO
  if (norm.includes('anim') || norm.includes('humor') || norm.includes('sent') || norm.includes('diari') || norm.includes('nota')) {
    const entries = data.diary.entries
    const lastEntry = entries.length > 0 ? entries.slice().sort((a, b) => b.date.localeCompare(a.date))[0] : null

    return createMsg(
      `📓 **Tu Diario Personal y Estado de Ánimo:**\n\n• **Entradas escritas:** ${entries.length}\n• **Último estado registrado:** ${lastEntry ? `${lastEntry.mood} (el ${formatDate(lastEntry.date)})` : 'Aún no registraste tu ánimo hoy'}\n\n¿Querés dejar una reflexión o escribir cómo te sentís hoy?`,
      { label: 'Abrir Diario', hash: '#diary:notes' },
    )
  }

  // 12. PROYECTOS / METAS
  if (norm.includes('proyect') || norm.includes('meta') || norm.includes('tare')) {
    const projs = data.personal.projects
    return createMsg(
      `🎯 Tenés **${projs.length} proyecto(s)** en seguimiento.\n\nPodés ingresar a la sección de Proyectos para gestionar el checklist de tareas y medir el porcentaje de avance.`,
      { label: 'Ver Proyectos', hash: '#personal:projects' },
    )
  }

  // 13. VAULT HEALTH SCORE
  if (norm.includes('score') || norm.includes('puntaj') || norm.includes('nivel') || norm.includes('salud de la boveda')) {
    const res = computeVaultHealthScore(data)
    return createMsg(
      `🏆 **Tu Vault Health Score es ${res.totalScore}/100 (${res.levelLabel}):**\n\n• **Seguridad:** ${res.pillars.security.score}/25\n• **Salud:** ${res.pillars.health.score}/25\n• **Finanzas:** ${res.pillars.finances.score}/25\n• **Bienestar:** ${res.pillars.wellness.score}/25\n\n💡 **Recomendación clave:** ${res.topRecommendations[0] || '¡Excelente balance integral en tu bóveda!'}`,
      { label: 'Ver Métricas en Dashboard', hash: '#dashboard' },
    )
  }

  // 14. RESUMEN GENERAL / COMPLETO
  if (norm.includes('resumen') || norm.includes('general') || norm.includes('todo') || norm.includes('como vengo')) {
    const score = computeVaultHealthScore(data)
    const activeMeds = data.health.medications.filter((m) => m.active).length
    const activeReminders = data.utilities.reminders.filter((r) => !r.done).length

    return createMsg(
      `📋 **Resumen Integral de tu Bóveda LifeKeeper:**\n\n• **Puntaje de salud integral:** ${score.totalScore}/100 (${score.levelLabel})\n• **Tratamientos activos:** ${activeMeds}\n• **Recordatorios pendientes:** ${activeReminders}\n• **Contraseñas resguardadas:** ${data.security.passwordEntries.length}\n• **Reflexiones en diario:** ${data.diary.entries.length}\n\n¿Querés profundizar en alguna de estas áreas?`,
      { label: 'Ir al Dashboard', hash: '#dashboard' },
    )
  }

  // Fallback inteligente y orientativo
  return createMsg(
    `No encontré un registro exacto para "${query}", pero puedo responderte al instante sobre:\n\n• 📊 **Finanzas:** "¿Cuánto gasté este mes?", "¿cuánto ingresé?"\n• 💊 **Medicación:** "¿Qué pastillas tomo hoy?", "¿a qué hora?"\n• 💧 **Agua:** "¿Cuánta agua tomé hoy?"\n• 🔐 **Seguridad:** "¿Cómo están mis contraseñas?"\n• 🗓️ **Recordatorios:** "¿Qué tengo pendiente para hoy?"\n• ⚖️ **Biometría:** "¿Cómo está mi peso o IMC?"\n• 🩺 **Salud:** "¿Cuándo es mi próxima consulta o vacuna?"\n• 📋 **General:** "Haceme un resumen"`,
  )
}
