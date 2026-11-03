import type { FormEvent, ReactNode } from 'react'
import { useId } from 'react'
import { Modal } from './Modal'
import '../styles/form-modal.css'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Texto del botón principal (por defecto "Guardar"). */
  submitLabel?: string
  onSubmit: () => void
  /** Si es false el botón queda deshabilitado (ej. falta un dato obligatorio). */
  canSubmit?: boolean
  children: ReactNode
  maxWidth?: number | string
  /** Botones extra a la izquierda del pie (ej. "Eliminar"). */
  footerExtra?: ReactNode
}

/**
 * Patrón para "agregar / editar algo": el formulario va en un modal y, al confirmar, se cierra y se agrega.
 * Pide confirmación si se intenta salir con datos cargados (lo hace `Modal`).
 */
export function FormModal({ open, onClose, title, subtitle, submitLabel = 'Guardar', onSubmit, canSubmit = true, children, maxWidth = 640, footerExtra }: Props) {
  const formId = useId()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (canSubmit) onSubmit()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxWidth={maxWidth}
      footer={
        <>
          {footerExtra ? <div className="fm-footer-extra">{footerExtra}</div> : null}
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button type="submit" form={formId} className="primary-button" disabled={!canSubmit}>{submitLabel}</button>
        </>
      }
    >
      <form id={formId} className="fm-form" onSubmit={submit} noValidate>
        {children}
      </form>
    </Modal>
  )
}
