import { differenceInCalendarDays, isSameMonth, subMonths } from 'date-fns'
import { navigation } from '../navigation'
import type { AppData, MoodLevel } from '../types'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  isPast,
  isUpcoming,
  safeParseDate,
  toLocalDateKey,
} from './dates'

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'success'
export type InsightCategory = 'salud' | 'personal' | 'diario' | 'seguridad' | 'utilidades' | 'perfil'

export interface InsightItem {
  id: string
  title: string
  description: string
  severity: InsightSeverity
  category: InsightCategory
  actionLabel: string
  targetHash: string
  meta?: string
}

export interface GlobalSearchResult {
  id: string
  title: string
  subtitle: string
  categoryLabel: string
  sectionHash: string
  kind: 'navigation' | 'record'
  badge?: string
}

export interface TodayMedicationDose {
  medicationId: string
  medicationName: string
  dosage: string
  time: string
  note?: string
  isPastToday: boolean
  isDueNow: boolean
}

export interface DashboardSmartSummary {
  insights: InsightItem[]
  criticalCount: number
  warningCount: number
  infoCount: number
  overdueRemindersCount: number
  todayRemindersCount: number
  upcomingVaccinesCount: number
  todayDoses: TodayMedicationDose[]
  nextDose: TodayMedicationDose | null
  currentMonthIncome: number
  currentMonthExpense: number
  currentMonthBalance: number
  previousMonthExpense: number
  expenseDeltaPercent: number | null
  weakOrReusedPasswordsCount: number
  oldPasswordsCount: number
  emergencyCompletenessPercent: number
  daysSinceLastBackup: number | null
  diaryStreakDays: number
  dominantMood: MoodLevel | null
  activeProjectsCount: number
  pendingTasksCount: number
}

const isWeakPassword = (value: string): boolean => {
  if (!value || value.length < 10) return true
  const hasUpper = /[A-Z]/.test(value)
  const hasLower = /[a-z]/.test(value)
  const hasDigit = /\d/.test(value)
  const hasSymbol = /[^A-Za-z0-9]/.test(value)
  const variety = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length
  return variety < 3
}

export const computeSmartSummary = (data: AppData, now = new Date()): DashboardSmartSummary => {
  const insights: InsightItem[] = []
  const todayKey = toLocalDateKey(now)
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // 1. Recordatorios vencidos y de hoy
  const activeReminders = data.utilities.reminders.filter((r) => !r.done)
  const overdueReminders = activeReminders.filter((r) => {
    const parsed = safeParseDate(r.dateTime)
    return parsed ? parsed.getTime() < now.getTime() && toLocalDateKey(parsed) !== todayKey : false
  })
  const todayReminders = activeReminders.filter((r) => toLocalDateKey(r.dateTime) === todayKey)

  if (overdueReminders.length > 0) {
    insights.push({
      id: 'overdue-reminders',
      title:
        overdueReminders.length === 1
          ? `Recordatorio vencido: ${overdueReminders[0].title}`
          : `${overdueReminders.length} recordatorios vencidos`,
      description:
        overdueReminders.length === 1
          ? `Estaba programado para el ${formatDateTime(overdueReminders[0].dateTime)}.`
          : `Tenés alertas pendientes cuya fecha ya pasó. Revisalas o posponelas.`,
      severity: 'critical',
      category: 'utilidades',
      actionLabel: 'Ver recordatorios',
      targetHash: '#utilities:reminders',
      meta: 'Vencido',
    })
  }

  if (todayReminders.length > 0) {
    insights.push({
      id: 'today-reminders',
      title:
        todayReminders.length === 1
          ? `Para hoy: ${todayReminders[0].title}`
          : `${todayReminders.length} recordatorios programados para hoy`,
      description: todayReminders
        .slice(0, 3)
        .map((r) => `${r.title} (${formatDateTime(r.dateTime).slice(11)})`)
        .join(' · '),
      severity: 'warning',
      category: 'utilidades',
      actionLabel: 'Ir a agenda',
      targetHash: '#utilities:reminders',
      meta: 'Hoy',
    })
  }

  // 2. Salud: Vacunas próximas o vencidas
  const overdueVaccines = data.health.vaccines.filter(
    (v) => v.nextDoseDate && isPast(v.nextDoseDate),
  )
  const upcomingVaccines = data.health.vaccines.filter(
    (v) => v.nextDoseDate && isUpcoming(v.nextDoseDate, 30),
  )

  if (overdueVaccines.length > 0) {
    insights.push({
      id: 'overdue-vaccines',
      title:
        overdueVaccines.length === 1
          ? `Refuerzo pendiente: ${overdueVaccines[0].vaccine}`
          : `${overdueVaccines.length} refuerzos de vacunas vencidos`,
      description: `La fecha estimada de aplicación (${formatDate(overdueVaccines[0].nextDoseDate!)}) ya pasó.`,
      severity: 'critical',
      category: 'salud',
      actionLabel: 'Ver vacunas',
      targetHash: '#health:vaccines',
      meta: 'Salud',
    })
  } else if (upcomingVaccines.length > 0) {
    insights.push({
      id: 'upcoming-vaccines',
      title:
        upcomingVaccines.length === 1
          ? `Próximo refuerzo: ${upcomingVaccines[0].vaccine}`
          : `${upcomingVaccines.length} refuerzos de vacunas en los próximos 30 días`,
      description: `Próxima aplicación programada para el ${formatDate(upcomingVaccines[0].nextDoseDate!)}.`,
      severity: 'warning',
      category: 'salud',
      actionLabel: 'Revisar calendario de vacunas',
      targetHash: '#health:vaccines',
      meta: 'Pronto',
    })
  }

  // 3. Salud: Tomas de medicación de hoy y cruce con alergias
  const activeMedications = data.health.medications.filter((m) => m.active)
  const todayDoses: TodayMedicationDose[] = activeMedications
    .flatMap((med) =>
      med.schedules.map((sched) => {
        const isDueNow = sched.time === currentHHMM
        const isPastToday = sched.time < currentHHMM
        return {
          medicationId: med.id,
          medicationName: med.name,
          dosage: med.dosage,
          time: sched.time,
          note: sched.note,
          isPastToday,
          isDueNow,
        }
      }),
    )
    .sort((a, b) => (a.time > b.time ? 1 : -1))

  const nextDose = todayDoses.find((d) => !d.isPastToday) ?? null

  // Cruce de alergias con medicaciones activas
  const allergies = data.health.emergencyProfile.allergies.map((a) => a.trim().toLowerCase()).filter(Boolean)
  const allergyConflicts = activeMedications.filter((med) =>
    allergies.some(
      (allergy) =>
        med.name.toLowerCase().includes(allergy) || allergy.includes(med.name.toLowerCase()),
    ),
  )

  if (allergyConflicts.length > 0) {
    insights.push({
      id: 'allergy-conflict',
      title: `Alerta de alergia detectada en medicación`,
      description: `El tratamiento activo "${allergyConflicts[0].name}" coincide con una alergia registrada en tu ficha de emergencia.`,
      severity: 'critical',
      category: 'salud',
      actionLabel: 'Verificar medicación',
      targetHash: '#health:medications',
      meta: 'Alerta médica',
    })
  }

  // Medicaciones activas cuyo fin de tratamiento ya pasó o vence pronto
  const endingMedications = activeMedications.filter(
    (m) => m.endDate && (isPast(m.endDate) || isUpcoming(m.endDate, 5)),
  )
  if (endingMedications.length > 0) {
    const first = endingMedications[0]
    insights.push({
      id: 'ending-medications',
      title: `Tratamiento por finalizar: ${first.name}`,
      description: `Fecha de finalización registrada: ${formatDate(first.endDate!)}. Actualizá su estado si ya concluyó.`,
      severity: 'info',
      category: 'salud',
      actionLabel: 'Ver medicaciones',
      targetHash: '#health:medications',
      meta: 'Tratamiento',
    })
  }

  // 4. Ficha de Emergencia (completitud)
  const emergency = data.health.emergencyProfile
  const emergencyChecks = [
    Boolean(emergency.fullName || data.profile.fullName),
    Boolean(emergency.bloodType),
    Boolean(emergency.birthDate || data.profile.birthDate),
    emergency.emergencyContacts.length > 0,
    emergency.allergies.length > 0 || emergency.conditions.length > 0 || emergency.medications.length > 0,
  ]
  const emergencyCompletenessPercent = Math.round(
    (emergencyChecks.filter(Boolean).length / emergencyChecks.length) * 100,
  )

  if (!emergency.bloodType || emergency.emergencyContacts.length === 0) {
    insights.push({
      id: 'emergency-incomplete',
      title: 'Completá tu ficha médica SOS',
      description: !emergency.bloodType
        ? 'Falta especificar tu grupo sanguíneo y datos clave para emergencias.'
        : 'Agregá al menos un contacto de emergencia para habilitar la tarjeta SOS completa.',
      severity: 'warning',
      category: 'salud',
      actionLabel: 'Completar ficha SOS',
      targetHash: '#health:emergency',
      meta: `${emergencyCompletenessPercent}% completa`,
    })
  }

  // 5. Finanzas del mes actual vs mes anterior
  const prevMonthDate = subMonths(now, 1)
  let currentMonthIncome = 0
  let currentMonthExpense = 0
  let previousMonthExpense = 0

  data.personal.finances.forEach((tx) => {
    const d = safeParseDate(tx.date)
    if (!d) return
    if (isSameMonth(d, now)) {
      if (tx.type === 'income') currentMonthIncome += tx.amount
      else currentMonthExpense += tx.amount
    } else if (isSameMonth(d, prevMonthDate) && tx.type === 'expense') {
      previousMonthExpense += tx.amount
    }
  })

  const currentMonthBalance = currentMonthIncome - currentMonthExpense
  const expenseDeltaPercent =
    previousMonthExpense > 0
      ? Math.round(((currentMonthExpense - previousMonthExpense) / previousMonthExpense) * 100)
      : null

  if (currentMonthExpense > currentMonthIncome && currentMonthExpense > 0) {
    insights.push({
      id: 'negative-balance',
      title: 'Balance mensual negativo este mes',
      description: `Los egresos del mes (${formatCurrency(currentMonthExpense)}) superan a los ingresos registrados (${formatCurrency(currentMonthIncome)}).`,
      severity: 'warning',
      category: 'personal',
      actionLabel: 'Analizar finanzas',
      targetHash: '#personal:finances',
      meta: formatCurrency(currentMonthBalance),
    })
  } else if (expenseDeltaPercent !== null && expenseDeltaPercent >= 25) {
    insights.push({
      id: 'expense-spike',
      title: `Tus gastos subieron un ${expenseDeltaPercent}% respecto al mes pasado`,
      description: `Llevás ${formatCurrency(currentMonthExpense)} este mes frente a ${formatCurrency(previousMonthExpense)} del mes anterior.`,
      severity: 'info',
      category: 'personal',
      actionLabel: 'Ver desglose',
      targetHash: '#personal:finances',
      meta: `+${expenseDeltaPercent}%`,
    })
  }

  // 6. Seguridad: Salud de contraseñas
  const passwords = data.security.passwordEntries
  const passwordCounts = new Map<string, number>()
  passwords.forEach((p) => {
    if (!p.password) return
    passwordCounts.set(p.password, (passwordCounts.get(p.password) ?? 0) + 1)
  })

  const weakOrReused = passwords.filter(
    (p) => isWeakPassword(p.password) || (passwordCounts.get(p.password) ?? 0) > 1,
  )
  const oldPasswords = passwords.filter((p) => {
    const updated = safeParseDate(p.updatedAt)
    return updated ? differenceInCalendarDays(now, updated) > 180 : false
  })

  if (weakOrReused.length > 0) {
    insights.push({
      id: 'password-health',
      title:
        weakOrReused.length === 1
          ? `1 contraseña débil o reutilizada detectada`
          : `${weakOrReused.length} contraseñas débiles o reutilizadas`,
      description: `Revisá tu bóveda de seguridad para fortalecer claves cortas o repetidas entre servicios.`,
      severity: 'warning',
      category: 'seguridad',
      actionLabel: 'Auditar contraseñas',
      targetHash: '#security:passwords',
      meta: 'Seguridad',
    })
  } else if (oldPasswords.length > 0) {
    insights.push({
      id: 'password-rotation',
      title: `${oldPasswords.length} contraseñas con más de 6 meses sin rotar`,
      description: `Se recomienda actualizar periódicamente tus credenciales críticas.`,
      severity: 'info',
      category: 'seguridad',
      actionLabel: 'Ver bóveda',
      targetHash: '#security:passwords',
      meta: '+180 días',
    })
  }

  // 7. Documentos sensibles próximos a vencer o vencidos
  const expiredDocs = data.security.documents.filter((d) => d.expiresAt && isPast(d.expiresAt))
  const expiringDocs = data.security.documents.filter(
    (d) => d.expiresAt && isUpcoming(d.expiresAt, 30),
  )

  if (expiredDocs.length > 0) {
    insights.push({
      id: 'expired-docs',
      title:
        expiredDocs.length === 1
          ? `Documento vencido: ${expiredDocs[0].name}`
          : `${expiredDocs.length} documentos sensibles vencidos`,
      description: `El documento "${expiredDocs[0].name}" venció el ${formatDate(expiredDocs[0].expiresAt!)}.`,
      severity: 'critical',
      category: 'seguridad',
      actionLabel: 'Ver documentos',
      targetHash: '#security:documents',
      meta: 'Vencido',
    })
  } else if (expiringDocs.length > 0) {
    insights.push({
      id: 'expiring-docs',
      title:
        expiringDocs.length === 1
          ? `Documento por vencer: ${expiringDocs[0].name}`
          : `${expiringDocs.length} documentos vencen en los próximos 30 días`,
      description: `Fecha de vencimiento: ${formatDate(expiringDocs[0].expiresAt!)}.`,
      severity: 'warning',
      category: 'seguridad',
      actionLabel: 'Revisar documentos',
      targetHash: '#security:documents',
      meta: 'Pronto',
    })
  }

  // 7.5. Vehículos con próximo service programado
  const upcomingVehicleServices = data.personal.vehicles.filter(
    (v) => v.nextServiceDate && (isPast(v.nextServiceDate) || isUpcoming(v.nextServiceDate, 30)),
  )
  if (upcomingVehicleServices.length > 0) {
    const first = upcomingVehicleServices[0]
    const overdue = isPast(first.nextServiceDate!)
    insights.push({
      id: 'vehicle-service-due',
      title: overdue
        ? `Service pendiente: ${first.vehicleName}`
        : `Próximo service: ${first.vehicleName}`,
      description: `Mantenimiento (${first.serviceType}) estimado para el ${formatDate(first.nextServiceDate!)}.`,
      severity: overdue ? 'warning' : 'info',
      category: 'personal',
      actionLabel: 'Ver vehículos',
      targetHash: '#personal:vehicles',
      meta: overdue ? 'Pendiente' : 'Service',
    })
  }

  // 8. Backups: antigüedad del último respaldo manual
  const lastManual = safeParseDate(data.utilities.backups.lastManualBackup)
  const daysSinceLastBackup = lastManual ? differenceInCalendarDays(now, lastManual) : null

  if (daysSinceLastBackup === null || daysSinceLastBackup > 14) {
    insights.push({
      id: 'backup-stale',
      title:
        daysSinceLastBackup === null
          ? 'Todavía no exportaste un respaldo externo cifrado'
          : `Hace ${daysSinceLastBackup} días que no descargás un backup manual`,
      description:
        'Tus datos viven cifrados en este navegador. Descargá una copia cifrada para resguardarte ante limpieza del navegador.',
      severity: daysSinceLastBackup === null ? 'info' : 'warning',
      category: 'utilidades',
      actionLabel: 'Crear backup ahora',
      targetHash: '#utilities:backups',
      meta: daysSinceLastBackup === null ? 'Sin backup externo' : `${daysSinceLastBackup} días`,
    })
  }

  // 8. Diario y Estado de ánimo (racha de días únicos y ánimo dominante)
  const diaryDaySet = new Set(
    data.diary.entries.map((e) => toLocalDateKey(e.date)).filter(Boolean),
  )
  let diaryStreakDays = 0
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Si hoy todavía no registró pero ayer sí, contamos desde ayer
  if (!diaryDaySet.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (diaryDaySet.has(toLocalDateKey(cursor))) {
    diaryStreakDays += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  const moodCounts = new Map<MoodLevel, number>()
  data.diary.entries.slice(0, 14).forEach((entry) => {
    moodCounts.set(entry.mood, (moodCounts.get(entry.mood) ?? 0) + 1)
  })
  let dominantMood: MoodLevel | null = null
  let maxMoodCount = 0
  moodCounts.forEach((count, mood) => {
    if (count > maxMoodCount) {
      maxMoodCount = count
      dominantMood = mood
    }
  })

  // Detección de ánimo bajo sostenido (por día único más reciente)
  const moodByDay = new Map<string, MoodLevel>()
  const sortedDiaryForMood = [...data.diary.entries].sort((a, b) =>
    b.date.localeCompare(a.date),
  )
  sortedDiaryForMood.forEach((entry) => {
    const key = toLocalDateKey(entry.date)
    if (key && !moodByDay.has(key)) {
      moodByDay.set(key, entry.mood)
    }
  })
  const recentDayMoods = Array.from(moodByDay.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, mood]) => mood)

  let consecutiveLowMoodDays = 0
  for (const mood of recentDayMoods) {
    if (mood === 'Regular' || mood === 'Mal') {
      consecutiveLowMoodDays += 1
    } else {
      break
    }
  }

  if (consecutiveLowMoodDays >= 4) {
    insights.push({
      id: 'mood-sustained-alert',
      title: `Alerta de bienestar: ${consecutiveLowMoodDays} días seguidos de ánimo bajo`,
      description:
        'Registramos varios días consecutivos difíciles. Priorizá tu descanso, apoyate en tus contactos de confianza o agendá una consulta profesional.',
      severity: 'critical',
      category: 'diario',
      actionLabel: 'Ver acompañamiento y recursos',
      targetHash: '#diary:mood',
      meta: 'Cuidado personal',
    })
  } else if (consecutiveLowMoodDays >= 2) {
    insights.push({
      id: 'mood-gentle-tip',
      title: `Acompañamiento emocional (${consecutiveLowMoodDays} días exigentes)`,
      description:
        'Notamos que los últimos días estuvieron pesados. Revisá las recomendaciones personalizadas en tu seguimiento de ánimo.',
      severity: 'warning',
      category: 'diario',
      actionLabel: 'Ver consejos de bienestar',
      targetHash: '#diary:mood',
      meta: 'Bienestar',
    })
  }

  // 9. Proyectos y tareas pendientes
  const projects = data.personal.projects
  const pendingTasksCount = projects.reduce(
    (acc, proj) => acc + proj.tasks.filter((t) => !t.completed).length,
    0,
  )
  const activeProjectsCount = projects.filter(
    (proj) => proj.tasks.length === 0 || proj.tasks.some((t) => !t.completed),
  ).length

  // Ordenar insights por severidad: critical -> warning -> info -> success
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  }
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return {
    insights,
    criticalCount: insights.filter((i) => i.severity === 'critical').length,
    warningCount: insights.filter((i) => i.severity === 'warning').length,
    infoCount: insights.filter((i) => i.severity === 'info').length,
    overdueRemindersCount: overdueReminders.length,
    todayRemindersCount: todayReminders.length,
    upcomingVaccinesCount: upcomingVaccines.length + overdueVaccines.length,
    todayDoses,
    nextDose,
    currentMonthIncome,
    currentMonthExpense,
    currentMonthBalance,
    previousMonthExpense,
    expenseDeltaPercent,
    weakOrReusedPasswordsCount: weakOrReused.length,
    oldPasswordsCount: oldPasswords.length,
    emergencyCompletenessPercent,
    daysSinceLastBackup,
    diaryStreakDays,
    dominantMood,
    activeProjectsCount,
    pendingTasksCount,
  }
}

export const searchVaultRecords = (data: AppData, rawQuery: string): GlobalSearchResult[] => {
  const query = rawQuery.trim().toLowerCase()
  const navResults: GlobalSearchResult[] = [
    {
      id: 'nav:dashboard',
      title: 'Dashboard',
      subtitle: 'Resumen inteligente, métricas y alertas activas',
      categoryLabel: 'Navegación',
      sectionHash: '',
      kind: 'navigation',
      badge: 'Ir a sección',
    },
    ...navigation.flatMap((section) =>
      section.subSections.map((sub) => ({
        id: `nav:${section.key}:${sub.key}`,
        title: sub.label,
        subtitle: `${section.label} · Ir a la sección`,
        categoryLabel: section.label,
        sectionHash: `#${section.key}:${sub.key}`,
        kind: 'navigation' as const,
        badge: 'Sección',
      })),
    ),
  ]

  if (!query) {
    return navResults.slice(0, 10)
  }

  const matchedNav = navResults.filter(
    (item) =>
      item.title.toLowerCase().includes(query) ||
      item.subtitle.toLowerCase().includes(query) ||
      item.categoryLabel.toLowerCase().includes(query),
  )

  const recordResults: GlobalSearchResult[] = []

  // Recordatorios
  data.utilities.reminders.forEach((r) => {
    if (
      r.title.toLowerCase().includes(query) ||
      (r.details ?? '').toLowerCase().includes(query) ||
      r.category.toLowerCase().includes(query)
    ) {
      recordResults.push({
        id: `rem:${r.id}`,
        title: r.title,
        subtitle: `${formatDateTime(r.dateTime)}${r.details ? ` · ${r.details}` : ''}`,
        categoryLabel: 'Recordatorios',
        sectionHash: '#utilities:reminders',
        kind: 'record',
        badge: r.done ? 'Completado' : r.category,
      })
    }
  })

  // Medicaciones
  data.health.medications.forEach((m) => {
    if (
      m.name.toLowerCase().includes(query) ||
      m.dosage.toLowerCase().includes(query) ||
      (m.instructions ?? '').toLowerCase().includes(query)
    ) {
      recordResults.push({
        id: `med:${m.id}`,
        title: `${m.name} (${m.dosage})`,
        subtitle: `${m.frequency}${m.schedules.length ? ` · Tomas: ${m.schedules.map((s) => s.time).join(', ')}` : ''}`,
        categoryLabel: 'Medicación',
        sectionHash: '#health:medications',
        kind: 'record',
        badge: m.active ? 'Activa' : 'Pausada',
      })
    }
  })

  // Vacunas
  data.health.vaccines.forEach((v) => {
    if (
      v.vaccine.toLowerCase().includes(query) ||
      v.dose.toLowerCase().includes(query) ||
      v.location.toLowerCase().includes(query)
    ) {
      recordResults.push({
        id: `vac:${v.id}`,
        title: `${v.vaccine} (${v.dose})`,
        subtitle: `Aplicada el ${formatDate(v.date)} · ${v.location}`,
        categoryLabel: 'Vacunas',
        sectionHash: '#health:vaccines',
        kind: 'record',
        badge: v.nextDoseDate ? `Refuerzo: ${formatDate(v.nextDoseDate)}` : undefined,
      })
    }
  })

  // Consultas médicas
  data.health.consultations.forEach((c) => {
    if (
      c.doctor.toLowerCase().includes(query) ||
      c.reason.toLowerCase().includes(query) ||
      (c.diagnosis ?? '').toLowerCase().includes(query) ||
      (c.treatment ?? '').toLowerCase().includes(query)
    ) {
      recordResults.push({
        id: `con:${c.id}`,
        title: `${c.reason} — ${c.doctor}`,
        subtitle: `${formatDate(c.date)}${c.diagnosis ? ` · ${c.diagnosis}` : ''}`,
        categoryLabel: 'Consultas médicas',
        sectionHash: '#health:consultations',
        kind: 'record',
      })
    }
  })

  // Historial clínico
  data.health.clinicalNotes.forEach((n) => {
    if (
      n.title.toLowerCase().includes(query) ||
      n.description.toLowerCase().includes(query) ||
      (n.tags ?? []).some((t) => t.toLowerCase().includes(query))
    ) {
      recordResults.push({
        id: `clin:${n.id}`,
        title: n.title,
        subtitle: `${formatDate(n.date)} · ${n.description.slice(0, 80)}`,
        categoryLabel: 'Historial clínico',
        sectionHash: '#health:history',
        kind: 'record',
        badge: n.tags?.[0],
      })
    }
  })

  // Diario personal
  data.diary.entries.forEach((e) => {
    if (
      e.title.toLowerCase().includes(query) ||
      e.content.toLowerCase().includes(query) ||
      e.tags.some((t) => t.toLowerCase().includes(query))
    ) {
      recordResults.push({
        id: `diary:${e.id}`,
        title: e.title || 'Entrada del diario',
        subtitle: `${formatDate(e.date)} · ${e.content.slice(0, 80)}`,
        categoryLabel: 'Diario personal',
        sectionHash: '#diary:notes',
        kind: 'record',
        badge: e.mood,
      })
    }
  })

  // Contraseñas (nunca expone la clave en el resultado de búsqueda)
  data.security.passwordEntries.forEach((p) => {
    if (
      p.service.toLowerCase().includes(query) ||
      p.username.toLowerCase().includes(query) ||
      (p.notes ?? '').toLowerCase().includes(query) ||
      (p.tags ?? []).some((t) => t.toLowerCase().includes(query))
    ) {
      recordResults.push({
        id: `pwd:${p.id}`,
        title: p.service,
        subtitle: `Usuario: ${p.username}`,
        categoryLabel: 'Gestor de contraseñas',
        sectionHash: '#security:passwords',
        kind: 'record',
        badge: p.tags?.[0] ?? 'Bóveda',
      })
    }
  })

  // Documentos sensibles
  data.security.documents.forEach((d) => {
    if (
      d.name.toLowerCase().includes(query) ||
      (d.description ?? '').toLowerCase().includes(query) ||
      d.fileName.toLowerCase().includes(query)
    ) {
      recordResults.push({
        id: `doc:${d.id}`,
        title: d.name,
        subtitle: `${d.fileName}${d.description ? ` · ${d.description}` : ''}`,
        categoryLabel: 'Documentos sensibles',
        sectionHash: '#security:documents',
        kind: 'record',
      })
    }
  })

  // Notas privadas
  data.security.privateNotes.forEach((n) => {
    if (n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)) {
      recordResults.push({
        id: `pnote:${n.id}`,
        title: n.title,
        subtitle: n.content.slice(0, 80),
        categoryLabel: 'Notas privadas',
        sectionHash: '#security:private-notes',
        kind: 'record',
      })
    }
  })

  // Finanzas
  data.personal.finances.forEach((tx) => {
    if (
      tx.category.toLowerCase().includes(query) ||
      (tx.description ?? '').toLowerCase().includes(query)
    ) {
      recordResults.push({
        id: `fin:${tx.id}`,
        title: `${tx.category} — ${formatCurrency(tx.amount)}`,
        subtitle: `${formatDate(tx.date)}${tx.description ? ` · ${tx.description}` : ''}`,
        categoryLabel: 'Finanzas',
        sectionHash: '#personal:finances',
        kind: 'record',
        badge: tx.type === 'income' ? 'Ingreso' : 'Egreso',
      })
    }
  })

  // Proyectos
  data.personal.projects.forEach((proj) => {
    if (
      proj.name.toLowerCase().includes(query) ||
      (proj.description ?? '').toLowerCase().includes(query) ||
      proj.tasks.some((t) => t.description.toLowerCase().includes(query))
    ) {
      recordResults.push({
        id: `proj:${proj.id}`,
        title: proj.name,
        subtitle: proj.description || `${proj.tasks.length} tareas registradas`,
        categoryLabel: 'Proyectos e ideas',
        sectionHash: '#personal:projects',
        kind: 'record',
      })
    }
  })

  // Vehículos
  data.personal.vehicles.forEach((v) => {
    if (
      v.vehicleName.toLowerCase().includes(query) ||
      v.serviceType.toLowerCase().includes(query) ||
      (v.notes ?? '').toLowerCase().includes(query)
    ) {
      recordResults.push({
        id: `veh:${v.id}`,
        title: `${v.vehicleName} · ${v.serviceType}`,
        subtitle: `${formatDate(v.date)} · ${formatCurrency(v.cost)}`,
        categoryLabel: 'Vehículos',
        sectionHash: '#personal:vehicles',
        kind: 'record',
      })
    }
  })

  // Entrenamientos
  ;(data.personal.workouts ?? []).forEach((w) => {
    if (
      w.title.toLowerCase().includes(query) ||
      w.type.toLowerCase().includes(query) ||
      (w.notes ?? '').toLowerCase().includes(query) ||
      w.exercises.some((e) => e.name.toLowerCase().includes(query))
    ) {
      recordResults.push({
        id: `workout:${w.id}`,
        title: w.title,
        subtitle: `${formatDate(w.date)} · ${w.type}${w.durationMinutes ? ` · ${w.durationMinutes} min` : ''}`,
        categoryLabel: 'Entrenamientos',
        sectionHash: '#personal:workouts',
        kind: 'record',
        badge: w.type,
      })
    }
  })

  return [...matchedNav, ...recordResults].slice(0, 24)
}
