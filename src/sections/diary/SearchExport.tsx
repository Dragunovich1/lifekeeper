import { jsPDF } from 'jspdf'
import { saveAs } from 'file-saver'
import {
  CheckSquare,
  FileDown,
  FileText,
  RotateCcw,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { DatePicker } from '../../components/DatePicker'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import type { DiaryEntry } from '../../types'
import { formatDate, toLocalDateKey } from '../../utils/dates'

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
    setSelectedEntries((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )
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
          doc.text(`Etiquetas: ${entry.tags.join(', ')}`, margin, cursorY)
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
        const tagsLine = entry.tags.length > 0 ? `\nEtiquetas: ${entry.tags.join(', ')}` : ''
        return `${header}\n${title}${body}${tagsLine}`
      })
      .join('\n\n-----\n\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `diario-${Date.now()}.txt`)
  }

  return (
    <div>
      <SectionHeader
        title="Búsqueda y exportación"
        subtitle="Filtrá por fecha o palabra clave y prepará tus notas para exportar en PDF o texto"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Filtros de búsqueda</h3>
              <p className="panel-subtitle">
                Combiná palabras clave, rango de fechas y etiquetas para aislar las notas deseadas
              </p>
            </div>
            {(filters.keyword || filters.startDate || filters.endDate || filters.tag) ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setFilters(initialFilters)}
              >
                <RotateCcw size={14} aria-hidden />
                Restablecer filtros
              </button>
            ) : null}
          </div>

          <div className="search-export-filters-grid">
            <div className="field">
              <label htmlFor="filter-keyword">Palabra clave</label>
              <div className="search-input-wrap">
                <Search size={15} className="search-input-icon" aria-hidden />
                <input
                  id="filter-keyword"
                  value={filters.keyword}
                  onChange={(event) => setFilters({ ...filters, keyword: event.target.value })}
                  placeholder="Buscar en título, contenido o etiquetas..."
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="filter-start">Desde</label>
              <DatePicker
                id="filter-start"
                value={filters.startDate}
                onChange={(value) => setFilters({ ...filters, startDate: value })}
                placeholder="Fecha inicial"
                allowClear
                ariaLabel="Fecha desde"
              />
            </div>
            <div className="field">
              <label htmlFor="filter-end">Hasta</label>
              <DatePicker
                id="filter-end"
                value={filters.endDate}
                onChange={(value) => setFilters({ ...filters, endDate: value })}
                placeholder="Fecha final"
                allowClear
                ariaLabel="Fecha hasta"
              />
            </div>
            <div className="field">
              <label htmlFor="filter-tag">Etiqueta</label>
              <Select
                id="filter-tag"
                value={filters.tag}
                onChange={(value) => setFilters({ ...filters, tag: value })}
                options={[
                  { value: '', label: 'Todas las etiquetas' },
                  ...tags.map((tag) => ({ value: tag, label: tag })),
                ]}
                ariaLabel="Filtrar por etiqueta"
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header" style={{ alignItems: 'center' }}>
            <div>
              <h3 className="panel-title">
                Resultados ({filteredEntries.length})
                {selectedEntries.length > 0 ? (
                  <span className="panel-subtitle" style={{ marginLeft: '0.625rem' }}>
                    · {selectedEntries.length} {selectedEntries.length === 1 ? 'seleccionada' : 'seleccionadas'}
                  </span>
                ) : null}
              </h3>
            </div>
            <div className="section-actions">
              <button className="secondary-button" type="button" onClick={selectAll}>
                <CheckSquare size={14} aria-hidden />
                Seleccionar todo
              </button>
              {selectedEntries.length > 0 ? (
                <button className="secondary-button" type="button" onClick={clearSelection}>
                  Limpiar selección
                </button>
              ) : null}
              <button
                className="secondary-button"
                type="button"
                disabled={selectedEntries.length === 0}
                onClick={() => exportSelection('pdf')}
                title={selectedEntries.length === 0 ? 'Seleccioná al menos una nota' : 'Descargar PDF'}
              >
                <FileDown size={14} aria-hidden />
                Exportar PDF
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={selectedEntries.length === 0}
                onClick={() => exportSelection('txt')}
                title={selectedEntries.length === 0 ? 'Seleccioná al menos una nota' : 'Descargar TXT'}
              >
                <FileText size={14} aria-hidden />
                Exportar TXT
              </button>
            </div>
          </div>
          {filteredEntries.length === 0 ? (
            <div className="empty-state">
              Sin entradas que coincidan con los filtros seleccionados.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Fecha</th>
                  <th>Título</th>
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
                        aria-label={`Seleccionar "${entry.title || 'Sin título'}"`}
                      />
                    </td>
                    <td>{formatDate(entry.date)}</td>
                    <td>{entry.title || 'Sin título'}</td>
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
  const term = filters.keyword.trim().toLowerCase()
  const startKey = filters.startDate ? toLocalDateKey(filters.startDate) : ''
  const endKey = filters.endDate ? toLocalDateKey(filters.endDate) : ''

  return [...entries]
    .filter((entry) => {
      const keywordMatch = term
        ? [entry.title, entry.content, entry.tags.join(' ')]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(term))
        : true

      const entryDateKey = toLocalDateKey(entry.date)
      const startMatch = startKey ? entryDateKey >= startKey : true
      const endMatch = endKey ? entryDateKey <= endKey : true
      const tagMatch = filters.tag ? entry.tags.includes(filters.tag) : true

      return keywordMatch && startMatch && endMatch && tagMatch
    })
    .sort((a, b) => (a.date > b.date ? -1 : 1))
}
