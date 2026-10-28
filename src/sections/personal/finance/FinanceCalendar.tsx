import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ChevronLeft, ChevronRight, Eye, EyeOff, FileUp, Minus, Pencil, Plus } from 'lucide-react'
import { CategoryIcon } from '../../../components/CategoryIcon'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { Modal } from '../../../components/Modal'
import { useAppData } from '../../../hooks/useAppData'
import { useMobileLayout } from '../../../hooks/useMobileLayout'
import { usePreferences } from '../../../preferences/context'
import type { FinanceCategoryDef, FinanceTransaction, TransactionType } from '../../../types'
import { formatCurrencyNoCents, toLocalDateKey } from '../../../utils/dates'
import { resolveCategory } from '../../../utils/financeCategories'
import { TransactionModal, type TransactionDraft } from './TransactionModal'
import '../../../styles/finance-calendar.css'

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

type Tab = 'income' | 'balance' | 'expense'

interface DayAgg {
  income: number
  expense: number
  items: FinanceTransaction[]
}

/** 42 celdas (6 semanas) con la semana arrancando en lunes. */
function buildGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - offset + i)
    return { key: keyOf(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === month }
  })
}

const compact = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`
  return String(Math.round(n))
}

const dayTitle = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  const t = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function FinanceCalendar({ onImport }: { onImport: () => void }) {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const { isMobile } = useMobileLayout()
  const defaultCurrency = preferences.currency || 'ARS'
  const customCats = useMemo(() => data.personal.financeCategories ?? [], [data.personal.financeCategories])
  const transactions = data.personal.finances

  const today = new Date()
  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate())

  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [tab, setTab] = useState<Tab>('expense')
  const [selected, setSelected] = useState<string>(todayKey)
  const [reveal, setReveal] = useState(false)
  const [currency, setCurrency] = useState<string>(defaultCurrency)
  const [showAllCats, setShowAllCats] = useState(false)
  const [dayModal, setDayModal] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const [draft, setDraft] = useState<TransactionDraft | null>(null)
  const [txOpen, setTxOpen] = useState(false)
  const [deleting, setDeleting] = useState<FinanceTransaction | null>(null)
  const [notice, setNotice] = useState('')

  const flash = (t: string) => {
    setNotice(t)
    window.setTimeout(() => setNotice(''), 2200)
  }

  const curOf = (t: FinanceTransaction) => t.currency || defaultCurrency
  const currencies = useMemo(() => {
    const set = new Set<string>([defaultCurrency])
    transactions.forEach((t) => set.add(curOf(t)))
    return [...set]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, defaultCurrency])

  const monthPrefix = `${cursor.year}-${pad(cursor.month + 1)}`
  const monthTx = useMemo(
    () => transactions.filter((t) => curOf(t) === currency && toLocalDateKey(t.date).startsWith(monthPrefix)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, currency, monthPrefix],
  )

  const byDay = useMemo(() => {
    const map = new Map<string, DayAgg>()
    for (const t of monthTx) {
      const k = toLocalDateKey(t.date)
      const agg = map.get(k) ?? { income: 0, expense: 0, items: [] }
      if (t.type === 'income') agg.income += t.amount
      else agg.expense += t.amount
      agg.items.push(t)
      map.set(k, agg)
    }
    return map
  }, [monthTx])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of monthTx) t.type === 'income' ? (income += t.amount) : (expense += t.amount)
    return { income, expense, balance: income - expense }
  }, [monthTx])

  const categoryRows = useMemo(() => {
    const kind: TransactionType = tab === 'income' ? 'income' : 'expense'
    const total = kind === 'income' ? totals.income : totals.expense
    const map = new Map<string, { name: string; icon: string; color: string; amount: number }>()
    for (const t of monthTx) {
      if (t.type !== kind) continue
      const v = resolveCategory(t.category, kind, customCats)
      const row = map.get(v.name) ?? { name: v.name, icon: v.icon, color: v.color, amount: 0 }
      row.amount += t.amount
      map.set(v.name, row)
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount).map((r) => ({ ...r, pct: total > 0 ? (r.amount / total) * 100 : 0 }))
  }, [monthTx, tab, totals, customCats])

  const grid = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor])
  const money = (n: number) => (reveal ? formatCurrencyNoCents(n, currency) : '••••')

  // ---- Navegación ----------------------------------------------------------
  const shiftMonth = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }
  const goToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() })
    setSelected(todayKey)
  }
  const prevLabel = MONTHS[(cursor.month + 11) % 12].slice(0, 4).toLowerCase() + '.'
  const nextLabel = MONTHS[(cursor.month + 1) % 12].slice(0, 4).toLowerCase() + '.'

  // ---- Alta / edición ------------------------------------------------------
  const openNew = (type: TransactionType, dateKey?: string) => {
    setDraft({ type, amount: '', currency, category: '', date: dateKey ?? selected ?? todayKey, description: '', recurring: false, recurrence: 'monthly' })
    setTxOpen(true)
    setFabOpen(false)
  }

  const openEdit = (t: FinanceTransaction) => {
    setDraft({ id: t.id, type: t.type, amount: String(t.amount), currency: curOf(t), category: t.category, date: toLocalDateKey(t.date), description: t.description ?? '', recurring: Boolean(t.recurring), recurrence: t.recurrence ?? 'monthly' })
    setTxOpen(true)
  }

  const saveTx = (d: TransactionDraft) => {
    updateData((prev) => {
      const existing = d.id ? prev.personal.finances.find((t) => t.id === d.id) : undefined
      const tx: FinanceTransaction = {
        ...(existing ?? {}),
        id: d.id ?? uuid(),
        type: d.type,
        amount: Number(d.amount),
        currency: d.currency,
        category: d.category.trim(),
        date: d.date,
        description: d.description.trim() || undefined,
        recurring: d.recurring,
        recurrence: d.recurring ? d.recurrence : undefined,
      }
      const finances = existing ? prev.personal.finances.map((t) => (t.id === tx.id ? tx : t)) : [tx, ...prev.personal.finances]
      return { ...prev, personal: { ...prev.personal, finances } }
    })
    const [y, m] = d.date.split('-').map(Number)
    setCursor({ year: y, month: m - 1 })
    setSelected(d.date)
    setCurrency(d.currency)
    setTxOpen(false)
    flash(d.id ? 'Movimiento actualizado' : d.type === 'income' ? 'Ingreso guardado' : 'Gasto guardado')
  }

  const confirmDelete = () => {
    if (deleting) updateData((prev) => ({ ...prev, personal: { ...prev.personal, finances: prev.personal.finances.filter((t) => t.id !== deleting.id) } }))
    setDeleting(null)
    setTxOpen(false)
  }

  const createCategory = (def: FinanceCategoryDef) =>
    updateData((prev) => ({ ...prev, personal: { ...prev.personal, financeCategories: [...(prev.personal.financeCategories ?? []), def] } }))
  const deleteCategory = (id: string) =>
    updateData((prev) => ({ ...prev, personal: { ...prev.personal, financeCategories: (prev.personal.financeCategories ?? []).filter((c) => c.id !== id) } }))

  // ---- Panel del día -------------------------------------------------------
  const dayAgg = byDay.get(selected)
  const dayList = (
    <div className="fin-day">
      <header className="fin-day-head">
        <h3>{dayTitle(selected)}</h3>
        {dayAgg && (
          <span className="fin-day-totals">
            {dayAgg.income > 0 && <b className="inc">+{money(dayAgg.income)}</b>}
            {dayAgg.expense > 0 && <b className="exp">−{money(dayAgg.expense)}</b>}
          </span>
        )}
      </header>
      {!dayAgg || dayAgg.items.length === 0 ? (
        <p className="fin-day-empty">No hay movimientos este día. Podés añadir un gasto o un ingreso.</p>
      ) : (
        <ul className="fin-day-list">
          {dayAgg.items.map((t) => {
            const v = resolveCategory(t.category, t.type, customCats)
            return (
              <li key={t.id}>
                <button type="button" onClick={() => openEdit(t)} aria-label={`Editar ${v.name}`}>
                  <CategoryIcon icon={v.icon} color={v.color} size={16} />
                  <span className="fin-day-name">
                    <strong>{v.name}</strong>
                    {t.description && <small>{t.description}</small>}
                  </span>
                  <span className={`fin-day-amount ${t.type === 'income' ? 'inc' : 'exp'}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</span>
                  <Pencil size={14} className="fin-day-edit" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="fin-day-actions">
        <button type="button" className="fin-add inc" onClick={() => openNew('income', selected)}><Plus size={16} /> Añadir ingreso</button>
        <button type="button" className="fin-add exp" onClick={() => openNew('expense', selected)}><Minus size={16} /> Añadir gasto</button>
      </div>
    </div>
  )

  const visibleRows = showAllCats ? categoryRows : categoryRows.slice(0, 5)

  return (
    <div className="fin-cal">
      {/* Ingresos | Saldo | Gastos */}
      <div className="fin-tabs" role="tablist" aria-label="Qué ver">
        <button type="button" role="tab" aria-selected={tab === 'income'} className={`inc ${tab === 'income' ? 'is-active' : ''}`} onClick={() => setTab('income')}>
          <span>Ingresos</span><strong>{money(totals.income)}</strong>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'balance'} className={`bal ${tab === 'balance' ? 'is-active' : ''}`} onClick={() => setTab('balance')}>
          <span>Saldo</span><strong className={totals.balance < 0 ? 'neg' : ''}>{money(totals.balance)}</strong>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'expense'} className={`exp ${tab === 'expense' ? 'is-active' : ''}`} onClick={() => setTab('expense')}>
          <span>Gastos</span><strong>{money(totals.expense)}</strong>
        </button>
      </div>

      <div className="fin-toolbar">
        <button type="button" className="fin-eye" onClick={() => setReveal((v) => !v)} aria-pressed={reveal} aria-label={reveal ? 'Ocultar montos' : 'Mostrar montos'} title={reveal ? 'Ocultar montos' : 'Mostrar montos'}>
          {reveal ? <EyeOff size={16} /> : <Eye size={16} />} <span>{reveal ? 'Ocultar' : 'Mostrar'} montos</span>
        </button>
        {currencies.length > 1 && (
          <div className="fin-currencies" role="radiogroup" aria-label="Moneda">
            {currencies.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={currency === c} className={currency === c ? 'is-active' : ''} onClick={() => setCurrency(c)}>{c}</button>
            ))}
          </div>
        )}
        <span className="fin-toolbar-spacer" />
        <button type="button" className="secondary-button fin-import-btn" onClick={onImport}><FileUp size={15} /> <span>Importar archivo</span></button>
        <button type="button" className="fin-add inc desk" onClick={() => openNew('income')}><Plus size={15} /> Ingreso</button>
        <button type="button" className="fin-add exp desk" onClick={() => openNew('expense')}><Minus size={15} /> Gasto</button>
      </div>

      <div className="fin-layout">
        <div className="fin-left">
          {/* Mes */}
          <section className="fin-month" aria-label="Calendario del mes">
            <header className="fin-month-head">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={18} /> <span>{prevLabel}</span></button>
              <div className="fin-month-title">
                <strong>{MONTHS[cursor.month]}</strong>
                <span>{cursor.year}</span>
              </div>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Mes siguiente"><span>{nextLabel}</span> <ChevronRight size={18} /></button>
            </header>
            <div className="fin-weekdays" aria-hidden="true">
              {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
            </div>
            <div className="fin-days" role="grid">
              {grid.map((c) => {
                const agg = c.inMonth ? byDay.get(c.key) : undefined
                const isToday = c.key === todayKey
                const isSel = c.key === selected && c.inMonth
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="gridcell"
                    disabled={!c.inMonth}
                    aria-selected={isSel}
                    aria-label={`${c.day} de ${MONTHS[cursor.month]}${agg ? `: ${agg.income ? 'ingresos' : ''}${agg.income && agg.expense ? ' y ' : ''}${agg.expense ? 'gastos' : ''}` : ''}`}
                    className={`fin-day-cell ${c.inMonth ? '' : 'is-out'} ${isToday ? 'is-today' : ''} ${isSel ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelected(c.key)
                      if (isMobile) setDayModal(true)
                    }}
                  >
                    <span className="fin-day-num">{c.day}</span>
                    {agg && (
                      <span className="fin-marks" aria-hidden="true">
                        {agg.expense > 0 && <i className="exp" />}
                        {agg.income > 0 && <i className="inc" />}
                      </span>
                    )}
                    {agg && reveal && (
                      <span className="fin-cell-amounts" aria-hidden="true">
                        {agg.income > 0 && <small className="inc">+{compact(agg.income)}</small>}
                        {agg.expense > 0 && <small className="exp">−{compact(agg.expense)}</small>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <footer className="fin-legend">
              <span><i className="exp" /> Día con gastos</span>
              <span><i className="inc" /> Día con ingresos</span>
              <span><i className="today" /> Hoy</span>
              <button type="button" className="fin-today-btn" onClick={goToday}>Ir a hoy</button>
            </footer>
          </section>
        </div>

        <div className="fin-right">
          {/* Desglose */}
          <section className="fin-breakdown" aria-label={tab === 'income' ? 'Ingresos por categoría' : tab === 'expense' ? 'Gastos por categoría' : 'Resumen del mes'}>
            {tab === 'balance' ? (
              <div className="fin-balance">
                <div className="fin-balance-row inc"><span>Ingresos</span><strong>{money(totals.income)}</strong></div>
                <div className="fin-balance-row exp"><span>Gastos</span><strong>{money(totals.expense)}</strong></div>
                <div className={`fin-balance-row total ${totals.balance < 0 ? 'neg' : ''}`}><span>Saldo del mes</span><strong>{money(totals.balance)}</strong></div>
                <div className="fin-split" aria-hidden="true">
                  <i className="inc" style={{ flex: Math.max(totals.income, 0.0001) }} />
                  <i className="exp" style={{ flex: Math.max(totals.expense, 0.0001) }} />
                </div>
                <p className="fin-balance-note">
                  {totals.income + totals.expense === 0 ? 'Todavía no hay movimientos este mes.' : totals.expense > totals.income ? `Gastaste ${Math.round((totals.expense / Math.max(totals.income, 1)) * 100)}% de lo que ingresó.` : `Te sobró el ${Math.round(((totals.income - totals.expense) / Math.max(totals.income, 1)) * 100)}% de lo que ingresó.`}
                </p>
              </div>
            ) : categoryRows.length === 0 ? (
              <p className="fin-empty">{tab === 'income' ? 'Sin ingresos' : 'Sin gastos'} en {MONTHS[cursor.month].toLowerCase()}. Tocá un día del calendario para añadir.</p>
            ) : (
              <>
                <ul className="fin-bars">
                  {visibleRows.map((r) => (
                    <li key={r.name}>
                      <div className="fin-bar-label">
                        <span>{r.name}</span>
                        <CategoryIcon icon={r.icon} color={r.color} size={16} />
                      </div>
                      <div className="fin-bar-track">
                        <div className="fin-bar-fill" style={{ width: `${Math.max(r.pct, 6)}%`, background: r.color }}>
                          <span>{r.pct.toFixed(1)}%</span>
                        </div>
                        <small>{money(r.amount)}</small>
                      </div>
                    </li>
                  ))}
                </ul>
                {categoryRows.length > 5 && (
                  <button type="button" className="fin-more" onClick={() => setShowAllCats((v) => !v)}>
                    {showAllCats ? 'Ver menos' : `Ver todas (${categoryRows.length})`}
                  </button>
                )}
              </>
            )}
          </section>

          {!isMobile && <section className="fin-day-panel">{dayList}</section>}
        </div>
      </div>

      {/* FAB móvil */}
      {isMobile && (
        <div className="fin-fab-wrap">
          {fabOpen && (
            <div className="fin-fab-menu">
              <button type="button" className="inc" onClick={() => openNew('income')}><span>Añadir ingresos</span><i><Plus size={20} /></i></button>
              <button type="button" className="exp" onClick={() => openNew('expense')}><span>Añadir gastos</span><i><Minus size={20} /></i></button>
            </div>
          )}
          <button type="button" className={`fin-fab ${fabOpen ? 'is-open' : ''}`} onClick={() => setFabOpen((v) => !v)} aria-expanded={fabOpen} aria-label="Añadir movimiento">
            <Plus size={26} />
          </button>
        </div>
      )}

      <Modal open={dayModal && isMobile} onClose={() => setDayModal(false)} title="Movimientos del día" className="fin-day-modal">
        {dayList}
      </Modal>

      <TransactionModal
        open={txOpen}
        draft={draft}
        custom={customCats}
        onClose={() => setTxOpen(false)}
        onSave={saveTx}
        onDelete={(id) => setDeleting(transactions.find((t) => t.id === id) ?? null)}
        onCreateCategory={createCategory}
        onDeleteCategory={deleteCategory}
      />

      <ConfirmModal
        open={Boolean(deleting)}
        title="Eliminar movimiento"
        message="¿Eliminar este movimiento? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />

      {notice && <div className="tool-toast" role="status">{notice}</div>}
    </div>
  )
}
