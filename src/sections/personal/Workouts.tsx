import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Timer,
  Play,
  Pause,
  Zap,
  Check,
  Dumbbell,
  Plus,
  Trash2,
  Trophy,
  Copy,
  FileText,
  Search,
  Sparkles,
  Activity,
  ChevronDown,
  Edit3,
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
import { exportWorkoutsToPDF } from '../../utils/workoutPdfExport'
import { playRestTimerSound, triggerHapticFeedback } from '../../utils/audioHaptics'

const WORKOUT_SET_TYPES: Array<{
  value: WorkoutSetType
  label: string
  badge: string
  color: string
  bg: string
}> = [
  {
    value: 'normal',
    label: 'Normal',
    badge: 'Normal',
    color: 'var(--color-text-muted)',
    bg: 'rgba(255,255,255,0.06)',
  },
  {
    value: 'biserie',
    label: '🔗 Biserie (Superset)',
    badge: 'Biserie',
    color: '#818cf8',
    bg: 'rgba(129, 140, 248, 0.15)',
  },
  {
    value: 'dropset',
    label: '⚡ Drop Set',
    badge: 'Drop Set',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.15)',
  },
  {
    value: 'warmup',
    label: '🔥 Calentamiento',
    badge: 'Calent.',
    color: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.15)',
  },
  {
    value: 'failure',
    label: '💥 Al Fallo',
    badge: 'Fallo',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
  },
]

const WORKOUT_TYPES: Array<{ value: WorkoutType; label: string; isDistance?: boolean }> = [
  { value: 'fuerza', label: '🏋️ Fuerza / Hipertrofia' },
  { value: 'running', label: '🏃 Running / Carrera', isDistance: true },
  { value: 'ciclismo', label: '🚴 Ciclismo / Bici', isDistance: true },
  { value: 'caminata', label: '🚶 Caminata / Paseo', isDistance: true },
  { value: 'trekking', label: '🥾 Trekking / Senderismo', isDistance: true },
  { value: 'natacion', label: '🏊 Natación', isDistance: true },
  { value: 'funcional', label: '⚡ Funcional / HIIT' },
  { value: 'cardio', label: '❤️ Cardio general', isDistance: true },
  { value: 'flexibilidad', label: '🧘 Flexibilidad / Yoga' },
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
  'Prensa de piernas',
  'Extensión de cuádriceps',
  'Gemelos en máquina',
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

const computePace = (
  distanceKm: number | '',
  durationMinutes: number | '',
  type: WorkoutType,
): string => {
  if (
    typeof distanceKm !== 'number' ||
    typeof durationMinutes !== 'number' ||
    distanceKm <= 0 ||
    durationMinutes <= 0
  ) {
    return ''
  }

  if (type === 'ciclismo') {
    const kmh = (distanceKm / (durationMinutes / 60)).toFixed(1)
    return `${kmh} km/h`
  }
  if (type === 'natacion') {
    const minPer100m = durationMinutes / (distanceKm * 10)
    const mins = Math.floor(minPer100m)
    const secs = Math.round((minPer100m - mins) * 60)
    return `${mins}:${String(secs).padStart(2, '0')} /100m`
  }
  // running, caminata, trekking, cardio
  const minPerKm = durationMinutes / distanceKm
  const mins = Math.floor(minPerKm)
  const secs = Math.round((minPerKm - mins) * 60)
  return `${mins}:${String(secs).padStart(2, '0')} min/km`
}

export const WorkoutsSection = () => {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const isImperial = preferences.unitSystem === 'imperial'
  const userName = data.profile.nickName || data.profile.fullName || 'Atleta'

  const weightUnit = isImperial ? 'lb' : 'kg'
  const distanceUnit = isImperial ? 'mi' : 'km'

  const workouts = useMemo(() => data.personal.workouts ?? [], [data.personal.workouts])

  // Solapas: 'new' (default) o 'history'
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new')

  // Filtros de historial
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | 'quarter' | 'year'>('all')
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(10)

  // Formulario de creación
  const [formState, setFormState] = useState<WorkoutFormState>(createInitialFormState)
  const [exerciseDraftName, setExerciseDraftName] = useState('')

  // Modo Planificación vs Modo Gym en Vivo
  const [creationMode, setCreationMode] = useState<'plan' | 'live'>('plan')

  // Estado Sesión en Vivo
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0)

  // Temporizador de descanso (Rest Timer)
  const [restTimerSeconds, setRestTimerSeconds] = useState(60)
  const [restRemaining, setRestRemaining] = useState(0)
  const [restActive, setRestActive] = useState(false)
  const [finishModalOpen, setFinishModalOpen] = useState(false)

  // Cronómetro de sesión
  useEffect(() => {
    let interval: any = null
    if (sessionActive) {
      interval = setInterval(() => {
        setSessionElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [sessionActive])

  // Countdown timer de descanso
  useEffect(() => {
    let interval: any = null
    if (restActive && restRemaining > 0) {
      interval = setInterval(() => {
        setRestRemaining((prev) => {
          if (prev <= 1) {
            playRestTimerSound()
            triggerHapticFeedback('double')
            setRestActive(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [restActive, restRemaining])

  const startRestTimer = (seconds?: number) => {
    const s = seconds || restTimerSeconds
    setRestTimerSeconds(s)
    setRestRemaining(s)
    setRestActive(true)
    triggerHapticFeedback('impact')
  }

  const stopRestTimer = () => {
    setRestActive(false)
    setRestRemaining(0)
  }

  const formatStopwatch = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Toggle set done en Live Mode
  const toggleLiveSetDone = (exerciseId: string, setIndex: number) => {
    setFormState((prev) => {
      const nextExercises = prev.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex
        const nextSets = ex.sets.map((s, idx) => {
          if (idx !== setIndex) return s
          const nextDone = !s.done
          if (nextDone) {
            // Disparar timer de descanso al completar serie
            setTimeout(() => startRestTimer(restTimerSeconds), 50)
          }
          return { ...s, done: nextDone }
        })
        return { ...ex, sets: nextSets }
      })
      return { ...prev, exercises: nextExercises }
    })
  }

  const adjustLiveSetReps = (exerciseId: string, setIndex: number, delta: number) => {
    setFormState((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex
        return {
          ...ex,
          sets: ex.sets.map((s, idx) =>
            idx === setIndex ? { ...s, reps: Math.max(1, s.reps + delta) } : s
          ),
        }
      }),
    }))
  }

  const adjustLiveSetWeight = (exerciseId: string, setIndex: number, delta: number) => {
    setFormState((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex
        return {
          ...ex,
          sets: ex.sets.map((s, idx) =>
            idx === setIndex
              ? { ...s, weight: Math.max(0, Number(((s.weight ?? 0) + delta).toFixed(1))) }
              : s
          ),
        }
      }),
    }))
  }

  // Métricas en vivo
  const liveStats = useMemo(() => {
    let completedSets = 0
    let totalSets = 0
    let totalVolumeKg = 0

    formState.exercises.forEach((ex) => {
      ex.sets.forEach((s) => {
        totalSets += 1
        if (s.done) {
          completedSets += 1
        }
        if (s.reps && s.weight) {
          totalVolumeKg += s.reps * s.weight
        }
      })
    })

    return {
      completedSets,
      totalSets,
      totalVolumeKg,
      progressPercent: totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0,
    }
  }, [formState.exercises])

  const handleFinishLiveSession = () => {
    const elapsedMinutes = Math.max(1, Math.round(sessionElapsedSeconds / 60))
    const normalizedDate = fromLocalDateOrDateTime(formState.date || new Date().toISOString(), true)

    const normalizedExercises = formState.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        setType: s.setType || 'normal',
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
      title: formState.title.trim() || 'Entrenamiento en Gym',
      date: normalizedDate,
      type: formState.type,
      durationMinutes: elapsedMinutes,
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

    setSessionActive(false)
    setSessionElapsedSeconds(0)
    setRestActive(false)
    setFinishModalOpen(false)
    setFormState(createInitialFormState())
    setCreationMode('plan')
    setSaveSuccessMsg(`¡Excelente sesión! ${elapsedMinutes} minutos entrenados y ${liveStats.totalVolumeKg.toLocaleString('es-AR')} kg levantados.`)
    setTimeout(() => setSaveSuccessMsg(null), 5000)
  }

  // Edición
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<WorkoutFormState>(createInitialFormState)
  const [editExerciseDraftName, setEditExerciseDraftName] = useState('')

  // Eliminación
  const [deletingSession, setDeletingSession] = useState<WorkoutSession | null>(null)

  // Mensaje de éxito tras guardar
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null)

  // Predicción inteligente de rutina
  const suggestedRoutine = useMemo(() => {
    if (workouts.length === 0) return null

    const routineMap = new Map<string, { session: WorkoutSession; lastDate: string; count: number }>()

    workouts.forEach((w) => {
      const key = w.title.trim().toLowerCase()
      if (!key) return
      const existing = routineMap.get(key)
      if (!existing) {
        routineMap.set(key, { session: w, lastDate: w.date, count: 1 })
      } else {
        existing.count += 1
        if (w.date > existing.lastDate) {
          existing.lastDate = w.date
          existing.session = w
        }
      }
    })

    const routinesList = Array.from(routineMap.values())
      .filter((r) => r.session.exercises.length > 0 || (r.session.distanceKm && r.session.distanceKm > 0))
      .sort((a, b) => a.lastDate.localeCompare(b.lastDate))

    if (routinesList.length === 0) return null

    const candidate = routinesList[0]
    const lastTime = new Date(candidate.lastDate).getTime()
    const daysAgo = Math.max(1, Math.floor((Date.now() - lastTime) / (1000 * 60 * 60 * 24)))

    return {
      title: candidate.session.title,
      type: candidate.session.type,
      daysAgo,
      session: candidate.session,
    }
  }, [workouts])

  // Cargar una rutina previa como plantilla en el formulario de creación
  const loadRoutineAsTemplate = (session: WorkoutSession) => {
    const clonedExercises = session.exercises.map((ex) => ({
      id: uuid(),
      name: ex.name,
      sets: ex.sets.map((s) => ({
        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe,
        setType: s.setType || 'normal',
        notes: s.notes || '',
      })),
    }))

    setFormState({
      title: session.title,
      date: new Date().toISOString(),
      type: session.type,
      durationMinutes: session.durationMinutes ?? 45,
      distanceKm: session.distanceKm ?? '',
      calories: session.calories ?? '',
      notes: session.notes ?? '',
      exercises: clonedExercises,
    })

    setActiveTab('new')
    setSaveSuccessMsg(`Rutina "${session.title}" cargada como plantilla. ¡Ajustá tus cargas e iniciá tu sesión!`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Atajos para agregar ejercicios
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

    let storedDistance: number | undefined
    if (typeof formState.distanceKm === 'number' && formState.distanceKm > 0) {
      storedDistance = isImperial
        ? Number((formState.distanceKm * 1.60934).toFixed(2))
        : Number(formState.distanceKm)
    }

    const calculatedPace = computePace(formState.distanceKm, formState.durationMinutes, formState.type)

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
      pace: calculatedPace || undefined,
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
    setSaveSuccessMsg('¡Entrenamiento registrado con éxito!')
    setTimeout(() => setSaveSuccessMsg(null), 4000)
  }

  const startEdit = (session: WorkoutSession) => {
    setEditingId(session.id)

    const displayDistance =
      typeof session.distanceKm === 'number'
        ? isImperial
          ? Number((session.distanceKm / 1.60934).toFixed(2))
          : session.distanceKm
        : ''

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

    const calculatedPace = computePace(editFormState.distanceKm, editFormState.durationMinutes, editFormState.type)

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
                pace: calculatedPace || undefined,
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

  // Filtrado y búsqueda avanzada de historial
  const filteredWorkouts = useMemo(() => {
    const now = new Date()
    const nowTime = now.getTime()

    return workouts.filter((session) => {
      // Filtro tipo
      if (filterType !== 'all' && session.type !== filterType) {
        return false
      }

      // Filtro período
      if (periodFilter !== 'all') {
        const sessionTime = new Date(session.date).getTime()
        const diffDays = (nowTime - sessionTime) / (1000 * 60 * 60 * 24)

        if (periodFilter === 'month' && diffDays > 31) return false
        if (periodFilter === 'quarter' && diffDays > 92) return false
        if (periodFilter === 'year' && diffDays > 365) return false
      }

      // Filtro búsqueda
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const titleMatch = session.title.toLowerCase().includes(q)
        const notesMatch = session.notes?.toLowerCase().includes(q)
        const exerciseMatch = session.exercises.some((e) => e.name.toLowerCase().includes(q))
        if (!titleMatch && !notesMatch && !exerciseMatch) {
          return false
        }
      }

      return true
    }).sort((a, b) => b.date.localeCompare(a.date))
  }, [workouts, filterType, periodFilter, searchTerm])

  // Estadísticas del mes actual
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

  const userWeight = data.profile.weightKg

  // Ritmo en vivo en formulario
  const livePace = computePace(formState.distanceKm, formState.durationMinutes, formState.type)
  const isDistanceType =
    formState.type === 'running' ||
    formState.type === 'ciclismo' ||
    formState.type === 'caminata' ||
    formState.type === 'trekking' ||
    formState.type === 'natacion' ||
    formState.type === 'cardio' ||
    (typeof formState.distanceKm === 'number' && formState.distanceKm > 0)

  // Exportar PDF con los entrenamientos filtrados
  const handleExportPDF = () => {
    const periodLabels: Record<string, string> = {
      all: 'Historial Completo',
      month: 'Último Mes',
      quarter: 'Último Trimestre',
      year: 'Último Año',
    }

    exportWorkoutsToPDF({
      workouts: filteredWorkouts,
      userName,
      filterPeriodLabel: periodLabels[periodFilter] || 'Historial Filtrado',
      unitSystem: isImperial ? 'imperial' : 'metric',
    })
  }

  // Exportar sesión individual en PDF
  const handleExportSinglePDF = (session: WorkoutSession) => {
    exportWorkoutsToPDF({
      workouts: [session],
      userName,
      filterPeriodLabel: `Sesión del ${formatDate(session.date)}`,
      unitSystem: isImperial ? 'imperial' : 'metric',
    })
  }

  return (
    <div>
      <SectionHeader
        title="Entrenamientos"
        subtitle="Registrá rutinas de fuerza, caminatas, running, bici y generá informes técnicos en PDF"
      />

      {/* Navegación por Solapas */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={activeTab === 'new' ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveTab('new')}
          >
            ⚡ Nuevo Entrenamiento
          </button>
          <button
            type="button"
            className={activeTab === 'history' ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveTab('history')}
          >
            📋 Mis Entrenamientos ({workouts.length})
          </button>
        </div>

        {activeTab === 'history' && (
          <button
            type="button"
            className="secondary-button"
            onClick={handleExportPDF}
            style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <FileText size={16} style={{ color: 'var(--color-accent-blue)' }} />
            Exportar Informe PDF ({filteredWorkouts.length})
          </button>
        )}
      </div>

      <div className="section-body">
        {/* ============================================================== */}
        {/* SOLAPA 1: NUEVO ENTRENAMIENTO */}
        {/* ============================================================== */}
        {activeTab === 'new' && (
          <>
            {/* Mensaje de éxito tras guardar */}
            {saveSuccessMsg && (
              <div className="alert alert-success" role="alert" style={{ marginBottom: '1rem' }}>
                <span>{saveSuccessMsg}</span>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => setActiveTab('history')}
                >
                  Ver en Mis Entrenamientos →
                </button>
              </div>
            )}

            {/* Banner Inteligente de Sugerencia Predictiva */}
            {suggestedRoutine && (
              <div
                className="panel"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)',
                  borderColor: 'rgba(59, 130, 246, 0.4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '1rem 1.25rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ maxWidth: '600px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <Sparkles size={16} style={{ color: 'var(--color-accent-blue)' }} />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--color-accent-blue)',
                      }}
                    >
                      Sugerencia inteligente de rutina
                    </span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                    ¿Hoy te toca entrenar "{suggestedRoutine.title}"?
                  </h4>
                  <p
                    style={{
                      margin: '0.25rem 0 0',
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Según tu ciclo habitual, hace <strong>{suggestedRoutine.daysAgo} días</strong>{' '}
                    que no hacés esta rutina ({suggestedRoutine.session.exercises.length} ejercicios
                    con sus cargas previas).
                  </p>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => loadRoutineAsTemplate(suggestedRoutine.session)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  ⚡ Precargar rutina sugerida
                </button>
              </div>
            )}

            {/* Panel de Estadísticas Físicas Rápidas */}
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
                <span className="panel-subtitle">Running, caminatas y bici</span>
              </div>
            </div>

            {/* Notificación de correlación con perfil */}
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

            {/* Selector de Modo: Planificación vs Gym en Vivo */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={creationMode === 'plan' ? 'primary-button' : 'secondary-button'}
                  onClick={() => setCreationMode('plan')}
                  style={{ fontSize: '0.85rem' }}
                >
                  📝 Modo Planificación
                </button>
                <button
                  type="button"
                  className={creationMode === 'live' ? 'primary-button' : 'secondary-button'}
                  onClick={() => {
                    setCreationMode('live')
                    if (!sessionActive) setSessionActive(true)
                  }}
                  style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Zap size={15} />
                  🏋️‍♂️ Modo Gym en Vivo
                  {sessionActive && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#22c55e',
                        display: 'inline-block',
                      }}
                    />
                  )}
                </button>
              </div>

              {creationMode === 'live' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '1.15rem', fontWeight: 800 }}>
                    <Timer size={18} style={{ color: 'var(--color-accent-blue)' }} />
                    <span style={{ fontFamily: 'monospace' }}>{formatStopwatch(sessionElapsedSeconds)}</span>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => setSessionActive(!sessionActive)}
                    title={sessionActive ? 'Pausar cronómetro' : 'Reanudar cronómetro'}
                  >
                    {sessionActive ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* VISTA A: MODO GYM EN VIVO (CONSOLA INTERACTIVA DE GIMNASIO) */}
            {/* ============================================================== */}
            {creationMode === 'live' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Consola Superior: Rest Timer y Métricas Rápidas */}
                <div
                  className="panel"
                  style={{
                    background: restActive
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)'
                      : 'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(16, 185, 129, 0.06) 100%)',
                    borderColor: restActive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.3)',
                    padding: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          color: restActive ? 'var(--color-error)' : 'var(--color-accent-blue)',
                        }}
                      >
                        {restActive ? '⏳ Descanso en curso' : '⏱️ Temporizador de Descanso'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <span style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'monospace', lineHeight: 1 }}>
                          {restActive ? `${restRemaining}s` : `${restTimerSeconds}s`}
                        </span>
                        {restActive && (
                          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            restantes
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Presets rápidos de descanso */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {[30, 45, 60, 90, 120, 180].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            className={restTimerSeconds === sec ? 'primary-button' : 'secondary-button'}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            onClick={() => {
                              setRestTimerSeconds(sec)
                              if (restActive) setRestRemaining(sec)
                            }}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {restActive ? (
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', color: 'var(--color-error)' }}
                            onClick={stopRestTimer}
                          >
                            Detener descanso
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="primary-button"
                            style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
                            onClick={() => startRestTimer()}
                          >
                            Iniciar descanso ({restTimerSeconds}s)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Barra de progreso de descanso */}
                  {restActive && (
                    <div
                      style={{
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '999px',
                        overflow: 'hidden',
                        marginTop: '0.75rem',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.round((restRemaining / restTimerSeconds) * 100)}%`,
                          background: restRemaining <= 10 ? 'var(--color-error)' : 'var(--color-warning)',
                          transition: 'width 1s linear',
                        }}
                      />
                    </div>
                  )}

                  {/* Métricas rápidas de la sesión en vivo */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '0.75rem',
                      marginTop: '1rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      paddingTop: '0.75rem',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Series hechas</span>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                        {liveStats.completedSets} / {liveStats.totalSets} ({liveStats.progressPercent}%)
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Volumen total</span>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-success)' }}>
                        {liveStats.totalVolumeKg.toLocaleString('es-AR')} {weightUnit}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tiempo transcurrido</span>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'monospace' }}>
                        {formatStopwatch(sessionElapsedSeconds)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Título y Foco del Entrenamiento en Vivo */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    value={formState.title}
                    onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                    placeholder="Nombre del entrenamiento (Ej. Pecho y Bíceps)"
                    style={{ fontSize: '1.1rem', fontWeight: 700, padding: '0.6rem 0.8rem' }}
                  />
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setFinishModalOpen(true)}
                    style={{ whiteSpace: 'nowrap', backgroundColor: '#10b981', borderColor: '#10b981' }}
                  >
                    🏁 Finalizar Sesión
                  </button>
                </div>

                {/* Lista de Ejercicios en Vivo con Botones Táctiles Grandes */}
                {formState.exercises.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                    <Dumbbell size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <p style={{ margin: '0 0 1rem 0' }}>Agregá ejercicios para empezar a registrar tus series.</p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {QUICK_EXERCISES.slice(0, 5).map((quick) => (
                        <button
                          key={quick}
                          type="button"
                          className="secondary-button"
                          onClick={() => addExerciseToCreation(quick)}
                        >
                          + {quick}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {formState.exercises.map((ex, exIdx) => (
                      <div
                        key={ex.id}
                        className="subpanel"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '10px',
                          padding: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                            {exIdx + 1}. {ex.name}
                          </h4>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              const newSet = { reps: 10, weight: 0, rpe: 8, setType: 'normal' as WorkoutSetType }
                              setFormState((prev) => ({
                                ...prev,
                                exercises: prev.exercises.map((e) =>
                                  e.id === ex.id ? { ...e, sets: [...e.sets, newSet] } : e
                                ),
                              }))
                            }}
                          >
                            + Serie
                          </button>
                        </div>

                        {/* Series con botones táctiles grandes */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {ex.sets.map((set, setIdx) => (
                            <div
                              key={setIdx}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr 1fr auto',
                                gap: '0.5rem',
                                alignItems: 'center',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '8px',
                                backgroundColor: set.done ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                                border: set.done ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--color-border)',
                              }}
                            >
                              {/* Número de serie */}
                              <span style={{ fontWeight: 700, width: '24px', fontSize: '0.85rem' }}>
                                #{setIdx + 1}
                              </span>

                              {/* Repeticiones con botones +/- */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem', fontWeight: 800 }}
                                  onClick={() => adjustLiveSetReps(ex.id, setIdx, -1)}
                                >
                                  -
                                </button>
                                <span style={{ minWidth: '48px', textAlign: 'center', fontWeight: 700 }}>
                                  {set.reps} reps
                                </span>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem', fontWeight: 800 }}
                                  onClick={() => adjustLiveSetReps(ex.id, setIdx, +1)}
                                >
                                  +
                                </button>
                              </div>

                              {/* Carga con botones +/- */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontWeight: 800 }}
                                  onClick={() => adjustLiveSetWeight(ex.id, setIdx, isImperial ? -5 : -2.5)}
                                >
                                  -
                                </button>
                                <span style={{ minWidth: '54px', textAlign: 'center', fontWeight: 700 }}>
                                  {set.weight ?? 0} {weightUnit}
                                </span>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontWeight: 800 }}
                                  onClick={() => adjustLiveSetWeight(ex.id, setIdx, isImperial ? +5 : +2.5)}
                                >
                                  +
                                </button>
                              </div>

                              {/* Botón de serie completada que dispara el timer */}
                              <button
                                type="button"
                                className={set.done ? 'primary-button' : 'secondary-button'}
                                style={{
                                  padding: '0.4rem 0.75rem',
                                  fontSize: '0.85rem',
                                  backgroundColor: set.done ? '#10b981' : undefined,
                                  borderColor: set.done ? '#10b981' : undefined,
                                  color: set.done ? '#ffffff' : undefined,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                                onClick={() => toggleLiveSetDone(ex.id, setIdx)}
                              >
                                <Check size={16} />
                                {set.done ? 'Hecha' : 'Completar'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Agregar más ejercicios en vivo */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    value={exerciseDraftName}
                    onChange={(e) => setExerciseDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addExerciseToCreation(exerciseDraftName)
                      }
                    }}
                    placeholder="Agregar otro ejercicio a la sesión..."
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => addExerciseToCreation(exerciseDraftName)}
                  >
                    + Agregar
                  </button>
                </div>
              </div>
            ) : null}

            {/* Modal Confirmar Finalización de Sesión */}
            <Modal
              open={finishModalOpen}
              title="🏁 Finalizar Entrenamiento en Vivo"
              onClose={() => setFinishModalOpen(false)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  ¡Gran trabajo en los fierros! Vas a guardar la sesión en tu historial.
                </p>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    padding: '1rem',
                    borderRadius: '8px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tiempo de sesión</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                      {Math.max(1, Math.round(sessionElapsedSeconds / 60))} min
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Volumen levantado</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-success)' }}>
                      {liveStats.totalVolumeKg.toLocaleString('es-AR')} {weightUnit}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Series completadas</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      {liveStats.completedSets} de {liveStats.totalSets}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Ejercicios</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      {formState.exercises.length}
                    </div>
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setFinishModalOpen(false)}
                  >
                    Seguir entrenando
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleFinishLiveSession}
                    style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                  >
                    Confirmar y Guardar Sesión
                  </button>
                </div>
              </div>
            </Modal>

            {/* ============================================================== */}
            {/* VISTA B: MODO PLANIFICACIÓN (FORMULARIO CLÁSICO COMPLETO) */}
            {/* ============================================================== */}
            {creationMode === 'plan' && (
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">Registrar nueva sesión de entrenamiento</h3>
              </div>

              <form
                className="form-grid"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
                onSubmit={handleCreate}
              >
                <div className="field">
                  <label htmlFor="workout-title">Nombre o foco de la sesión *</label>
                  <input
                    id="workout-title"
                    value={formState.title}
                    onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                    placeholder="Ej. Pecho y tríceps, Fondo 10k, Bici nocturna"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="workout-type">Disciplina</label>
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

                {/* Campos para actividades con distancia (Running, Ciclismo, Caminatas, etc.) */}
                {isDistanceType && (
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
                        placeholder="Ej. 6.5"
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="workout-calories">Calorías estimadas (kcal)</label>
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
                        placeholder="Ej. 380"
                      />
                    </div>

                    {livePace && (
                      <div
                        className="field field-full"
                        style={{
                          background: 'rgba(59, 130, 246, 0.1)',
                          padding: '0.625rem 0.875rem',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <Activity size={18} style={{ color: 'var(--color-accent-blue)' }} />
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                          Ritmo promedio calculado:{' '}
                          <strong style={{ color: 'var(--color-accent-blue)' }}>{livePace}</strong>
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Constructor de Ejercicios y Series */}
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
                    <label style={{ margin: 0, fontWeight: 600 }}>
                      Ejercicios de la sesión ({formState.exercises.length})
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Podés configurar modalidad (biserie, dropset) y notas por serie
                    </span>
                  </div>

                  {/* Chips para agregar ejercicios rápidos */}
                  <div className="chip-list" style={{ marginBottom: '0.875rem' }}>
                    {QUICK_EXERCISES.map((exName) => (
                      <button
                        key={exName}
                        type="button"
                        className="secondary-button"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        onClick={() => addExerciseToCreation(exName)}
                      >
                        + {exName}
                      </button>
                    ))}
                  </div>

                  {/* Input manual para otro ejercicio */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input
                      value={exerciseDraftName}
                      onChange={(e) => setExerciseDraftName(e.target.value)}
                      placeholder="Nombre de otro ejercicio..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addExerciseToCreation(exerciseDraftName)
                        }
                      }}
                      style={{ maxWidth: '360px' }}
                    />
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => addExerciseToCreation(exerciseDraftName)}
                    >
                      <Plus size={16} style={{ marginRight: '0.25rem' }} /> Agregar
                    </button>
                  </div>

                  {/* Listado de ejercicios agregados a la sesión */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    {formState.exercises.map((exercise, exIndex) => (
                      <div
                        key={exercise.id}
                        className="subpanel"
                        style={{
                          borderLeft: '3px solid var(--color-accent-blue)',
                          padding: '0.875rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <strong style={{ fontSize: '0.95rem' }}>{exercise.name}</strong>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => {
                              setFormState((prev) => ({
                                ...prev,
                                exercises: prev.exercises.filter((_, idx) => idx !== exIndex),
                              }))
                            }}
                          >
                            Eliminar ejercicio
                          </button>
                        </div>

                        {/* Tabla de series */}
                        <div style={{ overflowX: 'auto' }}>
                          <table className="table" style={{ fontSize: '0.8125rem' }}>
                            <thead>
                              <tr>
                                <th style={{ width: '45px' }}>Serie</th>
                                <th style={{ width: '150px' }}>Tipo de serie</th>
                                <th style={{ width: '85px' }}>Reps</th>
                                <th style={{ width: '95px' }}>Peso ({weightUnit})</th>
                                <th style={{ width: '70px' }}>RPE</th>
                                <th>Notas / Comentario de la serie</th>
                                <th style={{ width: '40px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {exercise.sets.map((set, setIndex) => (
                                <tr key={setIndex}>
                                  <td style={{ fontWeight: 600, textAlign: 'center' }}>
                                    #{setIndex + 1}
                                  </td>
                                  <td>
                                    <select
                                      className="select"
                                      value={set.setType || 'normal'}
                                      onChange={(e) => {
                                        const newType = e.target.value as WorkoutSetType
                                        setFormState((prev) => {
                                          const next = [...prev.exercises]
                                          next[exIndex].sets[setIndex].setType = newType
                                          return { ...prev, exercises: next }
                                        })
                                      }}
                                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
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
                                          const next = [...prev.exercises]
                                          next[exIndex].sets[setIndex].reps = repsVal
                                          return { ...prev, exercises: next }
                                        })
                                      }}
                                      style={{ width: '100%', padding: '0.25rem 0.4rem' }}
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
                                          const next = [...prev.exercises]
                                          next[exIndex].sets[setIndex].weight = weightVal
                                          return { ...prev, exercises: next }
                                        })
                                      }}
                                      style={{ width: '100%', padding: '0.25rem 0.4rem' }}
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
                                          const next = [...prev.exercises]
                                          next[exIndex].sets[setIndex].rpe = rpeVal
                                          return { ...prev, exercises: next }
                                        })
                                      }}
                                      placeholder="8"
                                      style={{ width: '100%', padding: '0.25rem 0.4rem' }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      value={set.notes || ''}
                                      onChange={(e) => {
                                        const noteVal = e.target.value
                                        setFormState((prev) => {
                                          const next = [...prev.exercises]
                                          next[exIndex].sets[setIndex].notes = noteVal
                                          return { ...prev, exercises: next }
                                        })
                                      }}
                                      placeholder="Ej. pausa 2s, al fallo, buena congestión..."
                                      style={{
                                        width: '100%',
                                        minWidth: '150px',
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.75rem',
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="tag-remove"
                                      onClick={() => {
                                        setFormState((prev) => {
                                          const next = [...prev.exercises]
                                          next[exIndex].sets = next[exIndex].sets.filter(
                                            (_, sIdx) => sIdx !== setIndex,
                                          )
                                          return { ...prev, exercises: next }
                                        })
                                      }}
                                      title="Eliminar serie"
                                    >
                                      ×
                                    </button>
                                  </td>
                                </tr>
                              ))}
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
                                const next = [...prev.exercises]
                                const lastSet =
                                  exercise.sets[exercise.sets.length - 1] ?? {
                                    reps: 10,
                                    weight: 0,
                                    rpe: 8,
                                    setType: 'normal',
                                    notes: '',
                                  }
                                next[exIndex].sets.push({
                                  reps: lastSet.reps,
                                  weight: lastSet.weight,
                                  rpe: lastSet.rpe,
                                  setType: lastSet.setType ?? 'normal',
                                  notes: '',
                                })
                                return { ...prev, exercises: next }
                              })
                            }}
                          >
                            + Serie
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="field field-full">
                  <label htmlFor="workout-notes">Notas y sensaciones de la sesión</label>
                  <textarea
                    id="workout-notes"
                    value={formState.notes}
                    onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                    placeholder="Observaciones de energía, descanso previo, recuperación muscular..."
                    rows={2}
                  />
                </div>

                <div className="form-actions field-full">
                  <button className="primary-button" type="submit" style={{ padding: '0.625rem 1.5rem' }}>
                    Guardar entrenamiento
                  </button>
                </div>
              </form>
            </div>
            )}
          </>
        )}

        {/* ============================================================== */}
        {/* SOLAPA 2: MIS ENTRENAMIENTOS (HISTORIAL & REPORTES) */}
        {/* ============================================================== */}
        {activeTab === 'history' && (
          <div className="panel">
            {/* Toolbar de Filtros y Búsqueda */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1rem',
                alignItems: 'center',
              }}
            >
              {/* Buscador */}
              <div style={{ position: 'relative' }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)',
                  }}
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por ejercicio, rutina o notas..."
                  style={{ paddingLeft: '2.25rem', width: '100%' }}
                />
              </div>

              {/* Filtro Período */}
              <div>
                <select
                  className="select"
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
                >
                  <option value="all">Todo el historial</option>
                  <option value="month">Último mes</option>
                  <option value="quarter">Últimos 3 meses</option>
                  <option value="year">Último año</option>
                </select>
              </div>

              {/* Filtro Disciplina */}
              <div>
                <select
                  className="select"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">Todas las disciplinas</option>
                  {WORKOUT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón Exportar PDF */}
              <div style={{ textAlign: 'right' }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleExportPDF}
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={filteredWorkouts.length === 0}
                >
                  <FileText size={16} style={{ marginRight: '0.35rem' }} />
                  Generar Informe PDF
                </button>
              </div>
            </div>

            {filteredWorkouts.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 1rem' }}>
                <Dumbbell size={40} style={{ color: 'var(--color-text-muted)', margin: '0 auto 1rem' }} />
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
                  No se encontraron entrenamientos
                </h4>
                <p style={{ margin: '0.5rem auto 1.5rem', maxWidth: '360px', color: 'var(--color-text-secondary)' }}>
                  {searchTerm || filterType !== 'all' || periodFilter !== 'all'
                    ? 'Probá ajustando los filtros de búsqueda o período.'
                    : 'Aún no registraste ninguna sesión. ¡Creá tu primer entrenamiento!'}
                </p>
                <button type="button" className="primary-button" onClick={() => setActiveTab('new')}>
                  ⚡ Crear nuevo entrenamiento
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {filteredWorkouts.slice(0, visibleHistoryCount).map((session) => {
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
                    <div
                      key={session.id}
                      className="subpanel"
                      style={{
                        padding: '1rem',
                        borderLeft: '4px solid var(--color-accent-blue)',
                      }}
                    >
                      {/* Cabecera de la sesión */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          marginBottom: '0.625rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                              {session.type}
                            </span>
                            <strong style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                              {session.title}
                            </strong>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.875rem',
                              flexWrap: 'wrap',
                              marginTop: '0.35rem',
                              fontSize: '0.8125rem',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            <span>📅 {formatDate(session.date)}</span>
                            {session.durationMinutes ? <span>⏱️ {session.durationMinutes} min</span> : null}
                            {session.distanceKm ? (
                              <span>
                                📍{' '}
                                {isImperial
                                  ? (session.distanceKm / 1.60934).toFixed(1)
                                  : session.distanceKm}{' '}
                                {distanceUnit}
                              </span>
                            ) : null}
                            {session.pace ? (
                              <span style={{ color: 'var(--color-accent-blue)', fontWeight: 600 }}>
                                ⚡ {session.pace}
                              </span>
                            ) : null}
                            {session.calories ? <span>🔥 {session.calories} kcal</span> : null}
                            {sessionVolume > 0 ? (
                              <span>
                                🏋️ {displaySessionVolume.toLocaleString('es-AR')} {weightUnit}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Botones de Acción de la Sesión */}
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                            onClick={() => loadRoutineAsTemplate(session)}
                            title="Precargar esta misma rutina en Nuevo Entrenamiento"
                          >
                            <Copy size={13} style={{ marginRight: '0.25rem' }} />
                            Usar como plantilla
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                            onClick={() => handleExportSinglePDF(session)}
                            title="Exportar esta sesión a PDF"
                          >
                            <FileText size={13} style={{ marginRight: '0.2rem' }} />
                            PDF
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                            onClick={() => startEdit(session)}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                            onClick={() => setDeletingSession(session)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Notas de la sesión */}
                      {session.notes ? (
                        <p
                          style={{
                            margin: '0 0 0.625rem',
                            fontSize: '0.8125rem',
                            color: 'var(--color-text-secondary)',
                            fontStyle: 'italic',
                          }}
                        >
                          "{session.notes}"
                        </p>
                      ) : null}

                      {/* Lista de ejercicios y series */}
                      {session.exercises.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            borderTop: '1px solid var(--color-border)',
                            paddingTop: '0.625rem',
                          }}
                        >
                          {session.exercises.map((ex) => (
                            <div key={ex.id} style={{ fontSize: '0.8125rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                • {ex.name}:{' '}
                              </span>
                              <span style={{ color: 'var(--color-text-secondary)' }}>
                                {ex.sets
                                  .map((s, idx) => {
                                    const w = isImperial
                                      ? Math.round((s.weight || 0) * 2.20462)
                                      : s.weight || 0
                                    const setConfig = WORKOUT_SET_TYPES.find(
                                      (t) => t.value === s.setType,
                                    )
                                    const badge =
                                      s.setType && s.setType !== 'normal'
                                        ? ` [${setConfig?.badge || s.setType}]`
                                        : ''
                                    const note = s.notes ? ` 💬 "${s.notes}"` : ''
                                    return `Serie ${idx + 1}: ${w}${weightUnit} × ${s.reps}${badge}${note}`
                                  })
                                  .join(' · ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Botón Cargar Más */}
                {filteredWorkouts.length > visibleHistoryCount && (
                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setVisibleHistoryCount((prev) => prev + 10)}
                    >
                      <ChevronDown size={16} style={{ marginRight: '0.35rem' }} />
                      Mostrar más entrenamientos ({filteredWorkouts.length - visibleHistoryCount} restantes)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Edición de Entrenamiento */}
      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Editar sesión de entrenamiento"
        subtitle="Actualizá los datos de la sesión, series o notas"
        maxWidth="820px"
      >
        <form className="form-grid" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-workout-title">Nombre o foco de la sesión</label>
            <input
              id="edit-workout-title"
              value={editFormState.title}
              onChange={(e) => setEditFormState({ ...editFormState, title: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="edit-workout-type">Disciplina</label>
            <Select
              id="edit-workout-type"
              value={editFormState.type}
              onChange={(value) =>
                setEditFormState({ ...editFormState, type: value as WorkoutType })
              }
              options={WORKOUT_TYPES}
              ariaLabel="Tipo de disciplina"
            />
          </div>

          <div className="field">
            <label htmlFor="edit-workout-date">Fecha</label>
            <DatePicker
              id="edit-workout-date"
              value={toLocalDateKey(editFormState.date)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  date: fromLocalDateOrDateTime(value, true),
                })
              }
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

          <div className="field">
            <label htmlFor="edit-workout-distance">Distancia ({distanceUnit})</label>
            <input
              id="edit-workout-distance"
              type="number"
              step="0.01"
              min="0"
              value={editFormState.distanceKm}
              onChange={(e) =>
                setEditFormState({
                  ...editFormState,
                  distanceKm: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            />
          </div>

          <div className="field">
            <label htmlFor="edit-workout-calories">Calorías (kcal)</label>
            <input
              id="edit-workout-calories"
              type="number"
              min="0"
              value={editFormState.calories}
              onChange={(e) =>
                setEditFormState({
                  ...editFormState,
                  calories: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            />
          </div>

          {/* Constructor en Edición */}
          <div className="field-full" style={{ marginTop: '0.5rem' }}>
            <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
              Ejercicios y Series
            </label>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <input
                value={editExerciseDraftName}
                onChange={(e) => setEditExerciseDraftName(e.target.value)}
                placeholder="Nombre de otro ejercicio..."
                style={{ maxWidth: '300px' }}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => addExerciseToEdit(editExerciseDraftName)}
              >
                + Agregar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {editFormState.exercises.map((exercise, exIndex) => (
                <div
                  key={exercise.id}
                  className="subpanel"
                  style={{ borderLeft: '3px solid var(--color-accent-blue)', padding: '0.75rem' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <strong>{exercise.name}</strong>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                      onClick={() => {
                        setEditFormState((prev) => ({
                          ...prev,
                          exercises: prev.exercises.filter((_, idx) => idx !== exIndex),
                        }))
                      }}
                    >
                      Eliminar
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {exercise.sets.map((set, setIndex) => (
                      <div
                        key={setIndex}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 130px 65px 75px 1fr 30px',
                          gap: '0.35rem',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>#{setIndex + 1}</span>
                        <select
                          className="select"
                          value={set.setType || 'normal'}
                          onChange={(e) => {
                            const val = e.target.value as WorkoutSetType
                            setEditFormState((prev) => {
                              const next = [...prev.exercises]
                              next[exIndex].sets[setIndex].setType = val
                              return { ...prev, exercises: next }
                            })
                          }}
                          style={{ padding: '0.2rem 0.35rem', fontSize: '0.75rem' }}
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
                              const next = [...prev.exercises]
                              next[exIndex].sets[setIndex].reps = r
                              return { ...prev, exercises: next }
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
                              const next = [...prev.exercises]
                              next[exIndex].sets[setIndex].weight = w
                              return { ...prev, exercises: next }
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
                              const next = [...prev.exercises]
                              next[exIndex].sets[setIndex].notes = noteVal
                              return { ...prev, exercises: next }
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
                              const next = [...prev.exercises]
                              next[exIndex].sets = next[exIndex].sets.filter(
                                (_, sIdx) => sIdx !== setIndex,
                              )
                              return { ...prev, exercises: next }
                            })
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', marginTop: '0.4rem' }}
                    onClick={() => {
                      setEditFormState((prev) => {
                        const next = [...prev.exercises]
                        const last =
                          exercise.sets[exercise.sets.length - 1] ?? {
                            reps: 10,
                            weight: 0,
                            setType: 'normal',
                            notes: '',
                          }
                        next[exIndex].sets.push({
                          reps: last.reps,
                          weight: last.weight,
                          setType: last.setType ?? 'normal',
                          notes: '',
                        })
                        return { ...prev, exercises: next }
                      })
                    }}
                  >
                    + Serie
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="field field-full">
            <label htmlFor="edit-workout-notes">Notas</label>
            <textarea
              id="edit-workout-notes"
              value={editFormState.notes}
              onChange={(e) => setEditFormState({ ...editFormState, notes: e.target.value })}
              rows={2}
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
