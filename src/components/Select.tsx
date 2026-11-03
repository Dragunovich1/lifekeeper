import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
}

const MENU_MIN_WIDTH = 180
const MENU_GAP = 6
const MENU_MAX_HEIGHT = 280
const OPTION_HEIGHT = 36
const EDGE = 8

interface MenuPosition {
  left: number
  width: number
  maxHeight: number
  /** Si cabe abajo se ancla por arriba del menú; si se abre hacia arriba, se ancla por su borde inferior (así queda pegado al campo sin importar su alto real). */
  top?: number
  bottom?: number
}

export const Select = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'Seleccionar',
  ariaLabel,
  className = '',
  disabled = false,
}: SelectProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const selected = options.find((option) => option.value === value)

  const computePosition = (): MenuPosition | null => {
    const trigger = triggerRef.current
    if (!trigger) return null
    const rect = trigger.getBoundingClientRect()
    const width = Math.max(rect.width, MENU_MIN_WIDTH)
    const left = Math.min(Math.max(EDGE, rect.left), Math.max(EDGE, window.innerWidth - width - EDGE))
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - EDGE
    const spaceAbove = rect.top - MENU_GAP - EDGE
    const needed = Math.min(MENU_MAX_HEIGHT, Math.max(1, options.length) * OPTION_HEIGHT + 12)
    if (spaceBelow >= needed || spaceBelow >= spaceAbove) {
      return { left, width, top: rect.bottom + MENU_GAP, maxHeight: Math.max(120, Math.min(MENU_MAX_HEIGHT, spaceBelow)) }
    }
    return { left, width, bottom: window.innerHeight - rect.top + MENU_GAP, maxHeight: Math.max(120, Math.min(MENU_MAX_HEIGHT, spaceAbove)) }
  }

  const openMenu = () => {
    if (disabled) return
    setPosition(computePosition())
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)))
    setOpen(true)
  }

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  const selectOption = useCallback(
    (option: SelectOption) => {
      onChange(option.value)
      closeMenu(true)
    },
    [onChange, closeMenu],
  )

  useLayoutEffect(() => {
    if (!open) return
    // Sigue al campo mientras está abierto: si la página se desplaza o el contenido cambia de alto
    // (imágenes que cargan, avisos que aparecen) el menú no se queda en el lugar viejo.
    let frame = 0
    let last = ''
    const track = () => {
      const next = computePosition()
      const key = JSON.stringify(next)
      if (key !== last) {
        last = key
        setPosition(next)
      }
      frame = window.requestAnimationFrame(track)
    }
    track()
    return () => window.cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && (menuRef.current?.contains(target) || triggerRef.current?.contains(target))) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu(true)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => Math.min(options.length - 1, index + 1))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) => Math.max(0, index - 1))
        return
      }
      if (event.key === 'Enter' && activeIndex >= 0 && activeIndex < options.length) {
        event.preventDefault()
        selectOption(options[activeIndex])
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, activeIndex, options, selectOption, closeMenu])

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`app-select ${className}`.trim()}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            openMenu()
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={`app-select-value${selected ? '' : ' is-placeholder'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={15} className="app-select-chevron" aria-hidden />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              className="app-select-menu"
              role="listbox"
              aria-label={ariaLabel}
              style={{ top: position.top, bottom: position.bottom, left: position.left, minWidth: position.width, maxHeight: position.maxHeight }}
            >
              {options.length === 0 ? (
                <div className="app-select-empty">Sin opciones</div>
              ) : (
                options.map((option, index) => {
                  const isSelected = option.value === value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`app-select-option${index === activeIndex ? ' is-active' : ''}${
                        isSelected ? ' is-selected' : ''
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectOption(option)}
                    >
                      <span>{option.label}</span>
                      {isSelected ? <Check size={14} aria-hidden /> : null}
                    </button>
                  )
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
