import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { legalDocuments, type LegalDocKey } from '../content/legal'
import { ScrollbarOverlay } from '../scrollbar/ScrollbarOverlay'

interface LegalModalProps {
  documentKey: LegalDocKey | null
  onClose: () => void
}

export const LegalModal = ({ documentKey, onClose }: LegalModalProps) => {
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (!documentKey) return
    previousFocus.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
  }, [documentKey, onClose])

  if (!documentKey || typeof document === 'undefined') {
    return null
  }

  const document_ = legalDocuments[documentKey]

  return createPortal(
    <div
      className="legal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
        <header className="legal-modal-header">
          <div className="legal-modal-heading">
            <span className="page-eyebrow">Legal</span>
            <h2 id="legal-modal-title">{document_.title}</h2>
            <p className="legal-updated">Última actualización: {document_.updated}</p>
          </div>
          <button ref={closeRef} type="button" className="legal-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="legal-modal-body-shell">
          <div ref={bodyRef} className="legal-modal-body" tabIndex={0}>
            {document_.sections.map((section) => (
              <section key={section.title}>
                <h3>{section.title}</h3>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
          <ScrollbarOverlay targetRef={bodyRef} zIndex={1051} minThumb={30} />
        </div>

        <footer className="legal-modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
