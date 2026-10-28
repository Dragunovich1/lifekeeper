import { useEffect, useRef, useState } from 'react'
import { History, Maximize2, Minimize2, MoreHorizontal, Plus, Trash2, Volume2 } from 'lucide-react'

export function HeaderActions({
  onNewChat,
  onOpenVoice,
  onOpenHistory,
  onDeleteChat,
  canDelete,
  autoSpeak,
  isExpanded,
  onToggleExpand,
}: {
  onNewChat: () => void
  onOpenVoice: () => void
  onOpenHistory: () => void
  onDeleteChat: () => void
  canDelete: boolean
  autoSpeak: boolean
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="asst-header-actions">
      <button type="button" className="asst-new-btn" onClick={onNewChat} title="Iniciar nueva conversación">
        <Plus size={14} />
        <span>Nuevo</span>
      </button>

      <div className="asst-menu-wrap" ref={wrapRef}>
        <button
          type="button"
          className={`pref-modal-action-btn ${open ? 'is-active' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Más opciones del asistente"
          title="Voz, historial y más"
        >
          <MoreHorizontal size={17} />
          {autoSpeak && <span className="asst-badge-dot" aria-hidden="true" />}
        </button>

        {open && (
          <div className="asst-menu" role="menu">
            <button type="button" role="menuitem" onClick={run(onOpenVoice)}>
              <Volume2 size={15} />
              <span>Voz y lectura</span>
              {autoSpeak && <em>Auto</em>}
            </button>
            <button type="button" role="menuitem" onClick={run(onOpenHistory)}>
              <History size={15} />
              <span>Historial de chats</span>
            </button>
            {canDelete && (
              <button type="button" role="menuitem" className="is-danger" onClick={run(onDeleteChat)}>
                <Trash2 size={15} />
                <span>Eliminar esta conversación</span>
              </button>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        className="pref-modal-action-btn asst-expand-btn"
        onClick={onToggleExpand}
        aria-label={isExpanded ? 'Contraer ventana' : 'Expandir ventana'}
        title={isExpanded ? 'Contraer ventana' : 'Expandir ventana'}
      >
        {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  )
}
