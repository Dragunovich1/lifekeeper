import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'
import { Select } from './Select'

const pad = (value: number) => String(value).padStart(2, '0')

const HOURS = Array.from({ length: 24 }, (_, idx) => {
  const v = pad(idx)
  return { value: v, label: `${v} hs` }
})

const MINUTES_STEP_5 = Array.from({ length: 60 }, (_, idx) => {
  const v = pad(idx)
  return { value: v, label: `${v} min` }
})

const QUICK_TIMES = ['08:00', '09:00', '12:00', '14:00', '18:00', '20:00', '22:00']

const parseTimeParts = (value?: string): { hour: string; minute: string } => {
  const match = /^(\d{2}):(\d{2})/.exec((value ?? '').trim())
  if (!match) return { hour: '09', minute: '00' }
  const h = Math.min(23, Math.max(0, Number(match[1])))
  const m = Math.min(59, Math.max(0, Number(match[2])))
  return { hour: pad(h), minute: pad(m) }
}

interface InlineTimeSelectorProps {
  value: string
  onChange: (nextTime: string) => void
  label?: string
}

export const InlineTimeSelector = ({
  value,
  onChange,
  label = 'Horario',
}: InlineTimeSelectorProps) => {
  const { hour, minute } = parseTimeParts(value)

  const handleHourChange = (nextHour: string) => {
    onChange(`${nextHour}:${minute}`)
  }

  const handleMinuteChange = (nextMinute: string) => {
    onChange(`${hour}:${nextMinute}`)
  }

  return (
    <div className="app-datepicker-time" role="group" aria-label={label}>
      <div className="app-datepicker-time-header">
        <span className="app-datepicker-time-label">
          <Clock size={13} aria-hidden />
          {label}
        </span>
        <span className="app-datepicker-time-preview">
          {hour}:{minute} hs
        </span>
      </div>
      <div className="app-datepicker-time-selects">
        <Select
          value={hour}
          onChange={handleHourChange}
          options={HOURS}
          ariaLabel="Hora"
          className="app-time-unit-select"
        />
        <span className="app-datepicker-time-sep" aria-hidden>
          :
        </span>
        <Select
          value={minute}
          onChange={handleMinuteChange}
          options={MINUTES_STEP_5}
          ariaLabel="Minutos"
          className="app-time-unit-select"
        />
      </div>
      <div className="app-datepicker-time-presets" aria-label="Horarios rápidos">
        {QUICK_TIMES.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`app-time-preset${ `${hour}:${minute}` === preset ? ' is-selected' : ''}`}
            onClick={() => onChange(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface TimePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
}

const POPUP_WIDTH = 280
const POPUP_HEIGHT = 210
const POPUP_GAP = 6

export const TimePicker = ({
  id,
  value,
  onChange,
  placeholder = 'Seleccionar hora',
  ariaLabel,
  className = '',
  disabled = false,
}: TimePickerProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const computePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return null
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - POPUP_GAP
    const top =
      spaceBelow >= POPUP_HEIGHT || rect.top < POPUP_HEIGHT
        ? rect.bottom + POPUP_GAP
        : Math.max(8, rect.top - POPUP_GAP - POPUP_HEIGHT)
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - POPUP_WIDTH - 8))
    return { top, left }
  }

  const openPicker = () => {
    if (disabled) return
    if (!value) {
      onChange('08:00')
    }
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
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && (popupRef.current?.contains(target) || triggerRef.current?.contains(target))) {
        return
      }
      // Si el click fue dentro del portal de un Select hijo (hora/minuto), no cerrar
      if (target instanceof Element && target.closest('.app-select-menu')) {
        return
      }
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

  const display = value ? `${value.slice(0, 5)} hs` : ''

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`app-datepicker-trigger app-timepicker-trigger ${className}`.trim()}
        onClick={() => (open ? closePicker() : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={`app-datepicker-value${display ? '' : ' is-placeholder'}`}>
          {display || placeholder}
        </span>
        <Clock size={15} className="app-datepicker-icon" aria-hidden />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={popupRef}
              className="app-datepicker app-timepicker-popup"
              role="dialog"
              aria-label={ariaLabel ?? 'Elegir horario'}
              style={{ top: position.top, left: position.left, width: POPUP_WIDTH }}
            >
              <InlineTimeSelector
                value={value || '08:00'}
                onChange={(nextTime) => onChange(nextTime)}
                label="Seleccionar horario"
              />
              <div className="app-datepicker-footer">
                <button
                  type="button"
                  className="app-datepicker-link"
                  onClick={() => {
                    const now = new Date()
                    onChange(`${pad(now.getHours())}:${pad(now.getMinutes())}`)
                  }}
                >
                  Ahora
                </button>
                <button
                  type="button"
                  className="primary-button app-datepicker-apply"
                  onClick={() => closePicker(true)}
                >
                  Listo
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
