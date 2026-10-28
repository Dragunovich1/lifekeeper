import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Eye, EyeOff } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import { usePreferences } from '../../preferences/context'
import { fetchCurrencySnapshot, type CurrencySnapshot } from '../../services/api'
import type { FinanceTransaction } from '../../types'
import {
  formatCurrency,
  formatCurrencyNoCents,
  formatDate,
  fromLocalDateOrDateTime,
  monthKey,
  toLocalDateKey,
} from '../../utils/dates'
import { DebtsSection } from './DebtsSection'
import { SavingsSection } from './SavingsSection'
import { FinanceCalendar } from './finance/FinanceCalendar'
import { FinanceImport } from './finance/FinanceImport'
import '../../styles/finance-calendar.css'

const createInitialFormState = (defaultCurrency = 'ARS'): Omit<FinanceTransaction, 'id'> => ({
  type: 'income',
  amount: 0,
  currency: defaultCurrency,
  category: '',
  date: new Date().toISOString(),
  description: '',
  recurring: false,
  recurrence: 'monthly',
})

const BASE_CATEGORY_SUGGESTIONS = [
  'Sueldo',
  'Hogar',
  'Comida',
  'Supermercado',
  'Facturas y servicios',
  'Salud',
  'Transporte',
]

const recurrenceLabels: Record<NonNullable<FinanceTransaction['recurrence']>, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual',
}

const palette = [
  'var(--color-accent-blue)',
  'var(--color-accent-cyan)',
  'var(--color-accent-purple)',
  'var(--color-warning)',
  'var(--color-error)',
  'var(--color-success)',
]

export const FinancesSection = () => {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const currency = preferences.currency || 'ARS'
  const transactions = data.personal.finances
  const budgets = data.personal.budgets ?? {}

  const [financeTab, setFinanceTab] = useState<'calendar' | 'transactions' | 'import' | 'debts' | 'savings'>('calendar')
  const [showFinancesBalance, setShowFinancesBalance] = useState(false)

  const [formState, setFormState] = useState<Omit<FinanceTransaction, 'id'>>(() => createInitialFormState(currency))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<Omit<FinanceTransaction, 'id'>>(() => createInitialFormState(currency))
  const [deletingTx, setDeletingTx] = useState<FinanceTransaction | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [budgetCategory, setBudgetCategory] = useState('')
  const [budgetLimit, setBudgetLimit] = useState<number>(0)

  // Cotizaciones y Conversor
  const [rates, setRates] = useState<CurrencySnapshot | null>(null)
  const [loadingRates, setLoadingRates] = useState(false)
  const [showConverter, setShowConverter] = useState(false)
  const [convAmount, setConvAmount] = useState<number>(100)
  const [convSource, setConvSource] = useState<string>('USD')
  const [convTarget, setConvTarget] = useState<string>('blue')

  const loadRates = async (force = false) => {
    setLoadingRates(true)
    const snapshot = await fetchCurrencySnapshot(force)
    if (snapshot) setRates(snapshot)
    setLoadingRates(false)
  }

  useEffect(() => {
    void loadRates(false)
  }, [])

  const existingCategories = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const item of [...transactions.map((t) => t.category), ...BASE_CATEGORY_SUGGESTIONS]) {
      const cleaned = item.trim()
      if (!cleaned) continue
      const key = cleaned.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        list.push(cleaned)
      }
    }
    return list
  }, [transactions])

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.amount || !formState.category.trim()) {
      return
    }

    const normalizedDate = fromLocalDateOrDateTime(formState.date, true)
    const isRecurring = Boolean(formState.recurring)
    const normalizedRecurrence = isRecurring ? formState.recurrence ?? 'monthly' : undefined

    const entry: FinanceTransaction = {
      ...formState,
      id: uuid(),
      category: formState.category.trim(),
      date: normalizedDate,
      amount: Number(formState.amount),
      recurring: isRecurring,
      recurrence: normalizedRecurrence,
    }

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        finances: [entry, ...previous.personal.finances],
      },
    }))

    setFormState(createInitialFormState())
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.amount || !editFormState.category.trim()) {
      return
    }

    const normalizedDate = fromLocalDateOrDateTime(editFormState.date, true)
    const isRecurring = Boolean(editFormState.recurring)
    const normalizedRecurrence = isRecurring ? editFormState.recurrence ?? 'monthly' : undefined

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        finances: previous.personal.finances.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...editFormState,
                category: editFormState.category.trim(),
                date: normalizedDate,
                amount: Number(editFormState.amount),
                recurring: isRecurring,
                recurrence: normalizedRecurrence,
              }
            : item,
        ),
      },
    }))

    setEditingId(null)
  }

  const startEdit = (item: FinanceTransaction) => {
    setEditingId(item.id)
    setEditFormState({
      type: item.type,
      amount: item.amount,
      currency: item.currency || currency,
      category: item.category,
      date: item.date,
      description: item.description ?? '',
      recurring: item.recurring ?? false,
      recurrence: item.recurrence ?? 'monthly',
    })
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        finances: previous.personal.finances.filter((item) => item.id !== id),
      },
    }))
    if (editingId === id) {
      setEditingId(null)
    }
  }

  const handleSaveBudget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanCat = budgetCategory.trim()
    if (!cleanCat || budgetLimit <= 0) return

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        budgets: {
          ...(previous.personal.budgets ?? {}),
          [cleanCat]: Number(budgetLimit),
        },
      },
    }))
    setBudgetCategory('')
    setBudgetLimit(0)
  }

  const handleRemoveBudget = (cat: string) => {
    updateData((previous) => {
      const nextBudgets = { ...(previous.personal.budgets ?? {}) }
      delete nextBudgets[cat]
      return {
        ...previous,
        personal: {
          ...previous.personal,
          budgets: nextBudgets,
        },
      }
    })
  }

  const filteredTransactions = useMemo(() => {
    const base =
      filterType === 'all' ? transactions : transactions.filter((item) => item.type === filterType)
    return [...base].sort((a, b) => (a.date > b.date ? -1 : 1))
  }, [transactions, filterType])

  const monthlySummary = useMemo(() => buildMonthlySummary(transactions), [transactions])
  const expenseBreakdown = useMemo(() => buildExpenseBreakdown(transactions), [transactions])
  const totals = useMemo(() => computeTotals(transactions), [transactions])

  const currentMonthKey = monthKey(new Date().toISOString())
  const currentMonthExpensesByCategory = useMemo(() => {
    const map = new Map<string, number>()
    transactions.forEach((tx) => {
      if (tx.type !== 'expense') return
      if (monthKey(tx.date) !== currentMonthKey) return
      const key = tx.category.trim().toLowerCase()
      map.set(key, (map.get(key) ?? 0) + tx.amount)
    })
    return map
  }, [transactions, currentMonthKey])

  const budgetEntries = useMemo(() => Object.entries(budgets), [budgets])

  return (
    <div>
      <SectionHeader
        title="Finanzas"
        subtitle="Registrá ingresos y egresos, gestioná deudas y préstamos, controlá presupuestos y divisas"
      />

      <div className="fin-section-tabs">
        <button
          type="button"
          className={financeTab === 'calendar' ? 'primary-button' : 'secondary-button'}
          onClick={() => setFinanceTab('calendar')}
        >
          📅 Calendario
        </button>
        <button
          type="button"
          className={financeTab === 'transactions' ? 'primary-button' : 'secondary-button'}
          onClick={() => setFinanceTab('transactions')}
        >
          💳 Movimientos y Presupuestos
        </button>
        <button
          type="button"
          className={financeTab === 'import' ? 'primary-button' : 'secondary-button'}
          onClick={() => setFinanceTab('import')}
        >
          📥 Importar
        </button>
        <button
          type="button"
          className={financeTab === 'debts' ? 'primary-button' : 'secondary-button'}
          onClick={() => setFinanceTab('debts')}
        >
          🤝 Deudas y Préstamos
          {(data.personal.debts?.filter((d) => d.status !== 'cancelada').length ?? 0) > 0 ? (
            <span
              style={{
                marginLeft: '0.4rem',
                background: 'var(--color-warning)',
                color: '#000',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {data.personal.debts?.filter((d) => d.status !== 'cancelada').length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className={financeTab === 'savings' ? 'primary-button' : 'secondary-button'}
          onClick={() => setFinanceTab('savings')}
        >
          🐷 Metas de Ahorro
          {(data.personal.savingsGoals?.length ?? 0) > 0 ? (
            <span
              style={{
                marginLeft: '0.4rem',
                background: 'var(--color-accent-blue)',
                color: '#fff',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {data.personal.savingsGoals?.length}
            </span>
          ) : null}
        </button>
      </div>

      {financeTab === 'calendar' ? (
        <FinanceCalendar onImport={() => setFinanceTab('import')} />
      ) : financeTab === 'import' ? (
        <FinanceImport onDone={() => setFinanceTab('calendar')} />
      ) : financeTab === 'savings' ? (
        <SavingsSection />
      ) : financeTab === 'debts' ? (
        <DebtsSection />
      ) : (
        <div className="section-body">
        {rates && rates.dolares.length > 0 ? (
          <div className="panel" style={{ paddingBottom: '1rem' }}>
            <div className="panel-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 className="panel-title">Cotizaciones y divisas en vivo</h3>
                <p className="panel-subtitle">
                  Tipos de cambio oficiales y paralelos actualizados en tiempo real
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}
                  onClick={() => setShowConverter(!showConverter)}
                >
                  {showConverter ? 'Ocultar conversor' : '💱 Conversor rápido'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}
                  onClick={() => loadRates(true)}
                  disabled={loadingRates}
                >
                  {loadingRates ? 'Actualizando...' : '↻ Refrescar'}
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
                marginBottom: showConverter ? '1rem' : 0,
              }}
            >
              {rates.dolares.slice(0, 5).map((d) => (
                <div
                  key={d.casa}
                  className="subpanel"
                  style={{ padding: '0.625rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {d.nombre}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      ${d.venta}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      C: ${d.compra}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {showConverter && (
              <div className="subpanel field-full" style={{ marginTop: '0.75rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                  Conversor de divisas
                </h4>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      Monto
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={convAmount || ''}
                      onChange={(e) => setConvAmount(Number(e.target.value))}
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      De
                    </label>
                    <select
                      className="select"
                      value={convSource}
                      onChange={(e) => setConvSource(e.target.value)}
                    >
                      <option value="USD">USD (Dólar)</option>
                      <option value="EUR">EUR (Euro)</option>
                      <option value="ARS">ARS (Pesos)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      A
                    </label>
                    <select
                      className="select"
                      value={convTarget}
                      onChange={(e) => setConvTarget(e.target.value)}
                    >
                      <option value="blue">ARS (Dólar Blue)</option>
                      <option value="oficial">ARS (Dólar Oficial)</option>
                      <option value="mep">ARS (Dólar MEP)</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div
                    style={{
                      background: 'var(--color-bg-primary)',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Resultado aproximado</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--color-accent-blue)' }}>
                      {(() => {
                        const blue = rates.dolares.find((d) => d.casa === 'blue')?.venta || 1200
                        const oficial = rates.dolares.find((d) => d.casa === 'oficial')?.venta || 1000
                        const mep = rates.dolares.find((d) => d.casa === 'bolsa')?.venta || 1150
                        const eurPerUsd = rates.global?.rates?.EUR || 0.92

                        if (convSource === 'USD') {
                          if (convTarget === 'blue') return `$${(convAmount * blue).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS`
                          if (convTarget === 'oficial') return `$${(convAmount * oficial).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS`
                          if (convTarget === 'mep') return `$${(convAmount * mep).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS`
                          if (convTarget === 'EUR') return `€${(convAmount * eurPerUsd).toFixed(2)} EUR`
                          return `$${convAmount} USD`
                        }
                        if (convSource === 'ARS') {
                          if (convTarget === 'blue') return `US$${(convAmount / blue).toFixed(2)}`
                          if (convTarget === 'oficial') return `US$${(convAmount / oficial).toFixed(2)}`
                          if (convTarget === 'mep') return `US$${(convAmount / mep).toFixed(2)}`
                          if (convTarget === 'EUR') return `€${((convAmount / oficial) * eurPerUsd).toFixed(2)}`
                          return `$${convAmount} ARS`
                        }
                        if (convSource === 'EUR') {
                          const usdEquivalent = convAmount / eurPerUsd
                          if (convTarget === 'blue') return `$${(usdEquivalent * blue).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS`
                          if (convTarget === 'oficial') return `$${(usdEquivalent * oficial).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS`
                          if (convTarget === 'USD') return `US$${usdEquivalent.toFixed(2)}`
                          return `€${convAmount} EUR`
                        }
                        return '—'
                      })()}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Nuevo movimiento</h3>
          </div>
          <form className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }} onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="fin-type">Tipo</label>
              <Select
                id="fin-type"
                value={formState.type}
                onChange={(value) =>
                  setFormState({ ...formState, type: value as FinanceTransaction['type'] })
                }
                options={[
                  { value: 'income', label: 'Ingreso' },
                  { value: 'expense', label: 'Egreso' },
                ]}
                ariaLabel="Tipo de movimiento"
              />
            </div>
            <div className="field">
              <label htmlFor="fin-amount">Monto</label>
              <input
                id="fin-amount"
                type="number"
                step="any"
                value={formState.amount || ''}
                onChange={(event) =>
                  setFormState({ ...formState, amount: Number(event.target.value) })
                }
                placeholder="0.00"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="fin-currency">Moneda</label>
              <Select
                id="fin-currency"
                value={formState.currency || currency || 'ARS'}
                onChange={(val) => setFormState({ ...formState, currency: val })}
                options={[
                  { value: 'ARS', label: 'ARS ($ Pesos)' },
                  { value: 'USD', label: 'USD (US$ Dólares)' },
                  { value: 'EUR', label: 'EUR (€ Euros)' },
                  { value: 'USDT', label: 'USDT (₮ Tether)' },
                  { value: 'BRL', label: 'BRL (R$ Reales)' },
                  { value: 'CLP', label: 'CLP ($ Pesos Chilenos)' },
                ]}
                ariaLabel="Moneda del movimiento"
              />
            </div>
            <div className="field">
              <label htmlFor="fin-category">Categoría</label>
              <input
                id="fin-category"
                value={formState.category}
                onChange={(event) => setFormState({ ...formState, category: event.target.value })}
                placeholder="Ej. sueldo, luz, comida"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="fin-date">Fecha</label>
              <DatePicker
                id="fin-date"
                value={toLocalDateKey(formState.date)}
                onChange={(value) =>
                  setFormState({ ...formState, date: fromLocalDateOrDateTime(value, true) })
                }
                ariaLabel="Fecha del movimiento"
              />
            </div>
            <div className="field">
              <label htmlFor="fin-recurring">Frecuencia</label>
              <Select
                id="fin-recurring"
                value={formState.recurring ? 'yes' : 'no'}
                onChange={(value) =>
                  setFormState({
                    ...formState,
                    recurring: value === 'yes',
                    recurrence: value === 'yes' ? formState.recurrence ?? 'monthly' : undefined,
                  })
                }
                options={[
                  { value: 'no', label: 'No, movimiento único' },
                  { value: 'yes', label: 'Sí, es recurrente' },
                ]}
                ariaLabel="¿Es un movimiento recurrente?"
              />
            </div>
            {formState.recurring ? (
              <div className="field">
                <label htmlFor="fin-recurrence">Periodicidad</label>
                <Select
                  id="fin-recurrence"
                  value={formState.recurrence ?? 'monthly'}
                  onChange={(value) =>
                    setFormState({
                      ...formState,
                      recurrence: value as NonNullable<FinanceTransaction['recurrence']>,
                    })
                  }
                  options={[
                    { value: 'monthly', label: 'Mensual' },
                    { value: 'weekly', label: 'Semanal' },
                    { value: 'yearly', label: 'Anual' },
                  ]}
                  ariaLabel="Periodicidad del movimiento"
                />
              </div>
            ) : null}

            {existingCategories.length > 0 ? (
              <div className="field-full" style={{ marginTop: '-0.25rem' }}>
                <div
                  className="tag-suggestions"
                  aria-label="Categorías sugeridas"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    flexWrap: 'wrap',
                    padding: '0.25rem 0',
                  }}
                >
                  <span
                    className="tag-suggestions-label"
                    style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}
                  >
                    Rápidas:
                  </span>
                  {existingCategories.slice(0, 10).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className="tag-suggestion-chip"
                      onClick={() => setFormState({ ...formState, category: cat })}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="field field-full">
              <label htmlFor="fin-description">Descripción</label>
              <textarea
                id="fin-description"
                value={formState.description ?? ''}
                onChange={(event) =>
                  setFormState({ ...formState, description: event.target.value })
                }
                placeholder="Detalle opcional"
              />
            </div>
            <div className="form-actions field-full">
              <button className="primary-button" type="submit">
                Registrar movimiento
              </button>
            </div>
          </form>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-title">Ingresos totales</span>
            <span className="stat-value">
              {showFinancesBalance ? formatCurrencyNoCents(totals.income, currency) : '••••••'}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-title">Egresos totales</span>
            <span className="stat-value">
              {showFinancesBalance ? formatCurrencyNoCents(totals.expense, currency) : '••••••'}
            </span>
          </div>
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-title">Balance mensual</span>
              <button
                type="button"
                onClick={() => setShowFinancesBalance((prev) => !prev)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  padding: '0.2rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                title={showFinancesBalance ? 'Ocultar montos' : 'Mostrar montos'}
              >
                {showFinancesBalance ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span
              className={`stat-value${totals.income - totals.expense < 0 ? ' is-negative' : ''}`}
            >
              {showFinancesBalance
                ? formatCurrencyNoCents(totals.income - totals.expense, currency)
                : '••••••'}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-title">Gasto fijo mensual estimado</span>
            <span className="stat-value">
              {showFinancesBalance
                ? formatCurrencyNoCents(totals.fixedMonthlyExpense, currency)
                : '••••••'}
            </span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Presupuestos mensuales por categoría</h3>
              <p className="panel-subtitle">
                Definí topes mensuales en {currency} y compará el consumo del mes actual ({currentMonthKey})
              </p>
            </div>
          </div>
          <form
            onSubmit={handleSaveBudget}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr)) auto',
                gap: '0.875rem',
                alignItems: 'flex-end',
              }}
            >
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="budget-category">Categoría</label>
                <input
                  id="budget-category"
                  value={budgetCategory}
                  onChange={(event) => setBudgetCategory(event.target.value)}
                  placeholder="Ej. Supermercado, Servicios"
                  required
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="budget-limit">Tope mensual ({currency})</label>
                <input
                  id="budget-limit"
                  type="number"
                  step="100"
                  min="1"
                  value={budgetLimit || ''}
                  onChange={(event) => setBudgetLimit(Number(event.target.value))}
                  placeholder="Ej. 150000"
                  required
                />
              </div>
              <button
                className="primary-button"
                type="submit"
                style={{ height: '40px', whiteSpace: 'nowrap' }}
              >
                Guardar tope
              </button>
            </div>

            {existingCategories.length > 0 ? (
              <div
                className="tag-suggestions"
                aria-label="Categorías disponibles"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  className="tag-suggestions-label"
                  style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}
                >
                  Categorías disponibles:
                </span>
                {existingCategories.slice(0, 10).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className="tag-suggestion-chip"
                    onClick={() => setBudgetCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            ) : null}
          </form>

          {budgetEntries.length === 0 ? (
            <div className="empty-state">
              Todavía no configuraste topes mensuales por categoría.
            </div>
          ) : (
            <div className="section-body">
              {budgetEntries.map(([category, limit]) => {
                const spent =
                  currentMonthExpensesByCategory.get(category.trim().toLowerCase()) ?? 0
                const rawPercent = limit > 0 ? Math.round((spent / limit) * 100) : 0
                const barWidth = Math.min(100, Math.max(0, rawPercent))
                const statusBadge =
                  rawPercent >= 100 ? (
                    <span className="badge badge-error">Excedido ({rawPercent}%)</span>
                  ) : rawPercent >= 80 ? (
                    <span className="badge badge-warning">Alerta ({rawPercent}%)</span>
                  ) : (
                    <span className="badge badge-success">En rango ({rawPercent}%)</span>
                  )

                return (
                  <div key={category} className="subpanel">
                    <div className="panel-header">
                      <div>
                        <h4 className="panel-title">{category}</h4>
                        <span className="panel-subtitle">
                          Gastado este mes: {formatCurrency(spent, currency)} de {formatCurrency(limit, currency)}
                        </span>
                      </div>
                      <div className="section-actions">
                        {statusBadge}
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => handleRemoveBudget(category)}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                    <div className="progress-track" aria-label={`Presupuesto ${category}`}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${barWidth}%`,
                          background:
                            rawPercent >= 100
                              ? 'var(--color-error)'
                              : rawPercent >= 80
                                ? 'var(--color-warning)'
                                : undefined,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <h3 className="panel-title">Resumen mensual</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={monthlySummary}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border-strong)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="var(--color-border-strong)"
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--color-border-strong)"
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                  tickLine={false}
                  width={64}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  formatter={(val: unknown) => [formatCurrency(Number(val) || 0, currency)]}
                  contentStyle={{
                    background: 'var(--color-bg-elevated)',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 12,
                    color: 'var(--color-text-primary)',
                  }}
                  labelStyle={{ color: 'var(--color-text-tertiary)' }}
                />
                <Bar
                  dataKey="income"
                  stackId="a"
                  fill="var(--color-success)"
                  name="Ingresos"
                  radius={[0, 0, 6, 6]}
                />
                <Bar
                  dataKey="expense"
                  stackId="a"
                  fill="var(--color-error)"
                  name="Egresos"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <h3 className="panel-title">Egresos por categoría</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Tooltip
                  formatter={(val: unknown) => [formatCurrency(Number(val) || 0, currency)]}
                  contentStyle={{
                    background: 'var(--color-bg-elevated)',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 12,
                    color: 'var(--color-text-primary)',
                  }}
                  labelStyle={{ color: 'var(--color-text-tertiary)' }}
                />
                <Pie
                  data={expenseBreakdown}
                  dataKey="value"
                  nameKey="category"
                  innerRadius={50}
                  outerRadius={90}
                >
                  {expenseBreakdown.map((item, index) => (
                    <Cell key={item.category} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Movimientos</h3>
            <Select
              value={filterType}
              onChange={(value) => setFilterType(value as typeof filterType)}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'income', label: 'Ingresos' },
                { value: 'expense', label: 'Egresos' },
              ]}
              ariaLabel="Filtrar movimientos por tipo"
            />
          </div>
          {filteredTransactions.length === 0 ? (
            <div className="empty-state">Sin registros para mostrar.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.date)}</td>
                    <td>
                      <div className="chip-list">
                        <span>{item.type === 'income' ? 'Ingreso' : 'Egreso'}</span>
                        {item.recurring ? (
                          <span className="badge badge-info">
                            Recurrente
                            {item.recurrence ? ` · ${recurrenceLabels[item.recurrence]}` : ''}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>
                        {formatCurrency(item.amount, item.currency || currency)}
                      </span>
                      {item.currency && item.currency !== currency ? (
                        <span
                          className="badge"
                          style={{
                            marginLeft: '0.4rem',
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.35rem',
                          }}
                        >
                          {item.currency}
                        </span>
                      ) : null}
                    </td>
                    <td>{item.category}</td>
                    <td>{item.description || '—'}</td>
                    <td>
                      <div className="section-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => startEdit(item)}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setDeletingTx(item)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Editar movimiento financiero"
        subtitle="Actualizá los datos del ingreso o egreso"
        maxWidth="680px"
      >
        <form className="form-grid three-columns" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-fin-type">Tipo</label>
            <Select
              id="edit-fin-type"
              value={editFormState.type}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  type: value as FinanceTransaction['type'],
                })
              }
              options={[
                { value: 'income', label: 'Ingreso' },
                { value: 'expense', label: 'Egreso' },
              ]}
              ariaLabel="Tipo de movimiento"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-fin-amount">Monto</label>
            <input
              id="edit-fin-amount"
              type="number"
              step="any"
              value={editFormState.amount || ''}
              onChange={(event) =>
                setEditFormState({
                  ...editFormState,
                  amount: Number(event.target.value),
                })
              }
              placeholder="0.00"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="edit-fin-currency">Moneda</label>
            <Select
              id="edit-fin-currency"
              value={editFormState.currency || currency || 'ARS'}
              onChange={(val) => setEditFormState({ ...editFormState, currency: val })}
              options={[
                { value: 'ARS', label: 'ARS ($ Pesos)' },
                { value: 'USD', label: 'USD (US$ Dólares)' },
                { value: 'EUR', label: 'EUR (€ Euros)' },
                { value: 'USDT', label: 'USDT (₮ Tether)' },
                { value: 'BRL', label: 'BRL (R$ Reales)' },
                { value: 'CLP', label: 'CLP ($ Pesos Chilenos)' },
              ]}
              ariaLabel="Moneda del movimiento"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-fin-category">Categoría</label>
            <input
              id="edit-fin-category"
              value={editFormState.category}
              onChange={(event) =>
                setEditFormState({ ...editFormState, category: event.target.value })
              }
              placeholder="Ej. sueldo, luz, comida"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="edit-fin-date">Fecha</label>
            <DatePicker
              id="edit-fin-date"
              value={toLocalDateKey(editFormState.date)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  date: fromLocalDateOrDateTime(value, true),
                })
              }
              ariaLabel="Fecha del movimiento"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-fin-recurring">Frecuencia</label>
            <Select
              id="edit-fin-recurring"
              value={editFormState.recurring ? 'yes' : 'no'}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  recurring: value === 'yes',
                  recurrence:
                    value === 'yes'
                      ? editFormState.recurrence ?? 'monthly'
                      : undefined,
                })
              }
              options={[
                { value: 'no', label: 'No, movimiento único' },
                { value: 'yes', label: 'Sí, es recurrente' },
              ]}
              ariaLabel="¿Es un movimiento recurrente?"
            />
          </div>
          {editFormState.recurring ? (
            <div className="field">
              <label htmlFor="edit-fin-recurrence">Periodicidad</label>
              <Select
                id="edit-fin-recurrence"
                value={editFormState.recurrence ?? 'monthly'}
                onChange={(value) =>
                  setEditFormState({
                    ...editFormState,
                    recurrence: value as NonNullable<FinanceTransaction['recurrence']>,
                  })
                }
                options={[
                  { value: 'monthly', label: 'Mensual' },
                  { value: 'weekly', label: 'Semanal' },
                  { value: 'yearly', label: 'Anual' },
                ]}
                ariaLabel="Periodicidad del movimiento"
              />
            </div>
          ) : null}

          {existingCategories.length > 0 ? (
            <div className="field-full" style={{ marginTop: '-0.25rem' }}>
              <div
                className="tag-suggestions"
                aria-label="Sugerencias de categorías"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  flexWrap: 'wrap',
                  padding: '0.25rem 0',
                }}
              >
                <span
                  className="tag-suggestions-label"
                  style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}
                >
                  Rápidas:
                </span>
                {existingCategories.slice(0, 10).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className="tag-suggestion-chip"
                    onClick={() =>
                      setEditFormState({ ...editFormState, category: cat })
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="field field-full">
            <label htmlFor="edit-fin-description">Descripción</label>
            <textarea
              id="edit-fin-description"
              value={editFormState.description ?? ''}
              onChange={(event) =>
                setEditFormState({
                  ...editFormState,
                  description: event.target.value,
                })
              }
              placeholder="Detalle opcional"
            />
          </div>
          <div
            className="form-actions field-full"
            style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}
          >
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditingId(null)}
            >
              Cancelar
            </button>
            <button className="primary-button" type="submit">
              Guardar cambios
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deletingTx)}
        title="Eliminar movimiento"
        message={
          deletingTx
            ? `¿Querés eliminar el movimiento de "${deletingTx.category}" por ${formatCurrency(deletingTx.amount, currency)}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deletingTx) {
            handleRemove(deletingTx.id)
          }
        }}
        onClose={() => setDeletingTx(null)}
      />
    </div>
  )
}

const buildMonthlySummary = (transactions: FinanceTransaction[]) => {
  const summary = new Map<string, { month: string; income: number; expense: number }>()
  transactions.forEach((item) => {
    const key = monthKey(item.date)
    if (!summary.has(key)) {
      summary.set(key, { month: key, income: 0, expense: 0 })
    }
    const bucket = summary.get(key)!
    if (item.type === 'income') {
      bucket.income += item.amount
    } else {
      bucket.expense += item.amount
    }
  })

  return Array.from(summary.values())
    .sort((a, b) => (a.month > b.month ? 1 : -1))
    .slice(-6)
}

const buildExpenseBreakdown = (transactions: FinanceTransaction[]) => {
  const expenses = transactions.filter((item) => item.type === 'expense')
  const breakdown = new Map<string, number>()
  expenses.forEach((item) =>
    breakdown.set(item.category, (breakdown.get(item.category) ?? 0) + item.amount),
  )
  return Array.from(breakdown.entries()).map(([category, value]) => ({ category, value }))
}

const computeTotals = (transactions: FinanceTransaction[]) => {
  return transactions.reduce(
    (acc, item) => {
      if (item.type === 'income') {
        acc.income += item.amount
      } else {
        acc.expense += item.amount
        if (item.recurring) {
          if (item.recurrence === 'weekly') {
            acc.fixedMonthlyExpense += item.amount * (52 / 12)
          } else if (item.recurrence === 'yearly') {
            acc.fixedMonthlyExpense += item.amount / 12
          } else {
            acc.fixedMonthlyExpense += item.amount
          }
        }
      }
      return acc
    },
    { income: 0, expense: 0, fixedMonthlyExpense: 0 },
  )
}
