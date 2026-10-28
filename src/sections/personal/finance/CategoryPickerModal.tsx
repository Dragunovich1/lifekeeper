import { useState, type FormEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { Check, Plus, Trash2 } from 'lucide-react'
import { CategoryIcon, CATEGORY_ICONS } from '../../../components/CategoryIcon'
import { Modal } from '../../../components/Modal'
import type { FinanceCategoryDef, TransactionType } from '../../../types'
import { COLOR_SWATCHES, ICON_KEYS, allCategories, normalizeCategoryName } from '../../../utils/financeCategories'

interface Props {
  open: boolean
  kind: TransactionType
  selected: string
  custom: FinanceCategoryDef[]
  onSelect: (name: string) => void
  onCreate: (def: FinanceCategoryDef) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function CategoryPickerModal({ open, kind, selected, custom, onSelect, onCreate, onDelete, onClose }: Props) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string>('tag')
  const [color, setColor] = useState<string>(COLOR_SWATCHES[0])
  const [error, setError] = useState('')

  const categories = allCategories(custom, kind)
  const selectedKey = normalizeCategoryName(selected)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const clean = name.trim()
    if (!clean) {
      setError('Ponele un nombre a la categoría.')
      return
    }
    if (categories.some((c) => normalizeCategoryName(c.name) === normalizeCategoryName(clean))) {
      setError('Ya existe una categoría con ese nombre.')
      return
    }
    const def: FinanceCategoryDef = { id: uuid(), name: clean, kind, icon, color }
    onCreate(def)
    onSelect(clean)
    setCreating(false)
    setName('')
    setError('')
  }

  return (
    <Modal open={open} onClose={onClose} title={kind === 'expense' ? 'Categorías de gastos' : 'Categorías de ingresos'} className="fin-picker-modal">
      {creating ? (
        <form className="fin-newcat" onSubmit={submit}>
          <div className="fin-newcat-preview">
            <CategoryIcon icon={icon} color={color} size={22} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la categoría" aria-label="Nombre de la categoría" autoFocus maxLength={30} />
          </div>
          <div className="fin-swatches" role="radiogroup" aria-label="Color">
            {COLOR_SWATCHES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Color ${c}`} className={color === c ? 'is-active' : ''} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <div className="fin-iconpick" role="radiogroup" aria-label="Ícono">
            {ICON_KEYS.map((k) => {
              const Icon = CATEGORY_ICONS[k]
              return (
                <button key={k} type="button" role="radio" aria-checked={icon === k} aria-label={k} className={icon === k ? 'is-active' : ''} onClick={() => setIcon(k)}>
                  <Icon size={18} />
                </button>
              )
            })}
          </div>
          {error && <p className="fin-error" role="alert">{error}</p>}
          <div className="fin-actions">
            <button type="button" className="secondary-button" onClick={() => { setCreating(false); setError('') }}>Cancelar</button>
            <button type="submit" className="primary-button">Crear categoría</button>
          </div>
        </form>
      ) : (
        <>
          <ul className="fin-catlist">
            {categories.map((c) => (
              <li key={`${c.custom ? 'c' : 'd'}-${c.name}`}>
                <button type="button" className="fin-catrow" onClick={() => { onSelect(c.name); onClose() }}>
                  <CategoryIcon icon={c.icon} color={c.color} />
                  <span className="fin-catname">{c.name}{c.custom && <em>propia</em>}</span>
                  <span className={`fin-radio ${normalizeCategoryName(c.name) === selectedKey ? 'is-on' : ''}`} aria-hidden="true">
                    {normalizeCategoryName(c.name) === selectedKey && <Check size={13} strokeWidth={3} />}
                  </span>
                </button>
                {c.custom && c.id && (
                  <button type="button" className="fin-catdel" aria-label={`Eliminar la categoría ${c.name}`} title="Eliminar categoría (los movimientos conservan su nombre)" onClick={() => onDelete(c.id!)}>
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="secondary-button fin-newcat-btn" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nueva categoría
          </button>
        </>
      )}
    </Modal>
  )
}
