import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import { searchPlaces, type PlaceSuggestion } from '../../services/api'
import type { Reminder, VaccineRecord } from '../../types'
import {
  formatDate,
  fromLocalDateOrDateTime,
  isUpcoming,
  safeParseDate,
  toLocalDateKey,
} from '../../utils/dates'

type VaccineFormState = Omit<VaccineRecord, 'id'> & { nextDoseDate?: string }

const createInitialFormState = (): VaccineFormState => ({
  vaccine: '',
  dose: '',
  date: new Date().toISOString(),
  location: '',
  lot: '',
  notes: '',
  nextDoseDate: '',
  reminderEnabled: true,
})

export const VaccinesSection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<VaccineFormState>(createInitialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<VaccineFormState>(createInitialFormState)
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([])
  const [showPlaceSuggestions, setShowPlaceSuggestions] = useState(false)

  useEffect(() => {
    const loc = formState.location.trim()
    if (loc.length < 3) {
      setPlaceSuggestions([])
      return
    }
    let isCurrent = true
    const timer = setTimeout(async () => {
      const places = await searchPlaces(loc)
      if (isCurrent) setPlaceSuggestions(places)
    }, 350)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [formState.location])
  const [pendingDelete, setPendingDelete] = useState<VaccineRecord | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyUpcoming, setShowOnlyUpcoming] = useState(false)

  const vaccines = data.health.vaccines

  const sortedVaccines = useMemo(
    () =>
      [...vaccines].sort((first, second) => {
        const firstTime = safeParseDate(first.date)?.getTime() ?? 0
        const secondTime = safeParseDate(second.date)?.getTime() ?? 0
        return secondTime - firstTime
      }),
    [vaccines],
  )

  const filteredVaccines = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return sortedVaccines.filter((record) => {
      const matchesSearch = term
        ? [record.vaccine, record.location, record.dose, record.notes ?? '', record.lot]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(term))
        : true

      const matchesUpcoming = showOnlyUpcoming
        ? Boolean(record.nextDoseDate && isUpcoming(record.nextDoseDate, 30))
        : true

      return matchesSearch && matchesUpcoming
    })
  }, [searchTerm, showOnlyUpcoming, sortedVaccines])

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.vaccine.trim() || !formState.date) {
      return
    }

    const normalizedRecord: VaccineRecord = {
      ...formState,
      id: uuid(),
      vaccine: formState.vaccine.trim(),
      date: fromLocalDateOrDateTime(formState.date, true),
      nextDoseDate: formState.nextDoseDate
        ? fromLocalDateOrDateTime(formState.nextDoseDate) || undefined
        : undefined,
    }

    updateData((previous) => {
      const updatedVaccines = [normalizedRecord, ...previous.health.vaccines]
      const existingReminders = previous.utilities.reminders
      const hasScheduled = shouldScheduleReminder(normalizedRecord)

      let updatedReminders: Reminder[]
      if (hasScheduled) {
        updatedReminders = [buildReminder(normalizedRecord), ...existingReminders]
      } else {
        updatedReminders = existingReminders
      }

      return {
        ...previous,
        health: {
          ...previous.health,
          vaccines: updatedVaccines,
        },
        utilities: {
          ...previous.utilities,
          reminders: updatedReminders,
        },
      }
    })

    setFormState(createInitialFormState())
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.vaccine.trim() || !editFormState.date) {
      return
    }

    const normalizedRecord: VaccineRecord = {
      ...editFormState,
      id: editingId,
      vaccine: editFormState.vaccine.trim(),
      date: fromLocalDateOrDateTime(editFormState.date, true),
      nextDoseDate: editFormState.nextDoseDate
        ? fromLocalDateOrDateTime(editFormState.nextDoseDate) || undefined
        : undefined,
    }

    updateData((previous) => {
      const updatedVaccines = previous.health.vaccines.map((item) =>
        item.id === editingId ? normalizedRecord : item,
      )

      const existingReminders = previous.utilities.reminders
      const hasScheduled = shouldScheduleReminder(normalizedRecord)
      const existingIndex = existingReminders.findIndex(
        (rem) => rem.sourceId === normalizedRecord.id,
      )

      let updatedReminders: Reminder[]
      if (hasScheduled) {
        if (existingIndex >= 0) {
          const existing = existingReminders[existingIndex]
          const syncedReminder = buildReminder(normalizedRecord, existing.id, existing.done)
          updatedReminders = existingReminders.map((rem, idx) =>
            idx === existingIndex ? syncedReminder : rem,
          )
        } else {
          updatedReminders = [buildReminder(normalizedRecord), ...existingReminders]
        }
      } else {
        updatedReminders = existingReminders.filter(
          (rem) => rem.sourceId !== normalizedRecord.id,
        )
      }

      return {
        ...previous,
        health: {
          ...previous.health,
          vaccines: updatedVaccines,
        },
        utilities: {
          ...previous.utilities,
          reminders: updatedReminders,
        },
      }
    })

    setEditingId(null)
  }

  const startEdit = (record: VaccineRecord) => {
    setEditingId(record.id)
    setEditFormState({
      vaccine: record.vaccine,
      dose: record.dose,
      date: record.date,
      location: record.location,
      lot: record.lot,
      notes: record.notes ?? '',
      nextDoseDate: record.nextDoseDate ?? '',
      reminderEnabled: Boolean(record.reminderEnabled),
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
        vaccines: previous.health.vaccines.filter((record) => record.id !== id),
      },
      utilities: {
        ...previous.utilities,
        reminders: previous.utilities.reminders.filter((rem) => rem.sourceId !== id),
      },
    }))
  }

  return (
    <div>
      <SectionHeader
        title="Vacunas"
        subtitle="Registrá cada aplicación, mantené las dosis futuras en agenda y organizá refuerzos"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Agregar vacuna</h3>
            <p className="panel-subtitle">Completá los datos clave de la aplicación</p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="vaccine-name">Vacuna</label>
              <input
                id="vaccine-name"
                value={formState.vaccine}
                onChange={(event) => setFormState({ ...formState, vaccine: event.target.value })}
                placeholder="Ejemplo: Hepatitis B"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="vaccine-dose">Dosis</label>
              <input
                id="vaccine-dose"
                value={formState.dose}
                onChange={(event) => setFormState({ ...formState, dose: event.target.value })}
                placeholder="1ra, 2da, refuerzo"
              />
            </div>
            <div className="field">
              <label htmlFor="vaccine-date">Fecha de aplicación</label>
              <DatePicker
                id="vaccine-date"
                value={toLocalDateKey(formState.date)}
                onChange={(value) =>
                  setFormState({
                    ...formState,
                    date: fromLocalDateOrDateTime(value, true),
                  })
                }
                ariaLabel="Fecha de la vacuna"
              />
            </div>
            <div className="field" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="vaccine-location">Ubicación / Centro de aplicación</label>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  OpenStreetMap
                </span>
              </div>
              <input
                id="vaccine-location"
                value={formState.location}
                onChange={(event) => {
                  setFormState({ ...formState, location: event.target.value })
                  setShowPlaceSuggestions(true)
                }}
                onFocus={() => setShowPlaceSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPlaceSuggestions(false), 200)}
                placeholder="Hospital, clínica, vacunatorio"
                autoComplete="off"
              />
              {showPlaceSuggestions && placeSuggestions.length > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: 'var(--color-surface)',
                    boxShadow: 'var(--shadow-card)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    marginTop: '0.25rem',
                  }}
                >
                  {placeSuggestions.map((place, idx) => (
                    <button
                      key={`${place.lat}-${place.lon}-${idx}`}
                      type="button"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem 0.75rem',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
                        color: 'var(--color-text-primary)',
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setFormState({ ...formState, location: place.shortName })
                        setShowPlaceSuggestions(false)
                      }}
                    >
                      <strong style={{ fontSize: '0.875rem' }}>📍 {place.shortName}</strong>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                        }}
                      >
                        {place.displayName}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="vaccine-lot">Lote</label>
              <input
                id="vaccine-lot"
                value={formState.lot}
                onChange={(event) => setFormState({ ...formState, lot: event.target.value })}
                placeholder="Código de lote"
              />
            </div>
            <div className="field">
              <label htmlFor="vaccine-next">Próxima dosis</label>
              <DatePicker
                id="vaccine-next"
                value={toLocalDateKey(formState.nextDoseDate)}
                onChange={(value) =>
                  setFormState({
                    ...formState,
                    nextDoseDate: fromLocalDateOrDateTime(value),
                  })
                }
                placeholder="Sin recordatorio"
                ariaLabel="Próxima dosis"
              />
            </div>
            <div className="field">
              <label htmlFor="vaccine-notes">Notas</label>
              <textarea
                id="vaccine-notes"
                value={formState.notes}
                onChange={(event) => setFormState({ ...formState, notes: event.target.value })}
                placeholder="Observaciones, reacciones, indicaciones"
              />
            </div>
            <div className="field">
              <label htmlFor="vaccine-reminder">Recordatorio de refuerzo</label>
              <Select
                id="vaccine-reminder"
                value={formState.reminderEnabled ? 'yes' : 'no'}
                onChange={(value) =>
                  setFormState({ ...formState, reminderEnabled: value === 'yes' })
                }
                options={[
                  { value: 'yes', label: 'Sí, crear recordatorio' },
                  { value: 'no', label: 'No por ahora' },
                ]}
                ariaLabel="Recordatorio de refuerzo"
              />
            </div>
            <div className="form-actions field-full">
              <button className="primary-button" type="submit">
                Guardar vacuna
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Historial de vacunas</h3>
            <div className="section-actions">
              <div className="search-input-wrap">
                <Search size={15} className="search-input-icon" aria-hidden />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por nombre, ubicación o lote"
                  aria-label="Buscar por nombre, ubicación o lote"
                />
              </div>
              <label className="badge">
                <input
                  type="checkbox"
                  checked={showOnlyUpcoming}
                  onChange={(event) => setShowOnlyUpcoming(event.target.checked)}
                />
                Refuerzos próximos
              </label>
            </div>
          </div>

          {filteredVaccines.length === 0 ? (
            <div className="empty-state">No hay vacunas registradas con esos filtros.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Vacuna</th>
                  <th>Dosis</th>
                  <th>Aplicación</th>
                  <th>Ubicación</th>
                  <th>Próxima dosis</th>
                  <th>Notas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredVaccines.map((record) => (
                  <tr key={record.id}>
                    <td>{record.vaccine}</td>
                    <td>{record.dose || '—'}</td>
                    <td>{formatDate(record.date)}</td>
                    <td>{record.location || '—'}</td>
                    <td>
                      {record.nextDoseDate ? (
                        <span className={isUpcoming(record.nextDoseDate, 30) ? 'badge' : ''}>
                          {formatDate(record.nextDoseDate)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{record.notes || '—'}</td>
                    <td>
                      <div className="section-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => startEdit(record)}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setPendingDelete(record)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Editar vacuna"
        subtitle="Actualizá los datos de la aplicación seleccionada"
        maxWidth="640px"
      >
        <form className="form-grid two-columns" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-vaccine-name">Vacuna</label>
            <input
              id="edit-vaccine-name"
              value={editFormState.vaccine}
              onChange={(event) =>
                setEditFormState({ ...editFormState, vaccine: event.target.value })
              }
              placeholder="Ejemplo: Hepatitis B"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="edit-vaccine-dose">Dosis</label>
            <input
              id="edit-vaccine-dose"
              value={editFormState.dose}
              onChange={(event) =>
                setEditFormState({ ...editFormState, dose: event.target.value })
              }
              placeholder="1ra, 2da, refuerzo"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-vaccine-date">Fecha de aplicación</label>
            <DatePicker
              id="edit-vaccine-date"
              value={toLocalDateKey(editFormState.date)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  date: fromLocalDateOrDateTime(value, true),
                })
              }
              ariaLabel="Fecha de la vacuna"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-vaccine-location">Ubicación / Centro de aplicación</label>
            <input
              id="edit-vaccine-location"
              value={editFormState.location}
              onChange={(event) =>
                setEditFormState({ ...editFormState, location: event.target.value })
              }
              placeholder="Hospital, clínica, vacunatorio"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-vaccine-lot">Lote</label>
            <input
              id="edit-vaccine-lot"
              value={editFormState.lot}
              onChange={(event) =>
                setEditFormState({ ...editFormState, lot: event.target.value })
              }
              placeholder="Código de lote"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-vaccine-next">Próxima dosis</label>
            <DatePicker
              id="edit-vaccine-next"
              value={toLocalDateKey(editFormState.nextDoseDate)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  nextDoseDate: fromLocalDateOrDateTime(value),
                })
              }
              placeholder="Sin recordatorio"
              ariaLabel="Próxima dosis"
              allowClear
            />
          </div>
          <div className="field">
            <label htmlFor="edit-vaccine-notes">Notas</label>
            <textarea
              id="edit-vaccine-notes"
              value={editFormState.notes}
              onChange={(event) =>
                setEditFormState({ ...editFormState, notes: event.target.value })
              }
              placeholder="Observaciones, reacciones, indicaciones"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-vaccine-reminder">Recordatorio de refuerzo</label>
            <Select
              id="edit-vaccine-reminder"
              value={editFormState.reminderEnabled ? 'yes' : 'no'}
              onChange={(value) =>
                setEditFormState({ ...editFormState, reminderEnabled: value === 'yes' })
              }
              options={[
                { value: 'yes', label: 'Sí, crear recordatorio' },
                { value: 'no', label: 'No por ahora' },
              ]}
              ariaLabel="Recordatorio de refuerzo"
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
        title="Eliminar vacuna"
        message={
          pendingDelete
            ? `¿Seguro que querés eliminar el registro de "${pendingDelete.vaccine}" (${formatDate(pendingDelete.date)})? Esta acción no se puede deshacer.`
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

const shouldScheduleReminder = (record: VaccineRecord) =>
  Boolean(record.reminderEnabled && record.nextDoseDate)

const buildReminder = (record: VaccineRecord, existingId?: string, done = false): Reminder => ({
  id: existingId ?? uuid(),
  title: `Refuerzo de ${record.vaccine}`,
  details: `Dosis ${record.dose || 'pendiente'} en ${record.location || 'centro habitual'}. Lote ${
    record.lot || 'sin dato'
  }`,
  dateTime: record.nextDoseDate!,
  category: 'salud',
  done,
  sourceId: record.id,
  sourceType: 'vaccine',
})
