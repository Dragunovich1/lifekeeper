import type { FormEvent } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { Plus } from 'lucide-react'
import { es } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { TimePicker } from '../../components/TimePicker'
import { useAppData } from '../../hooks/useAppData'
import { usePreferences } from '../../preferences/context'
import type { AppData, DiaryEntry, Reminder, WorkoutSession } from '../../types'
import {
  formatCurrency,
  formatDate,
  fromLocalDateOrDateTime,
  safeParseDate,
  toLocalDateKey,
  toLocalTimeKey,
} from '../../utils/dates'

interface CalendarEvent {
  id: string
  date: string
  title: string
  description?: string
  category: string
  targetHash: string
  reminderId?: string
  reminderDone?: boolean
}

const categoriesPalette: Record<string, string> = {
  salud: 'var(--color-accent-cyan)',
  diario: 'var(--color-accent-purple)',
  seguridad: 'var(--color-warning)',
  personal: 'var(--color-accent-blue)',
  general: 'var(--color-success)',
}

const categoryFilterOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'salud', label: 'Salud' },
  { value: 'personal', label: 'Personal' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'diario', label: 'Diario' },
  { value: 'general', label: 'General' },
]

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export const CalendarSection = () => {
  const { data, updateData } = useAppData()
  const { preferences: appPreferences } = usePreferences()
  const preferences = data.utilities.calendarPreferences
  const [cursor, setCursor] = useState(new Date())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [deletingReminderEvent, setDeletingReminderEvent] = useState<CalendarEvent | null>(null)

  // Estado del formulario rápido para la fecha seleccionada
  const [quickTitle, setQuickTitle] = useState('')
  const [quickTime, setQuickTime] = useState('09:00')
  const [quickCategory, setQuickCategory] = useState<Reminder['category']>('general')
  const [quickMode, setQuickMode] = useState<'reminder' | 'both'>('reminder')
  const [quickDetails, setQuickDetails] = useState('')

  const allEvents = useMemo(
    () => buildEvents(data, preferences.includeCompleted, appPreferences.currency),
    [data, preferences.includeCompleted, appPreferences.currency],
  )

  const events = useMemo(() => {
    if (selectedCategory === 'all') return allEvents
    return allEvents.filter((event) => event.category === selectedCategory)
  }, [allEvents, selectedCategory])

  const currentMonth = startOfMonth(cursor)
  const monthStart = currentMonth
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  })

  const selectedDayEvents = useMemo(() => {
    return events.filter((event) => {
      const eventDate = safeParseDate(event.date)
      return eventDate ? isSameDay(eventDate, selectedDate) : false
    })
  }, [events, selectedDate])

  const upcomingEvents = useMemo(() => {
    const todayStart = startOfDay(new Date())
    const horizon =
      preferences.monthsAhead > 0
        ? endOfMonth(addMonths(todayStart, preferences.monthsAhead))
        : endOfMonth(todayStart)

    return events
      .filter((event) => {
        const parsed = safeParseDate(event.date)
        if (!parsed) return false
        return parsed >= todayStart && parsed <= horizon
      })
      .sort((a, b) => (a.date > b.date ? 1 : -1))
  }, [events, preferences.monthsAhead])

  const handleMonthsAhead = (value: number) => {
    const clamped = Number.isNaN(value) ? 0 : Math.min(12, Math.max(0, value))
    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        calendarPreferences: {
          ...previous.utilities.calendarPreferences,
          monthsAhead: clamped,
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

  const handleQuickAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanTitle = quickTitle.trim()
    if (!cleanTitle) return

    const dateKey = toLocalDateKey(selectedDate)
    const timeKey = quickTime || '09:00'
    const isoDateTime = fromLocalDateOrDateTime(`${dateKey}T${timeKey}`, true)

    const newReminder: Reminder = {
      id: uuid(),
      title: cleanTitle,
      details: quickDetails.trim() || undefined,
      dateTime: isoDateTime,
      category: quickCategory,
      done: false,
    }

    updateData((previous) => {
      let nextDiaryEntries = previous.diary.entries
      if (quickMode === 'both') {
        const diaryEntry: DiaryEntry = {
          id: uuid(),
          date: isoDateTime,
          title: cleanTitle,
          content: quickDetails.trim() || cleanTitle,
          mood: 'Neutral',
          tags: [quickCategory, 'calendario'],
        }
        nextDiaryEntries = [diaryEntry, ...previous.diary.entries]
      }

      return {
        ...previous,
        diary: {
          ...previous.diary,
          entries: nextDiaryEntries,
        },
        utilities: {
          ...previous.utilities,
          reminders: [newReminder, ...previous.utilities.reminders],
        },
      }
    })

    setQuickTitle('')
    setQuickDetails('')
  }

  const toggleReminderDone = (reminderId: string) => {
    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        reminders: previous.utilities.reminders.map((rem) =>
          rem.id === reminderId ? { ...rem, done: !rem.done } : rem,
        ),
      },
    }))
  }

  const removeReminder = (reminderId: string) => {
    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        reminders: previous.utilities.reminders.filter((rem) => rem.id !== reminderId),
      },
    }))
  }

  const selectedDateFormatted = formatDate(selectedDate.toISOString())

  return (
    <div>
      <SectionHeader
        title="Calendario"
        subtitle="Visualizá eventos de salud, finanzas, vehículos, seguridad y agendá recordatorios en cualquier fecha"
        actions={
          <div className="section-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                const now = new Date()
                setCursor(now)
                setSelectedDate(now)
              }}
            >
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
            <h3 className="panel-title" style={{ textTransform: 'capitalize' }}>
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h3>
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

          <div className="chip-list" aria-label="Filtrar eventos por categoría">
            {categoryFilterOptions.map((option) => {
              const isActive = selectedCategory === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={isActive ? 'primary-button' : 'secondary-button'}
                  onClick={() => setSelectedCategory(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="calendar-grid">
            {weekDays.map((day) => (
              <div key={day} className="calendar-header-cell">
                {day}
              </div>
            ))}
            {days.map((day) => {
              const isSelected = isSameDay(day, selectedDate)
              const dayEvents = events.filter((event) => {
                const eventDate = safeParseDate(event.date)
                return eventDate ? isSameDay(eventDate, day) : false
              })
              return (
                <div
                  key={day.toISOString()}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedDate(day)
                    setIsEventModalOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedDate(day)
                      setIsEventModalOpen(true)
                    }
                  }}
                  style={
                    isSelected
                      ? {
                          borderColor: 'var(--color-accent-blue)',
                          boxShadow: '0 0 0 2px var(--color-focus-ring)',
                          cursor: 'pointer',
                        }
                      : { cursor: 'pointer' }
                  }
                  className={`calendar-cell ${
                    isSameMonth(day, currentMonth) ? '' : 'calendar-cell-out'
                  }`}
                >
                  <span className="calendar-day">{day.getDate()}</span>
                  <div className="calendar-events">
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className="calendar-event"
                        style={{
                          borderLeftColor:
                            categoriesPalette[event.category] ?? 'var(--color-text-muted)',
                        }}
                      >
                        <strong>{event.title}</strong>
                        {event.description ? <span>{event.description}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="subpanel">
            <div className="panel-header">
              <div>
                <h4 className="panel-title">Eventos del {selectedDateFormatted}</h4>
                <span className="panel-subtitle">
                  {selectedDayEvents.length === 0
                    ? 'Sin eventos registrados en esta fecha.'
                    : `${selectedDayEvents.length} ${
                        selectedDayEvents.length === 1 ? 'evento' : 'eventos'
                      } en este día`}
                </span>
              </div>
              <div className="section-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setIsEventModalOpen(true)}
                >
                  <Plus size={15} aria-hidden />
                  Agendar evento
                </button>
              </div>
            </div>

            {selectedDayEvents.length > 0 ? (
              <ul className="recent-list">
                {selectedDayEvents.map((event) => (
                  <li key={event.id}>
                    <div>
                      <strong className={event.reminderDone ? 'task-completed' : ''}>
                        {event.reminderId ? `[${toLocalTimeKey(event.date)}] ` : ''}
                        {event.title}
                      </strong>
                      {event.description ? (
                        <span className="panel-subtitle" style={{ display: 'block' }}>
                          {event.description}
                        </span>
                      ) : null}
                    </div>
                    <div className="section-actions">
                      {event.reminderId ? (
                        <>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => toggleReminderDone(event.reminderId!)}
                          >
                            {event.reminderDone ? 'Marcar pendiente' : 'Marcar completado'}
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => setDeletingReminderEvent(event)}
                          >
                            Eliminar
                          </button>
                        </>
                      ) : null}
                      <a className="secondary-button" href={event.targetHash}>
                        Ir a sección
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <Modal
          open={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          title="Agendar evento"
          subtitle={`Fecha seleccionada: ${selectedDateFormatted}`}
          maxWidth="560px"
        >
          <form
            className="form-grid two-columns"
            onSubmit={(event) => {
              handleQuickAdd(event)
              setIsEventModalOpen(false)
            }}
          >
            <div className="field">
              <label htmlFor="cal-quick-title">Título</label>
              <input
                id="cal-quick-title"
                value={quickTitle}
                onChange={(event) => setQuickTitle(event.target.value)}
                placeholder="Ej. Turno médico, Pago de tarjeta, Cumpleaños"
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="cal-quick-time">Horario</label>
              <TimePicker
                id="cal-quick-time"
                value={quickTime}
                onChange={setQuickTime}
                ariaLabel="Horario del evento"
              />
            </div>
            <div className="field">
              <label htmlFor="cal-quick-category">Categoría</label>
              <Select
                id="cal-quick-category"
                value={quickCategory}
                onChange={(value) => setQuickCategory(value as Reminder['category'])}
                options={[
                  { value: 'general', label: 'General' },
                  { value: 'salud', label: 'Salud' },
                  { value: 'personal', label: 'Personal' },
                  { value: 'seguridad', label: 'Seguridad' },
                  { value: 'diario', label: 'Diario' },
                ]}
                ariaLabel="Categoría del evento"
              />
            </div>
            <div className="field">
              <label htmlFor="cal-quick-mode">Recordatorio y opciones</label>
              <Select
                id="cal-quick-mode"
                value={quickMode}
                onChange={(value) => setQuickMode(value as 'reminder' | 'both')}
                options={[
                  { value: 'reminder', label: 'Activar alerta en Recordatorios' },
                  {
                    value: 'both',
                    label: 'Guardar también como nota en el Diario',
                  },
                ]}
                ariaLabel="Opciones de guardado"
              />
            </div>
            <div className="field field-full">
              <label htmlFor="cal-quick-details">Detalle / Notas</label>
              <textarea
                id="cal-quick-details"
                value={quickDetails}
                onChange={(event) => setQuickDetails(event.target.value)}
                placeholder="Descripción o notas opcionales para esta fecha"
                rows={3}
              />
            </div>
            <div
              className="form-actions field-full"
              style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}
            >
              <button
                className="secondary-button"
                type="button"
                onClick={() => setIsEventModalOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary-button" type="submit">
                Agendar en el {selectedDateFormatted}
              </button>
            </div>
          </form>
        </Modal>

        <div className="panel">
          <h3 className="panel-title">Eventos próximos</h3>
          {upcomingEvents.length === 0 ? (
            <div className="empty-state">
              No hay eventos próximos dentro del rango de meses configurado.
            </div>
          ) : (
            <ul className="mood-history">
              {upcomingEvents.map((event) => (
                <li key={event.id}>
                  <span>{formatDate(event.date)}</span>
                  <span>{event.title}</span>
                  <span>
                    <a href={event.targetHash} style={{ color: 'inherit' }}>
                      {event.description || event.category}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deletingReminderEvent)}
        title="Eliminar recordatorio del calendario"
        message={
          deletingReminderEvent
            ? `¿Querés eliminar el recordatorio "${deletingReminderEvent.title}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deletingReminderEvent?.reminderId) {
            removeReminder(deletingReminderEvent.reminderId)
          }
        }}
        onClose={() => setDeletingReminderEvent(null)}
      />
    </div>
  )
}

const buildEvents = (data: AppData, includeCompleted: boolean, currency: string = 'ARS') => {
  const events: CalendarEvent[] = []

  data.health.consultations.forEach((consult) => {
    events.push({
      id: `consult-${consult.id}`,
      date: consult.date,
      title: `Consulta: ${consult.doctor}`,
      description: consult.reason,
      category: 'salud',
      targetHash: '#health:consultations',
    })
    if (consult.nextVisitDate) {
      events.push({
        id: `consult-next-${consult.id}`,
        date: consult.nextVisitDate,
        title: `Próximo control: ${consult.doctor}`,
        description: consult.reason,
        category: 'salud',
        targetHash: '#health:consultations',
      })
    }
  })

  data.health.vaccines.forEach((vaccine) => {
    events.push({
      id: `vaccine-${vaccine.id}`,
      date: vaccine.date,
      title: `Vacuna ${vaccine.vaccine}`,
      description: vaccine.dose,
      category: 'salud',
      targetHash: '#health:vaccines',
    })
    if (vaccine.nextDoseDate) {
      events.push({
        id: `vaccine-next-${vaccine.id}`,
        date: vaccine.nextDoseDate,
        title: `Refuerzo ${vaccine.vaccine}`,
        description: vaccine.location,
        category: 'salud',
        targetHash: '#health:vaccines',
      })
    }
  })

  data.security.passwordEntries.forEach((entry) => {
    events.push({
      id: `pwd-${entry.id}`,
      date: entry.updatedAt,
      title: `Actualización contraseña ${entry.service}`,
      category: 'seguridad',
      targetHash: '#security:passwords',
    })
  })

  data.security.documents.forEach((doc) => {
    if (doc.expiresAt) {
      events.push({
        id: `doc-exp-${doc.id}`,
        date: doc.expiresAt,
        title: `Vencimiento: ${doc.name}`,
        description: doc.category || doc.fileName,
        category: 'seguridad',
        targetHash: '#security:documents',
      })
    }
  })

  data.personal.finances.forEach((transaction) => {
    events.push({
      id: `fin-${transaction.id}`,
      date: transaction.date,
      title: `${transaction.type === 'income' ? 'Ingreso' : 'Egreso'} ${transaction.category}`,
      description: formatCurrency(transaction.amount, currency),
      category: 'personal',
      targetHash: '#personal:finances',
    })
  })

  data.personal.vehicles.forEach((service) => {
    events.push({
      id: `veh-${service.id}`,
      date: service.date,
      title: `Servicio ${service.vehicleName}`,
      description: service.serviceType,
      category: 'personal',
      targetHash: '#personal:vehicles',
    })
    if (service.nextServiceDate) {
      events.push({
        id: `veh-next-${service.id}`,
        date: service.nextServiceDate,
        title: `Próximo service ${service.vehicleName}`,
        description: service.serviceType,
        category: 'personal',
        targetHash: '#personal:vehicles',
      })
    }
  })

  const workoutList = (data.personal.workouts ?? []) as WorkoutSession[]
  workoutList.forEach((workout) => {
    events.push({
      id: `workout-${workout.id}`,
      date: workout.date,
      title: `Entrenamiento: ${workout.title}`,
      description: `${workout.type}${workout.durationMinutes ? ` · ${workout.durationMinutes} min` : ''}`,
      category: 'personal',
      targetHash: '#personal:workouts',
    })
  })

  // Sincronización del ciclo menstrual para usuarias
  const cycle = data.health.menstrualCycle
  if (data.profile.gender === 'Femenino' && cycle) {
    const cycleEntries = cycle.entries || []
    cycleEntries.forEach((entry) => {
      events.push({
        id: `cycle-${entry.id}`,
        date: entry.startDate,
        title: `🌸 Inicio de período menstrual${entry.flow ? ` (${entry.flow})` : ''}`,
        description: entry.symptoms?.length ? `Síntomas: ${entry.symptoms.join(', ')}` : 'Período registrado',
        category: 'salud',
        targetHash: '#health:menstrual',
      })
      if (entry.endDate) {
        events.push({
          id: `cycle-end-${entry.id}`,
          date: entry.endDate,
          title: '🌸 Fin del período menstrual',
          description: 'Fin del sangrado registrado',
          category: 'salud',
          targetHash: '#health:menstrual',
        })
      }
    })

    // Proyecciones estimadas de próximos ciclos y ovulación
    if (cycleEntries.length > 0) {
      const sorted = cycleEntries.slice().sort((a, b) => b.startDate.localeCompare(a.startDate))
      const last = sorted[0]
      const avgCycle = cycle.averageCycleDays || 28
      const avgPeriod = cycle.averagePeriodDays || 5
      let nextDate = new Date(last.startDate + 'T00:00:00')

      for (let i = 1; i <= 3; i++) {
        nextDate = new Date(nextDate.getTime() + avgCycle * 24 * 60 * 60 * 1000)
        const nextKey = toLocalDateKey(nextDate)

        events.push({
          id: `pred-cycle-${i}`,
          date: nextKey,
          title: '🌸 Período menstrual estimado',
          description: `Inicio previsto de ciclo (${avgPeriod} días de duración estimada)`,
          category: 'salud',
          targetHash: '#health:menstrual',
        })

        // Ovulación estimada: ~14 días antes del próximo período
        const ovulationDate = new Date(nextDate.getTime() - 14 * 24 * 60 * 60 * 1000)
        const ovulationKey = toLocalDateKey(ovulationDate)

        events.push({
          id: `pred-ovulation-${i}`,
          date: ovulationKey,
          title: '🌺 Ovulación estimada (pico fértil)',
          description: 'Ventana de máxima probabilidad de fertilidad',
          category: 'salud',
          targetHash: '#health:menstrual',
        })
      }
    }
  }

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
      targetHash: '#utilities:reminders',
      reminderId: reminder.id,
      reminderDone: reminder.done,
    })
  })

  return events
}
