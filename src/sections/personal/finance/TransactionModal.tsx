import { useEffect, useState, type FormEvent } from 'react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { CategoryIcon } from '../../../components/CategoryIcon'
import { Modal } from '../../../components/Modal'
import type { FinanceCategoryDef, FinanceTransaction, TransactionType } from '../../../types'
import { resolveCategory } from '../../../utils/financeCategories'
import { CategoryPickerModal } from './CategoryPickerModal'

export interface TransactionDraft {
  id?: string
  type: TransactionType
  amount: string
  currency: string
  category: string
  date: string
  description: string
  recurring: boolean
  recurrence: NonNullable<FinanceTransaction['recurrence']>
}

const CURRENCIES = ['ARS', 'USD', 'EUR', 'USDT', 'BRL', 'CLP']

interface Props {
  open: boolean
  draft: TransactionDraft | null
  custom: FinanceCategoryDef[]
  onClose: () => void
  onSave: (draft: TransactionDraft) => void
  onDelete?: (id: string) => void
  onCreateCategory: (def: FinanceCategoryDef) => void
  onDeleteCategory: (id: string) => void
}

export function TransactionModal({ open, draft, custom, onClose, onSave, onDelete, onCreateCategory, onDeleteCategory }: Props) {
  const [form, setForm] = useState<TransactionDraft | null>(draft)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(draft)
      setError('')
    }
  }, [open, draft])

  if (!form) return null
  const editing = Boolean(form.id)
  const view = form.category ? resolveCategory(form.category, form.type, custom) : null

  const switchKind = (type: TransactionType) => {
    if (type === form.type) return
    setForm({ ...form, type, category: '' })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const amount = parseFloat(form.amount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Ingresá un monto mayor a cero.')
      return
    }
    if (!form.category.trim()) {
      setError(`Elegí una categoría de ${form.type === 'expense' ? 'gasto' : 'ingreso'}.`)
      return
    }
    onSave({ ...form, amount: String(amount) })
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={editing ? 'Editar movimiento' : form.type === 'expense' ? 'Añadir gasto' : 'Añadir ingreso'} className="fin-modal">
        <form className={`fin-form kind-${form.type}`} onSubmit={submit}>
          <div className="fin-kind" role="radiogroup" aria-label="Tipo de movimiento">
            <button type="button" role="radio" aria-checked={form.type === 'expense'} className={`is-expense ${form.type === 'expense' ? 'is-active' : ''}`} onClick={() => switchKind('expense')}>Gasto</button>
            <button type="button" role="radio" aria-checked={form.type === 'income'} className={`is-income ${form.type === 'income' ? 'is-active' : ''}`} onClick={() => switchKind('income')}>Ingreso</button>
          </div>

          <div className="fin-amount">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              aria-label="Monto"
              autoFocus
            />
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} aria-label="Moneda">
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <button type="button" className="fin-field fin-category-btn" onClick={() => setPickerOpen(true)}>
            {view ? <CategoryIcon icon={view.icon} color={view.color} size={16} /> : <span className="fin-cat-empty" aria-hidden="true" />}
            <span className={view ? '' : 'is-placeholder'}>{view ? view.name : `Elegí una categoría de ${form.type === 'expense' ? 'gastos' : 'ingresos'}…`}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>

          <label className="fin-field">
            <span>Nota</span>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Añadir nota…" maxLength={120} />
          </label>

          <div className="fin-row">
            <label className="fin-field">
              <span>Fecha</span>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label className="fin-field">
              <span>Repetir</span>
              <select
                value={form.recurring ? form.recurrence : 'no'}
                onChange={(e) => setForm(e.target.value === 'no' ? { ...form, recurring: false } : { ...form, recurring: true, recurrence: e.target.value as TransactionDraft['recurrence'] })}
              >
                <option value="no">No repetir</option>
                <option value="weekly">Cada semana</option>
                <option value="monthly">Cada mes</option>
                <option value="yearly">Cada año</option>
              </select>
            </label>
          </div>

          {error && <p className="fin-error" role="alert">{error}</p>}

          <div className="fin-actions">
            {editing && onDelete && (
              <button type="button" className="secondary-button danger" onClick={() => onDelete(form.id!)} aria-label="Eliminar movimiento">
                <Trash2 size={15} />
              </button>
            )}
            <button type="button" className="secondary-button" onClick={onClose}>Cerrar</button>
            <button type="submit" className={`primary-button fin-save kind-${form.type}`}>Guardar</button>
          </div>
        </form>
      </Modal>

      <CategoryPickerModal
        open={pickerOpen}
        kind={form.type}
        selected={form.category}
        custom={custom}
        onSelect={(name) => setForm({ ...form, category: name })}
        onCreate={onCreateCategory}
        onDelete={onDeleteCategory}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )
}
