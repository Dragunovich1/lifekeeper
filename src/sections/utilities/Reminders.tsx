import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import type { Reminder } from '../../types'
import {
  formatDateTime,
  fromLocalDateOrDateTime,
  isUpcoming,
  toLocalDateTimeKey,
} from '../../utils/dates'

const createInitialFormState = (): Omit<Reminder, 'id' | 'done'> => ({
  title: '',
  details: '',
  dateTime: new Date().toISOString(),
  category: 'general',
  snoozedUntil: undefined,
})

const categoryLabels: Record<Reminder['category'], string> = {
  general: 'General',
  salud: 'Salud',
  diario: 'Diario',
  seguridad: 'Seguridad',
  personal: 'Personal',
}

export const RemindersSection = () => {
  const { data, updateData } = useAppData()
  const reminders = data.utilities.reminders
  const [formState, setFormState] = useState<Omit<Reminder, 'id' | 'done'>>(createInitialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<Omit<Reminder, 'id' | 'done'>>(createInitialFormState)
  const [deletingReminder, setDeletingReminder] = useState<Reminder | null>(null)
  const [dueSoon, setDueSoon] = useState<string[]>([])

  useEffect(() => {
    const evaluate = () => {
      const soon = reminders
        .filter((reminder) => !reminder.done)
        .filter((reminder) => isUpcoming(reminder.dateTime, 1))
        .map((reminder) => reminder.id)
      setDueSoon(soon)
    }

    evaluate()
    const interval = window.setInterval(evaluate, 60000)
    return () => window.clearInterval(interval)
  }, [reminders])

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => (a.dateTime > b.dateTime ? 1 : -1))
  }, [reminders])

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.title.trim()) return

    const normalizedDateTime = fromLocalDateOrDateTime(formState.dateTime, true)
    const entry: Reminder = {
      ...formState,
      id: uuid(),
      title: formState.title.trim(),
      dateTime: normalizedDateTime,
      done: false,
    }

    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        reminders: [entry, ...previous.utilities.reminders],
      },
    }))

    setFormState(createInitialFormState())
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.title.trim()) return

    const normalizedDateTime = fromLocalDateOrDateTime(editFormState.dateTime, true)
    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        reminders: previous.utilities.reminders.map((reminder) =>
          reminder.id === editingId
            ? {
                ...reminder,
                ...editFormState,
                title: editFormState.title.trim(),
                dateTime: normalizedDateTime,
              }
            : reminder,
        ),
      },
    }))

    setEditingId(null)
  }

  const startEdit = (reminder: Reminder) => {
    setEditingId(reminder.id)
    setEditFormState({
      title: reminder.title,
      details: reminder.details ?? '',
      dateTime: reminder.dateTime,
      category: reminder.category,
      snoozedUntil: reminder.snoozedUntil,
    })
  }

  const toggleDone = (id: string) => {
    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        reminders: previous.utilities.reminders.map((reminder) =>
          reminder.id === id ? { ...reminder, done: !reminder.done } : reminder,
        ),
      },
    }))
  }

  const snoozeReminder = (id: string) => {
    const newDate = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        reminders: previous.utilities.reminders.map((reminder) =>
          reminder.id === id
            ? { ...reminder, dateTime: newDate, snoozedUntil: newDate, done: false }
            : reminder,
        ),
      },
    }))
  }

  const removeReminder = (id: string) => {
    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        reminders: previous.utilities.reminders.filter((reminder) => reminder.id !== id),
      },
    }))
    if (editingId === id) {
      setEditingId(null)
    }
  }

  return (
    <div>
      <SectionHeader
        title="Recordatorios"
        subtitle="Gestioná alertas generales, con categorías y avisos proactivos"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Nuevo recordatorio</h3>
          </div>
          <form className="form-grid three-columns" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="rem-title">Título</label>
              <input
                id="rem-title"
                value={formState.title}
                onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                placeholder="Control, pago, reunión"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="rem-date">Fecha y hora</label>
              <DatePicker
                id="rem-date"
                value={toLocalDateTimeKey(formState.dateTime)}
                onChange={(value) =>
                  setFormState({
                    ...formState,
                    dateTime: fromLocalDateOrDateTime(value, true),
                  })
                }
                withTime
                ariaLabel="Fecha y hora del recordatorio"
              />
            </div>
            <div className="field">
              <label htmlFor="rem-category">Categoría</label>
              <Select
                id="rem-category"
                value={formState.category}
                onChange={(value) =>
                  setFormState({ ...formState, category: value as Reminder['category'] })
                }
                options={[
                  { value: 'general', label: 'General' },
                  { value: 'salud', label: 'Salud' },
                  { value: 'diario', label: 'Diario' },
                  { value: 'seguridad', label: 'Seguridad' },
                  { value: 'personal', label: 'Personal' },
                ]}
                ariaLabel="Categoría del recordatorio"
              />
            </div>
            <div className="field field-full">
              <label htmlFor="rem-details">Detalle</label>
              <textarea
                id="rem-details"
                value={formState.details ?? ''}
                onChange={(event) => setFormState({ ...formState, details: event.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
            <div className="form-actions field-full">
              <button className="primary-button" type="submit">
                Guardar recordatorio
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <h3 className="panel-title">Listado</h3>
          {sortedReminders.length === 0 ? (
            <div className="empty-state">Todavía no hay recordatorios configurados.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Título</th>
                  <th>Vence</th>
                  <th>Categoría</th>
                  <th>Detalle</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedReminders.map((reminder) => (
                  <tr
                    key={reminder.id}
                    className={dueSoon.includes(reminder.id) ? 'due-reminder' : ''}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={reminder.done}
                        onChange={() => toggleDone(reminder.id)}
                        aria-label={`Marcar "${reminder.title}" como completado`}
                      />
                    </td>
                    <td>{reminder.title}</td>
                    <td>{formatDateTime(reminder.dateTime)}</td>
                    <td>{categoryLabels[reminder.category] ?? reminder.category}</td>
                    <td>{reminder.details || '—'}</td>
                    <td>
                      <div className="section-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => snoozeReminder(reminder.id)}
                        >
                          Posponer 1h
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => startEdit(reminder)}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setDeletingReminder(reminder)}
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
        title="Editar recordatorio"
        subtitle="Modificá la alerta o programación del recordatorio"
        maxWidth="640px"
      >
        <form className="form-grid three-columns" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-rem-title">Título</label>
            <input
              id="edit-rem-title"
              value={editFormState.title}
              onChange={(event) =>
                setEditFormState({ ...editFormState, title: event.target.value })
              }
              placeholder="Control, pago, reunión"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="edit-rem-date">Fecha y hora</label>
            <DatePicker
              id="edit-rem-date"
              value={toLocalDateTimeKey(editFormState.dateTime)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  dateTime: fromLocalDateOrDateTime(value, true),
                })
              }
              withTime
              ariaLabel="Fecha y hora del recordatorio"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-rem-category">Categoría</label>
            <Select
              id="edit-rem-category"
              value={editFormState.category}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  category: value as Reminder['category'],
                })
              }
              options={[
                { value: 'general', label: 'General' },
                { value: 'salud', label: 'Salud' },
                { value: 'diario', label: 'Diario' },
                { value: 'seguridad', label: 'Seguridad' },
                { value: 'personal', label: 'Personal' },
              ]}
              ariaLabel="Categoría del recordatorio"
            />
          </div>
          <div className="field field-full">
            <label htmlFor="edit-rem-details">Detalle</label>
            <textarea
              id="edit-rem-details"
              value={editFormState.details ?? ''}
              onChange={(event) =>
                setEditFormState({ ...editFormState, details: event.target.value })
              }
              placeholder="Descripción opcional"
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
        open={Boolean(deletingReminder)}
        title="Eliminar recordatorio"
        message={
          deletingReminder
            ? `¿Querés eliminar el recordatorio "${deletingReminder.title}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deletingReminder) {
            removeReminder(deletingReminder.id)
          }
        }}
        onClose={() => setDeletingReminder(null)}
      />
    </div>
  )
}
