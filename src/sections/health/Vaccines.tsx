import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { Paperclip, Search, Plus } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { FormModal } from '../../components/FormModal'
import { SectionHeader } from '../../components/SectionHeader'
import { VaccineFormFields } from '../../components/VaccineFormFields'
import { VaccineSchedulePanel } from '../../components/VaccineSchedulePanel'
import { useAppData } from '../../hooks/useAppData'
import { scheduleForCountry } from '../../data/vaccineSchedules'
import type { Reminder, VaccineRecord } from '../../types'
import {
  formatDate,
  fromLocalDateOrDateTime,
  isUpcoming,
  safeParseDate,
} from '../../utils/dates'
import { createInitialVaccineForm, applyScheduleChoice, type VaccineFormState } from '../../utils/vaccineForm'
import { rankPlaceHistory } from '../../utils/placeHistory'
import { computeSchedule } from '../../utils/vaccineSchedule'

const createInitialFormState = createInitialVaccineForm

export const VaccinesSection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<VaccineFormState>(createInitialFormState)
  const [adding, setAdding] = useState(false)
  const closeAdd = () => {
    setAdding(false)
    setFormState(createInitialFormState())
  }
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<VaccineFormState>(createInitialFormState)
  const [pendingDelete, setPendingDelete] = useState<VaccineRecord | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyUpcoming, setShowOnlyUpcoming] = useState(false)

  const vaccines = data.health.vaccines
  const schedule = useMemo(() => scheduleForCountry(data.profile.countryCode, data.profile.country), [data.profile.countryCode, data.profile.country])
  const report = useMemo(() => (data.profile.birthDate ? computeSchedule(schedule, data.profile.birthDate, vaccines) : null), [schedule, data.profile.birthDate, vaccines])
  const history = useMemo(() => rankPlaceHistory(vaccines.map((v) => ({ place: v.location, date: v.date }))), [vaccines])
  const near = typeof data.profile.latitude === 'number' && typeof data.profile.longitude === 'number' ? { latitude: data.profile.latitude, longitude: data.profile.longitude } : undefined
  const formProps = { schedule, report, birthDate: data.profile.birthDate, history, countryCode: data.profile.countryCode, near }

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

  const handleCreate = (event?: FormEvent) => {
    event?.preventDefault()
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

    closeAdd()
  }

  const handleUpdate = (event?: FormEvent) => {
    event?.preventDefault()
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
      scheduleVaccineId: record.scheduleVaccineId,
      doseIndex: record.doseIndex,
      attachments: record.attachments ?? [],
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
        actions={<button type="button" className="primary-button add-new-btn" onClick={() => setAdding(true)}><Plus size={16} aria-hidden /> Nueva vacuna</button>}
      />

      <div className="section-body">
        <VaccineSchedulePanel
          birthDate={data.profile.birthDate}
          country={data.profile.country}
          countryCode={data.profile.countryCode}
          records={data.health.vaccines}
          onRegister={(item) => {
            const sv = schedule.vaccines.find((v) => v.id === item.vaccineId)
            const base = createInitialFormState()
            setFormState(sv ? applyScheduleChoice(base, sv, item.doseIndex, data.profile.birthDate) : { ...base, vaccine: item.vaccineName, dose: item.doseLabel })
            setAdding(true)
          }}
        />
        <FormModal
          open={adding}
          onClose={closeAdd}
          title="Nueva vacuna"
          subtitle="Elegí la vacuna y listo: la dosis y la próxima fecha se completan solas"
          submitLabel="Guardar vacuna"
          canSubmit={Boolean(formState.vaccine.trim() && formState.date)}
          onSubmit={() => handleCreate()}
          maxWidth={720}
        >
          <VaccineFormFields {...formProps} idPrefix="vaccine" value={formState} onChange={setFormState} />
        </FormModal>

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
                    <td>
                      {record.vaccine}
                      {(record.attachments ?? []).map((att) => (
                        <a key={att.id} className="vf-att-link" href={att.dataUrl} download={att.fileName} title={`Abrir comprobante: ${att.fileName}`} aria-label={`Descargar comprobante ${att.fileName}`}>
                          <Paperclip size={13} aria-hidden />
                        </a>
                      ))}
                    </td>
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

      <FormModal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Editar vacuna"
        subtitle="Actualizá los datos de la aplicación seleccionada"
        submitLabel="Guardar cambios"
        canSubmit={Boolean(editFormState.vaccine.trim() && editFormState.date)}
        onSubmit={() => handleUpdate()}
        maxWidth={720}
      >
        <VaccineFormFields {...formProps} idPrefix="edit-vaccine" editing value={editFormState} onChange={setEditFormState} />
      </FormModal>

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
