import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { Reminder } from '../../types'
import { formatDateTime, isUpcoming } from '../../utils/dates'

const initialFormState: Omit<Reminder, 'id' | 'done'> = {
  title: '',
  details: '',
  dateTime: new Date().toISOString(),
  category: 'general',
  snoozedUntil: undefined,
}

export const RemindersSection = () => {
  const { data, updateData } = useAppData()
  const reminders = data.utilities.reminders
  const [formState, setFormState] = useState(initialFormState)
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.title) {
      return
    }

    const entry: Reminder = {
      ...formState,
      id: uuid(),
      dateTime: new Date(formState.dateTime).toISOString(),
      done: false,
    }

    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        reminders: [entry, ...previous.utilities.reminders],
      },
    }))

    setFormState(initialFormState)
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
  }

  return (
    <div>
      <SectionHeader
        title="Recordatorios"
        subtitle="Gestiona alertas generales, con categorias y avisos proactivos"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Nuevo recordatorio</h3>
          </div>
          <form className="form-grid three-columns" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="rem-title">Titulo</label>
              <input
                id="rem-title"
                value={formState.title}
                onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                placeholder="Control, pago, reunion"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="rem-date">Fecha y hora</label>
              <input
                id="rem-date"
                type="datetime-local"
                value={formState.dateTime.slice(0, 16)}
                onChange={(event) =>
                  setFormState({ ...formState, dateTime: new Date(event.target.value).toISOString() })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="rem-category">Categoria</label>
              <select
                id="rem-category"
                value={formState.category}
                onChange={(event) => setFormState({ ...formState, category: event.target.value as Reminder['category'] })}
              >
                <option value="general">General</option>
                <option value="salud">Salud</option>
                <option value="diario">Diario</option>
                <option value="seguridad">Seguridad</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="rem-details">Detalle</label>
              <textarea
                id="rem-details"
                value={formState.details ?? ''}
                onChange={(event) => setFormState({ ...formState, details: event.target.value })}
                placeholder="Descripcion opcional"
              />
            </div>
            <button className="primary-button" type="submit">
              Guardar recordatorio
            </button>
          </form>
        </div>

        <div className="panel">
          <h3 className="panel-title">Listado</h3>
          {sortedReminders.length === 0 ? (
            <div className="empty-state">No hay recordatorios configurados.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Titulo</th>
                  <th>Vence</th>
                  <th>Categoria</th>
                  <th>Detalle</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedReminders.map((reminder) => (
                  <tr key={reminder.id} className={dueSoon.includes(reminder.id) ? 'due-reminder' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={reminder.done}
                        onChange={() => toggleDone(reminder.id)}
                      />
                    </td>
                    <td>{reminder.title}</td>
                    <td>{formatDateTime(reminder.dateTime)}</td>
                    <td>{reminder.category}</td>
                    <td>{reminder.details || '—'}</td>
                    <td>
                      <div className="section-actions">
                        <button className="secondary-button" type="button" onClick={() => snoozeReminder(reminder.id)}>
                          Posponer 1h
                        </button>
                        <button className="secondary-button" type="button" onClick={() => removeReminder(reminder.id)}>
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
    </div>
  )
}
