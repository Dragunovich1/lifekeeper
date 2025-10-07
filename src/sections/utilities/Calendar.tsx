import { eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, startOfMonth } from 'date-fns'
import { useMemo, useState } from 'react'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { AppData } from '../../types'
import { formatDate } from '../../utils/dates'

interface CalendarEvent {
  id: string
  date: string
  title: string
  description?: string
  category: string
}

const categoriesPalette: Record<string, string> = {
  salud: '#38bdf8',
  diario: '#6366f1',
  seguridad: '#f97316',
  personal: '#22c55e',
  general: '#94a3b8',
}

export const CalendarSection = () => {
  const { data, updateData } = useAppData()
  const preferences = data.utilities.calendarPreferences
  const [cursor, setCursor] = useState(new Date())

  const events = useMemo(() => buildEvents(data, preferences.includeCompleted), [data, preferences.includeCompleted])

  const currentMonth = startOfMonth(cursor)
  const days = eachDayOfInterval({ start: currentMonth, end: endOfMonth(currentMonth) })

  const handleMonthsAhead = (value: number) => {
    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        calendarPreferences: {
          ...previous.utilities.calendarPreferences,
          monthsAhead: value,
        },
      },
    }))
  }

  const handleIncludeCompleted = (checked: boolean) => {
    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        calendarPreferences: {
          ...previous.utilities.calendarPreferences,
          includeCompleted: checked,
        },
      },
    }))
  }

  return (
    <div>
      <SectionHeader
        title="Calendario"
        subtitle="Visualiza eventos de salud, tareas y recordatorios en un mismo lugar"
        actions={
          <div className="section-actions">
            <button className="secondary-button" type="button" onClick={() => setCursor(new Date())}>
              Hoy
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              Mes anterior
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              Mes siguiente
            </button>
          </div>
        }
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">{format(currentMonth, 'MMMM yyyy')}</h3>
            <div className="section-actions">
              <label>
                Meses por delante
                <input
                  style={{ marginLeft: '0.5rem', width: '60px' }}
                  type="number"
                  min={0}
                  max={12}
                  value={preferences.monthsAhead}
                  onChange={(event) => handleMonthsAhead(Number(event.target.value))}
                />
              </label>
              <label className="badge">
                <input
                  type="checkbox"
                  checked={preferences.includeCompleted}
                  onChange={(event) => handleIncludeCompleted(event.target.checked)}
                />
                Incluir completados
              </label>
            </div>
          </div>
          <div className="calendar-grid">
            {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map((day) => (
              <div key={day} className="calendar-header-cell">
                {day}
              </div>
            ))}
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`calendar-cell ${isSameMonth(day, currentMonth) ? '' : 'calendar-cell-out'}`}
              >
                <span className="calendar-day">{day.getDate()}</span>
                <div className="calendar-events">
                  {events
                    .filter((event) => isSameDay(new Date(event.date), day))
                    .map((event) => (
                      <div
                        key={event.id}
                        className="calendar-event"
                        style={{ borderLeftColor: categoriesPalette[event.category] ?? '#94a3b8' }}
                      >
                        <strong>{event.title}</strong>
                        {event.description ? <span>{event.description}</span> : null}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3 className="panel-title">Eventos proximos</h3>
          <ul className="mood-history">
            {events.length === 0 ? (
              <li>No hay eventos registrados.</li>
            ) : (
              events
                .filter((event) => new Date(event.date) >= new Date())
                .sort((a, b) => (a.date > b.date ? 1 : -1))
                .slice(0, 10)
                .map((event) => (
                  <li key={event.id}>
                    <span>{formatDate(event.date)}</span>
                    <span>{event.title}</span>
                    <span>{event.description || event.category}</span>
                  </li>
                ))
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

const buildEvents = (data: AppData, includeCompleted: boolean) => {
  const events: CalendarEvent[] = []

  data.health.consultations.forEach((consult) => {
    events.push({
      id: `consult-${consult.id}`,
      date: consult.date,
      title: `Consulta: ${consult.doctor}`,
      description: consult.reason,
      category: 'salud',
    })
  })

  data.health.vaccines.forEach((vaccine) => {
    events.push({
      id: `vaccine-${vaccine.id}`,
      date: vaccine.date,
      title: `Vacuna ${vaccine.vaccine}`,
      description: vaccine.dose,
      category: 'salud',
    })
    if (vaccine.nextDoseDate) {
      events.push({
        id: `vaccine-next-${vaccine.id}`,
        date: vaccine.nextDoseDate,
        title: `Refuerzo ${vaccine.vaccine}`,
        description: vaccine.location,
        category: 'salud',
      })
    }
  })

  data.security.passwordEntries.forEach((entry) => {
    events.push({
      id: `pwd-${entry.id}`,
      date: entry.updatedAt,
      title: `Actualizacion password ${entry.service}`,
      category: 'seguridad',
    })
  })

  data.personal.finances.forEach((transaction) => {
    events.push({
      id: `fin-${transaction.id}`,
      date: transaction.date,
      title: `${transaction.type === 'income' ? 'Ingreso' : 'Egreso'} ${transaction.category}`,
      description: `$${transaction.amount.toFixed(2)}`,
      category: 'personal',
    })
  })

  data.personal.vehicles.forEach((service) => {
    events.push({
      id: `veh-${service.id}`,
      date: service.date,
      title: `Servicio ${service.vehicleName}`,
      description: service.serviceType,
      category: 'personal',
    })
  })

  data.utilities.reminders.forEach((reminder) => {
    if (!includeCompleted && reminder.done) {
      return
    }
    events.push({
      id: `rem-${reminder.id}`,
      date: reminder.dateTime,
      title: reminder.title,
      description: reminder.details,
      category: reminder.category,
    })
  })

  return events
}
