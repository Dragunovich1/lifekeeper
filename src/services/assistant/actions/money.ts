import type { DebtEntry, FinanceTransaction } from '../../../types'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../../../utils/financeCategories'
import { capitalize, fmtDate, findByName, isoDate, money, num, oneOf, optionalIsoDate, str, uid } from './helpers'
import type { ActionDef } from './types'

const CURRENCIES = ['ARS', 'USD', 'EUR', 'USDT', 'BRL', 'CLP'] as const
// Mismas categorías que usa la vista de calendario de Finanzas (ícono y color incluidos)
const CATEGORIES = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].map((c) => c.name)

export const transactionAction: ActionDef = {
  type: 'transaction',
  about: 'gastó, pagó, compró, cobró o ingresó plata',
  hints: /gast|compre|pague|ingres|cobre|sueldo|plata|\$|pesos|lucas|mangos|dolares|usd|luz\b|alquiler|expensas|super\b/,
  schema: '{"type":"transaction","kind":"expense|income","amount":número,"currency":"ARS|USD|EUR|USDT|BRL|CLP","category":"' + CATEGORIES.join('|') + '","description":"..."}',
  example: '"gasté 5 lucas en el súper" → {"type":"transaction","kind":"expense","amount":5000,"currency":"ARS","category":"Supermercado","description":"Súper"}   (una luca = 1000, un palo = 1.000.000; sin moneda es ARS)',
  build(raw, { todayKey }) {
    const amount = num(raw.amount)
    if (!amount || amount <= 0) return null
    const kind = raw.kind === 'income' ? 'income' : 'expense'
    const currency = oneOf(raw.currency, CURRENCIES) ?? 'ARS'
    const category = CATEGORIES.find((c) => c === raw.category) ?? (kind === 'income' ? 'Otros ingresos' : 'Otros gastos')
    const description = capitalize(str(raw.description, 80)) || (kind === 'income' ? 'Ingreso registrado por asistente' : `Gasto en ${category}`)
    const tx: FinanceTransaction = { id: uid('tx'), type: kind, amount, currency, category, description, date: isoDate(raw.date, todayKey) }

    return {
      apply: (prev) => ({ ...prev, personal: { ...prev.personal, finances: [tx, ...(prev.personal.finances ?? [])] } }),
      line: `• 💳 **${kind === 'income' ? 'Ingreso' : 'Gasto'}:** ${money(amount, currency)} — ${description} (${category})`,
      card: { category: 'finanzas', title: kind === 'income' ? 'Ingreso registrado' : 'Gasto registrado', details: `${money(amount, currency)} en ${description}`, badge: category, entityId: tx.id },
      link: { label: 'Ver Finanzas', hash: '#personal:finances' },
    }
  },
}

export const debtAction: ActionDef = {
  type: 'debt',
  about: 'prestó plata, le prestaron o debe plata a alguien o a una entidad (deuda nueva)',
  hints: /debo|deuda|preste|prestamo|prestado|me deben|me debe|cuota|tarjeta|financi/,
  schema: '{"type":"debt","direction":"por_pagar|por_cobrar","counterparty":"persona o entidad","personType":"persona|entidad","amount":número,"currency":"ARS|USD|EUR|USDT|BRL|CLP","dueDate":"YYYY-MM-DD o vacío","notes":"..."}',
  example: '"le presté 20 lucas a Juan" → {"type":"debt","direction":"por_cobrar","counterparty":"Juan","personType":"persona","amount":20000,"currency":"ARS"}   ("le debo X a Y" → por_pagar)',
  build(raw, { now }) {
    const amount = num(raw.amount)
    const counterparty = capitalize(str(raw.counterparty, 60))
    if (!amount || amount <= 0) return null
    if (!counterparty) return { clarify: '¿Con quién es la deuda o el préstamo?' }

    const direction = raw.direction === 'por_pagar' ? 'por_pagar' : 'por_cobrar'
    const currency = oneOf(raw.currency, CURRENCIES) ?? 'ARS'
    const debt: DebtEntry = {
      id: uid('debt'),
      title: direction === 'por_cobrar' ? `Préstamo a ${counterparty}` : `Deuda con ${counterparty}`,
      counterparty,
      debtorType: raw.personType === 'entidad' ? 'entidad' : 'persona',
      direction,
      totalAmount: amount,
      currency,
      dueDate: optionalIsoDate(raw.dueDate),
      status: 'pendiente',
      payments: [],
      notes: str(raw.notes, 200) || 'Cargado vía asistente',
      createdAt: now.toISOString(),
    }

    return {
      apply: (prev) => ({ ...prev, personal: { ...prev.personal, debts: [debt, ...(prev.personal.debts ?? [])] } }),
      line: `• 🤝 **${direction === 'por_cobrar' ? 'Te debe' : 'Le debés a'} ${counterparty}:** ${money(amount, currency)}${debt.dueDate ? ` — vence ${fmtDate(debt.dueDate)}` : ''}`,
      card: { category: 'deudas', title: debt.title, details: `${money(amount, currency)} ${direction === 'por_cobrar' ? 'por cobrar' : 'por pagar'}`, badge: direction === 'por_cobrar' ? 'Por cobrar' : 'Por pagar', entityId: debt.id },
      link: { label: 'Ver Deudas', hash: '#personal:finances' },
    }
  },
}

export const debtPaymentAction: ActionDef = {
  type: 'debt_payment',
  about: 'pagó o cobró una parte de una deuda o préstamo que ya existe',
  hints: /pague|abone|liquide|devolvio|me pago|cuota|cancele|devolvi/,
  schema: '{"type":"debt_payment","counterparty":"persona o entidad de una deuda existente","amount":número}',
  example: '"Juan me devolvió 10 lucas" → {"type":"debt_payment","counterparty":"Juan","amount":10000}',
  build(raw, { data, todayKey }) {
    const amount = num(raw.amount)
    if (!amount || amount <= 0) return null
    const open = (data.personal.debts ?? []).filter((d) => d.status !== 'cancelada')
    if (open.length === 0) return { clarify: 'No tenés deudas ni préstamos abiertos para registrar ese pago.' }

    const debt = findByName(open, str(raw.counterparty, 60), (d) => d.counterparty) ?? (open.length === 1 ? open[0] : null)
    if (!debt) return { clarify: `¿A qué deuda corresponde? Tenés abiertas: ${open.map((d) => d.counterparty).join(', ')}.` }

    const paid = debt.payments.reduce((s, p) => s + p.amount, 0) + amount
    const remaining = Math.max(0, debt.totalAmount - paid)
    const status = paid >= debt.totalAmount ? 'cancelada' : 'parcial'

    return {
      apply: (prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          debts: (prev.personal.debts ?? []).map((d) =>
            d.id === debt.id
              ? { ...d, status, payments: [...d.payments, { id: uid('pay'), date: todayKey, amount, notes: 'Registrado vía asistente' }], paidInstallments: (d.paidInstallments || 0) + 1 }
              : d,
          ),
        },
      }),
      line: `• 💸 **Pago ${debt.direction === 'por_cobrar' ? 'recibido de' : 'a'} ${debt.counterparty}:** ${money(amount, debt.currency)} — ${status === 'cancelada' ? 'deuda saldada ✅' : `resta ${money(remaining, debt.currency)}`}`,
      card: { category: 'deudas', title: `Pago: ${debt.counterparty}`, details: `${money(amount, debt.currency)} · ${status === 'cancelada' ? 'Saldada' : `Resta ${money(remaining, debt.currency)}`}`, badge: status === 'cancelada' ? 'Saldada' : 'Parcial', entityId: debt.id },
      link: { label: 'Ver Deudas', hash: '#personal:finances' },
    }
  },
}

export const savingsAction: ActionDef = {
  type: 'savings_contribution',
  about: 'puso plata en una meta de ahorro',
  hints: /ahorr|meta|chanchito|aporte|aporté|apunte|junte|sume a|sumé a/,
  schema: '{"type":"savings_contribution","goal":"nombre de la meta de ahorro","amount":número}',
  example: '"aporté 10 lucas a la meta del viaje" → {"type":"savings_contribution","goal":"viaje","amount":10000}',
  build(raw, { data, todayKey }) {
    const amount = num(raw.amount)
    if (!amount || amount <= 0) return null
    const goals = (data.personal.savingsGoals ?? []).filter((g) => !g.completed)
    if (goals.length === 0) return { clarify: 'No tenés metas de ahorro activas. Creá una en Finanzas > Metas de ahorro y después le sumo aportes.' }

    const goal = findByName(goals, str(raw.goal, 60), (g) => g.title) ?? (goals.length === 1 ? goals[0] : null)
    if (!goal) return { clarify: `¿A cuál meta? Tenés: ${goals.map((g) => g.title).join(', ')}.` }

    const total = goal.currentAmount + amount
    const done = total >= goal.targetAmount
    const pct = Math.min(100, Math.round((total / goal.targetAmount) * 100))

    return {
      apply: (prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          savingsGoals: (prev.personal.savingsGoals ?? []).map((g) =>
            g.id === goal.id
              ? { ...g, currentAmount: g.currentAmount + amount, completed: g.currentAmount + amount >= g.targetAmount, contributions: [...g.contributions, { id: uid('sc'), date: todayKey, amount, notes: 'Aporte vía asistente' }] }
              : g,
          ),
        },
      }),
      line: `• 🐷 **Ahorro "${goal.title}":** +${money(amount, goal.currency)} — ${pct}% de la meta${done ? ' 🎉 ¡cumplida!' : ''}`,
      card: { category: 'finanzas', title: `Aporte: ${goal.title}`, details: `+${money(amount, goal.currency)} (${pct}%)`, badge: `${pct}%`, entityId: goal.id },
      link: { label: 'Ver Ahorros', hash: '#personal:finances' },
    }
  },
}

export const MONEY_ACTIONS = [transactionAction, debtAction, debtPaymentAction, savingsAction]
