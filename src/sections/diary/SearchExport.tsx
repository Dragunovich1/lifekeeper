import { jsPDF } from 'jspdf'
import { saveAs } from 'file-saver'
import { useMemo, useState } from 'react'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { DiaryEntry } from '../../types'
import { formatDate } from '../../utils/dates'

interface Filters {
  keyword: string
  startDate: string
  endDate: string
  tag: string
}

const initialFilters: Filters = {
  keyword: '',
  startDate: '',
  endDate: '',
  tag: '',
}

export const DiarySearchExportSection = () => {
  const { data } = useAppData()
  const entries = data.diary.entries
  const [filters, setFilters] = useState(initialFilters)
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])

  const tags = useMemo(() => {
    const values = new Set<string>()
    entries.forEach((entry) => entry.tags.forEach((tag) => values.add(tag)))
    return Array.from(values)
  }, [entries])

  const filteredEntries = useMemo(() => applyFilters(entries, filters), [entries, filters])

  const toggleSelection = (id: string) => {
    setSelectedEntries((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]))
  }

  const selectAll = () => setSelectedEntries(filteredEntries.map((entry) => entry.id))
  const clearSelection = () => setSelectedEntries([])

  const exportSelection = (format: 'pdf' | 'txt') => {
    const selected = filteredEntries.filter((entry) => selectedEntries.includes(entry.id))
    if (selected.length === 0) {
      return
    }

    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const margin = 40
      let cursorY = margin
      selected.forEach((entry, index) => {
        doc.setFontSize(14)
        doc.text(`Fecha: ${formatDate(entry.date)} - ${entry.mood}`, margin, cursorY)
        cursorY += 18
        if (entry.title) {
          doc.setFontSize(16)
          doc.text(entry.title, margin, cursorY)
          cursorY += 18
        }
        doc.setFontSize(12)
        const text = doc.splitTextToSize(entry.content || '-', 520)
        doc.text(text, margin, cursorY)
        cursorY += text.length * 14
        if (entry.tags.length > 0) {
          doc.setFontSize(10)
          doc.text(`Tags: ${entry.tags.join(', ')}`, margin, cursorY)
          cursorY += 12
        }
        if (index < selected.length - 1) {
          cursorY += 20
          if (cursorY > 760) {
            doc.addPage()
            cursorY = margin
          }
        }
      })
      doc.save(`diario-${Date.now()}.pdf`)
      return
    }

    const content = selected
      .map((entry) => {
        const header = `Fecha: ${formatDate(entry.date)} - ${entry.mood}`
        const title = entry.title ? `${entry.title}\n` : ''
        const body = entry.content || '-'
        const tagsLine = entry.tags.length > 0 ? `\nTags: ${entry.tags.join(', ')}` : ''
        return `${header}\n${title}${body}${tagsLine}`
      })
      .join('\n\n-----\n\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `diario-${Date.now()}.txt`)
  }

  return (
    <div>
      <SectionHeader
        title="Busqueda y exportacion"
        subtitle="Filtra por fecha o palabra clave y prepara tus notas para exportar en PDF o texto"
      />

      <div className="section-body">
        <div className="panel">
          <h3 className="panel-title">Filtros rapidos</h3>
          <div className="form-grid three-columns">
            <div className="field">
              <label htmlFor="filter-keyword">Palabra clave</label>
              <input
                id="filter-keyword"
                value={filters.keyword}
                onChange={(event) => setFilters({ ...filters, keyword: event.target.value })}
                placeholder="Busqueda libre"
              />
            </div>
            <div className="field">
              <label htmlFor="filter-start">Desde</label>
              <input
                id="filter-start"
                type="date"
                value={filters.startDate}
                onChange={(event) => setFilters({ ...filters, startDate: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="filter-end">Hasta</label>
              <input
                id="filter-end"
                type="date"
                value={filters.endDate}
                onChange={(event) => setFilters({ ...filters, endDate: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="filter-tag">Etiqueta</label>
              <select
                id="filter-tag"
                value={filters.tag}
                onChange={(event) => setFilters({ ...filters, tag: event.target.value })}
              >
                <option value="">Todas</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
            <div className="section-actions">
              <button className="secondary-button" type="button" onClick={selectAll}>
                Seleccionar todo
              </button>
              <button className="secondary-button" type="button" onClick={clearSelection}>
                Limpiar seleccion
              </button>
              <button className="secondary-button" type="button" onClick={() => exportSelection('pdf')}>
                Exportar PDF
              </button>
              <button className="secondary-button" type="button" onClick={() => exportSelection('txt')}>
                Exportar TXT
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Resultados ({filteredEntries.length})</h3>
          </div>
          {filteredEntries.length === 0 ? (
            <div className="empty-state">Sin entradas que coincidan con los filtros seleccionados.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Fecha</th>
                  <th>Titulo</th>
                  <th>Estado</th>
                  <th>Etiquetas</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedEntries.includes(entry.id)}
                        onChange={() => toggleSelection(entry.id)}
                      />
                    </td>
                    <td>{formatDate(entry.date)}</td>
                    <td>{entry.title || 'Sin titulo'}</td>
                    <td>{entry.mood}</td>
                    <td>
                      <div className="chip-list">
                        {entry.tags.map((tag) => (
                          <span key={tag} className="chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const applyFilters = (entries: DiaryEntry[], filters: Filters) => {
  return entries.filter((entry) => {
    const keywordMatch = filters.keyword
      ? [entry.title, entry.content]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(filters.keyword.toLowerCase()))
      : true

    const startMatch = filters.startDate
      ? new Date(entry.date) >= new Date(filters.startDate)
      : true
    const endMatch = filters.endDate ? new Date(entry.date) <= new Date(filters.endDate) : true
    const tagMatch = filters.tag ? entry.tags.includes(filters.tag) : true

    return keywordMatch && startMatch && endMatch && tagMatch
  })
}
