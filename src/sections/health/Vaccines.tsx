import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { Reminder, VaccineRecord } from '../../types'
import { formatDate, isUpcoming } from '../../utils/dates'

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
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyUpcoming, setShowOnlyUpcoming] = useState(false)

  const vaccines = data.health.vaccines

  const filteredVaccines = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return vaccines.filter((record) => {
      const matchesSearch = term
        ? [record.vaccine, record.location, record.dose, record.notes ?? '', record.lot]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(term))
        : true

      const matchesUpcoming = showOnlyUpcoming && record.nextDoseDate
        ? isUpcoming(record.nextDoseDate)
        : true

      return matchesSearch && matchesUpcoming
    })
  }, [searchTerm, showOnlyUpcoming, vaccines])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.vaccine || !formState.date) {
      return
    }

    const normalizedRecord: VaccineRecord = {
      ...formState,
      id: uuid(),
      date: new Date(formState.date).toISOString(),
      nextDoseDate: formState.nextDoseDate ? new Date(formState.nextDoseDate).toISOString() : undefined,
    }

    updateData((previous) => {
      const updatedVaccines = [normalizedRecord, ...previous.health.vaccines]
      const pendingReminder = shouldScheduleReminder(normalizedRecord)
        ? buildReminder(normalizedRecord)
        : null

      return {
        ...previous,
        health: {
          ...previous.health,
          vaccines: updatedVaccines,
        },
        utilities: pendingReminder
          ? {
              ...previous.utilities,
              reminders: [pendingReminder, ...previous.utilities.reminders],
            }
          : previous.utilities,
      }
    })

    setFormState(createInitialFormState())
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        vaccines: previous.health.vaccines.filter((record) => record.id !== id),
      },
    }))
  }

  return (
    <div>
      <SectionHeader
        title="Vacunas"
        subtitle="Registra cada aplicacion, mantiene las dosis futuras en agenda y organiza refuerzos"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Agregar vacuna</h3>
            <p className="panel-subtitle">Completa los datos clave de la aplicacion</p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleSubmit}>
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
              <label htmlFor="vaccine-date">Fecha</label>
              <input
                id="vaccine-date"
                type="date"
                value={formState.date.slice(0, 10)}
                onChange={(event) =>
                  setFormState({ ...formState, date: new Date(event.target.value).toISOString() })
                }
                required
              />
            </div>
            <div className="field">
              <label htmlFor="vaccine-location">Centro de aplicacion</label>
              <input
                id="vaccine-location"
                value={formState.location}
                onChange={(event) => setFormState({ ...formState, location: event.target.value })}
                placeholder="Hospital, clinica, barrio"
              />
            </div>
            <div className="field">
              <label htmlFor="vaccine-lot">Lote</label>
              <input
                id="vaccine-lot"
                value={formState.lot}
                onChange={(event) => setFormState({ ...formState, lot: event.target.value })}
                placeholder="Codigo de lote"
              />
            </div>
            <div className="field">
              <label htmlFor="vaccine-next">Proxima dosis</label>
              <input
                id="vaccine-next"
                type="date"
                value={formState.nextDoseDate ? formState.nextDoseDate.slice(0, 10) : ''}
                onChange={(event) => {
                  const value = event.target.value
                  setFormState({
                    ...formState,
                    nextDoseDate: value ? new Date(value).toISOString() : '',
                  })
                }}
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
              <select
                id="vaccine-reminder"
                value={formState.reminderEnabled ? 'yes' : 'no'}
                onChange={(event) =>
                  setFormState({ ...formState, reminderEnabled: event.target.value === 'yes' })
                }
              >
                <option value="yes">Si, crear recordatorio</option>
                <option value="no">No por ahora</option>
              </select>
            </div>
            <button className="primary-button" type="submit">
              Guardar vacuna
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Historial de vacunas</h3>
            <div className="section-actions">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nombre, lugar, lote"
              />
              <label className="badge">
                <input
                  type="checkbox"
                  checked={showOnlyUpcoming}
                  onChange={(event) => setShowOnlyUpcoming(event.target.checked)}
                />
                Refuerzos proximos
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
                  <th>Fecha</th>
                  <th>Lugar</th>
                  <th>Proxima</th>
                  <th>Notas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredVaccines.map((record) => (
                  <tr key={record.id}>
                    <td>{record.vaccine}</td>
                    <td>{record.dose}</td>
                    <td>{formatDate(record.date)}</td>
                    <td>{record.location}</td>
                    <td>
                      {record.nextDoseDate ? (
                        <span className={isUpcoming(record.nextDoseDate) ? 'badge' : ''}>
                          {formatDate(record.nextDoseDate)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{record.notes}</td>
                    <td>
                      <button className="secondary-button" type="button" onClick={() => handleRemove(record.id)}>
                        Eliminar
                      </button>
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

const shouldScheduleReminder = (record: VaccineRecord) => Boolean(record.reminderEnabled && record.nextDoseDate)

const buildReminder = (record: VaccineRecord): Reminder => ({
  id: uuid(),
  title: `Refuerzo de ${record.vaccine}`,
  details: `Dosis ${record.dose || 'pendiente'} en ${record.location || 'centro habitual'}. Lote ${
    record.lot || 'sin dato'
  }`,
  dateTime: record.nextDoseDate!,
  category: 'salud',
  done: false,
})
