import { useMemo, useState } from 'react'
import { Clock, Search, X } from 'lucide-react'
import type { AssistantChatSession } from '../../types'

export function ChatHistoryPanel({
  sessions,
  activeSessionId,
  onSelect,
  onClose,
}: {
  sessions: AssistantChatSession[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter(
      (s) =>
        (s.title || '').toLowerCase().includes(q) ||
        s.messages?.some((m) => m.text.toLowerCase().includes(q)),
    )
  }, [sessions, query])

  return (
    <div className="asst-history" role="dialog" aria-label="Conversaciones guardadas">
      <div className="asst-popover-head">
        <div className="asst-popover-title">
          <Clock size={16} />
          <span>Conversaciones guardadas ({sessions.length})</span>
        </div>
        <button type="button" className="pref-modal-action-btn" onClick={onClose} aria-label="Cerrar historial">
          <X size={16} />
        </button>
      </div>

      {sessions.length > 3 && (
        <label className="asst-search">
          <Search size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en tus conversaciones…"
            aria-label="Buscar en tus conversaciones"
          />
        </label>
      )}

      <div className="asst-history-list">
        {sessions.length === 0 ? (
          <div className="asst-empty">No hay conversaciones anteriores guardadas en tu bóveda.</div>
        ) : filtered.length === 0 ? (
          <div className="asst-empty">Ninguna conversación coincide con tu búsqueda.</div>
        ) : (
          filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`asst-history-item ${s.id === activeSessionId ? 'is-active' : ''}`}
              onClick={() => onSelect(s.id)}
            >
              <span className="asst-history-title">{s.title || 'Conversación'}</span>
              <span className="asst-history-meta">
                {new Date(s.updatedAt).toLocaleDateString('es-AR')} · {s.messages?.length || 0} mensajes
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
