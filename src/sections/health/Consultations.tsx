import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { ClinicalNote, MedicalConsultation, Reminder } from '../../types'
import {
  formatDate,
  fromLocalDateOrDateTime,
  safeParseDate,
  toLocalDateKey,
} from '../../utils/dates'

type ConsultationFormState = Omit<MedicalConsultation, 'id'>

const createInitialFormState = (): ConsultationFormState => ({
  date: new Date().toISOString(),
  doctor: '',
  reason: '',
  diagnosis: '',
  treatment: '',
  notes: '',
  nextVisitDate: '',
  attachments: [],
})

export const ConsultationsSection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<ConsultationFormState>(createInitialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<ConsultationFormState>(createInitialFormState)
  const [pendingDelete, setPendingDelete] = useState<MedicalConsultation | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const consultations = data.health.consultations

  const sortedConsultations = useMemo(
    () =>
      [...consultations].sort((first, second) => {
        const firstTime = safeParseDate(first.date)?.getTime() ?? 0
        const secondTime = safeParseDate(second.date)?.getTime() ?? 0
        return secondTime - firstTime
      }),
    [consultations],
  )

  const filteredConsultations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      return sortedConsultations
    }

    return sortedConsultations.filter((item) =>
      [item.doctor, item.reason, item.diagnosis ?? '', item.treatment ?? '', item.notes ?? '']
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    )
  }, [sortedConsultations, searchTerm])

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.doctor.trim() || !formState.reason.trim()) {
      return
    }

    const entryId = uuid()
    const nextVisitIso = formState.nextVisitDate
      ? fromLocalDateOrDateTime(formState.nextVisitDate) || undefined
      : undefined

    const entry: MedicalConsultation = {
      ...formState,
      id: entryId,
      doctor: formState.doctor.trim(),
      reason: formState.reason.trim(),
      date: fromLocalDateOrDateTime(formState.date, true),
      nextVisitDate: nextVisitIso,
    }

    updateData((previous) => {
      const updatedConsultations = [entry, ...previous.health.consultations]
      let updatedReminders = previous.utilities.reminders

      if (entry.nextVisitDate) {
        const reminderPayload: Reminder = {
          id: uuid(),
          title: `Control médico: ${entry.doctor}`,
          details: `Seguimiento por ${entry.reason}${entry.diagnosis ? ` · ${entry.diagnosis}` : ''}`,
          dateTime: entry.nextVisitDate,
          category: 'salud',
          done: false,
          sourceId: entry.id,
          sourceType: 'consultation',
        }
        updatedReminders = [reminderPayload, ...previous.utilities.reminders]
      }

      return {
        ...previous,
        health: {
          ...previous.health,
          consultations: updatedConsultations,
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
    if (!editingId || !editFormState.doctor.trim() || !editFormState.reason.trim()) {
      return
    }

    const nextVisitIso = editFormState.nextVisitDate
      ? fromLocalDateOrDateTime(editFormState.nextVisitDate) || undefined
      : undefined

    const entry: MedicalConsultation = {
      ...editFormState,
      id: editingId,
      doctor: editFormState.doctor.trim(),
      reason: editFormState.reason.trim(),
      date: fromLocalDateOrDateTime(editFormState.date, true),
      nextVisitDate: nextVisitIso,
    }

    updateData((previous) => {
      const updatedConsultations = previous.health.consultations.map((item) =>
        item.id === editingId ? entry : item,
      )

      const existingReminders = previous.utilities.reminders
      const existingIndex = existingReminders.findIndex((rem) => rem.sourceId === entry.id)

      let updatedReminders: Reminder[]
      if (entry.nextVisitDate) {
        const reminderPayload: Reminder = {
          id: existingIndex >= 0 ? existingReminders[existingIndex].id : uuid(),
          title: `Control médico: ${entry.doctor}`,
          details: `Seguimiento por ${entry.reason}${entry.diagnosis ? ` · ${entry.diagnosis}` : ''}`,
          dateTime: entry.nextVisitDate,
          category: 'salud',
          done: existingIndex >= 0 ? existingReminders[existingIndex].done : false,
          sourceId: entry.id,
          sourceType: 'consultation',
        }
        updatedReminders =
          existingIndex >= 0
            ? existingReminders.map((rem, idx) => (idx === existingIndex ? reminderPayload : rem))
            : [reminderPayload, ...existingReminders]
      } else {
        updatedReminders = existingReminders.filter((rem) => rem.sourceId !== entry.id)
      }

      return {
        ...previous,
        health: {
          ...previous.health,
          consultations: updatedConsultations,
        },
        utilities: {
          ...previous.utilities,
          reminders: updatedReminders,
        },
      }
    })

    setEditingId(null)
  }

  const startEdit = (item: MedicalConsultation) => {
    setEditingId(item.id)
    setEditFormState({
      date: item.date,
      doctor: item.doctor,
      reason: item.reason,
      diagnosis: item.diagnosis ?? '',
      treatment: item.treatment ?? '',
      notes: item.notes ?? '',
      nextVisitDate: item.nextVisitDate ?? '',
      attachments: item.attachments ?? [],
    })
  }

  const handleAddToClinicalHistory = (item: MedicalConsultation) => {
    const descriptionParts = [
      `Profesional: ${item.doctor}`,
      item.diagnosis ? `Diagnóstico: ${item.diagnosis}` : '',
      item.treatment ? `Tratamiento: ${item.treatment}` : '',
      item.notes ? `Notas: ${item.notes}` : '',
    ].filter(Boolean)

    const newNote: ClinicalNote = {
      id: uuid(),
      title: `Consulta: ${item.reason} (${item.doctor})`,
      description: descriptionParts.join(' · '),
      date: toLocalDateKey(item.date) || toLocalDateKey(new Date()),
      tags: ['Consulta', item.doctor].filter(Boolean),
    }

    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        clinicalNotes: [newNote, ...previous.health.clinicalNotes],
      },
    }))

    setStatusMessage('Consulta agregada al historial clínico')
  }

  const handleRemove = (id: string) => {
    if (editingId === id) {
      setEditingId(null)
    }
    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        consultations: previous.health.consultations.filter((item) => item.id !== id),
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
        title="Consultas médicas"
        subtitle="Seguimiento completo de visitas, diagnósticos, tratamientos y próximos controles"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Registrar consulta</h3>
            <p className="panel-subtitle">
              Anotá cada visita para tener una línea de tiempo clara
            </p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="consult-date">Fecha</label>
              <DatePicker
                id="consult-date"
                value={toLocalDateKey(formState.date)}
                onChange={(value) =>
                  setFormState({
                    ...formState,
                    date: fromLocalDateOrDateTime(value, true),
                  })
                }
                ariaLabel="Fecha de la consulta"
              />
            </div>
            <div className="field">
              <label htmlFor="consult-doctor">Médico / Profesional</label>
              <input
                id="consult-doctor"
                value={formState.doctor}
                onChange={(event) => setFormState({ ...formState, doctor: event.target.value })}
                placeholder="Nombre del médico o especialista"
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
              <label htmlFor="consult-next-visit">Próximo control / seguimiento</label>
              <DatePicker
                id="consult-next-visit"
                value={toLocalDateKey(formState.nextVisitDate)}
                onChange={(value) =>
                  setFormState({
                    ...formState,
                    nextVisitDate: fromLocalDateOrDateTime(value),
                  })
                }
                placeholder="Sin próximo control"
                ariaLabel="Próximo control médico"
                allowClear
              />
            </div>
            <div className="field">
              <label htmlFor="consult-diagnosis">Diagnóstico</label>
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
                placeholder="Medicación indicada, controles"
              />
            </div>
            <div className="field field-full">
              <label htmlFor="consult-notes">Notas</label>
              <textarea
                id="consult-notes"
                value={formState.notes ?? ''}
                onChange={(event) => setFormState({ ...formState, notes: event.target.value })}
                placeholder="Complementos, estudios pendientes"
              />
            </div>
            <div className="form-actions field-full">
              <button className="primary-button" type="submit">
                Guardar consulta
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Historial de consultas</h3>
            <div className="search-input-wrap">
              <Search size={15} className="search-input-icon" aria-hidden />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por profesional, motivo o diagnóstico"
                aria-label="Buscar por profesional, motivo o diagnóstico"
              />
            </div>
          </div>
          {statusMessage ? <p className="panel-subtitle">{statusMessage}</p> : null}

          {filteredConsultations.length === 0 ? (
            <div className="empty-state">
              Todavía no cargaste consultas o no coinciden con la búsqueda.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Médico / Profesional</th>
                  <th>Motivo</th>
                  <th>Diagnóstico</th>
                  <th>Tratamiento</th>
                  <th>Próximo control</th>
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
                    <td>{item.nextVisitDate ? formatDate(item.nextVisitDate) : '—'}</td>
                    <td>
                      <div className="section-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => handleAddToClinicalHistory(item)}
                        >
                          + Historial
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => startEdit(item)}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setPendingDelete(item)}
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
        title="Editar consulta médica"
        subtitle="Actualizá los datos de la visita médica"
        maxWidth="640px"
      >
        <form className="form-grid two-columns" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-consult-date">Fecha</label>
            <DatePicker
              id="edit-consult-date"
              value={toLocalDateKey(editFormState.date)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  date: fromLocalDateOrDateTime(value, true),
                })
              }
              ariaLabel="Fecha de la consulta"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-consult-doctor">Médico / Profesional</label>
            <input
              id="edit-consult-doctor"
              value={editFormState.doctor}
              onChange={(event) =>
                setEditFormState({ ...editFormState, doctor: event.target.value })
              }
              placeholder="Nombre del médico o especialista"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="edit-consult-reason">Motivo</label>
            <input
              id="edit-consult-reason"
              value={editFormState.reason}
              onChange={(event) =>
                setEditFormState({ ...editFormState, reason: event.target.value })
              }
              placeholder="Chequeo, seguimiento, urgencia"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="edit-consult-next-visit">Próximo control / seguimiento</label>
            <DatePicker
              id="edit-consult-next-visit"
              value={toLocalDateKey(editFormState.nextVisitDate)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  nextVisitDate: fromLocalDateOrDateTime(value),
                })
              }
              placeholder="Sin próximo control"
              ariaLabel="Próximo control médico"
              allowClear
            />
          </div>
          <div className="field">
            <label htmlFor="edit-consult-diagnosis">Diagnóstico</label>
            <textarea
              id="edit-consult-diagnosis"
              value={editFormState.diagnosis ?? ''}
              onChange={(event) =>
                setEditFormState({ ...editFormState, diagnosis: event.target.value })
              }
              placeholder="Resultados, observaciones"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-consult-treatment">Tratamiento</label>
            <textarea
              id="edit-consult-treatment"
              value={editFormState.treatment ?? ''}
              onChange={(event) =>
                setEditFormState({ ...editFormState, treatment: event.target.value })
              }
              placeholder="Medicación indicada, controles"
            />
          </div>
          <div className="field field-full">
            <label htmlFor="edit-consult-notes">Notas</label>
            <textarea
              id="edit-consult-notes"
              value={editFormState.notes ?? ''}
              onChange={(event) =>
                setEditFormState({ ...editFormState, notes: event.target.value })
              }
              placeholder="Complementos, estudios pendientes"
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
        title="Eliminar consulta"
        message={
          pendingDelete
            ? `¿Seguro que querés eliminar la consulta con "${pendingDelete.doctor}" (${formatDate(pendingDelete.date)})? Esta acción no se puede deshacer.`
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
