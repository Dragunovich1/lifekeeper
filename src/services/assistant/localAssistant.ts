/**
 * Asistente Inteligente Conversacional Local de LifeKeeper (100% privado y offline).
 * Interpreta consultas en lenguaje natural en español y responde con datos reales de la bóveda.
 */

import type { AppData } from '../../types'
import { toLocalDateKey } from '../../utils/dates'
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

export function processAssistantQuery(query: string, data: AppData): AssistantMessage {
  const q = query.trim().toLowerCase()
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

  // 1. SALUDOS Y AYUDA
  if (['hola', 'buen día', 'buenas', 'que tal', 'inicio', 'hello'].some((g) => q.startsWith(g))) {
    const name = data.profile.nickName || data.profile.fullName || 'amigo'
    return createMsg(
      `¡Hola ${name}! Soy tu asistente personal de LifeKeeper. Podés preguntarme cosas como:\n• "¿Cuánto gasté este mes?"\n• "¿Qué pastilla tengo que tomar hoy?"\n• "¿Cuánta agua tomé hoy?"\n• "¿Tengo contraseñas débiles o hackeadas?"\n• "¿Cómo está el puntaje de mi bóveda?"`,
    )
  }

  // 2. FINANZAS / GASTOS
  if (
    q.includes('gasto') ||
    q.includes('gasté') ||
    q.includes('gastos') ||
    q.includes('plata') ||
    q.includes('dinero') ||
    q.includes('finanza') ||
    q.includes('balance') ||
    q.includes('ingreso')
  ) {
    const monthTxs = data.personal.finances.filter((t) => t.date.startsWith(currentMonth))
    const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const balance = income - expense

    // Búsqueda por categoría específica
    const categories = Array.from(new Set(monthTxs.map((t) => t.category.toLowerCase())))
    const mentionedCat = categories.find((c) => q.includes(c))

    if (mentionedCat) {
      const catSpent = monthTxs
        .filter((t) => t.type === 'expense' && t.category.toLowerCase() === mentionedCat)
        .reduce((s, t) => s + t.amount, 0)
      return createMsg(
        `En lo que va del mes, registrás un gasto de $${catSpent.toLocaleString('es-AR')} en la categoría "${mentionedCat}".`,
        { label: 'Ver movimientos de finanzas', hash: '#personal:finances' },
      )
    }

    return createMsg(
      `Resumen financiero del mes actual:\n• Ingresos: $${income.toLocaleString('es-AR')}\n• Egresos: $${expense.toLocaleString('es-AR')}\n• Balance neto: ${balance >= 0 ? '+' : ''}$${balance.toLocaleString('es-AR')} (${balance >= 0 ? 'Superávit' : 'Déficit'}).`,
      { label: 'Ir a Finanzas', hash: '#personal:finances' },
    )
  }

  // 3. MEDICACIÓN / TOMAS
  if (
    q.includes('pastilla') ||
    q.includes('remedio') ||
    q.includes('medicacion') ||
    q.includes('medicación') ||
    q.includes('tomar') ||
    q.includes('dosis')
  ) {
    const activeMeds = data.health.medications.filter((m) => m.active)
    if (activeMeds.length === 0) {
      return createMsg('No tenés tratamientos médicos activos registrados en este momento.', {
        label: 'Ver Medicaciones',
        hash: '#health:medications',
      })
    }

    const lines: string[] = []
    activeMeds.forEach((m) => {
      const schedules = m.schedules.map((s) => s.time).join(', ')
      lines.push(`• ${m.name} (${m.dosage}): horarios ${schedules || 'a demanda'}`)
    })

    return createMsg(
      `Tenés ${activeMeds.length} tratamiento(s) activo(s) para hoy:\n${lines.join('\n')}`,
      { label: 'Gestionar tomas', hash: '#health:medications' },
    )
  }

  // 4. HIDRATACIÓN / AGUA
  if (q.includes('agua') || q.includes('hidratacion') || q.includes('hidratación') || q.includes('liquido')) {
    const todayLog = (data.health.hydrationLogs ?? []).find((l) => l.date === todayKey)
    const target = data.health.hydrationTargetMl ?? 2500
    const current = todayLog?.amountMl ?? 0
    const pct = Math.round((current / target) * 100)

    return createMsg(
      `Hoy llevás registrados ${current} ml de agua de tu meta de ${target} ml (${pct}% cumplido). ${
        pct >= 100 ? '¡Excelente trabajo hidratándote hoy!' : `Te faltan ${Math.max(0, target - current)} ml para completar el objetivo.`
      }`,
      { label: 'Registrar agua', hash: '#health:hydration' },
    )
  }

  // 5. PESO / IMC / BIOMETRÍA
  if (q.includes('peso') || q.includes('imc') || q.includes('altura') || q.includes('kilo')) {
    const w = data.profile.weightKg
    const h = data.profile.heightCm
    if (!w || !h) {
      return createMsg('Todavía no cargaste tu peso o altura en tu perfil.', {
        label: 'Actualizar en Perfil',
        hash: '#profile',
      })
    }

    const heightM = h / 100
    const imc = w / (heightM * heightM)
    let cat = 'Normal'
    if (imc < 18.5) cat = 'Bajo peso'
    else if (imc < 25) cat = 'Normal'
    else if (imc < 30) cat = 'Sobrepeso'
    else cat = 'Obesidad'

    return createMsg(
      `Tus datos biométricos actuales son:\n• Peso: ${w} kg\n• Altura: ${h} cm\n• Índice de Masa Corporal (IMC): ${imc.toFixed(1)} (${cat}).`,
      { label: 'Ver perfil biométrico', hash: '#profile' },
    )
  }

  // 6. CONTRASEÑAS / SEGURIDAD / HACKEOS
  if (
    q.includes('clave') ||
    q.includes('contraseña') ||
    q.includes('password') ||
    q.includes('seguridad') ||
    q.includes('hack') ||
    q.includes('filtr')
  ) {
    const pwds = data.security.passwordEntries
    const weak = pwds.filter((p) => p.password.length < 12).length
    return createMsg(
      `Tenés un total de ${pwds.length} contraseñas cifradas en tu bóveda. ${
        weak > 0
          ? `Detectamos ${weak} contraseñas con menos de 12 caracteres que convendría robustecer.`
          : 'Tus credenciales mantienen una longitud adecuada.'
      } Podés usar la auditoría HIBP para verificar filtraciones públicas.`,
      { label: 'Ir al Gestor de contraseñas', hash: '#security:passwords' },
    )
  }

  // 7. RECORDATORIOS / PENDIENTES
  if (q.includes('recordatorio') || q.includes('pendiente') || q.includes('vence') || q.includes('alarma')) {
    const active = data.utilities.reminders.filter((r) => !r.done)
    const todayRem = active.filter((r) => toLocalDateKey(r.dateTime) === todayKey)

    if (todayRem.length > 0) {
      const list = todayRem.map((r) => `• ${r.title}`).join('\n')
      return createMsg(`Tenés ${todayRem.length} recordatorio(s) programados para hoy:\n${list}`, {
        label: 'Ver recordatorios',
        hash: '#utilities:reminders',
      })
    }

    return createMsg(
      active.length > 0
        ? `No tenés recordatorios para hoy, pero sí ${active.length} activos a futuro.`
        : 'Estás al día, no hay recordatorios pendientes en la lista.',
      { label: 'Ver recordatorios', hash: '#utilities:reminders' },
    )
  }

  // 8. VAULT SCORE / SALUD DE LA BÓVEDA
  if (q.includes('score') || q.includes('puntaje') || q.includes('nivel') || q.includes('salud de la boveda')) {
    const res = computeVaultHealthScore(data)
    return createMsg(
      `Tu Vault Health Score actual es de ${res.totalScore}/100 (${res.levelLabel}).\n• Seguridad: ${res.pillars.security.score}/25\n• Salud: ${res.pillars.health.score}/25\n• Finanzas: ${res.pillars.finances.score}/25\n• Bienestar: ${res.pillars.wellness.score}/25\n\nConsejo principal: ${res.topRecommendations[0] || '¡Excelente estado de tu bóveda!'}`,
      { label: 'Ver Dashboard', hash: '#dashboard' },
    )
  }

  // 9. RESUMEN GENERAL / SEMANAL
  if (q.includes('resumen') || q.includes('semana') || q.includes('todo')) {
    const score = computeVaultHealthScore(data)
    const activeMeds = data.health.medications.filter((m) => m.active).length
    const activeReminders = data.utilities.reminders.filter((r) => !r.done).length

    return createMsg(
      `📋 Resumen general de tu Bóveda LifeKeeper:\n• Estado integral: ${score.totalScore}/100 (${score.levelLabel})\n• Tratamientos activos: ${activeMeds}\n• Recordatorios pendientes: ${activeReminders}\n• Contraseñas protegidas: ${data.security.passwordEntries.length}\n• Notas del diario: ${data.diary.entries.length}`,
      { label: 'Ir al Dashboard', hash: '#dashboard' },
    )
  }

  // Fallback inteligente
  return createMsg(
    `Entendí tu consulta sobre "${query}". Podés preguntarme por tus **finanzas**, **medicaciones**, **agua**, **contraseñas**, **recordatorios** o pedirme un **resumen general**.`,
  )
}
