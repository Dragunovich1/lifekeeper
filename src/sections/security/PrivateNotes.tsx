import type { FormEvent } from 'react'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { PrivateNote } from '../../types'
import { formatDateTime } from '../../utils/dates'

const initialFormState: Omit<PrivateNote, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '',
  content: '',
}

export const PrivateNotesSection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState(initialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState(initialFormState)
  const [deletingNote, setDeletingNote] = useState<PrivateNote | null>(null)

  const notes = data.security.privateNotes

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.content.trim()) return

    const timestamp = new Date().toISOString()
    const entry: PrivateNote = {
      id: uuid(),
      title: formState.title.trim() || 'Nota sin título',
      content: formState.content,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    updateData((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        privateNotes: [entry, ...previous.security.privateNotes],
      },
    }))

    setFormState(initialFormState)
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.content.trim()) return

    const timestamp = new Date().toISOString()
    updateData((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        privateNotes: previous.security.privateNotes.map((note) =>
          note.id === editingId
            ? {
                ...note,
                title: editFormState.title.trim() || 'Nota sin título',
                content: editFormState.content,
                updatedAt: timestamp,
              }
            : note,
        ),
      },
    }))

    setEditingId(null)
  }

  const startEdit = (note: PrivateNote) => {
    setEditingId(note.id)
    setEditFormState({
      title: note.title,
      content: note.content,
    })
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        privateNotes: previous.security.privateNotes.filter((note) => note.id !== id),
      },
    }))
    if (editingId === id) {
      setEditingId(null)
    }
  }

  return (
    <div>
      <SectionHeader
        title="Notas privadas"
        subtitle="Texto cifrado para información delicada, visible solo tras desbloquear la app"
      />
      <div className="section-body compact">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Crear nota</h3>
          </div>
          <form className="form-grid" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="private-title">Título</label>
              <input
                id="private-title"
                value={formState.title}
                onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                placeholder="Título opcional"
              />
            </div>
            <div className="field">
              <label htmlFor="private-content">Contenido</label>
              <textarea
                id="private-content"
                value={formState.content}
                onChange={(event) => setFormState({ ...formState, content: event.target.value })}
                placeholder="Escribí tu nota"
                required
              />
            </div>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                Guardar nota
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <h3 className="panel-title">Notas guardadas</h3>
          {notes.length === 0 ? (
            <div className="empty-state">Todavía no cargaste notas privadas.</div>
          ) : (
            <div className="section-body">
              {notes.map((note) => (
                <div key={note.id} className="subpanel">
                  <div className="panel-header">
                    <div>
                      <h4 className="panel-title">{note.title || 'Sin título'}</h4>
                      <span className="panel-subtitle">
                        Actualizada {formatDateTime(note.updatedAt)}
                      </span>
                    </div>
                    <div className="section-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => startEdit(note)}
                      >
                        Editar
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setDeletingNote(note)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <p style={{ whiteSpace: 'pre-line' }}>{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Editar nota privada"
        subtitle="Actualizá el contenido de tu nota cifrada"
        maxWidth="600px"
      >
        <form className="form-grid" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-private-title">Título</label>
            <input
              id="edit-private-title"
              value={editFormState.title}
              onChange={(event) =>
                setEditFormState({ ...editFormState, title: event.target.value })
              }
              placeholder="Título opcional"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="edit-private-content">Contenido</label>
            <textarea
              id="edit-private-content"
              value={editFormState.content}
              onChange={(event) =>
                setEditFormState({ ...editFormState, content: event.target.value })
              }
              placeholder="Escribí tu nota"
              required
              rows={6}
            />
          </div>
          <div
            className="form-actions"
            style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}
          >
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditingId(null)}
            >
              Cancelar
            </button>
            <button className="primary-button" type="submit">
              Guardar cambios
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deletingNote)}
        title="Eliminar nota privada"
        message={
          deletingNote
            ? `¿Querés eliminar la nota "${deletingNote.title || 'Sin título'}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deletingNote) {
            handleRemove(deletingNote.id)
          }
        }}
        onClose={() => setDeletingNote(null)}
      />
    </div>
  )
}
