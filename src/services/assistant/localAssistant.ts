/**
 * Asistente Inteligente Conversacional Local de LifeKeeper (100% privado y offline).
 * Interpreta consultas y COMANDOS DE MUTACIÓN en lenguaje natural en español rioplatense porteño/tanguero.
 * Soporta clima en tiempo real, deudas/préstamos, hidratación, finanzas, nutrición,
 * ciclo menstrual, entrenamientos, biometría, medicación, daily briefing y armado de planes.
 */

import type {
  AppData,
  FinanceTransaction,
  DebtEntry,
  DebtPayment,
  MealType,
  MealFoodItem,
  WorkoutSetType,
  WorkoutExerciseSet,
  DiaryEntry,
  WorkoutTemplate,
  AssistantMutationCard,
  AssistantProposalCard,
  AssistantChatMessage,
} from '../../types'
import { toLocalDateKey, formatDate } from '../../utils/dates'
import { computeVaultHealthScore } from '../../utils/vaultScore'
import { fetchWeatherData, describeWeatherCode } from '../api/weather'

export type AssistantMessage = AssistantChatMessage

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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:()_"'\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const formatDayName = (dateStr: string): string => {
  const d = new Date(dateStr + 'T12:00:00')
  if (isNaN(d.getTime())) return dateStr
  const name = d.toLocaleDateString('es-AR', { weekday: 'long' })
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function createAssistantMessage(
  text: string,
  action?: { label: string; hash: string },
  mutationCard?: AssistantMutationCard,
  proposalCard?: AssistantProposalCard,
): AssistantMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sender: 'assistant',
    text,
    timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    action,
    mutationCard,
    proposalCard,
  }
}

/**
 * Extrae montos monetarios reconociendo 'lucas', 'k', 'mil', '$', etc.
 */
function extractAmount(text: string): number | null {
  const norm = normalizeText(text)

  // Caso: "50 lucas", "20 lucas", "1 luca"
  const lucasMatch = norm.match(/(\d+(?:[.,]\d+)?)\s*luca/)
  if (lucasMatch) {
    const val = parseFloat(lucasMatch[1].replace(',', '.'))
    return Math.round(val * 1000)
  }
  if (norm.includes('una luca')) return 1000
  if (norm.includes('dos lucas')) return 2000
  if (norm.includes('media luca')) return 500

  // Caso: "50k", "100k"
  const kMatch = norm.match(/(\d+(?:[.,]\d+)?)\s*k\b/)
  if (kMatch) {
    const val = parseFloat(kMatch[1].replace(',', '.'))
    return Math.round(val * 1000)
  }

  // Caso: "50 mil"
  const milMatch = norm.match(/(\d+(?:[.,]\d+)?)\s*mil/)
  if (milMatch) {
    const val = parseFloat(milMatch[1].replace(',', '.'))
    return Math.round(val * 1000)
  }

  // Caso estándar: "$50.000", "50000", "4500,50"
  const numMatch = text.match(/(?:\$|ars\s*|usd\s*)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)/i)
  if (numMatch) {
    let clean = numMatch[1].replace(/\./g, '').replace(',', '.')
    const val = parseFloat(clean)
    if (!isNaN(val) && val > 0) return val
  }

  return null
}

// ============================================================================
// MOTOR DE MUTACIONES / CARGA DE DATOS EN LENGUAJE NATURAL
// ============================================================================

export function tryExecuteAssistantMutation(query: string, data: AppData): AssistantMutationResult | null {
  const norm = normalizeText(query)
  const now = new Date()
  const todayKey = toLocalDateKey(now)

  // --------------------------------------------------------------------------
  // A. MUTACIÓN: DEUDAS Y PRÉSTAMOS ("le presté 20 lucas a Juan", "le debo 50000 a Visa", etc.)
  // --------------------------------------------------------------------------

  // A1. Cobro o Pago de una deuda existente ("Juan me devolvió 10 lucas", "pagué 15000 de la tarjeta Visa", etc.)
  const isDebtPaymentAction =
    (norm.includes('pague') || norm.includes('abone') || norm.includes('liquide') || norm.includes('devolvio') || norm.includes('me pago') || norm.includes('cobre')) &&
    (norm.includes('deuda') || norm.includes('tarjeta') || norm.includes('prestamo') || norm.includes('prestado') || norm.includes('cuota') || norm.includes('devol') || data.personal.debts?.some(d => norm.includes(normalizeText(d.counterparty))))

  if (isDebtPaymentAction && (data.personal.debts?.length ?? 0) > 0) {
    const amount = extractAmount(query)
    if (amount && amount > 0) {
      // Buscar la deuda asociada por nombre de contraparte o título
      const debts = data.personal.debts ?? []
      const matchedDebt = debts.find((d) => {
        const cp = normalizeText(d.counterparty)
        const tit = normalizeText(d.title)
        return (cp && norm.includes(cp)) || (tit && norm.includes(tit))
      }) || debts.find(d => d.status !== 'cancelada')

      if (matchedDebt) {
        const paymentId = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const newPayment: DebtPayment = {
          id: paymentId,
          date: todayKey,
          amount,
          notes: 'Registrado vía asistente',
        }

        const existingPaid = (matchedDebt.payments || []).reduce((s, p) => s + p.amount, 0)
        const updatedTotalPaid = existingPaid + amount
        const isCancelled = updatedTotalPaid >= matchedDebt.totalAmount
        const newStatus = isCancelled ? 'cancelada' : 'parcial'
        const remaining = Math.max(0, matchedDebt.totalAmount - updatedTotalPaid)

        const updater = (prev: AppData): AppData => {
          const currentDebts = prev.personal.debts ?? []
          return {
            ...prev,
            personal: {
              ...prev.personal,
              debts: currentDebts.map((d) => {
                if (d.id !== matchedDebt.id) return d
                return {
                  ...d,
                  status: newStatus,
                  payments: [...(d.payments || []), newPayment],
                  paidInstallments: (d.paidInstallments || 0) + 1,
                }
              }),
            },
          }
        }

        const isPorCobrar = matchedDebt.direction === 'por_cobrar'
        const verb = isPorCobrar ? 'recibido de' : 'abonado a'

        return {
          message: createAssistantMessage(
            `🤝 **¡De diez, che! Registré el abono de $ ${amount.toLocaleString('es-AR')}.**\n\n` +
              `• **Concepto:** ${matchedDebt.title} (${matchedDebt.counterparty})\n` +
              `• **Monto ${verb}:** $ ${amount.toLocaleString('es-AR')}\n` +
              `• **Total liquidado:** $ ${updatedTotalPaid.toLocaleString('es-AR')} de $ ${matchedDebt.totalAmount.toLocaleString('es-AR')}\n` +
              `• **Estado:** ${isCancelled ? '🎉 **¡Deuda liquidada por completo! Una pinturita.**' : `Restan amortizar **$ ${remaining.toLocaleString('es-AR')}**.`}`,
            { label: 'Ver Deudas', hash: '#personal:finances' },
            {
              category: 'deudas',
              title: isPorCobrar ? 'Cobro Registrado' : 'Pago de Deuda',
              details: `$ ${amount.toLocaleString('es-AR')} para ${matchedDebt.counterparty}`,
              badge: isCancelled ? 'Cancelada' : 'Parcial',
              entityId: paymentId,
            }
          ),
          updater,
        }
      }
    }
  }

  // A2. Préstamo a un tercero ("le presté 20 lucas a Juan", "le presté $30.000 a Marcos", etc.)
  const isLendingAction =
    norm.includes('preste') ||
    norm.includes('le preste') ||
    norm.includes('prestarle') ||
    norm.includes('le di prestado') ||
    (norm.includes('preste') && norm.includes('a'))

  if (isLendingAction) {
    const amount = extractAmount(query)
    if (amount && amount > 0) {
      // Extraer a quién
      let counterparty = 'Amigo/Familiar'
      const matchName = query.match(/(?:a|para|hacia)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,25})/i)
      if (matchName) {
        counterparty = matchName[1].replace(/(?:porfa|por favor|che|hoy|lucas|mil|pesos)/gi, '').trim()
        counterparty = counterparty.charAt(0).toUpperCase() + counterparty.slice(1)
      }

      const debtId = `debt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const newDebt: DebtEntry = {
        id: debtId,
        title: `Préstamo a ${counterparty}`,
        counterparty,
        debtorType: 'persona',
        direction: 'por_cobrar',
        totalAmount: amount,
        currency: 'ARS',
        status: 'pendiente',
        payments: [],
        createdAt: new Date().toISOString(),
        notes: 'Cargado vía asistente',
      }

      const updater = (prev: AppData): AppData => ({
        ...prev,
        personal: {
          ...prev.personal,
          debts: [newDebt, ...(prev.personal.debts ?? [])],
        },
      })

      return {
        message: createAssistantMessage(
          `💸 **¡Anotado al toque, papá! Registré el préstamo por cobrar.**\n\n` +
            `• **¿A quién?:** ${counterparty}\n` +
            `• **Monto:** **$ ${amount.toLocaleString('es-AR')}**\n` +
            `• **Sentido:** Activo a favor tuyo (por cobrar)\n` +
            `• **Fecha:** Hoy (${todayKey})\n\n` +
            `Quedó guardado en tu panel de Deudas y Préstamos. Cuando te devuelva la plata, avisame y lo tachamos.`,
          { label: 'Ver Deudas', hash: '#personal:finances' },
          {
            category: 'deudas',
            title: `Préstamo a ${counterparty}`,
            details: `$ ${amount.toLocaleString('es-AR')} por cobrar`,
            badge: 'Por cobrar',
            entityId: debtId,
          }
        ),
        updater,
      }
    }
  }

  // A3. Registro de deuda propia ("le debo 50000 a la tarjeta", "anotá deuda de 120 lucas con el banco", etc.)
  const isBorrowingAction =
    norm.includes('debo') ||
    norm.includes('le debo') ||
    norm.includes('deuda con') ||
    norm.includes('saque un prestamo') ||
    norm.includes('me prestaron') ||
    (norm.includes('anota') && norm.includes('deuda'))

  if (isBorrowingAction) {
    const amount = extractAmount(query)
    if (amount && amount > 0) {
      let counterparty = 'Entidad / Persona'
      const matchTarget = query.match(/(?:a|con|al|de)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,30})/i)
      if (matchTarget) {
        counterparty = matchTarget[1].replace(/(?:porfa|por favor|che|hoy|lucas|mil|pesos|deuda)/gi, '').trim()
        counterparty = counterparty.charAt(0).toUpperCase() + counterparty.slice(1)
      }

      const isBankOrEntity =
        norm.includes('banco') ||
        norm.includes('tarjeta') ||
        norm.includes('visa') ||
        norm.includes('master') ||
        norm.includes('financiera') ||
        norm.includes('mercadopago')

      const debtId = `debt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const newDebt: DebtEntry = {
        id: debtId,
        title: `Deuda con ${counterparty}`,
        counterparty,
        debtorType: isBankOrEntity ? 'entidad' : 'persona',
        direction: 'por_pagar',
        totalAmount: amount,
        currency: 'ARS',
        status: 'pendiente',
        payments: [],
        createdAt: new Date().toISOString(),
        notes: 'Cargado vía asistente',
      }

      const updater = (prev: AppData): AppData => ({
        ...prev,
        personal: {
          ...prev.personal,
          debts: [newDebt, ...(prev.personal.debts ?? [])],
        },
      })

      return {
        message: createAssistantMessage(
          `📋 **¡Anotado, che! Registré tu compromiso de pago.**\n\n` +
            `• **Acreedor:** ${counterparty} (${isBankOrEntity ? 'Entidad' : 'Persona'})\n` +
            `• **Monto adeudado:** **$ ${amount.toLocaleString('es-AR')}**\n` +
            `• **Sentido:** Pasivo (por pagar)\n` +
            `• **Estado:** Pendiente de amortización\n\n` +
            `Tranqui que le hacemos seguimiento para tener las cuentas claras y la cabeza en paz.`,
          { label: 'Ver Deudas', hash: '#personal:finances' },
          {
            category: 'deudas',
            title: `Deuda con ${counterparty}`,
            details: `$ ${amount.toLocaleString('es-AR')} por pagar`,
            badge: 'Por pagar',
            entityId: debtId,
          }
        ),
        updater,
      }
    }
  }

  // --------------------------------------------------------------------------
  // B. MUTACIÓN: HIDRATACIÓN / AGUA ("tomé 500ml de agua", "anotá 2 vasos de agua", etc.)
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
    const mlMatch = query.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|cc)/i)
    if (mlMatch) {
      ml = Math.round(parseFloat(mlMatch[1].replace(',', '.')))
    }

    if (!ml) {
      const literMatch = query.match(/(\d+(?:[.,]\d+)?)\s*(?:litro|litros|l\b)/i)
      if (literMatch) {
        ml = Math.round(parseFloat(literMatch[1].replace(',', '.')) * 1000)
      } else if (norm.includes('un litro')) ml = 1000
      else if (norm.includes('medio litro')) ml = 500
      else if (norm.includes('dos litros')) ml = 2000
    }

    if (!ml) {
      const glassMatch = query.match(/(\d+)\s*(?:vaso|vasos)/i)
      if (glassMatch) ml = parseInt(glassMatch[1], 10) * 250
      else if (norm.includes('un vaso')) ml = 250
      else if (norm.includes('dos vasos')) ml = 500
      else if (norm.includes('tres vasos')) ml = 750
      else if (norm.includes('cuatro vasos')) ml = 1000
    }

    if (!ml) {
      const bottleMatch = query.match(/(\d+)\s*(?:botella|botellas)/i)
      if (bottleMatch) ml = parseInt(bottleMatch[1], 10) * 500
      else if (norm.includes('una botella')) ml = 500
      else if (norm.includes('dos botellas')) ml = 1000
    }

    if (!ml) {
      const genericNumber = query.match(/(\d+)/)
      if (genericNumber) {
        const val = parseInt(genericNumber[1], 10)
        ml = val > 20 ? val : val * 250
      }
    }

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
          ? '🎉 **¡Sos un crack, meta diaria al 100% completada!** Una pinturita.'
          : `💧 Te faltan **${Math.max(0, target - newTotal)} ml** para coronar el día.`

      return {
        message: createAssistantMessage(
          `💧 **¡Qué grande, che! Ya te sumé ${ml} ml de agua fresca.**\n\n• **Total de hoy:** **${newTotal} ml** de ${target} ml (**${pct}%**)\n• ${celebration}`,
          { label: 'Ver Hidratación', hash: '#health:hydration' },
          {
            category: 'agua',
            title: `+${ml} ml de Agua`,
            details: `Total de hoy: ${newTotal} ml (${pct}%)`,
            badge: `${pct}%`,
          }
        ),
        updater,
      }
    }
  }

  // --------------------------------------------------------------------------
  // C. MUTACIÓN: FINANZAS / GASTOS E INGRESOS ("gasté 5000 en comida", "ingresé 80 lucas sueldo")
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
    const amount = extractAmount(query)

    if (amount && amount > 0) {
      let category = isIncome ? 'Ingreso' : 'Varios'
      let description = ''

      if (norm.includes('comida') || norm.includes('super') || norm.includes('almuerzo') || norm.includes('cena') || norm.includes('verduleria') || norm.includes('kiosco')) {
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
      } else if (isIncome && (norm.includes('sueldo') || norm.includes('honorarios') || norm.includes('venta') || norm.includes('laburo'))) {
        category = 'Sueldo/Honorarios'
      }

      const prepMatch = query.match(/(?:en|de|para|por)\s+([a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]{3,35})/i)
      if (prepMatch) {
        description = prepMatch[1].trim()
      } else {
        description = isIncome ? 'Ingreso registrado por asistente' : `Gasto en ${category}`
      }

      const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const newTx: FinanceTransaction = {
        id: txId,
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
          `💳 **¡Guardado al pie de la letra, che!**\n\n• **Tipo:** ${isIncome ? '🟢 Ingreso' : '🔴 Gasto'}\n• **Monto:** **$ ${amount.toLocaleString('es-AR')}**\n• **Detalle:** ${newTx.description}\n• **Categoría:** ${category}\n• **Fecha:** Hoy (${todayKey})\n\nTu balance mensual se actualizó al toque. Cuidar los mangos siempre paga.`,
          { label: 'Ver Finanzas', hash: '#personal:finances' },
          {
            category: 'finanzas',
            title: isIncome ? 'Ingreso Registrado' : 'Gasto Registrado',
            details: `$ ${amount.toLocaleString('es-AR')} en ${newTx.description}`,
            badge: category,
            entityId: txId,
          }
        ),
        updater,
      }
    }
  }

  // --------------------------------------------------------------------------
  // D. MUTACIÓN: NUTRICIÓN / COMIDAS / CALORÍAS ("comí 200g de pollo 350 calorias", etc.)
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

    let calories = 0
    const calMatch = query.match(/(\d+)\s*(?:kcal|calorias|cal\b)/i)
    if (calMatch) calories = parseInt(calMatch[1], 10)

    let grams: number | undefined
    const gMatch = query.match(/(\d+)\s*(?:g|gr|gramos)\b/i)
    if (gMatch) grams = parseInt(gMatch[1], 10)

    let foodName = 'Comida registrada por asistente'
    const foodClean = query
      .replace(/(?:porfa|por favor|che|anota|anotame|registra|registrame|carga|comi|desayune|almorce|cene|merende|que)\s+/gi, '')
      .replace(/(\d+)\s*(?:kcal|calorias|cal|g|gr|gramos)\b/gi, '')
      .replace(/(?:con|de|en el|en la|para el|para la)\s+/gi, ' ')
      .trim()

    if (foodClean.length >= 3) {
      foodName = foodClean.charAt(0).toUpperCase() + foodClean.slice(1)
    }

    if (!calories) {
      calories = mealType === 'almuerzo' || mealType === 'cena' ? 450 : mealType === 'desayuno' || mealType === 'merienda' ? 250 : 150
    }

    const foodId = `food-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newFood: MealFoodItem = {
      id: foodId,
      name: foodName,
      calories,
      portion: grams ? `${grams} g` : undefined,
    }

    const updater = (prev: AppData): AppData => {
      const nutrition = prev.personal.nutrition ?? { dailyLogs: [] }
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

    return {
      message: createAssistantMessage(
        `🥗 **¡Bien ahí con los nutrientes, che!**\n\n• **Comida:** ${mealType.toUpperCase()}\n• **Alimento:** ${foodName}${grams ? ` (${grams} g)` : ''}\n• **Aporte calórico:** **${calories} kcal**\n• **Fecha:** Hoy (${todayKey})\n\n¡Sumado impecable a tu diario nutricional!`,
        { label: 'Ver Nutrición', hash: '#personal:nutrition' },
        {
          category: 'nutricion',
          title: `${foodName} (${mealType})`,
          details: `+${calories} kcal${grams ? ` · ${grams}g` : ''}`,
          badge: `${calories} kcal`,
          entityId: foodId,
        }
      ),
      updater,
    }
  }

  // --------------------------------------------------------------------------
  // E. MUTACIÓN: PESO CORPORAL / BIOMETRÍA ("anotá mi peso 75.5 kg", "pesé 80 kg", etc.)
  // --------------------------------------------------------------------------
  const isWeightAction =
    (norm.includes('peso') || norm.includes('pese') || norm.includes('balanza') || norm.includes('kilos')) &&
    (norm.includes('anota') || norm.includes('registra') || norm.includes('actualiza') || norm.includes('mi peso') || norm.includes('estoy en') || norm.includes('pese'))

  if (isWeightAction) {
    const wMatch = query.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos|k\b)?/i)
    if (wMatch) {
      const weight = parseFloat(wMatch[1].replace(',', '.'))
      if (weight >= 30 && weight <= 250) {
        const updater = (prev: AppData): AppData => ({
          ...prev,
          profile: {
            ...prev.profile,
            weightKg: weight,
            updatedAt: new Date().toISOString(),
          },
        })

        const heightM = (data.profile.heightCm || 175) / 100
        const imc = (weight / (heightM * heightM)).toFixed(1)

        return {
          message: createAssistantMessage(
            `⚖️ **¡Anotado el pesaje, che! Quedó en ${weight} kg.**\n\n• **Peso actual:** **${weight} kg**\n• **IMC aproximado:** **${imc} kg/m²**\n• **Fecha:** Hoy (${todayKey})\n\n¡Mantené el foco y la constancia que el laburo físico da sus frutos!`,
            { label: 'Ver Perfil', hash: '#profile:settings' },
            {
              category: 'biometria',
              title: 'Peso Actualizado',
              details: `${weight} kg (IMC: ${imc})`,
              badge: `${weight} kg`,
            }
          ),
          updater,
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // F. MUTACIÓN: ENTRENAMIENTOS Y SERIES ("anotá serie press banca 80kg x 8 con dropset")
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
        `🏋️ **¡Qué fierro, papá! Serie clavada en tus Entrenamientos.**\n\n• **Ejercicio:** ${exerciseName}\n• **Carga:** ${weight} kg × ${reps} repeticiones\n• **Modalidad:** ${typeBadge}\n• **Fecha:** Hoy (${todayKey})\n\n¡Metele que son pasteles! Ya quedó guardado en tu sesión.`,
        { label: 'Ver Entrenamientos', hash: '#personal:workouts' },
        {
          category: 'entrenamiento',
          title: exerciseName,
          details: `${weight}kg × ${reps} reps · ${typeBadge}`,
          badge: typeBadge,
        }
      ),
      updater,
    }
  }

  // --------------------------------------------------------------------------
  // G. MUTACIÓN: RECORDATORIOS ("recordame comprar remedio mañana a las 10", etc.)
  // --------------------------------------------------------------------------
  const isReminderAction =
    norm.includes('recordame') ||
    norm.includes('recordar') ||
    norm.includes('agendame') ||
    norm.includes('agenda') ||
    ((norm.includes('anota') || norm.includes('crea') || norm.includes('agrega')) && (norm.includes('recordatorio') || norm.includes('alarma') || norm.includes('tarea')))

  if (isReminderAction) {
    let cleanTitle = query
      .replace(/(?:porfa|por favor|che|recordame|recordar|agendame|agenda|anota|crea|agrega|un recordatorio|una alarma|una tarea|de|que|para)\s+/gi, ' ')
      .replace(/(?:hoy|mañana|a las \d+:\d+|a las \d+)\b/gi, '')
      .trim()

    if (!cleanTitle) cleanTitle = 'Recordatorio general'
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1)

    const d = new Date()
    if (norm.includes('manana')) d.setDate(d.getDate() + 1)

    const hourMatch = query.match(/(?:a las|las)\s*(\d{1,2})(?::(\d{2}))?/i)
    if (hourMatch) {
      const h = parseInt(hourMatch[1], 10)
      const m = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0
      d.setHours(h, m, 0, 0)
    } else {
      d.setHours(10, 0, 0, 0)
    }

    const dateTimeStr = d.toISOString().slice(0, 16)
    const remId = `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const updater = (prev: AppData): AppData => ({
      ...prev,
      utilities: {
        ...prev.utilities,
        reminders: [
          {
            id: remId,
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
        `⏰ **¡Agendado al toque! No se te va a pasar.**\n\n• **Asunto:** ${cleanTitle}\n• **Fecha y hora:** ${d.toLocaleDateString('es-AR')} a las ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}\n\nTe quedó listo en la lista de recordatorios y en el calendario.`,
        { label: 'Ver Recordatorios', hash: '#utilities:reminders' },
        {
          category: 'recordatorio',
          title: cleanTitle,
          details: `${d.toLocaleDateString('es-AR')} a las ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
          badge: 'Agendado',
          entityId: remId,
        }
      ),
      updater,
    }
  }

  // --------------------------------------------------------------------------
  // H. MUTACIÓN: DIARIO PERSONAL ("anotá en el diario que hoy tuve un excelente día")
  // --------------------------------------------------------------------------
  const isDiaryAction =
    (norm.includes('diario') || norm.includes('reflexion') || norm.includes('nota de hoy')) &&
    (norm.includes('anota') || norm.includes('escribe') || norm.includes('guarda') || norm.includes('agrega'))

  if (isDiaryAction) {
    let content = query
      .replace(/(?:porfa|por favor|che|anota|escribe|guarda|agrega|en el diario|en mi diario|que)\s+/gi, '')
      .trim()
    if (!content) content = 'Reflexión registrada con el asistente'
    content = content.charAt(0).toUpperCase() + content.slice(1)

    const diaryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newEntry: DiaryEntry = {
      id: diaryId,
      date: todayKey,
      title: `Reflexión del ${formatDate(todayKey)}`,
      content,
      mood: 'Bien',
      tags: ['asistente', 'reflexion'],
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
        `📓 **¡Quedó guardado en tu diario personal, che!**\n\n• **Fecha:** Hoy (${todayKey})\n• **Contenido:** "${content}"\n\nDescargar las ideas en papel digital te aclara el mate y te da perspectiva.`,
        { label: 'Abrir Diario', hash: '#diary:notes' },
        {
          category: 'diario',
          title: 'Entrada de Diario',
          details: content.slice(0, 60) + (content.length > 60 ? '...' : ''),
          badge: 'Guardado',
          entityId: diaryId,
        }
      ),
      updater,
    }
  }

  return null
}

// ============================================================================
// PROCESADOR DE CONSULTAS INTELIGENTES Y GENERADORES (ESPAÑOL PORTEÑO)
// ============================================================================

export async function processAssistantQuery(query: string, data: AppData): Promise<AssistantMessage> {
  const norm = normalizeText(query)
  const now = new Date()
  const todayKey = toLocalDateKey(now)
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Primero: Verificar mutaciones
  const mutationResult = tryExecuteAssistantMutation(query, data)
  if (mutationResult) {
    return mutationResult.message
  }

  // ==========================================
  // 1. DAILY BRIEFING / RESUMEN MATUTINO Y NOCTURNO PROACTIVO
  // ==========================================
  if (
    norm.includes('resumen del dia') ||
    norm.includes('resumen de mi dia') ||
    norm.includes('como viene mi dia') ||
    norm.includes('daily briefing') ||
    norm.includes('briefing') ||
    norm.includes('cierre del dia') ||
    norm.includes('cierre de mi dia') ||
    norm.includes('que onda mi dia') ||
    norm.includes('como fue mi dia') ||
    norm.includes('buenos dias') ||
    norm.includes('buen dia que tengo')
  ) {
    const weather = await fetchWeatherData(false).catch(() => null)
    const activeMeds = data.health.medications.filter((m) => m.active)
    const activeReminders = (data.utilities.reminders || []).filter((r) => !r.done && toLocalDateKey(r.dateTime) === todayKey)
    const todayHydration = (data.health.hydrationLogs ?? []).find((l) => l.date === todayKey)?.amountMl ?? 0
    const targetHydration = data.health.hydrationTargetMl ?? 2500
    const todayLog = data.personal.nutrition?.dailyLogs?.find((l) => l.date === todayKey)
    const targetKcal = todayLog?.targetCalories ?? data.personal.nutrition?.dailyGoals?.calories ?? 2200

    let consumedKcal = 0
    if (todayLog?.meals) {
      for (const m of todayLog.meals) {
        for (const f of m.foods) consumedKcal += f.calories
      }
    }

    const workouts = data.personal.workouts ?? []
    const todayWorkout = workouts.find((w) => w.date === todayKey)

    const pendingDebts = (data.personal.debts ?? []).filter((d) => d.status !== 'cancelada')
    const porCobrar = pendingDebts.filter((d) => d.direction === 'por_cobrar').reduce((s, d) => s + (d.totalAmount - (d.payments || []).reduce((p, x) => p + x.amount, 0)), 0)
    const porPagar = pendingDebts.filter((d) => d.direction === 'por_pagar').reduce((s, d) => s + (d.totalAmount - (d.payments || []).reduce((p, x) => p + x.amount, 0)), 0)

    const lines: string[] = []

    // Saludo porteño
    lines.push(`☕ **¡Qué hacés, che! Acá te armé el panorama completo de hoy (${formatDayName(todayKey)} ${todayKey.slice(8, 10)}/${todayKey.slice(5, 7)}):**\n`)

    // Clima
    if (weather) {
      lines.push(`🌤️ **Clima en ${weather.city}:** ${weather.temp}°C (${weather.description}). ${weather.daily[0]?.precipProb > 30 ? '🌂 Ojo que hay probabilidad de lluvia, llevate un piloto o paraguas.' : '☀️ Cielo tranqui, ideal para encarar la jornada.'}`)
    }

    // Medicación
    if (activeMeds.length > 0) {
      const medNames = activeMeds.map((m) => `${m.name} (${m.dosage})`).join(', ')
      lines.push(`💊 **Medicación del día:** Tenés ${activeMeds.length} tratamiento(s) en curso: ${medNames}.`)
    } else {
      lines.push(`💊 **Medicación:** Sin tratamientos activos para hoy. Impecable.`)
    }

    // Entrenamientos
    if (todayWorkout) {
      lines.push(`🏋️ **Entrenamiento:** Ya registraste tu sesión de hoy: "${todayWorkout.title}". ¡Grande fierrero!`)
    } else {
      lines.push(`🏋️ **Actividad física:** Todavía no registraste entreno hoy. Si metés fierros o cardio, decime y te cargo las series.`)
    }

    // Hidratación y Nutrición
    lines.push(`💧 **Agua:** ${todayHydration} ml de ${targetHydration} ml (${Math.round((todayHydration / targetHydration) * 100)}%)`)
    lines.push(`🥗 **Nutrición:** ${consumedKcal} kcal consumidas de ${targetKcal} kcal objetivo.`)

    // Recordatorios
    if (activeReminders.length > 0) {
      const remTitles = activeReminders.map((r) => r.title).join(', ')
      lines.push(`⏰ **Recordatorios de hoy:** ${remTitles}.`)
    } else {
      lines.push(`⏰ **Recordatorios:** Sin tareas agendadas para hoy. Día despejado.`)
    }

    // Deudas
    if (porCobrar > 0 || porPagar > 0) {
      lines.push(`💳 **Finanzas / Deudas:** Tenés $ ${porCobrar.toLocaleString('es-AR')} a tu favor por cobrar y $ ${porPagar.toLocaleString('es-AR')} en compromisos pendientes.`)
    }

    lines.push(`\n💡 *Cualquier cosa que necesites anotar o consultar, tirame la data y lo resolvemos en dos toques.* 😉`)

    return createAssistantMessage(lines.join('\n'), { label: 'Ir al Dashboard', hash: '#dashboard' })
  }

  // ==========================================
  // 2. ENTRENADOR AI: ARMADO DE RUTINAS CON ACTION CARD GUARDABLE
  // ==========================================
  const isWorkoutPlanRequest =
    (norm.includes('armame') || norm.includes('creame') || norm.includes('dame') || norm.includes('haceme') || norm.includes('sugerime') || norm.includes('plan de')) &&
    (norm.includes('rutina') || norm.includes('entrenamiento') || norm.includes('hipertrofia') || norm.includes('gym') || norm.includes('fuerza') || norm.includes('empuje'))

  if (isWorkoutPlanRequest) {
    const isPushPullLegs = norm.includes('empuje') || norm.includes('ppl') || norm.includes('tiron') || norm.includes('pierna')
    const days = norm.includes('3') ? 3 : norm.includes('5') ? 5 : 4

    const templateId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newTemplate: WorkoutTemplate = {
      id: templateId,
      name: isPushPullLegs ? 'Rutina Empuje / Tirón / Piernas' : `Rutina Hipertrofia Porteña (${days} Días)`,
      type: 'fuerza',
      notes: 'Rutina diseñada por tu Asistente Inteligente de LifeKeeper. Enfoque en sobrecarga progresiva y estímulo óptimo.',
      exercises: [
        {
          id: `ex-${Date.now()}-1`,
          name: 'Press de Banca Plano con Barra',
          sets: [
            { reps: 12, weight: 60, setType: 'warmup', notes: 'Aproximación' },
            { reps: 8, weight: 80, setType: 'normal', notes: 'RPE 8' },
            { reps: 8, weight: 80, setType: 'normal', notes: 'RPE 8.5' },
            { reps: 6, weight: 85, setType: 'failure', notes: 'Al fallo controlado' },
          ],
        },
        {
          id: `ex-${Date.now()}-2`,
          name: 'Remo con Barra Pendlay',
          sets: [
            { reps: 10, weight: 70, setType: 'normal' },
            { reps: 10, weight: 70, setType: 'normal' },
            { reps: 8, weight: 75, setType: 'dropset', notes: 'Bajar 20% al terminar' },
          ],
        },
        {
          id: `ex-${Date.now()}-3`,
          name: 'Sentadilla Libre con Barra Trasera',
          sets: [
            { reps: 10, weight: 90, setType: 'normal' },
            { reps: 8, weight: 100, setType: 'normal' },
            { reps: 8, weight: 100, setType: 'normal' },
          ],
        },
        {
          id: `ex-${Date.now()}-4`,
          name: 'Press Militar con Mancuernas',
          sets: [
            { reps: 12, weight: 22, setType: 'normal' },
            { reps: 10, weight: 24, setType: 'biserie', notes: 'Combinar con elevaciones laterales' },
          ],
        },
      ],
    }

    return createAssistantMessage(
      `🏋️‍♂️ **¡Tremendo plan te armé, che! Rutina de Hipertrofia (${days} Días):**\n\n` +
        `Acá tenés la estructura base con ejercicios compuestos pesados y accesorios con biseries y drop sets para maximizar el estímulo:\n\n` +
        `• **Día 1 (Empuje / Pecho & Hombros):** Press banca plano (3x8 con drop set) + Press militar + Fondos.\n` +
        `• **Día 2 (Tirón / Espalda & Bíceps):** Remo con barra + Dominadas pronas + Curl martillo en biserie.\n` +
        `• **Día 3 (Piernas & Core):** Sentadilla libre pesada + Peso muerto rumano + Prensa 45° + Elevación de gemelos.\n` +
        `• **Día 4 (Torso & Brazos / Bombeo):** Press inclinado con mancuernas + Jalón al pecho + Biserie brazos al fallo.\n\n` +
        `👇 **Hacé clic en el botón de abajo y te la guardo directamente como Plantilla en tu sección de Workouts para cargarla en 1 toque cuando entrenes.**`,
      { label: 'Ir a Workouts', hash: '#personal:workouts' },
      undefined,
      {
        type: 'workout_template',
        title: newTemplate.name,
        summary: '4 Ejercicios fundamentales · 13 Series efectivas con Drop Sets y Biseries',
        payload: newTemplate,
      }
    )
  }

  // ==========================================
  // 3. NUTRICIONISTA AI: PLAN DE ALIMENTACIÓN CON ACTION CARD
  // ==========================================
  const isNutritionPlanRequest =
    (norm.includes('armame') || norm.includes('creame') || norm.includes('dame') || norm.includes('haceme') || norm.includes('sugerime') || norm.includes('plan de')) &&
    (norm.includes('dieta') || norm.includes('nutricion') || norm.includes('comidas') || norm.includes('calorias') || norm.includes('macros'))

  if (isNutritionPlanRequest) {
    const isCutting = norm.includes('definir') || norm.includes('bajar') || norm.includes('grasa')
    const isBulking = norm.includes('volumen') || norm.includes('masa') || norm.includes('musculo') || norm.includes('ganar')

    const targetKcal = isCutting ? 1900 : isBulking ? 2600 : 2200
    const targetProt = isCutting ? 160 : isBulking ? 170 : 150
    const targetCarbs = isCutting ? 180 : isBulking ? 320 : 240
    const targetFats = isCutting ? 50 : isBulking ? 70 : 60

    return createAssistantMessage(
      `🥗 **¡Una pinturita de plan nutricional, che! (${targetKcal} kcal):**\n\n` +
        `Diseñado con balance óptimo de macros para rendir en los fierros y recuperarte:\n\n` +
        `• 🍗 **Proteínas:** **${targetProt} g** (para sintetizar masa magra sin chistar)\n` +
        `• 🍚 **Carbohidratos:** **${targetCarbs} g** (energía de calidad para entrenar pesado)\n` +
        `• 🥑 **Grasas saludables:** **${targetFats} g** (salud hormonal al palo)\n\n` +
        `**Ejemplo de distribución del día:**\n` +
        `• **Desayuno (550 kcal):** Omelette de 3 huevos + 80g de avena con fruta y café.\n` +
        `• **Almuerzo (700 kcal):** 200g de pechuga de pollo o carne magra + 150g de arroz integral + ensalada verde con oliva.\n` +
        `• **Merienda (400 kcal):** Yogur griego o queso descremado con frutos secos y una banana.\n` +
        `• **Cena (550 kcal):** Filet de pescado o lomo con batatas al horno y vegetales al vapor.\n\n` +
        `👇 **Podés tocar el botón de abajo para fijar estas metas directamente en tu sección de Nutrición.**`,
      { label: 'Ir a Nutrición', hash: '#personal:nutrition' },
      undefined,
      {
        type: 'nutrition_plan',
        title: `Plan Nutricional (${targetKcal} kcal)`,
        summary: `${targetProt}g Proteínas · ${targetCarbs}g Carbos · ${targetFats}g Grasas`,
        payload: {
          calories: targetKcal,
          proteinGrams: targetProt,
          carbsGrams: targetCarbs,
          fatsGrams: targetFats,
        },
      }
    )
  }

  // ==========================================
  // 4. CONSULTAS DE DEUDAS Y PRÉSTAMOS ("¿quién me debe plata?", "¿cuánto debo?", etc.)
  // ==========================================
  if (
    norm.includes('deuda') ||
    norm.includes('quien me debe') ||
    norm.includes('a quien le debo') ||
    norm.includes('prestamo') ||
    norm.includes('prestado') ||
    norm.includes('cuanto debo')
  ) {
    const debts = data.personal.debts ?? []
    if (debts.length === 0) {
      return createAssistantMessage(
        '🤝 **¡Cuentas claras y cero deudas, papá!**\n\nNo tenés préstamos ni deudas registradas en tu bóveda. Si le prestás plata a alguien o sacás algo a pagar, decime: *"Le presté 20 lucas a Juan"* y te lo anoto al toque.',
        { label: 'Ver Deudas', hash: '#personal:finances' },
      )
    }

    const pending = debts.filter((d) => d.status !== 'cancelada')
    const porCobrar = pending.filter((d) => d.direction === 'por_cobrar')
    const porPagar = pending.filter((d) => d.direction === 'por_pagar')

    const totalPorCobrar = porCobrar.reduce((s, d) => s + (d.totalAmount - (d.payments || []).reduce((p, x) => p + x.amount, 0)), 0)
    const totalPorPagar = porPagar.reduce((s, d) => s + (d.totalAmount - (d.payments || []).reduce((p, x) => p + x.amount, 0)), 0)

    const cobrarLines = porCobrar.map((d) => {
      const pagado = (d.payments || []).reduce((s, p) => s + p.amount, 0)
      const restan = d.totalAmount - pagado
      return `  • 🟢 **${d.counterparty}:** te debe **$ ${restan.toLocaleString('es-AR')}** (${d.title})`
    })

    const pagarLines = porPagar.map((d) => {
      const pagado = (d.payments || []).reduce((s, p) => s + p.amount, 0)
      const restan = d.totalAmount - pagado
      return `  • 🔴 **${d.counterparty}:** le debés **$ ${restan.toLocaleString('es-AR')}** (${d.title})`
    })

    const sections: string[] = []
    if (cobrarLines.length > 0) {
      sections.push(`💰 **Plata que te deben (Total a favor: $ ${totalPorCobrar.toLocaleString('es-AR')}):**\n${cobrarLines.join('\n')}`)
    } else {
      sections.push('💰 **Plata que te deben:** Nadie te debe nada por el momento.')
    }

    if (pagarLines.length > 0) {
      sections.push(`💳 **Compromisos por pagar (Total adeudado: $ ${totalPorPagar.toLocaleString('es-AR')}):**\n${pagarLines.join('\n')}`)
    } else {
      sections.push('💳 **Compromisos por pagar:** ¡No le debés un solo mango a nadie!')
    }

    return createAssistantMessage(
      `📊 **Resumen Porteño de Deudas y Préstamos:**\n\n${sections.join('\n\n')}\n\n💡 Podés registrar pagos diciéndome: *"Juan me devolvió 10 lucas"* o *"Pagué 15000 de la tarjeta Visa"*.`,
      { label: 'Administrar Deudas', hash: '#personal:finances' },
    )
  }

  // ==========================================
  // 5. CLIMA / PRONÓSTICO
  // ==========================================
  const isRainQuery = norm.includes('lluv') || norm.includes('llover') || norm.includes('llueve') || norm.includes('paragua') || norm.includes('torment')
  const isWeatherGeneral = norm.includes('clim') || norm.includes('tiemp') || norm.includes('temperat') || norm.includes('termomet') || norm.includes('calor') || norm.includes('frio') || norm.includes('pronostic')

  if (isRainQuery || isWeatherGeneral) {
    const weather = await fetchWeatherData(false).catch(() => null)
    if (!weather) {
      return createAssistantMessage(
        '🌦️ Che, no pude conectar con el servicio de meteorología en este momento. Fijate en el widget del Dashboard.',
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

    if (isRainQuery) {
      const prob = todayForecast.precipProb
      if (prob >= 50) {
        return createAssistantMessage(
          `🌧️ **¡Sí che, asegurate de llevar paraguas o piloto!**\n\n• **Probabilidad de lluvia en ${weather.city}:** **${prob}%**\n• **Cielo:** ${describeWeatherCode(todayForecast.code)}\n• **Temperatura:** ${weather.temp}°C\n\nNo te confíes que te podés empapar hasta las medias.`,
          { label: 'Ver Clima en Dashboard', hash: '#dashboard' },
        )
      }
      return createAssistantMessage(
        `☀️ **Tranqui papá, no pinta lluvia para hoy en ${weather.city}.**\n\n• **Probabilidad:** solo **${prob}%**\n• **Cielo:** ${describeWeatherCode(todayForecast.code)}\n• **Temperatura actual:** ${weather.temp}°C\n\nPodés salir sin paraguas de diez.`,
        { label: 'Ver Clima en Dashboard', hash: '#dashboard' },
      )
    }

    return createAssistantMessage(
      `🌤️ **El tiempo hoy en ${weather.city}:**\n\n• **Temperatura actual:** **${weather.temp}°C** (Sensación: ${weather.apparentTemp}°C)\n• **Cielo:** ${weather.description}\n• **Mín / Máx:** ${todayForecast.tempMin}°C / ${todayForecast.tempMax}°C\n• **Viento:** ${weather.windSpeed} km/h\n• **Lluvia:** ${todayForecast.precipProb}% de probabilidad\n\n¡Hermoso día para encarar la jornada con todo!`,
      { label: 'Ver Clima en Dashboard', hash: '#dashboard' },
    )
  }

  // ==========================================
  // 6. FINANZAS / BALANCE
  // ==========================================
  if (
    norm.includes('gast') ||
    norm.includes('plat') ||
    norm.includes('guita') ||
    norm.includes('diner') ||
    norm.includes('financ') ||
    norm.includes('ingres') ||
    norm.includes('balanc') ||
    norm.includes('cuanto me queda') ||
    norm.includes('sueldo')
  ) {
    const monthTxs = data.personal.finances.filter((t) => t.date.startsWith(currentMonth))
    const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const balance = income - expense

    const state = balance >= 0 ? '🟢 Superávit neto (venís derecho)' : '🔴 Déficit mensual (a cuidar los mangos)'
    return createAssistantMessage(
      `📊 **Balance financiero de este mes (${currentMonth}):**\n\n• **Entradas:** $ ${income.toLocaleString('es-AR')}\n• **Salidas / Gastos:** $ ${expense.toLocaleString('es-AR')}\n• **Disponible neto:** ${balance >= 0 ? '+' : ''}$ ${balance.toLocaleString('es-AR')} (${state})\n• **Movimientos registrados:** ${monthTxs.length}\n\n💡 Decime *"Gasté 4500 en súper"* y te lo anoto sin vueltas.`,
      { label: 'Ir a Finanzas', hash: '#personal:finances' },
    )
  }

  // ==========================================
  // 7. HISTORIA CLÍNICA Y MEDICACIÓN
  // ==========================================
  if (norm.includes('pastill') || norm.includes('remedi') || norm.includes('medic') || norm.includes('dosis') || norm.includes('tomas')) {
    const activeMeds = data.health.medications.filter((m) => m.active)
    if (activeMeds.length === 0) {
      return createAssistantMessage(
        '💊 Che, no tenés tratamientos médicos activos en este momento. Si empezás alguno, cargalo para no olvidarte de ninguna toma.',
        { label: 'Cargar Medicación', hash: '#health:medications' },
      )
    }
    const lines = activeMeds.map((m) => `• **${m.name}** (${m.dosage}) — Horarios: ${m.schedules.map((s) => s.time).join(', ') || 'A demanda'}`)
    return createAssistantMessage(
      `💊 **Tratamientos activos (${activeMeds.length}):**\n\n${lines.join('\n')}\n\n¡La constancia en las tomas es salud asegurada!`,
      { label: 'Gestionar Medicación', hash: '#health:medications' },
    )
  }

  // ==========================================
  // 8. SALUDOS Y AYUDA INICIAL PORTEÑA
  // ==========================================
  if (
    ['hola', 'buen dia', 'buenas', 'que tal', 'inicio', 'hello', 'hey', 'quien sos', 'ayuda', 'hola che'].some(
      (g) => norm.startsWith(g) || norm === g,
    )
  ) {
    const name = data.profile.nickName || data.profile.fullName || 'amigo'
    return createAssistantMessage(
      `¡Qué hacés, ${name}! 👋 Soy tu asistente personal de LifeKeeper, bien de acá y con la mejor onda.\n\n` +
        `Tengo toda tu bóveda bajo la lupa para darte una mano:\n` +
        `• ☀️ **Mi día:** *"¿Cómo viene mi día?"* o *"Daily briefing"*\n` +
        `• 🤝 **Deudas:** *"Le presté 20 lucas a Juan"*, *"¿Quién me debe plata?"*\n` +
        `• 🏋️ **Gym & Rutinas:** *"Armame una rutina de 4 días hipertrofia"*, *"Anotá press banca 80kg x 8"*, *"¿Qué entrené?"*\n` +
        `• 🥗 **Nutrición:** *"Armame una dieta de 2200 kcal"*, *"Comí 200g de pollo 350 kcal"*\n` +
        `• 💧 **Agua:** *"Tomé 500ml de agua"*\n` +
        `• 💳 **Finanzas:** *"Gasté 5000 en nafta"*, *"¿Cuánto gasté este mes?"*\n` +
        `• 🌦️ **Clima:** *"¿Va a llover hoy?"*\n\n` +
        `¡Pedime lo que quieras que acá estoy firme al pie del cañón!`,
      { label: 'Explorar Dashboard', hash: '#dashboard' },
    )
  }

  // ==========================================
  // 9. VAULT HEALTH SCORE
  // ==========================================
  if (norm.includes('score') || norm.includes('puntaje') || norm.includes('salud de la boveda')) {
    const res = computeVaultHealthScore(data)
    return createAssistantMessage(
      `🏆 **Tu Vault Health Score es ${res.totalScore}/100 (${res.levelLabel}):**\n\n• **Seguridad:** ${res.pillars.security.score}/25\n• **Salud:** ${res.pillars.health.score}/25\n• **Finanzas:** ${res.pillars.finances.score}/25\n• **Bienestar:** ${res.pillars.wellness.score}/25\n\n💡 **Recomendación clave:** ${res.topRecommendations[0] || '¡Excelente balance integral en tu bóveda!'}`,
      { label: 'Ver Métricas en Dashboard', hash: '#dashboard' },
    )
  }

  // ==========================================
  // 10. RESUMEN GENERAL O FALLBACK
  // ==========================================
  return createAssistantMessage(
    `Che, te entendí sobre **"${query}"**, pero no encontré un dato exacto en tu bóveda con esa frase.\n\n` +
      `Probá con alguna de estas:\n` +
      `• ☀️ *"Resumen de mi día"* (briefing completo)\n` +
      `• 🤝 *"¿Quién me debe plata?"* o *"Le presté 15 lucas a Martín"*\n` +
      `• 🏋️ *"Armame una rutina de 4 días"* o *"Anotá serie de press banca"*\n` +
      `• 🥗 *"Armame una dieta de 2500 kcal"* o *"Anotá que almorcé 400 kcal"*\n` +
      `• 💧 *"Tomé 500ml de agua"*\n` +
      `• 💳 *"Gasté 3500 en comida"*\n` +
      `• 🌦️ *"¿Va a llover hoy?"*`,
    { label: 'Ver Dashboard', hash: '#dashboard' },
  )
}
