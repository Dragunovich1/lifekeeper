import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { TagInput } from '../../components/TagInput'
import { useAppData } from '../../hooks/useAppData'
import type { ClinicalNote } from '../../types'
import { formatDate } from '../../utils/dates'

type ClinicalNoteForm = {
  title: string
  description: string
  date: string
  tags: string[]
}

const createInitialFormState = (): ClinicalNoteForm => ({
  title: '',
  description: '',
  date: new Date().toISOString(),
  tags: [],
})

export const ClinicalHistorySection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<ClinicalNoteForm>(createInitialFormState)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('')

  const notes = data.health.clinicalNotes

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach((note) => note.tags?.forEach((tag) => tagSet.add(tag)))
    return Array.from(tagSet)
  }, [notes])

  const filteredNotes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return notes.filter((note) => {
      const matchesSearch = term
        ? [note.title, note.description]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(term))
        : true

      const matchesTag = selectedTag ? note.tags?.includes(selectedTag) : true

      return matchesSearch && matchesTag
    })
  }, [notes, searchTerm, selectedTag])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.title) {
      return
    }

    const record: ClinicalNote = {
      ...formState,
      id: uuid(),
      date: new Date(formState.date).toISOString(),
      tags: formState.tags.map((tag) => tag.trim()),
    }

    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        clinicalNotes: [record, ...previous.health.clinicalNotes],
      },
    }))

    setFormState(createInitialFormState())
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        clinicalNotes: previous.health.clinicalNotes.filter((note) => note.id !== id),
      },
    }))
  }

  return (
    <div>
      <SectionHeader
        title="Historial clinico"
        subtitle="Centraliza enfermedades, estudios, intervenciones y seguimientos relevantes"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Nueva entrada</h3>
            <p className="panel-subtitle">Registra hechos importantes para tener contexto rapido</p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="history-title">Titulo</label>
              <input
                id="history-title"
                value={formState.title}
                onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                placeholder="Ejemplo: Operacion, estudio, diagnostico"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="history-date">Fecha</label>
              <input
                id="history-date"
                type="date"
                value={formState.date.slice(0, 10)}
                onChange={(event) =>
                  setFormState({ ...formState, date: new Date(event.target.value).toISOString() })
                }
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="history-description">Descripcion</label>
              <textarea
                id="history-description"
                value={formState.description}
                onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                placeholder="Detalle del procedimiento, resultados, indicaciones, antecedentes"
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Etiquetas</label>
              <TagInput
                values={formState.tags}
                onChange={(tags) => setFormState({ ...formState, tags })}
                placeholder="Presiona Enter para agregar cada etiqueta"
              />
            </div>
            <button className="primary-button" type="submit">
              Guardar entrada
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Linea de tiempo clinica</h3>
            <div className="section-actions">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por titulo o descripcion"
              />
              <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
                <option value="">Todos los tags</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="empty-state">Sin registros para mostrar con los filtros actuales.</div>
          ) : (
            <div className="section-body">
              {filteredNotes.map((note) => (
                <div key={note.id} className="panel">
                  <div className="panel-header">
                    <div>
                      <h4 className="panel-title">{note.title}</h4>
                      <span className="panel-subtitle">{formatDate(note.date)}</span>
                    </div>
                    <button className="secondary-button" type="button" onClick={() => handleRemove(note.id)}>
                      Eliminar
                    </button>
                  </div>
                  <p>{note.description || 'Sin detalle adicional.'}</p>
                  {note.tags && note.tags.length > 0 ? (
                    <div className="chip-list">
                      {note.tags.map((tag) => (
                        <span key={tag} className="chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
