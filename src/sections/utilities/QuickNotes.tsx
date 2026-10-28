import { useMemo, useState, type KeyboardEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { Check, Copy, Pencil, Pin, PinOff, Plus, Search, StickyNote, Trash2, X } from 'lucide-react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { QuickNote, QuickNoteColor } from '../../types'
import '../../styles/utility-tools.css'

const COLORS: { id: QuickNoteColor; label: string }[] = [
  { id: 'amarillo', label: 'Amarillo' },
  { id: 'verde', label: 'Verde' },
  { id: 'azul', label: 'Azul' },
  { id: 'rosa', label: 'Rosa' },
  { id: 'violeta', label: 'Violeta' },
  { id: 'gris', label: 'Gris' },
]

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `hace ${d} d`
  return new Date(iso).toLocaleDateString('es-AR')
}

export const QuickNotesSection = () => {
  const { data, updateData } = useAppData()
  const notes = useMemo(() => data.utilities.quickNotes ?? [], [data.utilities.quickNotes])

  const [text, setText] = useState('')
  const [color, setColor] = useState<QuickNoteColor>('amarillo')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [deleting, setDeleting] = useState<QuickNote | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const patchNotes = (fn: (n: QuickNote[]) => QuickNote[]) =>
    updateData((prev) => ({ ...prev, utilities: { ...prev.utilities, quickNotes: fn(prev.utilities.quickNotes ?? []) } }))

  const addNote = () => {
    const value = text.trim()
    if (!value) return
    const now = new Date().toISOString()
    patchNotes((n) => [{ id: uuid(), text: value, color, pinned: false, createdAt: now, updatedAt: now }, ...n])
    setText('')
  }

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      addNote()
    }
  }

  const saveEdit = () => {
    const value = editText.trim()
    if (!editingId) return
    if (!value) {
      setEditingId(null)
      return
    }
    patchNotes((n) => n.map((x) => (x.id === editingId ? { ...x, text: value, updatedAt: new Date().toISOString() } : x)))
    setEditingId(null)
  }

  const onEditKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      setEditingId(null)
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      saveEdit()
    }
  }

  const copy = async (note: QuickNote) => {
    try {
      await navigator.clipboard.writeText(note.text)
      setCopiedId(note.id)
      window.setTimeout(() => setCopiedId(null), 1500)
    } catch {
      /* portapapeles bloqueado */
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...notes]
      .filter((n) => !q || n.text.toLowerCase().includes(q))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  }, [notes, search])

  return (
    <div className="tool-page">
      <SectionHeader title="Notas rápidas" subtitle="Anotá al vuelo lo que se te ocurre. Todo queda cifrado en tu bóveda." />

      <div className={`card qn-composer`} data-color={color}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onComposerKey}
          rows={3}
          placeholder="Escribí una nota…  (Enter para guardar, Shift+Enter para nueva línea)"
          aria-label="Nueva nota rápida"
        />
        <div className="qn-composer-bar">
          <div className="qn-colors" role="radiogroup" aria-label="Color de la nota">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={color === c.id}
                aria-label={c.label}
                title={c.label}
                data-color={c.id}
                className={`qn-dot ${color === c.id ? 'is-active' : ''}`}
                onClick={() => setColor(c.id)}
              />
            ))}
          </div>
          <button type="button" className="primary-button" onClick={addNote} disabled={!text.trim()}>
            <Plus size={16} /> Guardar nota
          </button>
        </div>
      </div>

      {notes.length > 0 && (
        <label className="qn-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en tus notas…" aria-label="Buscar en tus notas" />
          <span>{visible.length} {visible.length === 1 ? 'nota' : 'notas'}</span>
        </label>
      )}

      {notes.length === 0 ? (
        <div className="empty-state shop-empty">
          <StickyNote size={34} aria-hidden="true" />
          <h3>Todavía no tenés notas</h3>
          <p>Escribí algo arriba, o decile al asistente: <em>“anotame que mañana tengo que llevar el DNI”</em>.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state shop-empty">
          <Search size={30} aria-hidden="true" />
          <h3>Sin resultados</h3>
          <p>Ninguna nota coincide con “{search}”.</p>
        </div>
      ) : (
        <div className="qn-grid">
          {visible.map((n) => (
            <article key={n.id} className={`qn-card ${n.pinned ? 'is-pinned' : ''}`} data-color={n.color}>
              {editingId === n.id ? (
                <>
                  <textarea
                    className="qn-edit"
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={onEditKey}
                    rows={Math.min(10, Math.max(3, editText.split('\n').length + 1))}
                    aria-label="Editar nota"
                  />
                  <div className="qn-card-bar">
                    <div className="qn-colors">
                      {COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          aria-label={`Color ${c.label}`}
                          data-color={c.id}
                          className={`qn-dot ${n.color === c.id ? 'is-active' : ''}`}
                          onClick={() => patchNotes((all) => all.map((x) => (x.id === n.id ? { ...x, color: c.id } : x)))}
                        />
                      ))}
                    </div>
                    <div className="qn-card-actions is-visible">
                      <button type="button" aria-label="Guardar cambios" title="Guardar (Ctrl+Enter)" onClick={saveEdit}><Check size={15} /></button>
                      <button type="button" aria-label="Cancelar edición" title="Cancelar (Esc)" onClick={() => setEditingId(null)}><X size={15} /></button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {n.pinned && <Pin size={14} className="qn-pin-badge" aria-label="Nota fijada" />}
                  <p className="qn-text">{n.text}</p>
                  <div className="qn-card-bar">
                    <time dateTime={n.updatedAt}>{timeAgo(n.updatedAt)}</time>
                    <div className="qn-card-actions">
                      <button type="button" aria-label={n.pinned ? 'Desfijar' : 'Fijar nota'} title={n.pinned ? 'Desfijar' : 'Fijar arriba'} onClick={() => patchNotes((all) => all.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)))}>
                        {n.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                      </button>
                      <button type="button" aria-label="Copiar nota" title={copiedId === n.id ? 'Copiado' : 'Copiar'} onClick={() => copy(n)}>
                        {copiedId === n.id ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                      <button type="button" aria-label="Editar nota" title="Editar" onClick={() => { setEditingId(n.id); setEditText(n.text) }}>
                        <Pencil size={15} />
                      </button>
                      <button type="button" aria-label="Eliminar nota" title="Eliminar" onClick={() => setDeleting(n)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleting)}
        title="Eliminar nota"
        message="¿Eliminar esta nota? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleting) patchNotes((all) => all.filter((x) => x.id !== deleting.id))
          setDeleting(null)
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
