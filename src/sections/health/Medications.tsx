import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { TimePicker } from '../../components/TimePicker'
import { useAppData } from '../../hooks/useAppData'
import type { Medication, MedicationSchedule } from '../../types'
import { formatDate, fromLocalDateOrDateTime, toLocalDateKey } from '../../utils/dates'
import { searchMedications, type MedicationSuggestion } from '../../services/api'

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
  intakeLog: [],
})

export const MedicationsSection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<MedicationFormState>(createInitialFormState)
  const [scheduleDraft, setScheduleDraft] = useState<{ time: string; note: string }>({
    time: '',
    note: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<MedicationFormState>(createInitialFormState)
  const [editScheduleDraft, setEditScheduleDraft] = useState<{ time: string; note: string }>({
    time: '',
    note: '',
  })
  const [pendingDelete, setPendingDelete] = useState<Medication | null>(null)
  const [dueMedications, setDueMedications] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [medSuggestions, setMedSuggestions] = useState<MedicationSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    const query = formState.name.trim()
    if (query.length < 2) {
      setMedSuggestions([])
      return
    }
    let isCurrent = true
    const timer = setTimeout(async () => {
      const results = await searchMedications(query)
      if (isCurrent) {
        setMedSuggestions(results)
      }
    }, 250)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [formState.name])

  const medications = data.health.medications
  const allergies = data.health.emergencyProfile.allergies
  const todayKey = toLocalDateKey(new Date())

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

  const allergyConflict = useMemo(() => {
    const draftName = formState.name.trim().toLowerCase()
    if (!draftName) return null
    return (
      allergies.find((allergy) => {
        const cleaned = allergy.trim().toLowerCase()
        return cleaned && (draftName.includes(cleaned) || cleaned.includes(draftName))
      }) ?? null
    )
  }, [formState.name, allergies])

  const editAllergyConflict = useMemo(() => {
    const draftName = editFormState.name.trim().toLowerCase()
    if (!draftName) return null
    return (
      allergies.find((allergy) => {
        const cleaned = allergy.trim().toLowerCase()
        return cleaned && (draftName.includes(cleaned) || cleaned.includes(draftName))
      }) ?? null
    )
  }, [editFormState.name, allergies])

  const duplicateMedication = useMemo(() => {
    const draftName = formState.name.trim().toLowerCase()
    if (!draftName) return null
    return (
      medications.find(
        (med) =>
          med.active &&
          med.name.trim().toLowerCase() === draftName,
      ) ?? null
    )
  }, [formState.name, medications])

  const todayDoses = useMemo(() => {
    return medications
      .filter((med) => med.active)
      .flatMap((med) =>
        med.schedules.map((schedule) => {
          const intakeKey = `${todayKey}T${schedule.time}`
          const taken = Boolean(med.intakeLog?.includes(intakeKey))
          return {
            medicationId: med.id,
            medicationName: med.name,
            dosage: med.dosage,
            time: schedule.time,
            note: schedule.note,
            intakeKey,
            taken,
          }
        }),
      )
      .sort((a, b) => (a.time > b.time ? 1 : -1))
  }, [medications, todayKey])

  const adherencePercent = useMemo(() => {
    if (todayDoses.length === 0) return 100
    const takenCount = todayDoses.filter((d) => d.taken).length
    return Math.round((takenCount / todayDoses.length) * 100)
  }, [todayDoses])

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

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.name.trim()) return

    const payload: MedicationFormState = {
      ...formState,
      name: formState.name.trim(),
      startDate: fromLocalDateOrDateTime(formState.startDate, true),
      endDate: formState.endDate ? fromLocalDateOrDateTime(formState.endDate) || undefined : undefined,
    }

    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        medications: [{ ...payload, id: uuid(), intakeLog: [] }, ...previous.health.medications],
      },
    }))

    setFormState(createInitialFormState())
    setScheduleDraft({ time: '', note: '' })
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.name.trim()) return

    const payload: MedicationFormState = {
      ...editFormState,
      name: editFormState.name.trim(),
      startDate: fromLocalDateOrDateTime(editFormState.startDate, true),
      endDate: editFormState.endDate ? fromLocalDateOrDateTime(editFormState.endDate) || undefined : undefined,
    }

    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        medications: previous.health.medications.map((item) =>
          item.id === editingId
            ? { ...payload, id: editingId, intakeLog: item.intakeLog ?? [] }
            : item,
        ),
      },
    }))

    setEditingId(null)
  }

  const handleAddSchedule = () => {
    if (!scheduleDraft.time) return

    const newSchedule: MedicationSchedule = {
      time: scheduleDraft.time,
      note: scheduleDraft.note.trim() || undefined,
    }

    setFormState((prev) => ({
      ...prev,
      schedules: [...prev.schedules, newSchedule],
    }))

    setScheduleDraft({ time: '', note: '' })
  }

  const handleRemoveSchedule = (indexToRemove: number) => {
    setFormState((prev) => ({
      ...prev,
      schedules: prev.schedules.filter((_, index) => index !== indexToRemove),
    }))
  }

  const handleAddEditSchedule = () => {
    if (!editScheduleDraft.time) return

    const newSchedule: MedicationSchedule = {
      time: editScheduleDraft.time,
      note: editScheduleDraft.note.trim() || undefined,
    }

    setEditFormState((prev) => ({
      ...prev,
      schedules: [...prev.schedules, newSchedule],
    }))

    setEditScheduleDraft({ time: '', note: '' })
  }

  const handleRemoveEditSchedule = (indexToRemove: number) => {
    setEditFormState((prev) => ({
      ...prev,
      schedules: prev.schedules.filter((_, index) => index !== indexToRemove),
    }))
  }

  const toggleIntake = (medicationId: string, intakeKey: string) => {
    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        medications: previous.health.medications.map((med) => {
          if (med.id !== medicationId) return med
          const currentLog = med.intakeLog ?? []
          const exists = currentLog.includes(intakeKey)
          const nextLog = exists
            ? currentLog.filter((entry) => entry !== intakeKey)
            : [...currentLog, intakeKey]
          return { ...med, intakeLog: nextLog }
        }),
      },
    }))
  }

  const startEdit = (med: Medication) => {
    setEditingId(med.id)
    setEditFormState({
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      schedules: [...med.schedules],
      startDate: med.startDate,
      endDate: med.endDate ?? '',
      instructions: med.instructions ?? '',
      active: med.active,
      intakeLog: med.intakeLog ?? [],
    })
    setEditScheduleDraft({ time: '', note: '' })
  }

  const handleRemove = (id: string) => {
    if (editingId === id) {
      setEditingId(null)
    }
    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        medications: previous.health.medications.filter((item) => item.id !== id),
      },
      utilities: {
        ...previous.utilities,
        reminders: previous.utilities.reminders.filter((rem) => rem.sourceId !== id),
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
        subtitle="Gestioná las tomas vigentes, dosis y horarios con alertas integradas"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Agregar tratamiento</h3>
            <p className="panel-subtitle">Definí la posología y los horarios diarios</p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleCreate}>
            {allergyConflict ? (
              <div className="alert alert-error field-full" role="alert">
                Atención: este medicamento coincide con una alergia registrada en tu ficha de
                emergencia ({allergyConflict}).
              </div>
            ) : null}
            {duplicateMedication ? (
              <div className="alert alert-warning field-full" role="status">
                Ya tenés un tratamiento activo con este nombre ({duplicateMedication.name}{' '}
                {duplicateMedication.dosage ? `· ${duplicateMedication.dosage}` : ''}).
              </div>
            ) : null}

            <div className="field" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="med-name">Medicación</label>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Vademécum NLM / RxNorm
                </span>
              </div>
              <input
                id="med-name"
                value={formState.name}
                onChange={(event) => {
                  setFormState({ ...formState, name: event.target.value })
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Ej. Ibuprofeno, Losartán, Amoxicilina..."
                required
                autoComplete="off"
              />
              {showSuggestions && medSuggestions.length > 0 ? (
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
                  {medSuggestions.map((sug, idx) => (
                    <button
                      key={`${sug.name}-${idx}`}
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
                        setFormState({
                          ...formState,
                          name: sug.name,
                          dosage: sug.commonDosages?.[0] || formState.dosage,
                        })
                        setShowSuggestions(false)
                      }}
                    >
                      <strong style={{ fontSize: '0.875rem' }}>{sug.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {sug.category || sug.substance || 'Registro farmacéutico'}
                        {sug.commonDosages ? ` · Dosis habituales: ${sug.commonDosages.join(', ')}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
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
              <DatePicker
                id="med-start"
                value={toLocalDateKey(formState.startDate)}
                onChange={(value) =>
                  setFormState({
                    ...formState,
                    startDate: fromLocalDateOrDateTime(value, true),
                  })
                }
                ariaLabel="Fecha de inicio"
              />
            </div>
            <div className="field">
              <label htmlFor="med-end">Fin</label>
              <DatePicker
                id="med-end"
                value={toLocalDateKey(formState.endDate)}
                onChange={(value) =>
                  setFormState({
                    ...formState,
                    endDate: fromLocalDateOrDateTime(value),
                  })
                }
                placeholder="Sin fecha de fin"
                ariaLabel="Fecha de fin"
              />
            </div>
            <div className="field">
              <label htmlFor="med-active">Estado</label>
              <Select
                id="med-active"
                value={formState.active ? 'active' : 'paused'}
                onChange={(value) => setFormState({ ...formState, active: value === 'active' })}
                options={[
                  { value: 'active', label: 'Activo' },
                  { value: 'paused', label: 'Pausado' },
                ]}
                ariaLabel="Estado del medicamento"
              />
            </div>
            <div className="field field-full">
              <label htmlFor="med-notes">Indicaciones</label>
              <textarea
                id="med-notes"
                value={formState.instructions ?? ''}
                onChange={(event) =>
                  setFormState({ ...formState, instructions: event.target.value })
                }
                placeholder="Tomar con comida, reposo, observaciones"
              />
            </div>
            <div className="subpanel field-full">
              <div className="panel-header">
                <h4 className="panel-title">Horarios</h4>
              </div>
              <div className="form-grid two-columns">
                <div className="field">
                  <label htmlFor="schedule-time">Hora</label>
                  <TimePicker
                    id="schedule-time"
                    value={scheduleDraft.time}
                    onChange={(time) => setScheduleDraft({ ...scheduleDraft, time })}
                    ariaLabel="Hora de la toma"
                  />
                </div>
                <div className="field">
                  <label htmlFor="schedule-note">Nota</label>
                  <input
                    id="schedule-note"
                    value={scheduleDraft.note}
                    onChange={(event) =>
                      setScheduleDraft({ ...scheduleDraft, note: event.target.value })
                    }
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
                      <button
                        type="button"
                        className="tag-remove"
                        onClick={() => handleRemoveSchedule(index)}
                        aria-label={`Quitar horario ${schedule.time}`}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="panel-subtitle">Todavía no agregaste horarios.</p>
              )}
            </div>
            <div className="form-actions field-full">
              <button className="primary-button" type="submit">
                Guardar tratamiento
              </button>
            </div>
          </form>
        </div>

        {todayDoses.length > 0 ? (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Tomas de hoy y adherencia</h3>
                <p className="panel-subtitle">
                  Registrá cada toma cumplida hoy ({formatDate(todayKey)}) para llevar control diario
                </p>
              </div>
              <span
                className={
                  adherencePercent === 100
                    ? 'badge badge-success'
                    : adherencePercent >= 50
                      ? 'badge badge-info'
                      : 'badge badge-warning'
                }
              >
                Adherencia hoy: {adherencePercent}%
              </span>
            </div>
            <div className="section-body">
              {todayDoses.map((dose, idx) => (
                <div key={`${dose.medicationId}-${dose.time}-${idx}`} className="subpanel">
                  <div className="panel-header">
                    <div>
                      <h4 className="panel-title">
                        {dose.time} hs · {dose.medicationName}{' '}
                        {dose.dosage ? `(${dose.dosage})` : ''}
                      </h4>
                      {dose.note ? <span className="panel-subtitle">{dose.note}</span> : null}
                    </div>
                    <button
                      type="button"
                      className={dose.taken ? 'primary-button' : 'secondary-button'}
                      onClick={() => toggleIntake(dose.medicationId, dose.intakeKey)}
                    >
                      {dose.taken ? 'Tomada ✓' : 'Marcar tomada'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Medicaciones activas</h3>
            <div className="search-input-wrap">
              <Search size={15} className="search-input-icon" aria-hidden />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nombre o indicación"
                aria-label="Buscar por nombre o indicación"
              />
            </div>
          </div>

          {filteredMedications.length === 0 ? (
            <div className="empty-state">No hay tratamientos cargados o coincidentes.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Medicación</th>
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
                            onClick={() => startEdit(med)}
                          >
                            Editar
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => toggleMedicationActive(med.id)}
                          >
                            {med.active ? 'Pausar' : 'Activar'}
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => setPendingDelete(med)}
                          >
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

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Editar tratamiento"
        subtitle="Actualizá la posología o los horarios del tratamiento"
        maxWidth="720px"
      >
        <form className="form-grid two-columns" onSubmit={handleUpdate}>
          {editAllergyConflict ? (
            <div className="alert alert-error field-full" role="alert">
              Atención: este medicamento coincide con una alergia registrada en tu ficha de
              emergencia ({editAllergyConflict}).
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="edit-med-name">Medicación</label>
            <input
              id="edit-med-name"
              value={editFormState.name}
              onChange={(event) =>
                setEditFormState({ ...editFormState, name: event.target.value })
              }
              placeholder="Nombre comercial o droga"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="edit-med-dosage">Dosis</label>
            <input
              id="edit-med-dosage"
              value={editFormState.dosage}
              onChange={(event) =>
                setEditFormState({ ...editFormState, dosage: event.target.value })
              }
              placeholder="Ej. 500 mg"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-med-frequency">Frecuencia</label>
            <input
              id="edit-med-frequency"
              value={editFormState.frequency}
              onChange={(event) =>
                setEditFormState({ ...editFormState, frequency: event.target.value })
              }
              placeholder="Cada 8 hs, diaria, semanal"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-med-start">Inicio</label>
            <DatePicker
              id="edit-med-start"
              value={toLocalDateKey(editFormState.startDate)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  startDate: fromLocalDateOrDateTime(value, true),
                })
              }
              ariaLabel="Fecha de inicio"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-med-end">Fin</label>
            <DatePicker
              id="edit-med-end"
              value={toLocalDateKey(editFormState.endDate)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  endDate: fromLocalDateOrDateTime(value),
                })
              }
              placeholder="Sin fecha de fin"
              ariaLabel="Fecha de fin"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-med-active">Estado</label>
            <Select
              id="edit-med-active"
              value={editFormState.active ? 'active' : 'paused'}
              onChange={(value) =>
                setEditFormState({ ...editFormState, active: value === 'active' })
              }
              options={[
                { value: 'active', label: 'Activo' },
                { value: 'paused', label: 'Pausado' },
              ]}
              ariaLabel="Estado del medicamento"
            />
          </div>
          <div className="field field-full">
            <label htmlFor="edit-med-notes">Indicaciones</label>
            <textarea
              id="edit-med-notes"
              value={editFormState.instructions ?? ''}
              onChange={(event) =>
                setEditFormState({ ...editFormState, instructions: event.target.value })
              }
              placeholder="Tomar con comida, reposo, observaciones"
            />
          </div>
          <div className="subpanel field-full">
            <div className="panel-header">
              <h4 className="panel-title">Horarios</h4>
            </div>
            <div className="form-grid two-columns">
              <div className="field">
                <label htmlFor="edit-schedule-time">Hora</label>
                <TimePicker
                  id="edit-schedule-time"
                  value={editScheduleDraft.time}
                  onChange={(time) =>
                    setEditScheduleDraft({ ...editScheduleDraft, time })
                  }
                  ariaLabel="Hora de la toma"
                />
              </div>
              <div className="field">
                <label htmlFor="edit-schedule-note">Nota</label>
                <input
                  id="edit-schedule-note"
                  value={editScheduleDraft.note}
                  onChange={(event) =>
                    setEditScheduleDraft({
                      ...editScheduleDraft,
                      note: event.target.value,
                    })
                  }
                  placeholder="Antes de dormir, en ayunas"
                />
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={handleAddEditSchedule}
              >
                Agregar horario
              </button>
            </div>
            {editFormState.schedules.length > 0 ? (
              <div className="chip-list">
                {editFormState.schedules.map((schedule, index) => (
                  <span key={`${schedule.time}-${index}`} className="chip">
                    {schedule.time}
                    {schedule.note ? ` · ${schedule.note}` : ''}
                    <button
                      type="button"
                      className="tag-remove"
                      onClick={() => handleRemoveEditSchedule(index)}
                      aria-label={`Quitar horario ${schedule.time}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="panel-subtitle">Todavía no agregaste horarios.</p>
            )}
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
        title="Eliminar tratamiento"
        message={
          pendingDelete
            ? `¿Seguro que querés eliminar el tratamiento "${pendingDelete.name}"? Esta acción no se puede deshacer.`
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
