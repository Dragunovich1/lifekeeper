import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { Medication, MedicationSchedule } from '../../types'
import { formatDate } from '../../utils/dates'

type MedicationFormState = Omit<Medication, 'id'>

const createInitialFormState = (): MedicationFormState => ({
  name: '',
  dosage: '',
  frequency: '',
  schedules: [],
  startDate: new Date().toISOString(),
  endDate: '',
  instructions: '',
  active: true,
})

export const MedicationsSection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<MedicationFormState>(createInitialFormState)
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleNote, setScheduleNote] = useState('')
  const [dueMedications, setDueMedications] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const medications = data.health.medications

  useEffect(() => {
    const evaluateDueMedications = () => {
      const now = new Date()
      const currentTime = now.toTimeString().slice(0, 5)
      const due = medications
        .filter((med) => med.active)
        .filter((med) => med.schedules.some((schedule) => schedule.time === currentTime))
        .map((med) => med.id)
      setDueMedications(due)
    }

    evaluateDueMedications()
    const intervalId = window.setInterval(evaluateDueMedications, 60000)
    return () => window.clearInterval(intervalId)
  }, [medications])

  const filteredMedications = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      return medications
    }

    return medications.filter((med) =>
      [med.name, med.dosage, med.frequency, med.instructions ?? '']
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    )
  }, [medications, searchTerm])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.name) {
      return
    }

    const record: Medication = {
      ...formState,
      id: uuid(),
      startDate: new Date(formState.startDate).toISOString(),
      endDate: formState.endDate ? new Date(formState.endDate).toISOString() : undefined,
    }

    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        medications: [record, ...previous.health.medications],
      },
    }))

    setFormState(createInitialFormState())
    setScheduleTime('')
    setScheduleNote('')
  }

  const handleAddSchedule = () => {
    if (!scheduleTime) {
      return
    }

    const newSchedule: MedicationSchedule = {
      time: scheduleTime,
      note: scheduleNote || undefined,
    }

    setFormState((prev) => ({
      ...prev,
      schedules: [...prev.schedules, newSchedule],
    }))

    setScheduleTime('')
    setScheduleNote('')
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        medications: previous.health.medications.filter((item) => item.id !== id),
      },
    }))
  }

  const toggleMedicationActive = (id: string) => {
    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        medications: previous.health.medications.map((item) =>
          item.id === id ? { ...item, active: !item.active } : item,
        ),
      },
    }))
  }

  return (
    <div>
      <SectionHeader
        title="Medicaciones"
        subtitle="Gestiona las tomas vigentes, dosis y horarios con alertas integradas"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Agregar tratamiento</h3>
            <p className="panel-subtitle">Define la posologia y los horarios diarios</p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="med-name">Medicacion</label>
              <input
                id="med-name"
                value={formState.name}
                onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                placeholder="Nombre comercial o droga"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="med-dosage">Dosis</label>
              <input
                id="med-dosage"
                value={formState.dosage}
                onChange={(event) => setFormState({ ...formState, dosage: event.target.value })}
                placeholder="Ej. 500 mg"
              />
            </div>
            <div className="field">
              <label htmlFor="med-frequency">Frecuencia</label>
              <input
                id="med-frequency"
                value={formState.frequency}
                onChange={(event) => setFormState({ ...formState, frequency: event.target.value })}
                placeholder="Cada 8 hs, diaria, semanal"
              />
            </div>
            <div className="field">
              <label htmlFor="med-start">Inicio</label>
              <input
                id="med-start"
                type="date"
                value={formState.startDate.slice(0, 10)}
                onChange={(event) =>
                  setFormState({ ...formState, startDate: new Date(event.target.value).toISOString() })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="med-end">Fin</label>
              <input
                id="med-end"
                type="date"
                value={formState.endDate ? formState.endDate.slice(0, 10) : ''}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    endDate: event.target.value ? new Date(event.target.value).toISOString() : '',
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="med-notes">Indicaciones</label>
              <textarea
                id="med-notes"
                value={formState.instructions ?? ''}
                onChange={(event) => setFormState({ ...formState, instructions: event.target.value })}
                placeholder="Tomar con comida, reposo, observaciones"
              />
            </div>
            <div className="field">
              <label htmlFor="med-active">Estado</label>
              <select
                id="med-active"
                value={formState.active ? 'active' : 'paused'}
                onChange={(event) => setFormState({ ...formState, active: event.target.value === 'active' })}
              >
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
            <div className="panel">
              <div className="panel-header">
                <h4 className="panel-title">Horarios</h4>
              </div>
              <div className="form-grid two-columns">
                <div className="field">
                  <label htmlFor="schedule-time">Hora</label>
                  <input
                    id="schedule-time"
                    type="time"
                    value={scheduleTime}
                    onChange={(event) => setScheduleTime(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="schedule-note">Nota</label>
                  <input
                    id="schedule-note"
                    value={scheduleNote}
                    onChange={(event) => setScheduleNote(event.target.value)}
                    placeholder="Antes de dormir, en ayunas"
                  />
                </div>
                <button className="secondary-button" type="button" onClick={handleAddSchedule}>
                  Agregar horario
                </button>
              </div>
              {formState.schedules.length > 0 ? (
                <div className="chip-list">
                  {formState.schedules.map((schedule, index) => (
                    <span key={`${schedule.time}-${index}`} className="chip">
                      {schedule.time}
                      {schedule.note ? ` · ${schedule.note}` : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="panel-subtitle">Todavia no agregaste horarios.</p>
              )}
            </div>
            <button className="primary-button" type="submit">
              Guardar tratamiento
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Medicaciones activas</h3>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre o indicacion"
            />
          </div>

          {filteredMedications.length === 0 ? (
            <div className="empty-state">No hay tratamientos cargados o coincidentes.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Medicacion</th>
                  <th>Dosis</th>
                  <th>Frecuencia</th>
                  <th>Horarios</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredMedications.map((med) => {
                  const isDue = dueMedications.includes(med.id)
                  return (
                    <tr key={med.id} className={isDue ? 'due-medication' : ''}>
                      <td>{med.name}</td>
                      <td>{med.dosage || '—'}</td>
                      <td>{med.frequency || '—'}</td>
                      <td>
                        <div className="chip-list">
                          {med.schedules.map((schedule, index) => (
                            <span key={`${med.id}-${index}`} className="chip">
                              {schedule.time}
                              {schedule.note ? ` · ${schedule.note}` : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{formatDate(med.startDate)}</td>
                      <td>{med.endDate ? formatDate(med.endDate) : 'Continuo'}</td>
                      <td>{med.active ? 'Activo' : 'Pausado'}</td>
                      <td>
                        <div className="section-actions">
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => toggleMedicationActive(med.id)}
                          >
                            {med.active ? 'Pausar' : 'Activar'}
                          </button>
                          <button className="secondary-button" type="button" onClick={() => handleRemove(med.id)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
