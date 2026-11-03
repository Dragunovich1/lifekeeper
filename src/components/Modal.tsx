import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { ScrollbarOverlay } from '../scrollbar/ScrollbarOverlay'
import { ConfirmModal } from './ConfirmModal'

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
  headerActions?: ReactNode
  /** Pide confirmación al cerrar (tocar fuera, X o Esc) si ya se cargó algo en un formulario. Por defecto sí. */
  confirmDiscard?: boolean
}

// Modales abiertos (el último es el de arriba): Esc solo cierra el de arriba, no todos los anidados
const modalStack: symbol[] = []

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
  headerActions,
  confirmDiscard = true,
}: ModalProps) => {
  const titleId = useId()
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)
  // `onClose` suele ser una función nueva en cada render: se guarda en un ref para que el efecto NO se reinicie
  // (si se reinicia, el foco vuelve al botón de cerrar en cada tecla y el espacio cierra el modal).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // ¿Se tocó algo en un formulario? Si es así, cerrar "sin querer" (tocar fuera, X, Esc) pide confirmación
  // en lugar de perder en silencio lo que se cargó. Las búsquedas (`role=search` o `data-no-dirty`) no cuentan.
  const dirtyRef = useRef(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const confirmOpenRef = useRef(false)
  confirmOpenRef.current = confirmOpen

  useEffect(() => {
    if (open) {
      dirtyRef.current = false
      setConfirmOpen(false)
    }
  }, [open])

  const requestClose = useCallback(() => {
    if (confirmOpenRef.current) return
    if (confirmDiscard && dirtyRef.current) {
      setConfirmOpen(true)
      return
    }
    onCloseRef.current()
  }, [confirmDiscard])
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const id = Symbol('modal')
    modalStack.push(id)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && modalStack[modalStack.length - 1] === id) {
        event.stopPropagation()
        requestCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      const at = modalStack.indexOf(id)
      if (at >= 0) modalStack.splice(at, 1)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus()
      }
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pref-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div
        className={`pref-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={ariaLabel}
        style={maxWidth ? { maxWidth } : undefined}
        onInputCapture={(event) => {
          const t = event.target as HTMLElement
          if (t.closest('form') && !t.closest('[role="search"], [data-no-dirty]')) dirtyRef.current = true
        }}
      >
        <header className="pref-modal-header">
          <div className="pref-modal-heading">
            {eyebrow ? <span className="page-eyebrow">{eyebrow}</span> : null}
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className="pref-modal-subtitle">{subtitle}</p> : null}
          </div>
          <div className="pref-modal-header-actions">
            {headerActions}
            <button
              ref={closeRef}
              type="button"
              className="pref-modal-close"
              onClick={requestClose}
              aria-label="Cerrar ventana"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </header>

        <div className="pref-modal-body" ref={bodyRef}>
          {children}
        </div>

        <ScrollbarOverlay targetRef={bodyRef} zIndex={1051} minThumb={28} />

        {footer ? <footer className="pref-modal-footer">{footer}</footer> : null}

        <ConfirmModal
          open={confirmOpen}
          title="¿Salir sin guardar?"
          message="Lo que cargaste en este formulario se va a perder."
          confirmLabel="Descartar"
          cancelLabel="Seguir editando"
          variant="danger"
          onConfirm={() => {
            dirtyRef.current = false
            setConfirmOpen(false)
            onCloseRef.current()
          }}
          onClose={() => setConfirmOpen(false)}
        />
      </div>
    </div>,
    document.body,
  )
}
