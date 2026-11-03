import { v4 as uuid } from 'uuid'
import { CalendarCheck, Dumbbell, History, Play, Sparkles, Trophy } from 'lucide-react'
import type { LiveWorkoutDraft, WorkoutExercise, WorkoutRoutine, WorkoutSession, WorkoutType } from '../../../types'
import { formatDate } from '../../../utils/dates'
import { cloneExercises } from '../../../utils/workoutGroups'
import { dayOverview, nextRoutineDay, prepareDayForLive } from '../../../utils/workoutRoutines'
import { exerciseRecords, kgToDisplay, summarizeSession } from '../../../utils/workoutSets'
import { typeLabel } from './constants'

export interface StartOptions {
  title: string
  type: WorkoutType
  exercises: WorkoutExercise[]
  routineId?: string
  routineDayId?: string
}

interface Props {
  workouts: WorkoutSession[]
  routines: WorkoutRoutine[]
  activeRoutine: WorkoutRoutine | null
  liveDraft: LiveWorkoutDraft | null
  isImperial: boolean
  onStart: (opts: StartOptions) => void
  onResume: () => void
  onOpenRoutines: () => void
  onOpenHistory: () => void
  onRegister: () => void
  message?: string | null
}

const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))

/** Solapa "Hoy": lo que toca entrenar, retomar una sesión en curso y un pantallazo del mes. */
export function TodayTab({ workouts, routines, activeRoutine, liveDraft, isImperial, onStart, onResume, onOpenRoutines, onOpenHistory, onRegister, message }: Props) {
  const weightUnit = isImperial ? 'lb' : 'kg'
  const next = activeRoutine ? nextRoutineDay(activeRoutine, workouts) : null

  const now = new Date()
  const month = workouts.filter((w) => {
    const d = new Date(w.date)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const monthMinutes = month.reduce((a, w) => a + (w.durationMinutes || 0), 0)
  const monthVolume = month.reduce((a, w) => a + summarizeSession(w).volumeKg, 0)
  const recent = [...workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  const records = exerciseRecords(workouts)
    .filter((r) => r.maxWeightKg > 0)
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
    .slice(0, 4)

  // Sugerencia sin rutina: la sesión (por nombre) que hace más tiempo que no hacés
  const lastByTitle = new Map<string, WorkoutSession>()
  for (const w of workouts) {
    const k = w.title.trim().toLowerCase()
    if (!k || (w.exercises.length === 0 && !w.distanceKm)) continue
    const cur = lastByTitle.get(k)
    if (!cur || w.date > cur.date) lastByTitle.set(k, w)
  }
  const suggestion = !next ? [...lastByTitle.values()].sort((a, b) => a.date.localeCompare(b.date))[0] : undefined

  const startDay = (r: WorkoutRoutine, dayId: string) => {
    const day = r.days.find((d) => d.id === dayId)
    if (!day) return
    onStart({ title: day.name, type: day.type ?? 'fuerza', exercises: prepareDayForLive(day, workouts, uuid), routineId: r.id, routineDayId: day.id })
  }

  return (
    <div className="wk-today">
      {message ? <div className="alert alert-success" role="status"><span>{message}</span></div> : null}

      {liveDraft ? (
        <section className="wk-hero wk-hero-live">
          <div>
            <span className="wk-eyebrow"><span className="wk-dot" aria-hidden /> Sesión en curso</span>
            <h3>{liveDraft.title || 'Entrenamiento en Gym'}</h3>
            <p>
              {liveDraft.exercises.length} ejercicio{liveDraft.exercises.length === 1 ? '' : 's'} · {liveDraft.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)} series hechas. Quedó guardada: podés retomarla cuando quieras.
            </p>
          </div>
          <button type="button" className="primary-button wk-big" onClick={onResume}><Play size={18} aria-hidden /> Retomar sesión</button>
        </section>
      ) : next && activeRoutine ? (
        <section className="wk-hero">
          <div className="wk-hero-main">
            <span className="wk-eyebrow"><CalendarCheck size={14} aria-hidden /> Hoy toca · {activeRoutine.name}</span>
            <h3>{next.day.name}</h3>
            <p>
              {dayOverview(next.day).exerciseCount === 0 ? 'Este día todavía no tiene ejercicios.' : `${dayOverview(next.day).preview} · ${dayOverview(next.day).sets} series`}
              {next.lastDoneAt ? ` · Último día de la rutina: hace ${daysAgo(next.lastDoneAt)} d` : ''}
            </p>
          </div>
          <div className="wk-hero-actions">
            <button type="button" className="primary-button wk-big" onClick={() => startDay(activeRoutine, next.day.id)} disabled={next.day.exercises.length === 0}>
              <Play size={18} aria-hidden /> Empezar {next.day.name}
            </button>
            <button type="button" className="secondary-button" onClick={() => onStart({ title: '', type: 'fuerza', exercises: [] })}>Entrenamiento libre</button>
          </div>
          {activeRoutine.days.length > 1 ? (
            <div className="wk-day-picker" aria-label="Elegir otro día">
              <span>Otro día:</span>
              {activeRoutine.days.map((d, i) => (
                <button key={d.id} type="button" className={`wk-day-chip${i === next.index ? ' is-next' : ''}`} disabled={d.exercises.length === 0} onClick={() => startDay(activeRoutine, d.id)} title={d.exercises.length ? '' : 'Sin ejercicios'}>
                  {d.name}{next.counts[d.id] ? <small> ×{next.counts[d.id]}</small> : null}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="wk-hero">
          <div className="wk-hero-main">
            <span className="wk-eyebrow"><Dumbbell size={14} aria-hidden /> Entrenar</span>
            <h3>{routines.length > 0 ? 'Elegí una rutina para tener “lo que toca hoy”' : 'Armá tu primera rutina'}</h3>
            <p>
              {routines.length > 0
                ? 'Activá una de tus rutinas y acá te aparece el día que sigue, con las cargas de la última vez ya cargadas.'
                : 'Una rutina es un programa con varios días (Día 1 · Piernas, Día 2 · Tren superior…). Una vez armada, empezás a entrenar con un toque.'}
            </p>
          </div>
          <div className="wk-hero-actions">
            <button type="button" className="primary-button wk-big" onClick={onOpenRoutines}>{routines.length > 0 ? 'Ver mis rutinas' : 'Crear rutina'}</button>
            <button type="button" className="secondary-button" onClick={() => onStart({ title: '', type: 'fuerza', exercises: [] })}>Entrenamiento libre</button>
          </div>
          {suggestion ? (
            <div className="wk-suggest-row">
              <Sparkles size={15} aria-hidden /> Hace {daysAgo(suggestion.date)} días que no hacés <strong>{suggestion.title}</strong>.
              <button type="button" className="secondary-button wk-small" onClick={() => onStart({ title: suggestion.title, type: suggestion.type, exercises: prepareDayForLive({ id: 'x', name: suggestion.title, exercises: cloneExercises(suggestion.exercises, uuid).map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: false })) })) }, workouts, uuid) })}>Repetirla</button>
            </div>
          ) : null}
        </section>
      )}

      <div className="stats-grid">
        <div className="stat-card"><span className="stat-title">Sesiones del mes</span><span className="stat-value">{month.length}</span><span className="panel-subtitle">Total histórico: {workouts.length}</span></div>
        <div className="stat-card"><span className="stat-title">Tiempo este mes</span><span className="stat-value">{(monthMinutes / 60).toFixed(1)} h</span><span className="panel-subtitle">Constancia</span></div>
        <div className="stat-card"><span className="stat-title">Volumen del mes</span><span className="stat-value">{Math.round(kgToDisplay(monthVolume, isImperial)).toLocaleString('es-AR')} {weightUnit}</span><span className="panel-subtitle">Sin calentamientos</span></div>
      </div>

      <div className="wk-today-cols">
        <section className="panel">
          <div className="panel-header">
            <h3 className="panel-title"><History size={16} aria-hidden /> Últimos entrenamientos</h3>
            <div className="section-actions">
              <button type="button" className="secondary-button wk-small" onClick={onRegister}>Registrar uno ya hecho</button>
              {workouts.length > 0 ? <button type="button" className="secondary-button wk-small" onClick={onOpenHistory}>Ver todo</button> : null}
            </div>
          </div>
          {recent.length === 0 ? (
            <p className="wk-items-empty">Todavía no registraste entrenamientos.</p>
          ) : (
            <ul className="wk-recent">
              {recent.map((w) => {
                const s = summarizeSession(w)
                return (
                  <li key={w.id}>
                    <div><strong>{w.title}</strong><small>{formatDate(w.date)} · {typeLabel(w.type)}</small></div>
                    <span>{s.effectiveSets > 0 ? `${s.effectiveSets} series` : w.distanceKm ? `${w.distanceKm} km` : `${w.durationMinutes ?? 0} min`}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-header"><h3 className="panel-title"><Trophy size={16} aria-hidden /> Récords recientes</h3></div>
          {records.length === 0 ? (
            <p className="wk-items-empty">Cuando cargues pesos, acá van a aparecer tus mejores marcas.</p>
          ) : (
            <ul className="wk-recent">
              {records.map((r) => (
                <li key={r.name}>
                  <div><strong>{r.name}</strong><small>{r.sessions} sesión{r.sessions === 1 ? '' : 'es'}</small></div>
                  <span>{kgToDisplay(r.maxWeightKg, isImperial)} {weightUnit} × {r.maxWeightReps}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
