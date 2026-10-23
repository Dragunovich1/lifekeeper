import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'

export interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  eyebrow?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onClose: () => void
}

export const ConfirmModal = ({
  open,
  title,
  message,
  eyebrow = 'Confirmación',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onClose,
}: ConfirmModalProps) => {
  const titleId = useId()
  const descId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()

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
        className="pref-modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <header className="pref-modal-header">
          <div className="pref-modal-heading">
            <span className="page-eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            className="pref-modal-close"
            onClick={onClose}
            aria-label="Cerrar diálogo de confirmación"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="pref-modal-body confirm-modal-body">
          <div className={`confirm-modal-callout is-${variant}`}>
            <span className="confirm-modal-icon" aria-hidden>
              <AlertTriangle size={20} />
            </span>
            <p id={descId} className="confirm-modal-message">
              {message}
            </p>
          </div>
        </div>

        <footer className="pref-modal-footer confirm-modal-footer">
          <button ref={cancelRef} type="button" className="secondary-button" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={variant === 'danger' ? 'danger-button' : 'primary-button'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
