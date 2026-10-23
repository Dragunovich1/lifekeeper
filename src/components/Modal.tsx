import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { ScrollbarOverlay } from '../scrollbar/ScrollbarOverlay'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: number | string
  className?: string
  ariaLabel?: string
}

export const Modal = ({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  maxWidth,
  className = '',
  ariaLabel,
}: ModalProps) => {
  const titleId = useId()
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus()
      }
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pref-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`pref-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={ariaLabel}
        style={maxWidth ? { maxWidth } : undefined}
      >
        <header className="pref-modal-header">
          <div className="pref-modal-heading">
            {eyebrow ? <span className="page-eyebrow">{eyebrow}</span> : null}
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className="pref-modal-subtitle">{subtitle}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="pref-modal-close"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="pref-modal-body" ref={bodyRef}>
          {children}
        </div>

        <ScrollbarOverlay targetRef={bodyRef} zIndex={1051} minThumb={28} />

        {footer ? <footer className="pref-modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
