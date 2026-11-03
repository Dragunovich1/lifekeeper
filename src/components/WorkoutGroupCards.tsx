import { Check, Trash2 } from 'lucide-react'
import type { WorkoutExercise } from '../types'
import {
  GROUP_LABELS,
  addRound,
  groupKindFor,
  groupRest,
  groupTitle,
  isRoundDone,
  removeRound,
  roundCount,
  setGroupRest,
} from '../utils/workoutGroups'
import '../styles/workout-groups.css'

const letter = (i: number) => String.fromCharCode(65 + i)
const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240]
const restLabel = (s: number) => (s === 0 ? 'Sin descanso fijo' : s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`)

function RestSelect({ members, onChange }: { members: WorkoutExercise[]; onChange: (members: WorkoutExercise[]) => void }) {
  const value = groupRest(members) ?? 0
  const options = REST_OPTIONS.includes(value) ? REST_OPTIONS : [...REST_OPTIONS, value].sort((a, b) => a - b)
  return (
    <label className="wg-rest">
      <span>Descanso</span>
      <select className="select" value={value} onChange={(e) => onChange(setGroupRest(members, Number(e.target.value) || undefined))}>
        {options.map((s) => (
          <option key={s} value={s}>{restLabel(s)}</option>
        ))}
      </select>
    </label>
  )
}

interface PlanProps {
  members: WorkoutExercise[]
  weightUnit: string
  onChange: (members: WorkoutExercise[]) => void
  onUngroup: () => void
  onRemove: () => void
}

/** Ítem combinado en el armado/edición de una rutina: una tarjeta con los ejercicios y sus rondas. */
export function ExerciseGroupCard({ members, weightUnit, onChange, onUngroup, onRemove }: PlanProps) {
  const kind = groupKindFor(members.length)
  const rounds = roundCount(members)

  const patchMember = (mi: number, patch: Partial<WorkoutExercise>) =>
    onChange(members.map((m, i) => (i === mi ? { ...m, ...patch } : m)))
  const patchSet = (mi: number, round: number, patch: { reps?: number; weight?: number }) =>
    onChange(members.map((m, i) => (i === mi ? { ...m, sets: m.sets.map((s, r) => (r === round ? { ...s, ...patch } : s)) } : m)))

  return (
    <div className="subpanel wg-card" data-testid="exercise-group">
      <div className="wg-head">
        <div className="wg-head-main">
          <span className={`wg-badge wg-badge-${kind}`}>{GROUP_LABELS[kind]}</span>
          <strong className="wg-title">{groupTitle(members)}</strong>
        </div>
        <div className="wg-head-actions">
          <RestSelect members={members} onChange={onChange} />
          <button type="button" className="secondary-button" onClick={onUngroup} title="Convertir cada ejercicio en un ítem suelto">
            Separar
          </button>
          <button type="button" className="secondary-button wg-danger" onClick={onRemove}>
            Eliminar
          </button>
        </div>
      </div>

      <div className="wg-notes">
        {members.map((m, mi) => (
          <label key={m.id} className="wg-note">
            <span className="wg-letter" aria-hidden>{letter(mi)}</span>
            <input
              value={m.notes ?? ''}
              onChange={(e) => patchMember(mi, { notes: e.target.value || undefined })}
              placeholder={`Notas de ${m.name} (tempo, por pierna…)`}
              aria-label={`Notas de ${m.name}`}
            />
          </label>
        ))}
      </div>

      <div className="wg-rounds">
        {Array.from({ length: rounds }, (_, round) => (
          <div key={round} className="wg-round">
            <div className="wg-round-head">
              <strong>Ronda {round + 1}</strong>
              <button
                type="button"
                className="secondary-button wg-icon-btn wg-danger"
                onClick={() => onChange(removeRound(members, round))}
                aria-label={`Eliminar ronda ${round + 1}`}
                title="Eliminar ronda"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
            {members.map((m, mi) => {
              const set = m.sets[round]
              if (!set) return null
              return (
                <div key={m.id} className="wg-row">
                  <span className="wg-letter" aria-hidden>{letter(mi)}</span>
                  <span className="wg-name">{m.name}</span>
                  <label className="wg-field">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={set.reps || ''}
                      onChange={(e) => patchSet(mi, round, { reps: Number(e.target.value) || 0 })}
                      aria-label={`Repeticiones de ${m.name}, ronda ${round + 1}`}
                    />
                    <small>reps</small>
                  </label>
                  <label className="wg-field">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.5"
                      value={set.weight || ''}
                      onChange={(e) => patchSet(mi, round, { weight: Number(e.target.value) || 0 })}
                      aria-label={`Peso de ${m.name}, ronda ${round + 1}`}
                    />
                    <small>{weightUnit}</small>
                  </label>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <button type="button" className="secondary-button wg-add-round" onClick={() => onChange(addRound(members))}>
        + Ronda
      </button>
    </div>
  )
}

interface LiveProps {
  members: WorkoutExercise[]
  weightUnit: string
  weightStep: number
  onAdjustReps: (exerciseId: string, setIndex: number, delta: number) => void
  onAdjustWeight: (exerciseId: string, setIndex: number, delta: number) => void
  onToggleRound: (round: number) => void
  onChange: (members: WorkoutExercise[]) => void
  onRemove: () => void
}

/** Ítem combinado en "Gym en vivo": cada ronda muestra todos los ejercicios y se completa de una vez. */
export function ExerciseGroupLive({ members, weightUnit, weightStep, onAdjustReps, onAdjustWeight, onToggleRound, onChange, onRemove }: LiveProps) {
  const kind = groupKindFor(members.length)
  const rounds = roundCount(members)

  return (
    <div className="subpanel lw-exercise wg-live" data-testid="exercise-group-live">
      <div className="lw-ex-head">
        <h4 className="lw-ex-title">
          <span className={`wg-badge wg-badge-${kind}`}>{GROUP_LABELS[kind]}</span> {groupTitle(members)}
        </h4>
        <div className="lw-ex-actions">
          <button type="button" className="secondary-button" onClick={() => onChange(addRound(members))}>
            + Ronda
          </button>
          <button
            type="button"
            className="secondary-button lw-icon-btn lw-danger"
            onClick={onRemove}
            aria-label={`Eliminar ${groupTitle(members)}`}
            title="Eliminar ítem"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>

      {members.some((m) => m.notes) ? (
        <ul className="wg-live-notes">
          {members.map((m, mi) => (m.notes ? <li key={m.id}><strong>{letter(mi)}</strong> {m.notes}</li> : null))}
        </ul>
      ) : null}

      <div className="lw-sets">
        {Array.from({ length: rounds }, (_, round) => {
          const done = isRoundDone(members, round)
          return (
            <div key={round} className={`wg-live-round${done ? ' is-done' : ''}`}>
              <div className="wg-round-head">
                <strong>Ronda {round + 1}</strong>
                <button
                  type="button"
                  className="secondary-button wg-icon-btn wg-danger"
                  onClick={() => onChange(removeRound(members, round))}
                  aria-label={`Eliminar ronda ${round + 1}`}
                  title="Eliminar ronda"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
              {members.map((m, mi) => {
                const set = m.sets[round]
                if (!set) return null
                return (
                  <div key={m.id} className="wg-live-row">
                    <span className="wg-live-name"><span className="wg-letter" aria-hidden>{letter(mi)}</span> {m.name}</span>
                    <div className="lw-stepper" aria-label={`Repeticiones de ${m.name}`}>
                      <button type="button" className="secondary-button" onClick={() => onAdjustReps(m.id, round, -1)} aria-label={`Menos repeticiones de ${m.name}`}>−</button>
                      <span className="lw-stepper-value">{set.reps} <small>reps</small></span>
                      <button type="button" className="secondary-button" onClick={() => onAdjustReps(m.id, round, +1)} aria-label={`Más repeticiones de ${m.name}`}>+</button>
                    </div>
                    <div className="lw-stepper" aria-label={`Carga de ${m.name}`}>
                      <button type="button" className="secondary-button" onClick={() => onAdjustWeight(m.id, round, -weightStep)} aria-label={`Menos peso de ${m.name}`}>−</button>
                      <span className="lw-stepper-value">{set.weight ?? 0} <small>{weightUnit}</small></span>
                      <button type="button" className="secondary-button" onClick={() => onAdjustWeight(m.id, round, +weightStep)} aria-label={`Más peso de ${m.name}`}>+</button>
                    </div>
                  </div>
                )
              })}
              <button
                type="button"
                className={`${done ? 'primary-button' : 'secondary-button'} lw-done wg-live-done`}
                onClick={() => onToggleRound(round)}
              >
                <Check size={16} aria-hidden /> {done ? 'Ronda hecha' : 'Completar ronda'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
