import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, MessageCircle, Send, Share2, X } from 'lucide-react'

interface ShareModalProps {
  open: boolean
  onClose: () => void
}

const SHARE_URL = 'https://app.lifekeeper.lat/?ref=share'
const SHARE_MESSAGE =
  '¡Hola! Te recomiendo LifeKeeper, una app privada para gestionar tu salud, finanzas, contraseñas y recuerdos con cifrado de conocimiento cero (Zero-Knowledge):'

export const ShareModal = ({ open, onClose }: ShareModalProps) => {
  const [copied, setCopied] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${SHARE_MESSAGE}\n${SHARE_URL}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Fallback
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`${SHARE_MESSAGE}\n${SHARE_URL}`)
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const handleTelegram = () => {
    const url = encodeURIComponent(SHARE_URL)
    const text = encodeURIComponent(SHARE_MESSAGE)
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'LifeKeeper — Tu Bóveda Personal Soberana',
          text: SHARE_MESSAGE,
          url: SHARE_URL,
        })
      } catch {
        // User cancelled
      }
    }
  }

  return createPortal(
    <div
      className="pref-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="pref-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        style={{ maxWidth: '480px' }}
      >
        <header className="pref-modal-header">
          <div className="pref-modal-heading">
            <span className="page-eyebrow">Comunidad</span>
            <h2 id="share-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Share2 size={20} />
              <span>Compartir LifeKeeper</span>
            </h2>
            <p className="pref-modal-subtitle">
              Invitá a amigos o familiares a resguardar su vida digital en su propia bóveda soberana
            </p>
          </div>
          <button ref={closeRef} type="button" className="pref-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="pref-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Card Preview */}
          <div
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-strong)',
              background: 'linear-gradient(180deg, rgba(22, 22, 29, 0.95), rgba(12, 12, 15, 0.98))',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ position: 'relative', width: '100%', height: '140px', background: '#070b14', overflow: 'hidden' }}>
              <img
                src="/brand/og-banner.png?v=2"
                alt="LifeKeeper"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ padding: '0.875rem 1rem' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                LifeKeeper — Tu Bóveda Personal Soberana
              </div>
              <p style={{ margin: 0, fontSize: '0.78125rem', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                Salud, finanzas, contraseñas y recuerdos protegidos bajo cifrado de extremo a extremo y arquitectura Zero-Knowledge.
              </p>
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-accent-cyan)' }}>
                app.lifekeeper.lat
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <button
              type="button"
              className="primary-button"
              onClick={handleWhatsApp}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: '#25D366',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                padding: '0.75rem 1rem',
              }}
            >
              <MessageCircle size={18} />
              <span>Enviar por WhatsApp</span>
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={handleTelegram}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  fontSize: '0.8125rem',
                  padding: '0.65rem 0.75rem',
                }}
              >
                <Send size={15} />
                <span>Telegram</span>
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={handleCopy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  fontSize: '0.8125rem',
                  padding: '0.65rem 0.75rem',
                  color: copied ? 'var(--color-success)' : undefined,
                }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? '¡Copiado!' : 'Copiar enlace'}</span>
              </button>
            </div>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                className="secondary-button"
                onClick={handleNativeShare}
                style={{
                  fontSize: '0.78125rem',
                  padding: '0.5rem',
                  opacity: 0.85,
                  marginTop: '0.25rem',
                }}
              >
                Más opciones de compartir
              </button>
            )}
          </div>
        </div>

        <footer className="pref-modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
