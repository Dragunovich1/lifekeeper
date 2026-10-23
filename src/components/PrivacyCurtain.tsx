import { useState, useEffect } from 'react'
import { ShieldCheck, Eye } from 'lucide-react'

interface PrivacyCurtainProps {
  enabled?: boolean
}

export const PrivacyCurtain = ({ enabled = true }: PrivacyCurtainProps) => {
  const [blurred, setBlurred] = useState(false)

  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setBlurred(true)
      }
    }

    const handleBlur = () => {
      // Breve retraso para no disparar con clicks en popovers internos
      setTimeout(() => {
        if (!document.hasFocus()) {
          setBlurred(true)
        }
      }, 300)
    }

    const handleFocus = () => {
      // Al volver a la ventana, no quitamos el blur automáticamente de golpe
      // para permitir al usuario hacer clic conscientemente si así lo prefiere,
      // o quitamos si ya está visible.
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [enabled])

  if (!blurred || !enabled) return null

  return (
    <div
      role="region"
      aria-label="Cortina de privacidad activa"
      onClick={() => setBlurred(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(7, 17, 31, 0.82)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        animation: 'fadeIn 0.2s ease',
        userSelect: 'none',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: '380px',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-purple))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(29, 99, 220, 0.35)',
            color: '#ffffff',
          }}
        >
          <ShieldCheck size={36} />
        </div>

        <div>
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
            Bóveda Protegida
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.5 }}>
            Pantalla difuminada automáticamente para evitar miradas indiscretas.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={(e) => {
            e.stopPropagation()
            setBlurred(false)
          }}
          style={{
            marginTop: '0.5rem',
            padding: '0.55rem 1.25rem',
            fontSize: '0.875rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 4px 16px rgba(29, 99, 220, 0.4)',
          }}
        >
          <Eye size={16} />
          <span>Hacé clic para reanudar</span>
        </button>
      </div>
    </div>
  )
}
