import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
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
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { FinanceTransaction } from '../../types'
import { formatDate, monthKey } from '../../utils/dates'

const initialFormState: Omit<FinanceTransaction, 'id'> = {
  type: 'income',
  amount: 0,
  category: '',
  date: new Date().toISOString(),
  description: '',
  recurring: false,
  recurrence: undefined,
}

const palette = ['#22c55e', '#38bdf8', '#f97316', '#facc15', '#6366f1', '#ec4899']

export const FinancesSection = () => {
  const { data, updateData } = useAppData()
  const transactions = data.personal.finances
  const [formState, setFormState] = useState(initialFormState)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.amount || !formState.category) {
      return
    }

    const entry: FinanceTransaction = {
      ...formState,
      id: uuid(),
      date: new Date(formState.date).toISOString(),
      amount: Number(formState.amount),
    }

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        finances: [entry, ...previous.personal.finances],
      },
    }))

    setFormState(initialFormState)
  }

  const filteredTransactions = useMemo(() => {
    if (filterType === 'all') {
      return transactions
    }
    return transactions.filter((item) => item.type === filterType)
  }, [transactions, filterType])

  const monthlySummary = useMemo(() => buildMonthlySummary(transactions), [transactions])
  const expenseBreakdown = useMemo(() => buildExpenseBreakdown(transactions), [transactions])
  const totals = useMemo(() => computeTotals(transactions), [transactions])

  return (
    <div>
      <SectionHeader
        title="Finanzas"
        subtitle="Registra ingresos y egresos, visualiza tendencias rapidas"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Nuevo movimiento</h3>
          </div>
          <form className="form-grid three-columns" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="fin-type">Tipo</label>
              <select
                id="fin-type"
                value={formState.type}
                onChange={(event) => setFormState({ ...formState, type: event.target.value as FinanceTransaction['type'] })}
              >
                <option value="income">Ingreso</option>
                <option value="expense">Egreso</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="fin-amount">Monto</label>
              <input
                id="fin-amount"
                type="number"
                step="0.01"
                value={formState.amount}
                onChange={(event) => setFormState({ ...formState, amount: Number(event.target.value) })}
                placeholder="0.00"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="fin-category">Categoria</label>
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
              <input
                id="fin-date"
                type="date"
                value={formState.date.slice(0, 10)}
                onChange={(event) =>
                  setFormState({ ...formState, date: new Date(event.target.value).toISOString() })
                }
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="fin-description">Descripcion</label>
              <textarea
                id="fin-description"
                value={formState.description ?? ''}
                onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                placeholder="Detalle opcional"
              />
            </div>
            <button className="primary-button" type="submit">
              Registrar movimiento
            </button>
          </form>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-title">Ingresos totales</span>
            <span className="stat-value">${totals.income.toFixed(2)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-title">Egresos totales</span>
            <span className="stat-value">${totals.expense.toFixed(2)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-title">Balance</span>
            <span className="stat-value">${(totals.income - totals.expense).toFixed(2)}</span>
          </div>
        </div>

        <div className="panel">
          <h3 className="panel-title">Resumen mensual</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={monthlySummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
                <Bar dataKey="income" stackId="a" fill="#22c55e" name="Ingresos" />
                <Bar dataKey="expense" stackId="a" fill="#ef4444" name="Egresos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <h3 className="panel-title">Egresos por categoria</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Tooltip />
                <Pie data={expenseBreakdown} dataKey="value" nameKey="category" innerRadius={50} outerRadius={90}>
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
            <select value={filterType} onChange={(event) => setFilterType(event.target.value as typeof filterType)}>
              <option value="all">Todos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Egresos</option>
            </select>
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
                  <th>Categoria</th>
                  <th>Descripcion</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.type === 'income' ? 'Ingreso' : 'Egreso'}</td>
                    <td>${item.amount.toFixed(2)}</td>
                    <td>{item.category}</td>
                    <td>{item.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
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

  return Array.from(summary.values()).sort((a, b) => (a.month > b.month ? 1 : -1)).slice(-6)
}

const buildExpenseBreakdown = (transactions: FinanceTransaction[]) => {
  const expenses = transactions.filter((item) => item.type === 'expense')
  const breakdown = new Map<string, number>()
  expenses.forEach((item) => breakdown.set(item.category, (breakdown.get(item.category) ?? 0) + item.amount))
  return Array.from(breakdown.entries()).map(([category, value]) => ({ category, value }))
}

const computeTotals = (transactions: FinanceTransaction[]) => {
  return transactions.reduce(
    (acc, item) => {
      if (item.type === 'income') {
        acc.income += item.amount
      } else {
        acc.expense += item.amount
      }
      return acc
    },
    { income: 0, expense: 0 },
  )
}
