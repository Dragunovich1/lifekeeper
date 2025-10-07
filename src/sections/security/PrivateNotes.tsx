import type { FormEvent } from 'react'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
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

  const notes = data.security.privateNotes

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.content) {
      return
    }

    const timestamp = new Date().toISOString()
    const entry: PrivateNote = {
      id: uuid(),
      title: formState.title || 'Nota sin titulo',
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

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        privateNotes: previous.security.privateNotes.filter((note) => note.id !== id),
      },
    }))
  }

  return (
    <div>
      <SectionHeader
        title="Notas privadas"
        subtitle="Texto cifrado para informacion delicada, visible solo tras desbloquear la app"
      />
      <div className="section-body compact">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Crear nota</h3>
          </div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="private-title">Titulo</label>
              <input
                id="private-title"
                value={formState.title}
                onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                placeholder="Titulo opcional"
              />
            </div>
            <div className="field">
              <label htmlFor="private-content">Contenido</label>
              <textarea
                id="private-content"
                value={formState.content}
                onChange={(event) => setFormState({ ...formState, content: event.target.value })}
                placeholder="Escribe tu nota"
                required
              />
            </div>
            <button className="primary-button" type="submit">
              Guardar nota
            </button>
          </form>
        </div>

        <div className="panel">
          <h3 className="panel-title">Notas guardadas</h3>
          {notes.length === 0 ? (
            <div className="empty-state">Todavia no cargaste notas privadas.</div>
          ) : (
            <div className="section-body">
              {notes.map((note) => (
                <div key={note.id} className="panel">
                  <div className="panel-header">
                    <div>
                      <h4 className="panel-title">{note.title}</h4>
                      <span className="panel-subtitle">Actualizada {formatDateTime(note.updatedAt)}</span>
                    </div>
                    <button className="secondary-button" type="button" onClick={() => handleRemove(note.id)}>
                      Eliminar
                    </button>
                  </div>
                  <p>{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
