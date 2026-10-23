/**
 * Motor de cálculo del Vault Health Score (0 a 100).
 * Evalúa 4 pilares:
 * 1. Seguridad (25 pts)
 * 2. Salud y Hábitos (25 pts)
 * 3. Finanzas (25 pts)
 * 4. Constancia y Bienestar (25 pts)
 */

import type { AppData } from '../types'
import { toLocalDateKey, safeParseDate } from './dates'
import { differenceInCalendarDays } from 'date-fns'

export interface PillarScore {
  name: string
  score: number
  maxScore: number
  percent: number
  status: 'critical' | 'warning' | 'good' | 'excellent'
  badgeClass: string
  tips: string[]
}

export interface VaultHealthScoreResult {
  totalScore: number // 0 a 100
  levelLabel: string
  levelBadgeClass: string
  pillars: {
    security: PillarScore
    health: PillarScore
    finances: PillarScore
    wellness: PillarScore
  }
  topRecommendations: string[]
}

export function computeVaultHealthScore(data: AppData): VaultHealthScoreResult {
  const now = new Date()
  const todayKey = toLocalDateKey(now)

  // ----------------------------------------------------
  // PILAR 1: SEGURIDAD (0 - 25)
  // ----------------------------------------------------
  let secScore = 0
  const secTips: string[] = []
  const passwords = data.security.passwordEntries

  if (passwords.length > 0) {
    secScore += 5 // Bóveda en uso

    // Evaluar fortaleza
    const strongCount = passwords.filter((p) => p.password.length >= 12 && /[A-Z]/.test(p.password) && /\d/.test(p.password)).length
    const strongRatio = strongCount / passwords.length
    if (strongRatio >= 0.8) {
      secScore += 10
    } else if (strongRatio >= 0.5) {
      secScore += 6
      secTips.push('Fortalecé las contraseñas que tengan menos de 12 caracteres.')
    } else {
      secScore += 2
      secTips.push('La mayoría de tus contraseñas son cortas o vulnerables.')
    }

    // Claves repetidas
    const counts = new Map<string, number>()
    passwords.forEach((p) => counts.set(p.password, (counts.get(p.password) ?? 0) + 1))
    const repeated = Array.from(counts.values()).filter((c) => c > 1).length
    if (repeated === 0) {
      secScore += 5
    } else {
      secTips.push(`Tenés ${repeated} contraseñas reutilizadas entre servicios.`)
    }
  } else {
    secTips.push('Agregá tus contraseñas en el gestor para proteger tus cuentas.')
  }

  // Backup reciente
  const lastBackup = data.utilities.backups.lastManualBackup || data.utilities.backups.lastAutomaticBackup
  if (lastBackup) {
    const d = safeParseDate(lastBackup)
    const daysSince = d ? differenceInCalendarDays(now, d) : 99
    if (daysSince <= 7) {
      secScore += 5
    } else {
      secScore += 2
      secTips.push('Hace más de 7 días que no generás un backup de tu bóveda.')
    }
  } else {
    secTips.push('Generá un respaldo cifrado desde la sección de Respaldos.')
  }

  // ----------------------------------------------------
  // PILAR 2: SALUD Y HÁBITOS (0 - 25)
  // ----------------------------------------------------
  let healthScore = 0
  const healthTips: string[] = []

  // Ficha de emergencia completa
  const em = data.health.emergencyProfile
  const emComplete = Boolean(em.fullName && em.bloodType && em.emergencyContacts.length > 0)
  if (emComplete) {
    healthScore += 6
  } else {
    healthTips.push('Completá tu ficha de emergencia (grupo sanguíneo y contacto).')
  }

  // Hidratación de hoy
  const hydrationTarget = data.health.hydrationTargetMl ?? 2500
  const todayWater = (data.health.hydrationLogs ?? []).find((l) => l.date === todayKey)?.amountMl ?? 0
  const waterPct = todayWater / hydrationTarget
  if (waterPct >= 1) {
    healthScore += 7
  } else if (waterPct >= 0.5) {
    healthScore += 4
    healthTips.push(`Estás al ${Math.round(waterPct * 100)}% de tu meta de agua diaria.`)
  } else {
    healthTips.push('Registrá tu ingesta de agua para mantener tu hidratación al día.')
  }

  // Medicaciones activas al día
  const activeMeds = data.health.medications.filter((m) => m.active)
  if (activeMeds.length > 0) {
    let adheredCount = 0
    activeMeds.forEach((med) => {
      const tookToday = (med.intakeLog ?? []).some((entry) => entry.startsWith(todayKey))
      if (tookToday) adheredCount += 1
    })
    const medAdherence = adheredCount / activeMeds.length
    if (medAdherence >= 0.8) {
      healthScore += 7
    } else {
      healthScore += 3
      healthTips.push('Marcá las tomas de medicación cumplidas para elevar tu adherencia.')
    }
  } else {
    healthScore += 7 // Sin tratamientos requeridos
  }

  // Biometría (peso y altura cargados para IMC)
  if (data.profile.weightKg && data.profile.heightCm) {
    healthScore += 5
  } else {
    healthTips.push('Cargá tu peso y altura en tu Perfil para calcular tu IMC.')
  }

  // ----------------------------------------------------
  // PILAR 3: FINANZAS (0 - 25)
  // ----------------------------------------------------
  let finScore = 0
  const finTips: string[] = []
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthTxs = data.personal.finances.filter((t) => t.date.startsWith(currentMonth))

  if (monthTxs.length > 0) {
    finScore += 6 // Registro financiero activo

    const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    if (income >= expense && income > 0) {
      finScore += 10 // Balance positivo
    } else if (income > 0) {
      finScore += 4
      finTips.push('Tus egresos superan los ingresos este mes.')
    } else {
      finScore += 5
    }

    // Presupuestos
    const budgets = data.personal.budgets ?? {}
    if (Object.keys(budgets).length > 0) {
      finScore += 5
      let anyExceeded = false
      Object.entries(budgets).forEach(([cat, limit]) => {
        const catSpent = monthTxs
          .filter((t) => t.type === 'expense' && t.category.toLowerCase() === cat.toLowerCase())
          .reduce((s, t) => s + t.amount, 0)
        if (catSpent > limit) anyExceeded = true
      })
      if (!anyExceeded) {
        finScore += 4
      } else {
        finTips.push('Tenés presupuestos con límite excedido este mes.')
      }
    } else {
      finTips.push('Fijá al menos un presupuesto mensual para controlar gastos.')
    }
  } else {
    finScore += 5
    finTips.push('Registrá los ingresos y egresos de este mes.')
  }

  // ----------------------------------------------------
  // PILAR 4: BIENESTAR Y CONSTANCIA (0 - 25)
  // ----------------------------------------------------
  let wellScore = 0
  const wellTips: string[] = []

  // Racha del diario
  const diaryDates = new Set(data.diary.entries.map((e) => toLocalDateKey(e.date)))
  let streak = 0
  for (let i = 0; i < 30; i += 1) {
    const checkDate = new Date()
    checkDate.setDate(checkDate.getDate() - i)
    if (diaryDates.has(toLocalDateKey(checkDate))) {
      streak += 1
    } else if (i > 0) {
      break
    }
  }

  if (streak >= 7) {
    wellScore += 10
  } else if (streak >= 3) {
    wellScore += 7
    wellTips.push(`Llevás racha de ${streak} días en tu diario. ¡Mantenela!`)
  } else if (streak >= 1) {
    wellScore += 4
    wellTips.push('Escribí en tu diario para consolidar una racha de bienestar.')
  } else {
    wellTips.push('Hacé una breve anotación hoy sobre cómo te sentís.')
  }

  // Recordatorios al día (sin vencidos)
  const overdueReminders = data.utilities.reminders.filter(
    (r) => !r.done && safeParseDate(r.dateTime) && safeParseDate(r.dateTime)!.getTime() < now.getTime() && toLocalDateKey(r.dateTime) !== todayKey,
  )
  if (overdueReminders.length === 0) {
    wellScore += 8
  } else {
    wellScore += 3
    wellTips.push(`Tenés ${overdueReminders.length} recordatorios pendientes de resolución.`)
  }

  // Entrenamientos recientes
  const workouts = data.personal.workouts ?? []
  const recentWorkouts = workouts.filter((w) => {
    const d = safeParseDate(w.date)
    return d ? differenceInCalendarDays(now, d) <= 7 : false
  })
  if (recentWorkouts.length >= 3) {
    wellScore += 7
  } else if (recentWorkouts.length >= 1) {
    wellScore += 4
    wellTips.push('Completá al menos 3 sesiones de actividad física por semana.')
  } else {
    wellTips.push('Registrá tus sesiones de entrenamiento en Rendimiento.')
  }

  // Ajustes de límites
  const clamp = (v: number) => Math.max(0, Math.min(25, v))
  secScore = clamp(secScore)
  healthScore = clamp(healthScore)
  finScore = clamp(finScore)
  wellScore = clamp(wellScore)

  const totalScore = secScore + healthScore + finScore + wellScore

  const getPillarStatus = (score: number): PillarScore['status'] => {
    if (score >= 22) return 'excellent'
    if (score >= 17) return 'good'
    if (score >= 11) return 'warning'
    return 'critical'
  }

  const getBadgeClass = (status: PillarScore['status']): string => {
    if (status === 'excellent') return 'badge badge-success'
    if (status === 'good') return 'badge badge-info'
    if (status === 'warning') return 'badge badge-warning'
    return 'badge badge-error'
  }

  const secStatus = getPillarStatus(secScore)
  const healthStatus = getPillarStatus(healthScore)
  const finStatus = getPillarStatus(finScore)
  const wellStatus = getPillarStatus(wellScore)

  let levelLabel = 'Nivel Guardián Legendario 🛡️'
  let levelBadgeClass = 'badge badge-success'

  if (totalScore < 40) {
    levelLabel = 'Bóveda Inicial 🐣'
    levelBadgeClass = 'badge badge-error'
  } else if (totalScore < 65) {
    levelLabel = 'En Progreso ⚡'
    levelBadgeClass = 'badge badge-warning'
  } else if (totalScore < 85) {
    levelLabel = 'Bóveda Saludable 🌟'
    levelBadgeClass = 'badge badge-info'
  }

  const allTips = [...secTips, ...healthTips, ...finTips, ...wellTips]
  const topRecommendations = allTips.slice(0, 4)

  return {
    totalScore,
    levelLabel,
    levelBadgeClass,
    pillars: {
      security: {
        name: 'Seguridad',
        score: secScore,
        maxScore: 25,
        percent: Math.round((secScore / 25) * 100),
        status: secStatus,
        badgeClass: getBadgeClass(secStatus),
        tips: secTips,
      },
      health: {
        name: 'Salud y Hábitos',
        score: healthScore,
        maxScore: 25,
        percent: Math.round((healthScore / 25) * 100),
        status: healthStatus,
        badgeClass: getBadgeClass(healthStatus),
        tips: healthTips,
      },
      finances: {
        name: 'Finanzas',
        score: finScore,
        maxScore: 25,
        percent: Math.round((finScore / 25) * 100),
        status: finStatus,
        badgeClass: getBadgeClass(finStatus),
        tips: finTips,
      },
      wellness: {
        name: 'Bienestar y Racha',
        score: wellScore,
        maxScore: 25,
        percent: Math.round((wellScore / 25) * 100),
        status: wellStatus,
        badgeClass: getBadgeClass(wellStatus),
        tips: wellTips,
      },
    },
    topRecommendations,
  }
}
