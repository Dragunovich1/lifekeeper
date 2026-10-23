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
import type { DiaryEntry, MoodLevel } from '../../types'
import {
  formatDate,
  fromLocalDateOrDateTime,
  monthKey,
  toLocalDateKey,
} from '../../utils/dates'

type DiaryEntryForm = {
  date: string
  title: string
  content: string
  mood: MoodLevel
  tags: string[]
}

const moodOptions: Array<{ value: MoodLevel; label: string }> = [
  { value: 'Excelente', label: ':D Excelente' },
  { value: 'Bien', label: ':) Bien' },
  { value: 'Neutral', label: ':| Neutral' },
  { value: 'Regular', label: ':/ Regular' },
  { value: 'Mal', label: ':( Mal' },
]

const createInitialFormState = (): DiaryEntryForm => ({
  date: new Date().toISOString(),
  title: '',
  content: '',
  mood: 'Neutral',
  tags: [],
})

export const DiaryNotesSection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<DiaryEntryForm>(createInitialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<DiaryEntryForm>(createInitialFormState)
  const [deletingEntry, setDeletingEntry] = useState<DiaryEntry | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')

  const entries = data.diary.entries

  const existingTags = useMemo(() => {
    const counts = new Map<string, number>()
    entries.forEach((entry) => {
      entry.tags.forEach((tag) => {
        const cleaned = tag.trim()
        if (cleaned) {
          counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1)
        }
      })
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
  }, [entries])

  const months = useMemo(() => {
    const grouped = new Map<string, number>()
    entries.forEach((entry) => {
      const key = monthKey(entry.date)
      if (!key) return
      grouped.set(key, (grouped.get(key) ?? 0) + 1)
    })
    return Array.from(grouped.entries())
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([key, count]) => ({ key, count }))
  }, [entries])

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return [...entries]
      .filter((entry) => {
        const matchesSearch = term
          ? [entry.title, entry.content, entry.tags.join(' ')]
              .filter(Boolean)
              .some((value) => value.toLowerCase().includes(term))
          : true

        const matchesMonth = selectedMonth ? monthKey(entry.date) === selectedMonth : true

        return matchesSearch && matchesMonth
      })
      .sort((a, b) => (a.date > b.date ? -1 : 1))
  }, [entries, searchTerm, selectedMonth])

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.content.trim()) return

    const normalizedDate = fromLocalDateOrDateTime(formState.date, true)
    const normalizedTags = formState.tags.map((tag) => tag.trim()).filter(Boolean)

    const entry: DiaryEntry = {
      ...formState,
      id: uuid(),
      title: formState.title.trim(),
      date: normalizedDate,
      tags: normalizedTags,
    }

    updateData((previous) => ({
      ...previous,
      diary: {
        ...previous.diary,
        entries: [entry, ...previous.diary.entries],
      },
    }))

    setFormState(createInitialFormState())
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.content.trim()) return

    const normalizedDate = fromLocalDateOrDateTime(editFormState.date, true)
    const normalizedTags = editFormState.tags.map((tag) => tag.trim()).filter(Boolean)

    updateData((previous) => ({
      ...previous,
      diary: {
        ...previous.diary,
        entries: previous.diary.entries.map((entry) =>
          entry.id === editingId
            ? {
                ...entry,
                ...editFormState,
                title: editFormState.title.trim(),
                content: editFormState.content,
                date: normalizedDate,
                tags: normalizedTags,
              }
            : entry,
        ),
      },
    }))

    setEditingId(null)
  }

  const startEdit = (entry: DiaryEntry) => {
    setEditingId(entry.id)
    setEditFormState({
      date: entry.date,
      title: entry.title,
      content: entry.content,
      mood: entry.mood,
      tags: entry.tags,
    })
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      diary: {
        ...previous.diary,
        entries: previous.diary.entries.filter((entry) => entry.id !== id),
      },
    }))
    if (editingId === id) {
      setEditingId(null)
    }
  }

  return (
    <div>
      <SectionHeader
        title="Notas diarias"
        subtitle="Dejá registro sencillo de tu día con estado de ánimo y etiquetas accesibles"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Nueva nota</h3>
            <p className="panel-subtitle">
              La fecha se completa automáticamente, podés modificarla
            </p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="diary-date">Fecha</label>
              <DatePicker
                id="diary-date"
                value={toLocalDateKey(formState.date)}
                onChange={(value) =>
                  setFormState({ ...formState, date: fromLocalDateOrDateTime(value, true) })
                }
                ariaLabel="Fecha de la nota"
              />
            </div>
            <div className="field">
              <label htmlFor="diary-title">Título</label>
              <input
                id="diary-title"
                value={formState.title}
                onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                placeholder="Resumen corto"
              />
            </div>
            <div className="field">
              <label htmlFor="diary-mood">Estado de ánimo</label>
              <Select
                id="diary-mood"
                value={formState.mood}
                onChange={(value) => setFormState({ ...formState, mood: value as MoodLevel })}
                options={moodOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                ariaLabel="Estado de ánimo"
              />
            </div>
            <div className="field field-full">
              <label htmlFor="diary-content">Nota</label>
              <textarea
                id="diary-content"
                value={formState.content}
                onChange={(event) => setFormState({ ...formState, content: event.target.value })}
                placeholder="¿Cómo estuvo tu día?"
                required
              />
            </div>
            <div className="field field-full">
              <label>Etiquetas</label>
              <TagInput
                values={formState.tags}
                onChange={(tags) => setFormState({ ...formState, tags })}
                suggestions={existingTags}
                placeholder="Enter para agregar etiquetas"
              />
            </div>
            <div className="form-actions field-full">
              <button className="primary-button" type="submit">
                Guardar nota
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Notas registradas</h3>
            <div className="section-actions">
              <div className="search-input-wrap">
                <Search size={15} className="search-input-icon" aria-hidden />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Búsqueda por palabra clave"
                  aria-label="Búsqueda por palabra clave"
                />
              </div>
              <Select
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={[
                  { value: '', label: 'Todos los meses' },
                  ...months.map((month) => ({
                    value: month.key,
                    label: `${month.key} (${month.count})`,
                  })),
                ]}
                ariaLabel="Filtrar notas por mes"
              />
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="empty-state">Sin notas en este período.</div>
          ) : (
            <div className="section-body">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="subpanel">
                  <div className="panel-header">
                    <div>
                      <h4 className="panel-title">{entry.title || 'Entrada sin título'}</h4>
                      <span className="panel-subtitle">
                        {formatDate(entry.date)} · {entry.mood}
                      </span>
                    </div>
                    <div className="section-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => startEdit(entry)}
                      >
                        Editar
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setDeletingEntry(entry)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <p style={{ whiteSpace: 'pre-line' }}>{entry.content}</p>
                  {entry.tags.length > 0 ? (
                    <div className="chip-list">
                      {entry.tags.map((tag) => (
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
        title="Editar nota del diario"
        subtitle="Modificá el contenido o etiquetas de tu entrada"
        maxWidth="640px"
      >
        <form className="form-grid two-columns" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-diary-date">Fecha</label>
            <DatePicker
              id="edit-diary-date"
              value={toLocalDateKey(editFormState.date)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  date: fromLocalDateOrDateTime(value, true),
                })
              }
              ariaLabel="Fecha de la nota"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-diary-title">Título</label>
            <input
              id="edit-diary-title"
              value={editFormState.title}
              onChange={(event) =>
                setEditFormState({ ...editFormState, title: event.target.value })
              }
              placeholder="Resumen corto"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="edit-diary-mood">Estado de ánimo</label>
            <Select
              id="edit-diary-mood"
              value={editFormState.mood}
              onChange={(value) =>
                setEditFormState({ ...editFormState, mood: value as MoodLevel })
              }
              options={moodOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              ariaLabel="Estado de ánimo"
            />
          </div>
          <div className="field field-full">
            <label htmlFor="edit-diary-content">Nota</label>
            <textarea
              id="edit-diary-content"
              value={editFormState.content}
              onChange={(event) =>
                setEditFormState({ ...editFormState, content: event.target.value })
              }
              placeholder="¿Cómo estuvo tu día?"
              required
              rows={5}
            />
          </div>
          <div className="field field-full">
            <label>Etiquetas</label>
            <TagInput
              values={editFormState.tags}
              onChange={(tags) => setEditFormState({ ...editFormState, tags })}
              suggestions={existingTags}
              placeholder="Enter para agregar etiquetas"
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
        open={Boolean(deletingEntry)}
        title="Eliminar nota del diario"
        message={
          deletingEntry
            ? `¿Querés eliminar la nota "${deletingEntry.title || 'Entrada sin título'}" del ${formatDate(deletingEntry.date)}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deletingEntry) {
            handleRemove(deletingEntry.id)
          }
        }}
        onClose={() => setDeletingEntry(null)}
      />
    </div>
  )
}
