import { Plus, Trash2 } from 'lucide-react'
import type { WorkoutDrop, WorkoutExerciseSet, WorkoutMeasure } from '../../../types'
import { dropsOf, isFailure, isWarmup } from '../../../utils/workoutSets'

const num = (v: string) => (v === '' ? 0 : Math.max(0, Number(v) || 0))

interface ValuesProps {
  set: WorkoutExerciseSet
  measure: WorkoutMeasure
  weightUnit: string
  onChange: (patch: Partial<WorkoutExerciseSet>) => void
  /** Texto para lectores de pantalla: "Press, serie 2". */
  label: string
  perSide?: boolean
}

/** Repeticiones + peso, o minutos + segundos si el ejercicio se mide por tiempo. */
export function SetValues({ set, measure, weightUnit, onChange, label, perSide }: ValuesProps) {
  if (measure === 'time') {
    const total = set.seconds ?? 0
    const min = Math.floor(total / 60)
    const sec = total % 60
    return (
      <div className="wk-values">
        <label className="wk-field">
          <input type="number" inputMode="numeric" min="0" value={min || ''} placeholder="0" aria-label={`Minutos de ${label}`} onChange={(e) => onChange({ seconds: num(e.target.value) * 60 + sec })} />
          <small>min</small>
        </label>
        <label className="wk-field">
          <input type="number" inputMode="numeric" min="0" max="59" value={sec || ''} placeholder="0" aria-label={`Segundos de ${label}`} onChange={(e) => onChange({ seconds: min * 60 + Math.min(59, num(e.target.value)) })} />
          <small>seg</small>
        </label>
      </div>
    )
  }
  return (
    <div className="wk-values">
      <label className="wk-field">
        <input type="number" inputMode="numeric" min="0" value={set.reps || ''} placeholder="0" aria-label={`Repeticiones de ${label}`} onChange={(e) => onChange({ reps: num(e.target.value) })} />
        <small>{perSide ? 'reps c/lado' : 'reps'}</small>
      </label>
      <label className="wk-field">
        <input type="number" inputMode="decimal" min="0" step="0.5" value={set.weight || ''} placeholder="0" aria-label={`Peso de ${label}`} onChange={(e) => onChange({ weight: num(e.target.value) })} />
        <small>{weightUnit}</small>
      </label>
    </div>
  )
}

/** Etiquetas chicas de la serie: Calent., Fallo, Drop ×n. */
export function SetBadges({ set }: { set: WorkoutExerciseSet }) {
  const drops = dropsOf(set)
  if (!isWarmup(set) && !isFailure(set) && drops.length === 0 && set.setType !== 'biserie') return null
  return (
    <span className="wk-badges">
      {isWarmup(set) ? <span className="wk-chip is-warm">🔥 Calent.</span> : null}
      {isFailure(set) ? <span className="wk-chip is-fail">💥 Fallo</span> : null}
      {drops.length > 0 ? <span className="wk-chip is-drop">⚡ Drop{drops.length > 1 ? ` ×${drops.length}` : ''}</span> : null}
      {set.setType === 'biserie' ? <span className="wk-chip">🔗 Biserie (antigua)</span> : null}
    </span>
  )
}

interface OptionsProps {
  set: WorkoutExerciseSet
  measure: WorkoutMeasure
  weightUnit: string
  onChange: (patch: Partial<WorkoutExerciseSet>) => void
  /** Si se pasa, aparece "Eliminar serie". */
  onRemove?: () => void
  label: string
  showRpe?: boolean
}

/** Panel "⋯" de una serie: calentamiento, al fallo, caídas (drop set), RPE y notas. */
export function SetOptions({ set, measure, weightUnit, onChange, onRemove, label, showRpe = true }: OptionsProps) {
  const drops = dropsOf(set)
  const timed = measure === 'time'
  // Una serie vieja marcada solo con setType se migra al tocarla: así los cambios nuevos no se pisan con el modelo viejo
  const legacyReset: Partial<WorkoutExerciseSet> = set.setType === 'warmup' || set.setType === 'failure' || set.setType === 'dropset' ? { setType: 'normal', warmup: isWarmup(set) || undefined, failure: isFailure(set) || undefined, drops: drops.length ? drops : undefined } : {}

  const setDrops = (next: WorkoutDrop[]) => onChange({ ...legacyReset, drops: next.length ? next : undefined, setType: set.setType === 'dropset' ? 'normal' : set.setType })
  const patchDrop = (i: number, patch: Partial<WorkoutDrop>) => setDrops(drops.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  const addDrop = () => {
    const prev = drops.length ? drops[drops.length - 1] : { reps: set.reps, weight: set.weight }
    const lower = prev.weight ? Math.max(0, Math.round(prev.weight * 0.8 * 2) / 2) : 0 // ~20 % menos, de a 0,5
    setDrops([...drops.filter((d) => d.reps > 0 || d.weight), { reps: prev.reps || 10, weight: lower }])
  }

  return (
    <div className="wk-opts">
      <div className="wk-opts-toggles">
        <button type="button" className={`wk-toggle${isWarmup(set) ? ' is-on' : ''}`} aria-pressed={isWarmup(set)} onClick={() => onChange({ ...legacyReset, warmup: !isWarmup(set) || undefined, setType: legacyReset.setType ?? set.setType })}>
          🔥 Calentamiento
        </button>
        <button
          type="button"
          className={`wk-toggle${isFailure(set) ? ' is-on' : ''}`}
          aria-pressed={isFailure(set)}
          onClick={() => {
            const on = !isFailure(set)
            onChange({ ...legacyReset, failure: on || undefined, rpe: on ? 10 : set.rpe, setType: legacyReset.setType ?? set.setType })
          }}
        >
          💥 Al fallo
        </button>
        {!timed ? (
          <button type="button" className="wk-toggle" onClick={addDrop}>
            <Plus size={13} aria-hidden /> Caída (drop set)
          </button>
        ) : null}
      </div>

      {drops.length > 0 ? (
        <div className="wk-drops">
          {drops.map((d, i) => (
            <div key={i} className="wk-drop">
              <span className="wk-drop-n" title="Bajás el peso sin descansar y seguís">↓ Caída {i + 1}</span>
              <label className="wk-field">
                <input type="number" inputMode="numeric" min="0" value={d.reps || ''} placeholder="0" aria-label={`Repeticiones de la caída ${i + 1} de ${label}`} onChange={(e) => patchDrop(i, { reps: num(e.target.value) })} />
                <small>reps</small>
              </label>
              <label className="wk-field">
                <input type="number" inputMode="decimal" min="0" step="0.5" value={d.weight || ''} placeholder="0" aria-label={`Peso de la caída ${i + 1} de ${label}`} onChange={(e) => patchDrop(i, { weight: num(e.target.value) })} />
                <small>{weightUnit}</small>
              </label>
              <button type="button" className="secondary-button wk-icon-btn wk-danger" aria-label={`Quitar la caída ${i + 1}`} onClick={() => setDrops(drops.filter((_, idx) => idx !== i))}>
                <Trash2 size={13} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="wk-opts-extra">
        {showRpe ? (
          <label className="wk-field wk-rpe">
            <input type="number" inputMode="decimal" min="1" max="10" step="0.5" value={set.rpe ?? ''} placeholder="–" aria-label={`Esfuerzo (RPE) de ${label}`} onChange={(e) => onChange({ rpe: e.target.value === '' ? undefined : Math.min(10, num(e.target.value)) })} />
            <small>RPE</small>
          </label>
        ) : null}
        <input className="wk-note" value={set.notes ?? ''} placeholder="Nota de la serie (opcional)" aria-label={`Nota de ${label}`} onChange={(e) => onChange({ notes: e.target.value })} />
        {onRemove ? (
          <button type="button" className="secondary-button wk-danger" onClick={onRemove}>
            <Trash2 size={13} aria-hidden /> Eliminar serie
          </button>
        ) : null}
      </div>
    </div>
  )
}
