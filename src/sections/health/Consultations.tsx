import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { MedicalConsultation } from '../../types'
import { formatDate } from '../../utils/dates'

type ConsultationFormState = Omit<MedicalConsultation, 'id'>

const createInitialFormState = (): ConsultationFormState => ({
  date: new Date().toISOString(),
  doctor: '',
  reason: '',
  diagnosis: '',
  treatment: '',
  notes: '',
  attachments: [],
})

export const ConsultationsSection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<ConsultationFormState>(createInitialFormState)
  const [searchTerm, setSearchTerm] = useState('')

  const consultations = data.health.consultations

  const filteredConsultations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      return consultations
    }

    return consultations.filter((item) =>
      [item.doctor, item.reason, item.diagnosis ?? '', item.treatment ?? '', item.notes ?? '']
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    )
  }, [consultations, searchTerm])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.doctor || !formState.reason) {
      return
    }

    const record: MedicalConsultation = {
      ...formState,
      id: uuid(),
      date: new Date(formState.date).toISOString(),
    }

    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        consultations: [record, ...previous.health.consultations],
      },
    }))

    setFormState(createInitialFormState())
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        consultations: previous.health.consultations.filter((item) => item.id !== id),
      },
    }))
  }

  return (
    <div>
      <SectionHeader
        title="Consultas medicas"
        subtitle="Seguimiento completo de visitas, diagnosticos y tratamientos"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Registrar consulta</h3>
            <p className="panel-subtitle">Anota cada visita para tener una linea de tiempo clara</p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="consult-date">Fecha</label>
              <input
                id="consult-date"
                type="date"
                value={formState.date.slice(0, 10)}
                onChange={(event) =>
                  setFormState({ ...formState, date: new Date(event.target.value).toISOString() })
                }
                required
              />
            </div>
            <div className="field">
              <label htmlFor="consult-doctor">Profesional</label>
              <input
                id="consult-doctor"
                value={formState.doctor}
                onChange={(event) => setFormState({ ...formState, doctor: event.target.value })}
                placeholder="Nombre del profesional"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="consult-reason">Motivo</label>
              <input
                id="consult-reason"
                value={formState.reason}
                onChange={(event) => setFormState({ ...formState, reason: event.target.value })}
                placeholder="Chequeo, seguimiento, urgencia"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="consult-diagnosis">Diagnostico</label>
              <textarea
                id="consult-diagnosis"
                value={formState.diagnosis ?? ''}
                onChange={(event) => setFormState({ ...formState, diagnosis: event.target.value })}
                placeholder="Resultados, observaciones"
              />
            </div>
            <div className="field">
              <label htmlFor="consult-treatment">Tratamiento</label>
              <textarea
                id="consult-treatment"
                value={formState.treatment ?? ''}
                onChange={(event) => setFormState({ ...formState, treatment: event.target.value })}
                placeholder="Medicacion indicada, controles"
              />
            </div>
            <div className="field">
              <label htmlFor="consult-notes">Notas</label>
              <textarea
                id="consult-notes"
                value={formState.notes ?? ''}
                onChange={(event) => setFormState({ ...formState, notes: event.target.value })}
                placeholder="Complementos, estudios pendientes"
              />
            </div>
            <button className="primary-button" type="submit">
              Guardar consulta
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Historial de consultas</h3>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por profesional, motivo o diagnostico"
            />
          </div>

          {filteredConsultations.length === 0 ? (
            <div className="empty-state">Todavia no cargaste consultas o no coinciden con la busqueda.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Profesional</th>
                  <th>Motivo</th>
                  <th>Diagnostico</th>
                  <th>Tratamiento</th>
                  <th>Notas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredConsultations.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.doctor}</td>
                    <td>{item.reason}</td>
                    <td>{item.diagnosis || '—'}</td>
                    <td>{item.treatment || '—'}</td>
                    <td>{item.notes || '—'}</td>
                    <td>
                      <button className="secondary-button" type="button" onClick={() => handleRemove(item.id)}>
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
