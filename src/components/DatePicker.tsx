import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { safeParseDate, toLocalDateKey, toLocalTimeKey } from '../utils/dates'
import { InlineTimeSelector } from './TimePicker'

interface DatePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  withTime?: boolean
  disabled?: boolean
  allowClear?: boolean
}

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const POPUP_WIDTH = 308
const POPUP_HEIGHT_BASE = 340
const POPUP_HEIGHT_TIME = 468
const POPUP_GAP = 6

const pad = (value: number) => String(value).padStart(2, '0')

const formatDisplay = (value: string, withTime: boolean) => {
  const date = safeParseDate(value)
  if (!date) return ''
  const base = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
  if (!withTime) return base
  const time = toLocalTimeKey(value, '09:00')
  return `${base} · ${time} hs`
}

export const DatePicker = ({
  id,
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  ariaLabel,
  className = '',
  withTime = false,
  disabled = false,
  allowClear = true,
}: DatePickerProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [viewDate, setViewDate] = useState(() => {
    const selected = safeParseDate(value) ?? new Date()
    return new Date(selected.getFullYear(), selected.getMonth(), 1)
  })
  const [draftDate, setDraftDate] = useState(() => safeParseDate(value) ?? new Date())
  const [draftTime, setDraftTime] = useState(() => toLocalTimeKey(value, '09:00'))

  const display = formatDisplay(value, withTime)
  const popupHeight = withTime ? POPUP_HEIGHT_TIME : POPUP_HEIGHT_BASE

  const computePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return null
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - POPUP_GAP
    const top =
      spaceBelow >= popupHeight || rect.top < popupHeight
        ? rect.bottom + POPUP_GAP
        : Math.max(8, rect.top - POPUP_GAP - popupHeight)
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - POPUP_WIDTH - 8))
    return { top, left }
  }

  const openPicker = () => {
    if (disabled) return
    const selected = safeParseDate(value) ?? new Date()
    setViewDate(new Date(selected.getFullYear(), selected.getMonth(), 1))
    setDraftDate(selected)
    setDraftTime(toLocalTimeKey(value, '09:00'))
    setPosition(computePosition())
    setOpen(true)
  }

  const closePicker = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

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
  }, [open, withTime])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && (popupRef.current?.contains(target) || triggerRef.current?.contains(target))) return
      // Si el click ocurre en el portal de un Select hijo (hora/minuto), no cerrar el calendario
      if (target instanceof Element && target.closest('.app-select-menu')) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePicker(true)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const emitValue = (date: Date, time: string) => {
    const dateKey = toLocalDateKey(date)
    onChange(withTime ? `${dateKey}T${time}` : dateKey)
  }

  const pickDay = (date: Date) => {
    setDraftDate(date)
    emitValue(date, draftTime)
    if (!withTime) {
      closePicker(true)
    }
  }

  const handleTimeChange = (nextTime: string) => {
    setDraftTime(nextTime)
    emitValue(draftDate, nextTime)
  }

  const applyDraft = () => {
    emitValue(draftDate, draftTime)
    closePicker(true)
  }

  const selectedKey = withTime ? toLocalDateKey(draftDate) : toLocalDateKey(value)
  const todayKey = toLocalDateKey(new Date())
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstDayOffset + 1
    const date = new Date(year, month, dayNumber)
    return {
      date,
      key: toLocalDateKey(date),
      inMonth: date.getMonth() === month,
      dayNumber: date.getDate(),
    }
  })

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`app-datepicker-trigger ${className}`.trim()}
        onClick={() => (open ? closePicker() : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={`app-datepicker-value${display ? '' : ' is-placeholder'}`}>
          {display || placeholder}
        </span>
        <CalendarDays size={15} className="app-datepicker-icon" aria-hidden />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={popupRef}
              className="app-datepicker"
              role="dialog"
              aria-label={ariaLabel ?? 'Elegir fecha'}
              style={{ top: position.top, left: position.left }}
            >
              <div className="app-datepicker-header">
                <div className="app-datepicker-nav-group">
                  <button
                    type="button"
                    className="app-datepicker-nav app-datepicker-year"
                    onClick={() => setViewDate(new Date(year - 1, month, 1))}
                    aria-label="Año anterior"
                    title="Año anterior"
                  >
                    <ChevronsLeft size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="app-datepicker-nav"
                    onClick={() => setViewDate(new Date(year, month - 1, 1))}
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft size={16} aria-hidden />
                  </button>
                </div>
                <span className="app-datepicker-month">
                  {MONTHS[month]} {year}
                </span>
                <div className="app-datepicker-nav-group">
                  <button
                    type="button"
                    className="app-datepicker-nav"
                    onClick={() => setViewDate(new Date(year, month + 1, 1))}
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="app-datepicker-nav app-datepicker-year"
                    onClick={() => setViewDate(new Date(year + 1, month, 1))}
                    aria-label="Año siguiente"
                    title="Año siguiente"
                  >
                    <ChevronsRight size={15} aria-hidden />
                  </button>
                </div>
              </div>

              <div className="app-datepicker-weekdays" aria-hidden>
                {WEEKDAYS.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>

              <div className="app-datepicker-grid">
                {cells.map((cell) => (
                  <button
                    key={cell.key}
                    type="button"
                    className={`app-datepicker-day${cell.inMonth ? '' : ' is-outside'}${
                      cell.key === selectedKey ? ' is-selected' : ''
                    }${cell.key === todayKey ? ' is-today' : ''}`}
                    onClick={() => pickDay(cell.date)}
                  >
                    {cell.dayNumber}
                  </button>
                ))}
              </div>

              {withTime ? (
                <InlineTimeSelector
                  value={draftTime}
                  onChange={handleTimeChange}
                  label="Horario"
                />
              ) : null}

              <div className="app-datepicker-footer">
                {allowClear ? (
                  <button
                    type="button"
                    className="app-datepicker-link"
                    onClick={() => {
                      onChange('')
                      closePicker(true)
                    }}
                  >
                    Limpiar
                  </button>
                ) : null}
                <button
                  type="button"
                  className="app-datepicker-link"
                  onClick={() => {
                    const today = new Date()
                    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
                    if (withTime) {
                      const nowTime = `${pad(today.getHours())}:${pad(today.getMinutes())}`
                      setDraftDate(today)
                      setDraftTime(nowTime)
                      emitValue(today, nowTime)
                    } else {
                      onChange(toLocalDateKey(today))
                      closePicker(true)
                    }
                  }}
                >
                  {withTime ? 'Ahora' : 'Hoy'}
                </button>
                {withTime ? (
                  <button type="button" className="primary-button app-datepicker-apply" onClick={applyDraft}>
                    Listo
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
