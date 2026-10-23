import { useState, useEffect } from 'react'
import { Sparkles, X } from 'lucide-react'

interface FloatingAssistantProps {
  onClick: () => void
}

const STORAGE_KEY = 'lifekeeper:assistant-bubble-dismissed'

export const FloatingAssistant = ({ onClick }: FloatingAssistantProps) => {
  const [bubbleVisible, setBubbleVisible] = useState(false)

  useEffect(() => {
    // Mostrar la burbuja solo si el usuario no la cerró en esta sesión
    const isDismissed = sessionStorage.getItem(STORAGE_KEY) === 'true'
    if (!isDismissed) {
      // Pequeño retardo agradable para que aparezca después de cargar la pantalla
      const timer = setTimeout(() => {
        setBubbleVisible(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismissBubble = (e: React.MouseEvent) => {
    e.stopPropagation()
    setBubbleVisible(false)
    sessionStorage.setItem(STORAGE_KEY, 'true')
  }

  return (
    <aside className="floating-assistant-wrap" aria-label="Asistente flotante de LifeKeeper">
      {bubbleVisible && (
        <div
          className="floating-assistant-bubble"
          onClick={onClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick()
            }
          }}
          title="Hacé clic para hablar con el Asistente"
        >
          <div className="floating-assistant-bubble-header">
            <span className="floating-assistant-bubble-title">
              <Sparkles size={12} aria-hidden />
              <span>Asistente LifeKeeper</span>
            </span>
            <button
              type="button"
              className="floating-assistant-bubble-close"
              onClick={handleDismissBubble}
              aria-label="Ocultar saludo"
              title="Ocultar"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
          <p className="floating-assistant-bubble-text">
            ¡Hola! Soy el asistente de LifeKeeper. ¿En qué te ayudo?
          </p>
        </div>
      )}

      <button
        type="button"
        className="floating-assistant-btn"
        onClick={onClick}
        aria-label="Abrir Asistente LifeKeeper"
        title="Asistente LifeKeeper (Ctrl+J)"
      >
        <div className="floating-assistant-avatar-inner">
          <img
            src="/brand/assistant.png?v=2"
            alt="Asistente LifeKeeper"
          />
        </div>
        <span className="floating-assistant-status-dot" aria-hidden />
      </button>
    </aside>
  )
}
