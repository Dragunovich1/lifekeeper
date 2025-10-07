import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { TagInput } from '../../components/TagInput'
import { useAppData } from '../../hooks/useAppData'
import type { DiaryEntry, MoodLevel } from '../../types'
import { formatDate, monthKey } from '../../utils/dates'

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
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')

  const entries = data.diary.entries

  const months = useMemo(() => {
    const grouped = new Map<string, number>()
    entries.forEach((entry) => {
      const key = monthKey(entry.date)
      grouped.set(key, (grouped.get(key) ?? 0) + 1)
    })
    return Array.from(grouped.entries())
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([key, count]) => ({ key, count }))
  }, [entries])

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return entries.filter((entry) => {
      const matchesSearch = term
        ? [entry.title, entry.content, entry.tags.join(' ')]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(term))
        : true

      const matchesMonth = selectedMonth ? monthKey(entry.date) === selectedMonth : true

      return matchesSearch && matchesMonth
    })
  }, [entries, searchTerm, selectedMonth])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.content) {
      return
    }

    const entry: DiaryEntry = {
      ...formState,
      id: uuid(),
      date: new Date(formState.date).toISOString(),
      tags: formState.tags.map((tag) => tag.trim()),
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

  return (
    <div>
      <SectionHeader
        title="Notas diarias"
        subtitle="Deja registro sencillo de tu dia con estado de animo y etiquetas accesibles"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Nueva nota</h3>
            <p className="panel-subtitle">La fecha se completa automaticamente, podes modificarla</p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="diary-date">Fecha</label>
              <input
                id="diary-date"
                type="date"
                value={formState.date.slice(0, 10)}
                onChange={(event) =>
                  setFormState({ ...formState, date: new Date(event.target.value).toISOString() })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="diary-title">Titulo</label>
              <input
                id="diary-title"
                value={formState.title}
                onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                placeholder="Resumen corto"
              />
            </div>
            <div className="field">
              <label htmlFor="diary-mood">Estado de animo</label>
              <select
                id="diary-mood"
                value={formState.mood}
                onChange={(event) => setFormState({ ...formState, mood: event.target.value as MoodLevel })}
              >
                {moodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="diary-content">Nota</label>
              <textarea
                id="diary-content"
                value={formState.content}
                onChange={(event) => setFormState({ ...formState, content: event.target.value })}
                placeholder="Como estuvo tu dia?"
                required
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Etiquetas</label>
              <TagInput
                values={formState.tags}
                onChange={(tags) => setFormState({ ...formState, tags })}
                placeholder="Enter para agregar tags"
              />
            </div>
            <button className="primary-button" type="submit">
              Guardar nota
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Notas recientes</h3>
            <div className="section-actions">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por palabra clave"
              />
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                <option value="">Todos los meses</option>
                {months.map((month) => (
                  <option key={month.key} value={month.key}>
                    {month.key} ({month.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="empty-state">Sin notas en este periodo.</div>
          ) : (
            <div className="section-body">
              {filteredEntries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="panel">
                  <div className="panel-header">
                    <div>
                      <h4 className="panel-title">{entry.title || 'Entrada sin titulo'}</h4>
                      <span className="panel-subtitle">
                        {formatDate(entry.date)} · {entry.mood}
                      </span>
                    </div>
                  </div>
                  <p>{entry.content}</p>
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
    </div>
  )
}
