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
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const selected = options.find((option) => option.value === value)

  const computePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return null
    const rect = trigger.getBoundingClientRect()
    const width = Math.max(rect.width, MENU_MIN_WIDTH)
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP
    const top =
      spaceBelow >= Math.min(MENU_MAX_HEIGHT, 220) || rect.top < MENU_MAX_HEIGHT
        ? rect.bottom + MENU_GAP
        : Math.max(8, rect.top - MENU_GAP - Math.min(MENU_MAX_HEIGHT, 220))
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
    return { top, left, width }
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
    setPosition(computePosition())
    const onResize = () => setPosition(computePosition())
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open])

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
              style={{ top: position.top, left: position.left, minWidth: position.width }}
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
