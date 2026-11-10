import '../styles/suggest-input.css'
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface SuggestItem {
  key: string
  title: string
  detail?: string
  /** Texto corto a la derecha (p. ej. "Usado 3 veces") */
  hint?: string
  icon?: ReactNode
  /** Encabezado de grupo: se muestra cuando cambia respecto del ítem anterior */
  group?: string
}

interface Props {
  id: string
  value: string
  onChange: (text: string) => void
  onPick: (item: SuggestItem) => void
  items: SuggestItem[]
  placeholder?: string
  loading?: boolean
  /** Se muestra al pie de la lista (p. ej. "Escribí para buscar…") */
  footer?: ReactNode
  required?: boolean
  autoFocus?: boolean
  ariaLabel?: string
}

/** Campo de texto con lista de sugerencias (teclado: ↑ ↓ Enter Esc). El texto libre siempre se acepta. */
export function SuggestInput({ id, value, onChange, onPick, items, placeholder, loading, footer, required, autoFocus, ariaLabel }: Props) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => setActive(-1), [items])

  const pick = (item: SuggestItem) => {
    onPick(item)
    setOpen(false)
  }

  const showList = open && (items.length > 0 || loading || footer)

  return (
    <div
      className="si-wrap"
      ref={wrapRef}
      onBlur={(e) => {
        // se cierra solo si el foco sale del campo y de la lista
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((i) => Math.min(items.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter' && showList && active >= 0 && items[active]) {
            e.preventDefault()
            pick(items[active])
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation() // no cierra el modal: solo la lista
            setOpen(false)
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={Boolean(showList)}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
      />
      {showList ? (
        <div className="si-list" id={listId} role="listbox">
          {items.map((item, idx) => (
            <div key={item.key}>
              {item.group && item.group !== items[idx - 1]?.group ? <div className="si-group">{item.group}</div> : null}
              <button
                type="button"
                role="option"
                aria-selected={idx === active}
                className={`si-item${idx === active ? ' is-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
              >
                {item.icon ? <span className="si-icon" aria-hidden>{item.icon}</span> : null}
                <span className="si-text">
                  <strong>{item.title}</strong>
                  {item.detail ? <span>{item.detail}</span> : null}
                </span>
                {item.hint ? <span className="si-hint">{item.hint}</span> : null}
              </button>
            </div>
          ))}
          {loading ? <div className="si-note">Buscando…</div> : null}
          {footer ? <div className="si-note">{footer}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
