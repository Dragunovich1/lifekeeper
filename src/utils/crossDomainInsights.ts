/**
 * Motor de Correlaciones Cruzadas y Detección de Anomalías (Cross-Domain Intelligence).
 * Cruza información entre Salud, Diario, Clima, Finanzas y Vehículos.
 */

import type { AppData } from '../types'
import { toLocalDateKey, safeParseDate } from './dates'
import { differenceInCalendarDays } from 'date-fns'

export interface CrossInsight {
  id: string
  title: string
  description: string
  category: 'cruce-salud-animo' | 'anomalia-finanzas' | 'clima-entrenamiento' | 'prevision-gastos' | 'vehiculo-predictivo'
  badgeLabel: string
  badgeClass: string
  actionLabel?: string
  actionHash?: string
}

export function computeCrossDomainInsights(
  data: AppData,
  currentWeather?: { code: number; temp: number; description: string } | null,
): CrossInsight[] {
  const insights: CrossInsight[] = []

  // 1. CORRELACIÓN ÁNIMO VS. HIDRATACIÓN / ENTRENAMIENTOS
  const diaryEntries = data.diary.entries
  const hydrationLogs = data.health.hydrationLogs ?? []

  if (diaryEntries.length >= 3) {
    const positiveMoodEntries = diaryEntries.filter(
      (e) => e.mood === 'Excelente' || e.mood === 'Bien',
    )
    const positiveDates = new Set(positiveMoodEntries.map((e) => toLocalDateKey(e.date)))

    let waterTargetMetOnPositiveDays = 0
    let totalPositiveHydrationChecked = 0
    const target = data.health.hydrationTargetMl ?? 2500

    hydrationLogs.forEach((log) => {
      if (positiveDates.has(log.date)) {
        totalPositiveHydrationChecked += 1
        if (log.amountMl >= target) {
          waterTargetMetOnPositiveDays += 1
        }
      }
    })

    if (totalPositiveHydrationChecked >= 2 && waterTargetMetOnPositiveDays / totalPositiveHydrationChecked >= 0.7) {
      insights.push({
        id: 'cross-mood-water',
        title: 'Correlación positiva: Hidratación y Estado de Ánimo',
        description:
          'En el 70%+ de los días con ánimo excelente alcanzaste tu meta de agua. Mantenerte hidratado hoy potenciará tu energía.',
        category: 'cruce-salud-animo',
        badgeLabel: 'Patrón detectado 💧',
        badgeClass: 'badge badge-info',
        actionLabel: 'Ver hidratación',
        actionHash: '#health:hydration',
      })
    }
  }

  // 2. DETECCIÓN DE ANOMALÍAS EN GASTOS (Gastos > 60% por encima de la media de la categoría)
  const expenses = data.personal.finances.filter((t) => t.type === 'expense')
  if (expenses.length >= 5) {
    const categoryTotals = new Map<string, number[]>()
    expenses.forEach((t) => {
      const cat = t.category.trim()
      if (!cat) return
      const arr = categoryTotals.get(cat) ?? []
      arr.push(t.amount)
      categoryTotals.set(cat, arr)
    })

    for (const [cat, amounts] of categoryTotals.entries()) {
      if (amounts.length >= 3) {
        const sum = amounts.reduce((a, b) => a + b, 0)
        const avg = sum / amounts.length
        const recentExpenses = expenses
          .filter((t) => t.category.trim() === cat)
          .sort((a, b) => b.date.localeCompare(a.date))
        const latest = recentExpenses[0]

        if (latest && latest.amount >= avg * 1.6 && latest.amount > 5000) {
          insights.push({
            id: `anomaly-expense-${cat}`,
            title: `Gasto atípico en "${cat}"`,
            description: `El último movimiento de $${latest.amount.toLocaleString('es-AR')} en "${cat}" supera en más del 60% tu gasto promedio habitual ($${Math.round(avg).toLocaleString('es-AR')}).`,
            category: 'anomalia-finanzas',
            badgeLabel: 'Anomalía financiera ⚠️',
            badgeClass: 'badge badge-warning',
            actionLabel: 'Revisar finanzas',
            actionHash: '#personal:finances',
          })
          break
        }
      }
    }
  }

  // 3. PREVISIÓN DE GASTOS RECURRENTES EN LOS PRÓXIMOS 7 DÍAS
  const recurringExpenses = data.personal.finances.filter(
    (t) => t.type === 'expense' && t.recurring,
  )
  if (recurringExpenses.length > 0) {
    const projectedTotal = recurringExpenses.reduce((s, t) => s + t.amount, 0)
    insights.push({
      id: 'cross-projected-expenses',
      title: 'Compromisos periódicos detectados',
      description: `Tenés ${recurringExpenses.length} gastos recurrentes registrados con un impacto mensual de $${projectedTotal.toLocaleString('es-AR')}.`,
      category: 'prevision-gastos',
      badgeLabel: 'Proyección 💳',
      badgeClass: 'badge badge-info',
      actionLabel: 'Ver movimientos',
      actionHash: '#personal:finances',
    })
  }

  // 4. CLIMA + ACTIVIDAD FÍSICA O SALUD
  if (currentWeather) {
    const isRain = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(currentWeather.code)
    const isHot = currentWeather.temp >= 30

    if (isRain) {
      insights.push({
        id: 'cross-weather-workout',
        title: 'Condiciones climáticas: Lluvia o inestabilidad',
        description: `El pronóstico actual indica ${currentWeather.description}. Si tenés entrenamientos planificados hoy, considerá una rutina en interiores o flexibilidad en casa.`,
        category: 'clima-entrenamiento',
        badgeLabel: 'Aviso ambiental 🌧️',
        badgeClass: 'badge badge-info',
        actionLabel: 'Entrenamientos',
        actionHash: '#personal:workouts',
      })
    } else if (isHot) {
      insights.push({
        id: 'cross-weather-heat',
        title: 'Precaución por temperatura elevada',
        description: `La temperatura exterior ronda los ${currentWeather.temp}°C. Te recomendamos aumentar tu meta de hidratación en al menos 500 ml y evitar ejercicios al sol directo.`,
        category: 'clima-entrenamiento',
        badgeLabel: 'Calor intenso ☀️',
        badgeClass: 'badge badge-warning',
        actionLabel: 'Sumar agua',
        actionHash: '#health:hydration',
      })
    }
  }

  // 5. VEHÍCULO PREDICTIVO: CÁLCULO DE SERVICE POR KILOMETRAJE
  const services = data.personal.vehicles
  if (services.length >= 2) {
    const servicesWithKm = services
      .filter((s) => s.mileage && s.mileage > 0)
      .sort((a, b) => b.date.localeCompare(a.date))

    if (servicesWithKm.length >= 2) {
      const latest = servicesWithKm[0]
      const prev = servicesWithKm[1]
      const diffKm = (latest.mileage ?? 0) - (prev.mileage ?? 0)
      const d1 = safeParseDate(latest.date)
      const d2 = safeParseDate(prev.date)

      if (d1 && d2 && diffKm > 0) {
        const days = Math.max(1, differenceInCalendarDays(d1, d2))
        const kmPerDay = diffKm / days
        const kmPerMonth = Math.round(kmPerDay * 30)

        if (latest.nextServiceMileage && latest.mileage) {
          const remainingKm = latest.nextServiceMileage - latest.mileage
          if (remainingKm > 0 && kmPerDay > 0) {
            const estimatedDaysLeft = Math.round(remainingKm / kmPerDay)
            insights.push({
              id: 'cross-vehicle-prediction',
              title: `Mantenimiento predictivo: ${latest.vehicleName}`,
              description: `Con tu ritmo estimado de ${kmPerMonth.toLocaleString('es-AR')} km/mes, alcanzarás el próximo service (${latest.nextServiceMileage.toLocaleString('es-AR')} km) en aproximadamente ${estimatedDaysLeft} días.`,
              category: 'vehiculo-predictivo',
              badgeLabel: 'Predicción vehicular 🚗',
              badgeClass: 'badge badge-info',
              actionLabel: 'Ver vehículo',
              actionHash: '#personal:vehicles',
            })
          }
        }
      }
    }
  }

  return insights.slice(0, 4)
}
