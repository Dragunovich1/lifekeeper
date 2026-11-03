import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { isTouchPrimary } from '../services/platform'

export interface AutocompleteOption<T = unknown> {
  /** Texto que queda en el campo al elegirla. */
  value: string
  /** Texto principal de la sugerencia (por defecto, `value`). */
  label?: string
  /** Texto secundario (ej. "Buenos Aires, Argentina"). */
  hint?: string
  data?: T
}

interface AutocompleteProps<T> {
  id?: string
  value: string
  onChange: (text: string) => void
  onPick: (option: AutocompleteOption<T>) => void
  options: AutocompleteOption<T>[]
  loading?: boolean
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
  /** Mensaje cuando se escribió algo y no hay sugerencias. */
  emptyText?: ReactNode
  /** Se llama al salir del campo (para completar solo si lo escrito coincide exacto). */
  onBlurValue?: (text: string) => void
  /** Mostrar sugerencias aunque el campo esté vacío (ej. países más comunes). */
  showOnEmpty?: boolean
}

/** Resalta en negrita la parte escrita (sin importar tildes ni mayúsculas). */
function Highlight({ text, query }: { text: string; query: string }) {
  const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = strip(query.trim())
  if (!q) return <>{text}</>
  const idx = strip(text).indexOf(q)
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <b>{text.slice(idx, idx + q.length)}</b>
      {text.slice(idx + q.length)}
    </>
  )
}

/** Campo con sugerencias que se van filtrando mientras se escribe. Teclado: ↑ ↓ Enter Esc. Toque/clic en una sugerencia para elegirla. */
export function Autocomplete<T = unknown>({
  id,
  value,
  onChange,
  onPick,
  options,
  loading = false,
  placeholder,
  ariaLabel,
  disabled,
  emptyText,
  onBlurValue,
  showOnEmpty = false,
}: AutocompleteProps<T>) {
  const autoId = useId()
  const inputId = id ?? `ac-${autoId}`
  const listId = `${inputId}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const hasQuery = value.trim().length > 0
  const visible = open && (hasQuery || showOnEmpty)
  const showEmpty = visible && !loading && options.length === 0 && hasQuery && Boolean(emptyText)

  useEffect(() => setActive(options.length > 0 && hasQuery ? 0 : -1), [options, hasQuery])

  useEffect(() => {
    if (active < 0) return
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (option: AutocompleteOption<T>) => {
    onPick(option)
    setOpen(false)
  }

  return (
    <div className="ac" ref={wrapRef}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={visible && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          // En el celular se centra el campo: así la lista no queda tapada por la barra inferior ni por el teclado
          if (isTouchPrimary()) window.setTimeout(() => wrapRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
        }}
        onBlur={() => {
          // Pequeña espera: si se toca una sugerencia, el clic se procesa antes de cerrar
          window.setTimeout(() => {
            setOpen(false)
            onBlurValue?.(value)
          }, 120)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(options.length - 1, a + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (e.key === 'Enter' && visible && active >= 0 && options[active]) {
            e.preventDefault()
            pick(options[active])
          } else if (e.key === 'Escape' && visible) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {loading ? <Loader2 size={15} className="ac-spin" aria-hidden /> : null}

      {visible && options.length > 0 ? (
        <ul className="ac-list" id={listId} role="listbox" ref={listRef}>
          {options.map((o, i) => (
            <li
              key={`${o.value}-${o.hint ?? ''}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`ac-option${i === active ? ' is-active' : ''}`}
              // onMouseDown evita que el campo pierda el foco antes de elegir (también sirve para el toque en celular)
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="ac-label">
                <Highlight text={o.label ?? o.value} query={value} />
              </span>
              {o.hint ? <span className="ac-hint">{o.hint}</span> : null}
            </li>
          ))}
        </ul>
      ) : showEmpty ? (
        <div className="ac-list ac-empty" role="status">
          {emptyText}
        </div>
      ) : null}
    </div>
  )
}
