import { useEffect, useRef } from 'react'
import '../styles/form-modal.css'

interface Props {
  /** Texto a mostrar; null = no se muestra nada. */
  message: string | null
  /** Se llama cuando se cumple el tiempo, para limpiar el mensaje. */
  onDone: () => void
  duration?: number
  tone?: 'ok' | 'error'
}

/**
 * Aviso flotante ("Guardado", "Archivo generado"…). Va fijo abajo, encima del contenido, así no empuja nada:
 * los mensajes que se insertaban dentro de la página movían el resto (layout shift) al aparecer y desaparecer.
 */
export function StatusToast({ message, onDone, duration = 3500, tone = 'ok' }: Props) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(() => done.current(), duration)
    return () => window.clearTimeout(t)
  }, [message, duration])
  if (!message) return null
  return (
    <div className={`status-toast${tone === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}
