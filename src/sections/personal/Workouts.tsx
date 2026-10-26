import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import {
  Dumbbell,
  Plus,
  Trash2,
  Trophy,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import { usePreferences } from '../../preferences/context'
import type {
  WorkoutExercise,
  WorkoutSession,
  WorkoutSetType,
  WorkoutType,
} from '../../types'
import {
  formatDate,
  fromLocalDateOrDateTime,
  toLocalDateKey,
} from '../../utils/dates'

const WORKOUT_SET_TYPES: Array<{ value: WorkoutSetType; label: string; badge: string; color: string; bg: string }> = [
  { value: 'normal', label: 'Normal', badge: 'Normal', color: 'var(--color-text-muted)', bg: 'rgba(255,255,255,0.06)' },
  { value: 'biserie', label: '🔗 Biserie (Superset)', badge: 'Biserie', color: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)' },
  { value: 'dropset', label: '⚡ Drop Set', badge: 'Drop Set', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  { value: 'warmup', label: '🔥 Calentamiento', badge: 'Calent.', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  { value: 'failure', label: '💥 Al Fallo', badge: 'Fallo', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
]

const WORKOUT_TYPES: Array<{ value: WorkoutType; label: string }> = [
  { value: 'fuerza', label: 'Fuerza / Hipertrofia' },
  { value: 'running', label: 'Running / Carrera' },
  { value: 'funcional', label: 'Funcional / HIIT' },
  { value: 'ciclismo', label: 'Ciclismo / Bici' },
  { value: 'natacion', label: 'Natación' },
  { value: 'cardio', label: 'Cardio general' },
  { value: 'flexibilidad', label: 'Flexibilidad / Yoga' },
  { value: 'otro', label: 'Otro' },
]

const QUICK_EXERCISES = [
  'Press de banca',
  'Sentadilla',
  'Peso muerto',
  'Press militar',
  'Remo con barra',
  'Dominadas',
  'Fondos',
  'Hip Thrust',
  'Curl de bíceps',
  'Elevaciones laterales',
]

interface WorkoutFormState {
  title: string
  date: string
  type: WorkoutType
  durationMinutes: number | ''
  distanceKm: number | ''
  calories: number | ''
  notes: string
  exercises: WorkoutExercise[]
}

const createInitialFormState = (): WorkoutFormState => ({
  title: '',
  date: new Date().toISOString(),
  type: 'fuerza',
  durationMinutes: 45,
  distanceKm: '',
  calories: '',
  notes: '',
  exercises: [],
})

export const WorkoutsSection = () => {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const isImperial = preferences.unitSystem === 'imperial'

  const weightUnit = isImperial ? 'lb' : 'kg'
  const distanceUnit = isImperial ? 'mi' : 'km'

  const workouts = useMemo(() => data.personal.workouts ?? [], [data.personal.workouts])

  const [formState, setFormState] = useState<WorkoutFormState>(createInitialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<WorkoutFormState>(createInitialFormState)
  const [deletingSession, setDeletingSession] = useState<WorkoutSession | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  // Draft para agregar nuevo ejercicio en creación
  const [exerciseDraftName, setExerciseDraftName] = useState('')

  // Draft para agregar nuevo ejercicio en modal de edición
  const [editExerciseDraftName, setEditExerciseDraftName] = useState('')

  // Atajo para agregar ejercicio al formulario de creación
  const addExerciseToCreation = (nameToAdd: string) => {
    const clean = nameToAdd.trim()
    if (!clean) return
    const newEx: WorkoutExercise = {
      id: uuid(),
      name: clean,
      sets: [
        { reps: 10, weight: 0, rpe: 8, setType: 'normal', notes: '' },
        { reps: 10, weight: 0, rpe: 8, setType: 'normal', notes: '' },
        { reps: 10, weight: 0, rpe: 8, setType: 'normal', notes: '' },
      ],
    }
    setFormState((prev) => ({
      ...prev,
      exercises: [...prev.exercises, newEx],
    }))
    setExerciseDraftName('')
  }

  // Atajo para agregar ejercicio al modal de edición
  const addExerciseToEdit = (nameToAdd: string) => {
    const clean = nameToAdd.trim()
    if (!clean) return
    const newEx: WorkoutExercise = {
      id: uuid(),
      name: clean,
      sets: [
        { reps: 10, weight: 0, rpe: 8, setType: 'normal', notes: '' },
        { reps: 10, weight: 0, rpe: 8, setType: 'normal', notes: '' },
        { reps: 10, weight: 0, rpe: 8, setType: 'normal', notes: '' },
      ],
    }
    setEditFormState((prev) => ({
      ...prev,
      exercises: [...prev.exercises, newEx],
    }))
    setEditExerciseDraftName('')
  }

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.title.trim()) return

    const normalizedDate = fromLocalDateOrDateTime(formState.date, true)

    // Si está en imperial, convertimos distancia de millas a km para almacenamiento estándar
    let storedDistance: number | undefined
    if (typeof formState.distanceKm === 'number' && formState.distanceKm > 0) {
      storedDistance = isImperial
        ? Number((formState.distanceKm * 1.60934).toFixed(2))
        : Number(formState.distanceKm)
    }

    // Normalizar pesos de ejercicios y preservar tipo de serie y notas
    const normalizedExercises = formState.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        setType: s.setType || 'normal',
        notes: s.notes?.trim() || undefined,
        weight:
          typeof s.weight === 'number' && s.weight > 0
            ? isImperial
              ? Number((s.weight / 2.20462).toFixed(2))
              : s.weight
            : 0,
      })),
    }))

    const newSession: WorkoutSession = {
      id: uuid(),
      title: formState.title.trim(),
      date: normalizedDate,
      type: formState.type,
      durationMinutes:
        typeof formState.durationMinutes === 'number' ? formState.durationMinutes : undefined,
      distanceKm: storedDistance,
      calories: typeof formState.calories === 'number' ? formState.calories : undefined,
      notes: formState.notes.trim() || undefined,
      exercises: normalizedExercises,
    }

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        workouts: [newSession, ...(previous.personal.workouts ?? [])],
      },
    }))

    setFormState(createInitialFormState())
  }

  const startEdit = (session: WorkoutSession) => {
    setEditingId(session.id)

    // Si es imperial, convertimos los km a millas para mostrarlos en el input
    const displayDistance =
      typeof session.distanceKm === 'number'
        ? isImperial
          ? Number((session.distanceKm / 1.60934).toFixed(2))
          : session.distanceKm
        : ''

    // Convertir pesos a lb si es imperial para el formulario y preservar tipo y notas
    const displayExercises = session.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        setType: s.setType || 'normal',
        notes: s.notes || '',
        weight:
          typeof s.weight === 'number' && s.weight > 0
            ? isImperial
              ? Number((s.weight * 2.20462).toFixed(1))
              : s.weight
            : 0,
      })),
    }))

    setEditFormState({
      title: session.title,
      date: session.date,
      type: session.type,
      durationMinutes: session.durationMinutes ?? '',
      distanceKm: displayDistance,
      calories: session.calories ?? '',
      notes: session.notes ?? '',
      exercises: displayExercises,
    })
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.title.trim()) return

    const normalizedDate = fromLocalDateOrDateTime(editFormState.date, true)

    let storedDistance: number | undefined
    if (typeof editFormState.distanceKm === 'number' && editFormState.distanceKm > 0) {
      storedDistance = isImperial
        ? Number((editFormState.distanceKm * 1.60934).toFixed(2))
        : Number(editFormState.distanceKm)
    }

    const normalizedExercises = editFormState.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        setType: s.setType || 'normal',
        notes: s.notes?.trim() || undefined,
        weight:
          typeof s.weight === 'number' && s.weight > 0
            ? isImperial
              ? Number((s.weight / 2.20462).toFixed(2))
              : s.weight
            : 0,
      })),
    }))

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        workouts: (previous.personal.workouts ?? []).map((w) =>
          w.id === editingId
            ? {
                ...w,
                title: editFormState.title.trim(),
                date: normalizedDate,
                type: editFormState.type,
                durationMinutes:
                  typeof editFormState.durationMinutes === 'number'
                    ? editFormState.durationMinutes
                    : undefined,
                distanceKm: storedDistance,
                calories:
                  typeof editFormState.calories === 'number'
                    ? editFormState.calories
                    : undefined,
                notes: editFormState.notes.trim() || undefined,
                exercises: normalizedExercises,
              }
            : w,
        ),
      },
    }))

    setEditingId(null)
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        workouts: (previous.personal.workouts ?? []).filter((w) => w.id !== id),
      },
    }))
    if (editingId === id) {
      setEditingId(null)
    }
  }

  // Filtrado y orden
  const filteredWorkouts = useMemo(() => {
    const list =
      filterType === 'all'
        ? workouts
        : workouts.filter((item) => item.type === filterType)
    return [...list].sort((a, b) => (a.date > b.date ? -1 : 1))
  }, [workouts, filterType])

  // Estadísticas globales del mes actual
  const stats = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    let thisMonthSessions = 0
    let thisMonthMinutes = 0
    let totalVolumeKg = 0
    let totalDistanceKm = 0

    workouts.forEach((w) => {
      const d = new Date(w.date)
      const isThisMonth = d.getFullYear() === currentYear && d.getMonth() === currentMonth

      if (isThisMonth) {
        thisMonthSessions += 1
        thisMonthMinutes += w.durationMinutes || 0
      }

      if (w.distanceKm) {
        totalDistanceKm += w.distanceKm
      }

      w.exercises.forEach((ex) => {
        ex.sets.forEach((set) => {
          if (set.reps && set.weight) {
            totalVolumeKg += set.reps * set.weight
          }
        })
      })
    })

    const displayVolume = isImperial
      ? Number((totalVolumeKg * 2.20462).toFixed(0))
      : Math.round(totalVolumeKg)

    const displayDistance = isImperial
      ? Number((totalDistanceKm / 1.60934).toFixed(1))
      : Number(totalDistanceKm.toFixed(1))

    return {
      totalSessions: workouts.length,
      thisMonthSessions,
      thisMonthHours: (thisMonthMinutes / 60).toFixed(1),
      displayVolume,
      displayDistance,
    }
  }, [workouts, isImperial])

  // Usuario y perfil físico
  const userWeight = data.profile.weightKg

  return (
    <div>
      <SectionHeader
        title="Entrenamientos"
        subtitle="Registrá tus rutinas de fuerza, cardio, rendimiento físico y volumen corporal"
      />

      <div className="section-body">
        {/* Panel de Estadísticas Físicas */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-title">Sesiones del mes</span>
            <span className="stat-value">{stats.thisMonthSessions}</span>
            <span className="panel-subtitle">Total histórico: {stats.totalSessions}</span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Tiempo entrenado este mes</span>
            <span className="stat-value">{stats.thisMonthHours} hs</span>
            <span className="panel-subtitle">Constancia en actividad</span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Volumen acumulado</span>
            <span className="stat-value">
              {stats.displayVolume.toLocaleString('es-AR')} {weightUnit}
            </span>
            <span className="panel-subtitle">Cargas totales levantadas</span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Distancia acumulada</span>
            <span className="stat-value">
              {stats.displayDistance} {distanceUnit}
            </span>
            <span className="panel-subtitle">Running, ciclismo y cardio</span>
          </div>
        </div>

        {/* Notificación de correlación con perfil si tiene peso cargado */}
        {userWeight ? (
          <div
            className="subpanel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Trophy size={18} style={{ color: 'var(--color-accent-blue)', flexShrink: 0 }} />
              <div style={{ fontSize: '0.875rem' }}>
                <span>
                  Peso corporal de referencia sincronizado con tu perfil:{' '}
                  <strong>
                    {isImperial
                      ? `${(userWeight * 2.20462).toFixed(1)} lb`
                      : `${userWeight} kg`}
                  </strong>
                  . Tus ratios de fuerza se calculan en relación con tu masa actual.
                </span>
              </div>
            </div>
            <a className="secondary-button" href="#profile:settings" style={{ fontSize: '0.8125rem' }}>
              Ver perfil corporal
            </a>
          </div>
        ) : null}

        {/* Panel de Nueva Sesión */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Registrar nueva sesión de entrenamiento</h3>
          </div>

          <form className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }} onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="workout-title">Nombre o foco de la sesión</label>
              <input
                id="workout-title"
                value={formState.title}
                onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                placeholder="Ej. Pecho y tríceps, Fondo 10k, Pierna pesado"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="workout-type">Tipo de disciplina</label>
              <Select
                id="workout-type"
                value={formState.type}
                onChange={(value) =>
                  setFormState({ ...formState, type: value as WorkoutType })
                }
                options={WORKOUT_TYPES}
                ariaLabel="Tipo de disciplina"
              />
            </div>

            <div className="field">
              <label htmlFor="workout-date">Fecha</label>
              <DatePicker
                id="workout-date"
                value={toLocalDateKey(formState.date)}
                onChange={(value) =>
                  setFormState({
                    ...formState,
                    date: fromLocalDateOrDateTime(value, true),
                  })
                }
                ariaLabel="Fecha del entrenamiento"
              />
            </div>

            <div className="field">
              <label htmlFor="workout-duration">Duración (minutos)</label>
              <input
                id="workout-duration"
                type="number"
                min="1"
                value={formState.durationMinutes}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    durationMinutes: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                placeholder="45"
              />
            </div>

            {/* Campos condicionales para cardio / running / ciclismo */}
            {(formState.type === 'running' ||
              formState.type === 'ciclismo' ||
              formState.type === 'natacion' ||
              formState.type === 'cardio') && (
              <>
                <div className="field">
                  <label htmlFor="workout-distance">
                    Distancia recorrida ({distanceUnit})
                  </label>
                  <input
                    id="workout-distance"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formState.distanceKm}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        distanceKm: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    placeholder="Ej. 7.5"
                  />
                </div>
                <div className="field">
                  <label htmlFor="workout-calories">Calorías quemadas (kcal)</label>
                  <input
                    id="workout-calories"
                    type="number"
                    min="0"
                    value={formState.calories}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        calories: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    placeholder="Ej. 420"
                  />
                </div>
              </>
            )}

            {/* Constructor de Ejercicios y Series (Fuerza / Funcional) */}
            <div className="field-full" style={{ marginTop: '0.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Dumbbell size={18} style={{ color: 'var(--color-accent-blue)' }} />
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>
                    Ejercicios y series de la sesión
                  </h4>
                </div>
                <span className="panel-subtitle">
                  {formState.exercises.length}{' '}
                  {formState.exercises.length === 1 ? 'ejercicio' : 'ejercicios'} añadidos
                </span>
              </div>

              {/* Input + atajos para sumar ejercicios */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <input
                  value={exerciseDraftName}
                  onChange={(e) => setExerciseDraftName(e.target.value)}
                  placeholder="Escribí un ejercicio (ej. Press de banca, Sentadilla)..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addExerciseToCreation(exerciseDraftName)
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => addExerciseToCreation(exerciseDraftName)}
                >
                  <Plus size={16} aria-hidden />
                  Agregar
                </button>
              </div>

              {/* Sugerencias rápidas de ejercicios */}
              <div
                className="tag-suggestions"
                aria-label="Ejercicios frecuentes"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.75rem',
                }}
              >
                <span
                  className="tag-suggestions-label"
                  style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}
                >
                  Ejercicios comunes:
                </span>
                {QUICK_EXERCISES.map((exName) => (
                  <button
                    key={exName}
                    type="button"
                    className="tag-suggestion-chip"
                    onClick={() => addExerciseToCreation(exName)}
                  >
                    + {exName}
                  </button>
                ))}
              </div>

              {/* Listado de ejercicios en el formulario */}
              {formState.exercises.map((exercise, exIndex) => (
                <div
                  key={exercise.id}
                  className="subpanel"
                  style={{
                    marginBottom: '0.75rem',
                    padding: '0.875rem 1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <strong style={{ fontSize: '0.9375rem' }}>
                      {exIndex + 1}. {exercise.name}
                    </strong>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          exercises: prev.exercises.filter((_, idx) => idx !== exIndex),
                        }))
                      }
                    >
                      <Trash2 size={14} aria-hidden />
                      Quitar
                    </button>
                  </div>

                  {/* Tabla de series */}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ margin: 0, fontSize: '0.8125rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '55px' }}>Serie</th>
                          <th style={{ width: '135px' }}>Tipo</th>
                          <th style={{ width: '85px' }}>Reps</th>
                          <th style={{ width: '95px' }}>Carga ({weightUnit})</th>
                          <th style={{ width: '75px' }}>RPE (1-10)</th>
                          <th>Notas / Comentario de la serie</th>
                          <th style={{ width: '35px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {exercise.sets.map((set, setIndex) => {
                          const currentTypeObj = WORKOUT_SET_TYPES.find((t) => t.value === (set.setType || 'normal'))
                          return (
                            <tr key={setIndex}>
                              <td>
                                <span
                                  className="badge badge-info"
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '2px 6px',
                                    background: currentTypeObj?.bg,
                                    color: currentTypeObj?.color,
                                    borderColor: currentTypeObj?.color,
                                  }}
                                >
                                  #{setIndex + 1}
                                </span>
                              </td>
                              <td>
                                <select
                                  value={set.setType || 'normal'}
                                  onChange={(e) => {
                                    const val = e.target.value as WorkoutSetType
                                    setFormState((prev) => {
                                      const nextExercises = [...prev.exercises]
                                      nextExercises[exIndex].sets[setIndex].setType = val
                                      return { ...prev, exercises: nextExercises }
                                    })
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.25rem 0.35rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'inherit',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                  }}
                                >
                                  {WORKOUT_SET_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  value={set.reps || ''}
                                  onChange={(e) => {
                                    const repsVal = Number(e.target.value) || 0
                                    setFormState((prev) => {
                                      const nextExercises = [...prev.exercises]
                                      nextExercises[exIndex].sets[setIndex].reps = repsVal
                                      return { ...prev, exercises: nextExercises }
                                    })
                                  }}
                                  style={{ width: '100%', padding: '0.25rem 0.5rem' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={set.weight ?? ''}
                                  onChange={(e) => {
                                    const weightVal = Number(e.target.value) || 0
                                    setFormState((prev) => {
                                      const nextExercises = [...prev.exercises]
                                      nextExercises[exIndex].sets[setIndex].weight = weightVal
                                      return { ...prev, exercises: nextExercises }
                                    })
                                  }}
                                  style={{ width: '100%', padding: '0.25rem 0.5rem' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={set.rpe ?? ''}
                                  onChange={(e) => {
                                    const rpeVal = Number(e.target.value) || undefined
                                    setFormState((prev) => {
                                      const nextExercises = [...prev.exercises]
                                      nextExercises[exIndex].sets[setIndex].rpe = rpeVal
                                      return { ...prev, exercises: nextExercises }
                                    })
                                  }}
                                  placeholder="8"
                                  style={{ width: '100%', padding: '0.25rem 0.5rem' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={set.notes || ''}
                                  onChange={(e) => {
                                    const noteVal = e.target.value
                                    setFormState((prev) => {
                                      const nextExercises = [...prev.exercises]
                                      nextExercises[exIndex].sets[setIndex].notes = noteVal
                                      return { ...prev, exercises: nextExercises }
                                    })
                                  }}
                                  placeholder="Ej. pausa 2s, al fallo, superset..."
                                  style={{ width: '100%', minWidth: '140px', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="tag-remove"
                                  onClick={() => {
                                    setFormState((prev) => {
                                      const nextExercises = [...prev.exercises]
                                      nextExercises[exIndex].sets = nextExercises[
                                        exIndex
                                      ].sets.filter((_, sIdx) => sIdx !== setIndex)
                                      return { ...prev, exercises: nextExercises }
                                    })
                                  }}
                                  title="Eliminar serie"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                      onClick={() => {
                        setFormState((prev) => {
                          const nextExercises = [...prev.exercises]
                          const lastSet =
                            exercise.sets[exercise.sets.length - 1] ?? {
                              reps: 10,
                              weight: 0,
                              rpe: 8,
                              setType: 'normal',
                              notes: '',
                            }
                          nextExercises[exIndex].sets.push({
                            reps: lastSet.reps,
                            weight: lastSet.weight,
                            rpe: lastSet.rpe,
                            setType: lastSet.setType ?? 'normal',
                            notes: '',
                          })
                          return { ...prev, exercises: nextExercises }
                        })
                      }}
                    >
                      + Agregar serie
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="field field-full">
              <label htmlFor="workout-notes">Notas y sensaciones de la sesión</label>
              <textarea
                id="workout-notes"
                value={formState.notes}
                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                placeholder="Observaciones de energía, descanso previo, recuperación muscular..."
              />
            </div>

            <div className="form-actions field-full">
              <button className="primary-button" type="submit">
                Guardar entrenamiento
              </button>
            </div>
          </form>
        </div>

        {/* Panel de Historial de Entrenamientos */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Historial de entrenamientos</h3>
              <p className="panel-subtitle">
                Revisá tus registros pasados, cargas levantadas y marcas personales
              </p>
            </div>

            <Select
              value={filterType}
              onChange={(val) => setFilterType(val)}
              options={[{ value: 'all', label: 'Todas las disciplinas' }, ...WORKOUT_TYPES]}
              ariaLabel="Filtrar por disciplina"
            />
          </div>

          {filteredWorkouts.length === 0 ? (
            <div className="empty-state">
              Todavía no registraste entrenamientos en esta categoría.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredWorkouts.map((session) => {
                const sessionVolume = session.exercises.reduce((acc, ex) => {
                  return (
                    acc +
                    ex.sets.reduce((sAcc, s) => {
                      return sAcc + (s.reps || 0) * (s.weight || 0)
                    }, 0)
                  )
                }, 0)

                const displaySessionVolume = isImperial
                  ? Math.round(sessionVolume * 2.20462)
                  : Math.round(sessionVolume)

                return (
                  <div key={session.id} className="subpanel">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                            {session.type}
                          </span>
                          <strong style={{ fontSize: '1rem' }}>{session.title}</strong>
                        </div>
                        <span className="panel-subtitle" style={{ display: 'block', marginTop: '0.25rem' }}>
                          {formatDate(session.date)}
                          {session.durationMinutes ? ` · ${session.durationMinutes} min` : ''}
                          {session.distanceKm
                            ? ` · ${
                                isImperial
                                  ? (session.distanceKm / 1.60934).toFixed(1)
                                  : session.distanceKm
                              } ${distanceUnit}`
                            : ''}
                          {session.calories ? ` · ${session.calories} kcal` : ''}
                          {sessionVolume > 0
                            ? ` · Volumen: ${displaySessionVolume.toLocaleString('es-AR')} ${weightUnit}`
                            : ''}
                        </span>
                      </div>

                      <div className="section-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => startEdit(session)}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setDeletingSession(session)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    {session.exercises.length > 0 ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '0.5rem',
                          marginTop: '0.5rem',
                        }}
                      >
                        {session.exercises.map((ex) => (
                          <div
                            key={ex.id}
                            className="smart-card"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                          >
                            <strong>{ex.name}</strong>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.35rem' }}>
                              {ex.sets.map((set, sIdx) => {
                                const w = isImperial
                                  ? Math.round((set.weight || 0) * 2.20462)
                                  : set.weight || 0
                                const typeObj = WORKOUT_SET_TYPES.find((t) => t.value === set.setType)
                                const isSpecial = set.setType && set.setType !== 'normal'
                                return (
                                  <div
                                    key={sIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      flexWrap: 'wrap',
                                      gap: '0.35rem',
                                      fontSize: '0.78rem',
                                    }}
                                  >
                                    <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', minWidth: '22px' }}>
                                      #{sIdx + 1}
                                    </span>
                                    {isSpecial && typeObj ? (
                                      <span
                                        style={{
                                          fontSize: '0.68rem',
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          background: typeObj.bg,
                                          color: typeObj.color,
                                          fontWeight: 600,
                                        }}
                                      >
                                        {typeObj.label}
                                      </span>
                                    ) : null}
                                    <span>
                                      <strong>{set.reps}</strong> reps {w > 0 ? `× ${w} ${weightUnit}` : '(peso corporal)'}
                                      {set.rpe ? ` · RPE ${set.rpe}` : ''}
                                    </span>
                                    {set.notes ? (
                                      <span
                                        style={{
                                          fontSize: '0.72rem',
                                          color: 'var(--color-text-muted)',
                                          fontStyle: 'italic',
                                          background: 'rgba(255,255,255,0.04)',
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                        }}
                                      >
                                        💬 {set.notes}
                                      </span>
                                    ) : null}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {session.notes ? (
                      <p
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--color-text-muted)',
                          margin: '0.5rem 0 0',
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {session.notes}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edición sin Scroll */}
      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Editar entrenamiento"
        subtitle="Modificá las cargas, series, tiempos y notas de tu sesión"
      >
        <form onSubmit={handleUpdate} className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field">
            <label htmlFor="edit-workout-title">Nombre de la sesión</label>
            <input
              id="edit-workout-title"
              value={editFormState.title}
              onChange={(e) => setEditFormState({ ...editFormState, title: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="edit-workout-type">Tipo de disciplina</label>
            <Select
              id="edit-workout-type"
              value={editFormState.type}
              onChange={(val) => setEditFormState({ ...editFormState, type: val as WorkoutType })}
              options={WORKOUT_TYPES}
              ariaLabel="Tipo de disciplina"
            />
          </div>

          <div className="field">
            <label htmlFor="edit-workout-date">Fecha</label>
            <DatePicker
              id="edit-workout-date"
              value={toLocalDateKey(editFormState.date)}
              onChange={(val) =>
                setEditFormState({
                  ...editFormState,
                  date: fromLocalDateOrDateTime(val, true),
                })
              }
              ariaLabel="Fecha del entrenamiento"
            />
          </div>

          <div className="field">
            <label htmlFor="edit-workout-duration">Duración (minutos)</label>
            <input
              id="edit-workout-duration"
              type="number"
              min="1"
              value={editFormState.durationMinutes}
              onChange={(e) =>
                setEditFormState({
                  ...editFormState,
                  durationMinutes: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            />
          </div>

          {/* Constructor de ejercicios en modal */}
          <div className="field-full" style={{ marginTop: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '0.5rem',
              }}
            >
              <input
                value={editExerciseDraftName}
                onChange={(e) => setEditExerciseDraftName(e.target.value)}
                placeholder="Añadir ejercicio..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addExerciseToEdit(editExerciseDraftName)
                  }
                }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => addExerciseToEdit(editExerciseDraftName)}
              >
                + Añadir
              </button>
            </div>

            {editFormState.exercises.map((exercise, exIndex) => (
              <div
                key={exercise.id}
                className="subpanel"
                style={{ marginBottom: '0.5rem', padding: '0.75rem' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.35rem',
                  }}
                >
                  <strong>
                    {exIndex + 1}. {exercise.name}
                  </strong>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                    onClick={() =>
                      setEditFormState((prev) => ({
                        ...prev,
                        exercises: prev.exercises.filter((_, idx) => idx !== exIndex),
                      }))
                    }
                  >
                    Quitar
                  </button>
                </div>

                {exercise.sets.map((set, setIndex) => {
                  const currentTypeObj = WORKOUT_SET_TYPES.find((t) => t.value === (set.setType || 'normal'))
                  return (
                    <div
                      key={setIndex}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 110px 65px 75px 1fr auto',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <span
                        className="badge badge-info"
                        style={{
                          fontSize: '0.7rem',
                          padding: '1px 5px',
                          background: currentTypeObj?.bg,
                          color: currentTypeObj?.color,
                          borderColor: currentTypeObj?.color,
                        }}
                      >
                        #{setIndex + 1}
                      </span>
                      <select
                        value={set.setType || 'normal'}
                        onChange={(e) => {
                          const val = e.target.value as WorkoutSetType
                          setEditFormState((prev) => {
                            const n = [...prev.exercises]
                            n[exIndex].sets[setIndex].setType = val
                            return { ...prev, exercises: n }
                          })
                        }}
                        style={{
                          padding: '0.2rem 0.3rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'inherit',
                          border: '1px solid rgba(255,255,255,0.12)',
                        }}
                      >
                        {WORKOUT_SET_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={set.reps || ''}
                        onChange={(e) => {
                          const r = Number(e.target.value) || 0
                          setEditFormState((prev) => {
                            const n = [...prev.exercises]
                            n[exIndex].sets[setIndex].reps = r
                            return { ...prev, exercises: n }
                          })
                        }}
                        placeholder="Reps"
                        style={{ padding: '0.2rem 0.35rem', fontSize: '0.75rem' }}
                      />
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={set.weight ?? ''}
                        onChange={(e) => {
                          const w = Number(e.target.value) || 0
                          setEditFormState((prev) => {
                            const n = [...prev.exercises]
                            n[exIndex].sets[setIndex].weight = w
                            return { ...prev, exercises: n }
                          })
                        }}
                        placeholder={weightUnit}
                        style={{ padding: '0.2rem 0.35rem', fontSize: '0.75rem' }}
                      />
                      <input
                        type="text"
                        value={set.notes || ''}
                        onChange={(e) => {
                          const noteVal = e.target.value
                          setEditFormState((prev) => {
                            const n = [...prev.exercises]
                            n[exIndex].sets[setIndex].notes = noteVal
                            return { ...prev, exercises: n }
                          })
                        }}
                        placeholder="Nota de serie..."
                        style={{ padding: '0.2rem 0.35rem', fontSize: '0.75rem' }}
                      />
                      <button
                        type="button"
                        className="tag-remove"
                        onClick={() => {
                          setEditFormState((prev) => {
                            const n = [...prev.exercises]
                            n[exIndex].sets = n[exIndex].sets.filter((_, sIdx) => sIdx !== setIndex)
                            return { ...prev, exercises: n }
                          })
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}

                <button
                  type="button"
                  className="secondary-button"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', marginTop: '0.35rem' }}
                  onClick={() => {
                    setEditFormState((prev) => {
                      const n = [...prev.exercises]
                      const last = exercise.sets[exercise.sets.length - 1] ?? { reps: 10, weight: 0, setType: 'normal', notes: '' }
                      n[exIndex].sets.push({ reps: last.reps, weight: last.weight, setType: last.setType ?? 'normal', notes: '' })
                      return { ...prev, exercises: n }
                    })
                  }}
                >
                  + Serie
                </button>
              </div>
            ))}
          </div>

          <div className="field field-full">
            <label htmlFor="edit-workout-notes">Notas</label>
            <textarea
              id="edit-workout-notes"
              value={editFormState.notes}
              onChange={(e) => setEditFormState({ ...editFormState, notes: e.target.value })}
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

      {/* ConfirmModal para eliminación */}
      <ConfirmModal
        open={Boolean(deletingSession)}
        title="Eliminar sesión de entrenamiento"
        message={
          deletingSession
            ? `¿Querés eliminar el registro de "${deletingSession.title}" del ${formatDate(
                deletingSession.date,
              )}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar entrenamiento"
        onConfirm={() => {
          if (deletingSession) {
            handleRemove(deletingSession.id)
            setDeletingSession(null)
          }
        }}
        onClose={() => setDeletingSession(null)}
      />
    </div>
  )
}
