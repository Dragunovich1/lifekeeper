import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { TagInput } from '../../components/TagInput'
import { useAppData } from '../../hooks/useAppData'
import type { ClinicalNote } from '../../types'
import { formatDate, safeParseDate, toLocalDateKey } from '../../utils/dates'
import { ClinicalTimelineChart } from './ClinicalTimelineChart'

type ClinicalNoteForm = {
  title: string
  description: string
  date: string
  tags: string[]
}

const DEFAULT_CLINICAL_TAGS = [
  'Estudio',
  'Laboratorio',
  'Diagnóstico',
  'Cirugía',
  'Odontología',
  'Oftalmología',
  'Cardiología',
  'Traumatología',
]

const getTodayKey = () => toLocalDateKey(new Date())

const createInitialFormState = (): ClinicalNoteForm => ({
  title: '',
  description: '',
  date: getTodayKey(),
  tags: [],
})

export const ClinicalHistorySection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<ClinicalNoteForm>(createInitialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<ClinicalNoteForm>(createInitialFormState)
  const [pendingDelete, setPendingDelete] = useState<ClinicalNote | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [includeAllHealthEvents, setIncludeAllHealthEvents] = useState(true)

  const notes = data.health.clinicalNotes
  const consultations = data.health.consultations
  const vaccines = data.health.vaccines

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((first, second) => {
        const firstTime = safeParseDate(first.date)?.getTime() ?? 0
        const secondTime = safeParseDate(second.date)?.getTime() ?? 0
        return secondTime - firstTime
      }),
    [notes],
  )

  const allTags = useMemo(() => {
    const tagSet = new Set<string>(DEFAULT_CLINICAL_TAGS)
    notes.forEach((note) => note.tags?.forEach((tag) => tagSet.add(tag)))
    return Array.from(tagSet)
  }, [notes])

  const timelineNotes = useMemo<ClinicalNote[]>(() => {
    if (!includeAllHealthEvents) {
      return notes
    }
    const fromConsultations: ClinicalNote[] = consultations.map((c) => ({
      id: `consult-${c.id}`,
      title: `Consulta: ${c.reason} (${c.doctor})`,
      description: [c.diagnosis, c.treatment, c.notes].filter(Boolean).join(' · '),
      date: c.date,
      tags: ['Consulta'],
    }))
    const fromVaccines: ClinicalNote[] = vaccines.map((v) => ({
      id: `vaccine-${v.id}`,
      title: `Vacuna: ${v.vaccine}${v.dose ? ` (${v.dose})` : ''}`,
      description: [v.location, v.notes].filter(Boolean).join(' · '),
      date: v.date,
      tags: ['Vacuna'],
    }))
    return [...notes, ...fromConsultations, ...fromVaccines]
  }, [includeAllHealthEvents, notes, consultations, vaccines])

  const filteredNotes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return sortedNotes.filter((note) => {
      const matchesSearch = term
        ? [note.title, note.description]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(term))
        : true

      const matchesTag = selectedTag ? note.tags?.includes(selectedTag) : true

      return matchesSearch && matchesTag
    })
  }, [sortedNotes, searchTerm, selectedTag])

  const tagOptions = useMemo(() => {
    const usedTags = new Set<string>()
    notes.forEach((note) => note.tags?.forEach((tag) => usedTags.add(tag)))
    return [
      { value: '', label: 'Todas las etiquetas' },
      ...Array.from(usedTags).map((tag) => ({ value: tag, label: tag })),
    ]
  }, [notes])

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.title.trim()) return

    const payload = {
      title: formState.title.trim(),
      description: formState.description.trim(),
      date: toLocalDateKey(formState.date) || getTodayKey(),
      tags: formState.tags.map((tag) => tag.trim()).filter(Boolean),
    }

    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        clinicalNotes: [{ id: uuid(), ...payload }, ...previous.health.clinicalNotes],
      },
    }))

    setFormState(createInitialFormState())
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.title.trim()) return

    const payload = {
      title: editFormState.title.trim(),
      description: editFormState.description.trim(),
      date: toLocalDateKey(editFormState.date) || getTodayKey(),
      tags: editFormState.tags.map((tag) => tag.trim()).filter(Boolean),
    }

    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        clinicalNotes: previous.health.clinicalNotes.map((note) =>
          note.id === editingId ? { ...note, ...payload } : note,
        ),
      },
    }))

    setEditingId(null)
  }

  const startEdit = (note: ClinicalNote) => {
    setEditingId(note.id)
    setEditFormState({
      title: note.title,
      description: note.description,
      date: toLocalDateKey(note.date) || getTodayKey(),
      tags: note.tags ?? [],
    })
  }

  const handleRemove = (id: string) => {
    if (editingId === id) {
      setEditingId(null)
    }
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
        title="Historial clínico"
        subtitle="Centralizá enfermedades, estudios, intervenciones y seguimientos relevantes"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Nueva entrada</h3>
            <p className="panel-subtitle">
              Registrá hechos importantes para tener contexto rápido
            </p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="history-title">Título</label>
              <input
                id="history-title"
                value={formState.title}
                onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                placeholder="Ejemplo: Operación, estudio, diagnóstico"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="history-date">Fecha</label>
              <DatePicker
                id="history-date"
                value={toLocalDateKey(formState.date)}
                onChange={(value) => setFormState({ ...formState, date: value })}
                ariaLabel="Fecha del evento clínico"
              />
            </div>
            <div className="field field-full">
              <label htmlFor="history-description">Descripción</label>
              <textarea
                id="history-description"
                value={formState.description}
                onChange={(event) =>
                  setFormState({ ...formState, description: event.target.value })
                }
                placeholder="Detalle del procedimiento, resultados, indicaciones, antecedentes"
              />
            </div>
            <div className="field field-full">
              <label>Etiquetas</label>
              <TagInput
                values={formState.tags}
                onChange={(tags) => setFormState({ ...formState, tags })}
                suggestions={allTags}
                placeholder="Presioná Enter para agregar cada etiqueta"
              />
            </div>
            <div className="form-actions field-full">
              <button className="primary-button" type="submit">
                Guardar entrada
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Panorama cronológico de salud</h3>
              <p className="panel-subtitle">
                Visualizá tus entradas clínicas junto con consultas médicas y vacunas aplicadas
              </p>
            </div>
            <label className="badge">
              <input
                type="checkbox"
                checked={includeAllHealthEvents}
                onChange={(event) => setIncludeAllHealthEvents(event.target.checked)}
              />
              Incluir consultas y vacunas
            </label>
          </div>
          <ClinicalTimelineChart notes={timelineNotes} />
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Línea de tiempo clínica</h3>
            <div className="section-actions">
              <div className="search-input-wrap">
                <Search size={15} className="search-input-icon" aria-hidden />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por título o descripción"
                  aria-label="Buscar por título o descripción"
                />
              </div>
              <Select
                value={selectedTag}
                onChange={setSelectedTag}
                options={tagOptions}
                ariaLabel="Filtrar entradas por etiqueta"
              />
            </div>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="empty-state">Sin registros para mostrar con los filtros actuales.</div>
          ) : (
            <div className="section-body">
              {filteredNotes.map((note) => (
                <div key={note.id} className="subpanel">
                  <div className="panel-header">
                    <div>
                      <h4 className="panel-title">{note.title}</h4>
                      <span className="panel-subtitle">{formatDate(note.date)}</span>
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
                        onClick={() => setPendingDelete(note)}
                      >
                        Eliminar
                      </button>
                    </div>
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

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Editar entrada clínica"
        subtitle="Modificá los datos del evento clínico"
        maxWidth="640px"
      >
        <form className="form-grid two-columns" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-history-title">Título</label>
            <input
              id="edit-history-title"
              value={editFormState.title}
              onChange={(event) =>
                setEditFormState({ ...editFormState, title: event.target.value })
              }
              placeholder="Ejemplo: Operación, estudio, diagnóstico"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="edit-history-date">Fecha</label>
            <DatePicker
              id="edit-history-date"
              value={toLocalDateKey(editFormState.date)}
              onChange={(value) => setEditFormState({ ...editFormState, date: value })}
              ariaLabel="Fecha del evento clínico"
            />
          </div>
          <div className="field field-full">
            <label htmlFor="edit-history-description">Descripción</label>
            <textarea
              id="edit-history-description"
              value={editFormState.description}
              onChange={(event) =>
                setEditFormState({ ...editFormState, description: event.target.value })
              }
              placeholder="Detalle del procedimiento, resultados, indicaciones, antecedentes"
              rows={4}
            />
          </div>
          <div className="field field-full">
            <label>Etiquetas</label>
            <TagInput
              values={editFormState.tags}
              onChange={(tags) => setEditFormState({ ...editFormState, tags })}
              suggestions={allTags}
              placeholder="Presioná Enter para agregar cada etiqueta"
            />
          </div>
          <div
            className="form-actions field-full"
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
        open={Boolean(pendingDelete)}
        title="Eliminar entrada clínica"
        message={
          pendingDelete
            ? `¿Seguro que querés eliminar la entrada "${pendingDelete.title}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (pendingDelete) {
            handleRemove(pendingDelete.id)
          }
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}
