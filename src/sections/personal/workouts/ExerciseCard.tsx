import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { WorkoutExercise, WorkoutExerciseSet } from '../../../types'
import { measureOf, nextSetFrom, withMeasure } from '../../../utils/workoutSets'
import { SetBadges, SetOptions, SetValues } from './SetFields'

export const REST_CHOICES = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300]
export const restLabel = (s: number) => (s === 0 ? 'Sin descanso fijo' : s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`)

export function RestSelect({ value, onChange }: { value: number; onChange: (seconds: number | undefined) => void }) {
  const options = REST_CHOICES.includes(value) ? REST_CHOICES : [...REST_CHOICES, value].sort((a, b) => a - b)
  return (
    <label className="wk-rest">
      <span>Descanso</span>
      <select className="select" value={value} onChange={(e) => onChange(Number(e.target.value) || undefined)}>
        {options.map((s) => (
          <option key={s} value={s}>{restLabel(s)}</option>
        ))}
      </select>
    </label>
  )
}

interface Props {
  exercise: WorkoutExercise
  index: number
  weightUnit: string
  onChange: (exercise: WorkoutExercise) => void
  onRemove: () => void
}

/** Un ejercicio suelto con sus series. Cada serie muestra reps y peso; lo demás está en el panel "⋯". */
export function ExerciseCard({ exercise, index, weightUnit, onChange, onRemove }: Props) {
  const [openSet, setOpenSet] = useState<number | null>(null)
  const measure = measureOf(exercise)
  const patchSet = (i: number, patch: Partial<WorkoutExerciseSet>) =>
    onChange({ ...exercise, sets: exercise.sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
  const removeSet = (i: number) => {
    onChange({ ...exercise, sets: exercise.sets.filter((_, idx) => idx !== i) })
    setOpenSet(null)
  }

  return (
    <div className="subpanel wk-card" data-testid="exercise-card">
      <div className="wk-card-head">
        <div className="wk-card-title">
          <span className="wk-num">{index + 1}</span>
          <div className="wk-card-name">
            <strong>{exercise.name}</strong>
            {exercise.muscles?.length || exercise.equipment?.length ? <small className="ex-meta">{[...(exercise.muscles ?? []), ...(exercise.equipment ?? [])].join(' · ')}</small> : null}
          </div>
        </div>
        <button type="button" className="secondary-button wk-danger wk-small" onClick={onRemove}>
          Eliminar
        </button>
      </div>

      <div className="wk-card-opts">
        <div className="wk-seg" role="group" aria-label="Cómo se mide">
          <button type="button" className={measure === 'reps' ? 'is-on' : ''} aria-pressed={measure === 'reps'} onClick={() => onChange(withMeasure(exercise, 'reps'))}>Repeticiones</button>
          <button type="button" className={measure === 'time' ? 'is-on' : ''} aria-pressed={measure === 'time'} onClick={() => onChange(withMeasure(exercise, 'time'))}>Tiempo</button>
        </div>
        <label className="wk-check">
          <input type="checkbox" checked={Boolean(exercise.perSide)} onChange={(e) => onChange({ ...exercise, perSide: e.target.checked || undefined })} />
          Por lado
        </label>
        <RestSelect value={exercise.restSeconds ?? 0} onChange={(s) => onChange({ ...exercise, restSeconds: s })} />
      </div>

      <input className="wk-note" value={exercise.notes ?? ''} placeholder="Notas del ejercicio (tempo, agarre, máquina…)" aria-label={`Notas de ${exercise.name}`} onChange={(e) => onChange({ ...exercise, notes: e.target.value || undefined })} />

      <div className="wk-sets">
        {exercise.sets.map((set, i) => (
          <div key={i} className={`wk-set-wrap${openSet === i ? ' is-open' : ''}`}>
            <div className="wk-set">
              <span className="wk-set-n">{i + 1}</span>
              <SetValues set={set} measure={measure} weightUnit={weightUnit} perSide={exercise.perSide} label={`${exercise.name}, serie ${i + 1}`} onChange={(p) => patchSet(i, p)} />
              <button type="button" className="secondary-button wk-more" aria-expanded={openSet === i} aria-label={`Opciones de la serie ${i + 1}`} onClick={() => setOpenSet(openSet === i ? null : i)}>
                <MoreHorizontal size={16} aria-hidden />
              </button>
              <SetBadges set={set} />
            </div>
            {openSet === i ? (
              <SetOptions set={set} measure={measure} weightUnit={weightUnit} label={`${exercise.name}, serie ${i + 1}`} onChange={(p) => patchSet(i, p)} onRemove={() => removeSet(i)} />
            ) : null}
          </div>
        ))}
      </div>

      <button type="button" className="secondary-button wk-small wk-add" onClick={() => onChange({ ...exercise, sets: [...exercise.sets, nextSetFrom(exercise.sets[exercise.sets.length - 1])] })}>
        + Serie
      </button>
    </div>
  )
}
