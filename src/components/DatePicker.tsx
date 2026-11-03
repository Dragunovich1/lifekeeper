import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
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

type View = 'day' | 'month' | 'year'

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const POPUP_WIDTH = 308
const POPUP_HEIGHT_BASE = 430
const POPUP_HEIGHT_TIME = 560
const POPUP_GAP = 6
const YEARS_PER_PAGE = 12
const MIN_YEAR = 1900
const MAX_YEAR = 2100

const pad = (value: number) => String(value).padStart(2, '0')
const pageStartOf = (year: number) => Math.floor(year / YEARS_PER_PAGE) * YEARS_PER_PAGE

const formatDisplay = (value: string, withTime: boolean) => {
  const date = safeParseDate(value)
  if (!date) return ''
  const base = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
  if (!withTime) return base
  const time = toLocalTimeKey(value, '09:00')
  return `${base} · ${time} hs`
}

const formatShort = (date: Date, withTime: boolean, time: string) =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}${withTime ? ` · ${time} hs` : ''}`

const HINT: Record<View, string> = {
  day: 'Elegí el día y confirmá con “Aceptar”',
  month: 'Paso 2: elegí el mes',
  year: 'Paso 1: elegí el año (o escribilo)',
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
  const [view, setView] = useState<View>('day')
  const [viewDate, setViewDate] = useState(() => {
    const selected = safeParseDate(value) ?? new Date()
    return new Date(selected.getFullYear(), selected.getMonth(), 1)
  })
  const [yearPage, setYearPage] = useState(() => pageStartOf((safeParseDate(value) ?? new Date()).getFullYear()))
  const [yearText, setYearText] = useState('')
  /** Fecha elegida pero todavía no confirmada. null = sin fecha. */
  const [draft, setDraft] = useState<Date | null>(() => safeParseDate(value))
  const [draftTime, setDraftTime] = useState(() => toLocalTimeKey(value, '09:00'))

  const display = formatDisplay(value, withTime)
  const popupHeight = withTime ? POPUP_HEIGHT_TIME : POPUP_HEIGHT_BASE

  const computePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return null
    const rect = trigger.getBoundingClientRect()
    // Alto real del panel si ya está en pantalla (cambia según la vista); si no, una estimación
    const h = popupRef.current?.offsetHeight || popupHeight
    const spaceBelow = window.innerHeight - rect.bottom - POPUP_GAP
    const spaceAbove = rect.top - POPUP_GAP
    let top = rect.bottom + POPUP_GAP
    if (spaceBelow < h) top = spaceAbove >= h ? rect.top - POPUP_GAP - h : window.innerHeight - h - 8
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8))
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - POPUP_WIDTH - 8))
    return { top, left }
  }

  const openPicker = () => {
    if (disabled) return
    const selected = safeParseDate(value)
    const base = selected ?? new Date()
    setViewDate(new Date(base.getFullYear(), base.getMonth(), 1))
    setYearPage(pageStartOf(base.getFullYear()))
    setYearText('')
    setView('day')
    setDraft(selected)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, withTime, view])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && (popupRef.current?.contains(target) || triggerRef.current?.contains(target))) return
      // Si el click ocurre en el portal de un Select hijo (hora/minuto), no cerrar el calendario
      if (target instanceof Element && target.closest('.app-select-menu')) return
      setOpen(false) // tocar afuera cancela: no se cambia la fecha
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        // Esc primero vuelve de la vista de año/mes al calendario, y recién después cierra
        if (view !== 'day') setView('day')
        else closePicker(true)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view])

  const emitValue = (date: Date, time: string) => {
    const dateKey = toLocalDateKey(date)
    onChange(withTime ? `${dateKey}T${time}` : dateKey)
  }

  const confirm = () => {
    if (!draft) return
    emitValue(draft, draftTime)
    closePicker(true)
  }

  const pickDay = (date: Date) => {
    setDraft(date)
    if (date.getMonth() !== viewDate.getMonth()) setViewDate(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  const goToYear = (y: number) => {
    const clamped = Math.min(MAX_YEAR, Math.max(MIN_YEAR, y))
    setViewDate(new Date(clamped, viewDate.getMonth(), 1))
    setYearText('')
    setView('month') // después del año se elige el mes
  }

  const openYearView = () => {
    setYearPage(pageStartOf(viewDate.getFullYear()))
    setYearText('')
    setView('year')
  }

  const onYearText = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    setYearText(digits)
    if (digits.length === 4) {
      const y = Number(digits)
      if (y >= MIN_YEAR && y <= MAX_YEAR) goToYear(y)
    }
  }

  const selectedKey = draft ? toLocalDateKey(draft) : ''
  const todayKey = toLocalDateKey(new Date())
  const todayYear = new Date().getFullYear()
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstDayOffset + 1
    const date = new Date(year, month, dayNumber)
    return { date, key: toLocalDateKey(date), inMonth: date.getMonth() === month, dayNumber: date.getDate() }
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
        <span className={`app-datepicker-value${display ? '' : ' is-placeholder'}`}>{display || placeholder}</span>
        <CalendarDays size={15} className="app-datepicker-icon" aria-hidden />
      </button>

      {open && position
        ? createPortal(
            <>
              <div className="app-datepicker-backdrop" aria-hidden />
              <div ref={popupRef} className={`app-datepicker is-${view}`} role="dialog" aria-label={ariaLabel ?? 'Elegir fecha'} style={{ top: position.top, left: position.left }}>
                {view === 'day' ? (
                  <div className="app-datepicker-header">
                    <div className="app-datepicker-nav-group">
                      <button type="button" className="app-datepicker-nav app-datepicker-year" onClick={() => setViewDate(new Date(year - 1, month, 1))} aria-label="Año anterior" title="Año anterior">
                        <ChevronsLeft size={15} aria-hidden />
                      </button>
                      <button type="button" className="app-datepicker-nav" onClick={() => setViewDate(new Date(year, month - 1, 1))} aria-label="Mes anterior">
                        <ChevronLeft size={16} aria-hidden />
                      </button>
                    </div>
                    <span className="app-datepicker-month">
                      <button type="button" className="app-datepicker-title-btn" onClick={() => setView('month')} aria-label={`Mes: ${MONTHS[month]}. Tocá para elegir otro mes`}>
                        {MONTHS[month]} <ChevronDown size={12} aria-hidden />
                      </button>
                      <button type="button" className="app-datepicker-title-btn" onClick={openYearView} aria-label={`Año: ${year}. Tocá para elegir otro año`}>
                        {year} <ChevronDown size={12} aria-hidden />
                      </button>
                    </span>
                    <div className="app-datepicker-nav-group">
                      <button type="button" className="app-datepicker-nav" onClick={() => setViewDate(new Date(year, month + 1, 1))} aria-label="Mes siguiente">
                        <ChevronRight size={16} aria-hidden />
                      </button>
                      <button type="button" className="app-datepicker-nav app-datepicker-year" onClick={() => setViewDate(new Date(year + 1, month, 1))} aria-label="Año siguiente" title="Año siguiente">
                        <ChevronsRight size={15} aria-hidden />
                      </button>
                    </div>
                  </div>
                ) : view === 'month' ? (
                  <div className="app-datepicker-header">
                    <div className="app-datepicker-nav-group">
                      <button type="button" className="app-datepicker-nav" onClick={() => setViewDate(new Date(year - 1, month, 1))} aria-label="Año anterior">
                        <ChevronLeft size={16} aria-hidden />
                      </button>
                    </div>
                    <span className="app-datepicker-month">
                      <button type="button" className="app-datepicker-title-btn" onClick={openYearView} aria-label={`Año: ${year}. Tocá para elegir otro año`}>
                        {year} <ChevronDown size={12} aria-hidden />
                      </button>
                    </span>
                    <div className="app-datepicker-nav-group">
                      <button type="button" className="app-datepicker-nav" onClick={() => setViewDate(new Date(year + 1, month, 1))} aria-label="Año siguiente">
                        <ChevronRight size={16} aria-hidden />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="app-datepicker-header">
                    <div className="app-datepicker-nav-group">
                      <button type="button" className="app-datepicker-nav" onClick={() => setYearPage((p) => Math.max(pageStartOf(MIN_YEAR), p - YEARS_PER_PAGE))} aria-label="Años anteriores" title="Años anteriores">
                        <ChevronsLeft size={15} aria-hidden />
                      </button>
                    </div>
                    <span className="app-datepicker-month">
                      {yearPage} – {yearPage + YEARS_PER_PAGE - 1}
                    </span>
                    <div className="app-datepicker-nav-group">
                      <button type="button" className="app-datepicker-nav" onClick={() => setYearPage((p) => Math.min(pageStartOf(MAX_YEAR), p + YEARS_PER_PAGE))} aria-label="Años siguientes" title="Años siguientes">
                        <ChevronsRight size={15} aria-hidden />
                      </button>
                    </div>
                  </div>
                )}

                <p className="app-datepicker-hint" aria-live="polite">
                  {HINT[view]}
                </p>

                <div className="app-datepicker-body">
                  {view === 'day' ? (
                    <>
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
                            className={`app-datepicker-day${cell.inMonth ? '' : ' is-outside'}${cell.key === selectedKey ? ' is-selected' : ''}${cell.key === todayKey ? ' is-today' : ''}`}
                            onClick={() => pickDay(cell.date)}
                            onDoubleClick={() => {
                              emitValue(cell.date, draftTime)
                              closePicker(true)
                            }}
                            aria-pressed={cell.key === selectedKey}
                            aria-label={`${cell.dayNumber} de ${MONTHS[cell.date.getMonth()]} de ${cell.date.getFullYear()}`}
                          >
                            {cell.dayNumber}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : view === 'month' ? (
                    <div className="app-datepicker-pick-grid is-months" role="listbox" aria-label="Meses">
                      {MONTHS_SHORT.map((label, index) => (
                        <button
                          key={label}
                          type="button"
                          role="option"
                          aria-selected={index === month}
                          className={`app-datepicker-pick${index === month ? ' is-selected' : ''}${year === todayYear && index === new Date().getMonth() ? ' is-today' : ''}`}
                          onClick={() => {
                            setViewDate(new Date(year, index, 1))
                            setView('day')
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <label className="app-datepicker-yearinput">
                        <span>Escribí el año</span>
                        <input
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={4}
                          value={yearText}
                          onChange={(e) => onYearText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const y = Number(yearText)
                              if (y >= MIN_YEAR && y <= MAX_YEAR) goToYear(y)
                            }
                          }}
                          placeholder="Ej. 1990"
                          data-bare
                        />
                      </label>
                      <div className="app-datepicker-pick-grid is-years" role="listbox" aria-label="Años">
                        {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPage + i)
                          .filter((y) => y >= MIN_YEAR && y <= MAX_YEAR)
                          .map((y) => (
                            <button
                              key={y}
                              type="button"
                              role="option"
                              aria-selected={y === year}
                              className={`app-datepicker-pick${y === year ? ' is-selected' : ''}${y === todayYear ? ' is-today' : ''}`}
                              onClick={() => goToYear(y)}
                            >
                              {y}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>

                {withTime && view === 'day' ? <InlineTimeSelector value={draftTime} onChange={setDraftTime} label="Horario" /> : null}

                <div className="app-datepicker-summary" aria-live="polite">
                  {draft ? (
                    <>
                      Fecha elegida: <strong>{formatShort(draft, withTime, draftTime)}</strong>
                    </>
                  ) : (
                    'Todavía no elegiste ninguna fecha'
                  )}
                </div>

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
                      emitValue(today, withTime ? `${pad(today.getHours())}:${pad(today.getMinutes())}` : draftTime)
                      closePicker(true)
                    }}
                  >
                    {withTime ? 'Ahora' : 'Hoy'}
                  </button>
                  <span className="app-datepicker-spacer" />
                  <button type="button" className="secondary-button app-datepicker-cancel" onClick={() => closePicker(true)}>
                    Cancelar
                  </button>
                  <button type="button" className="primary-button app-datepicker-apply" onClick={confirm} disabled={!draft}>
                    Aceptar
                  </button>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  )
}
