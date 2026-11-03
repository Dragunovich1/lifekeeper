import { useState } from 'react'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import type { WorkoutExercise, WorkoutExerciseSet } from '../../../types'
import { GROUP_LABELS, addRound, groupKindFor, groupRest, groupTitle, removeRound, roundCount, setGroupRest } from '../../../utils/workoutGroups'
import { measureOf, withMeasure } from '../../../utils/workoutSets'
import { RestSelect } from './ExerciseCard'
import { SetBadges, SetOptions, SetValues } from './SetFields'

const letter = (i: number) => String.fromCharCode(65 + i)

interface PlanProps {
  members: WorkoutExercise[]
  weightUnit: string
  onChange: (members: WorkoutExercise[]) => void
  onUngroup: () => void
  onRemove: () => void
}

/** Ítem combinado (biserie / triserie / circuito) al armar o editar: los ejercicios y sus rondas. */
export function ExerciseGroupCard({ members, weightUnit, onChange, onUngroup, onRemove }: PlanProps) {
  const [open, setOpen] = useState<string | null>(null) // "ronda-miembro"
  const kind = groupKindFor(members.length)
  const rounds = roundCount(members)

  const patchMember = (mi: number, patch: Partial<WorkoutExercise>) => onChange(members.map((m, i) => (i === mi ? { ...m, ...patch } : m)))
  const patchSet = (mi: number, round: number, patch: Partial<WorkoutExerciseSet>) =>
    onChange(members.map((m, i) => (i === mi ? { ...m, sets: m.sets.map((s, r) => (r === round ? { ...s, ...patch } : s)) } : m)))

  return (
    <div className="subpanel wk-card wk-group" data-testid="exercise-group">
      <div className="wk-card-head">
        <div className="wk-card-title">
          <span className={`wg-badge wg-badge-${kind}`}>{GROUP_LABELS[kind]}</span>
          <strong className="wk-group-title">{groupTitle(members)}</strong>
        </div>
        <div className="wk-card-actions">
          <RestSelect value={groupRest(members) ?? 0} onChange={(s) => onChange(setGroupRest(members, s))} />
          <button type="button" className="secondary-button wk-small" onClick={onUngroup} title="Convertir cada ejercicio en un ítem suelto">Separar</button>
          <button type="button" className="secondary-button wk-danger wk-small" onClick={onRemove}>Eliminar</button>
        </div>
      </div>

      <div className="wk-group-members">
        {members.map((m, mi) => (
          <div key={m.id} className="wk-member">
            <span className="wg-letter" aria-hidden>{letter(mi)}</span>
            <div className="wk-member-main">
              <strong>{m.name}</strong>
              <input className="wk-note" value={m.notes ?? ''} placeholder="Notas (tempo, por pierna…)" aria-label={`Notas de ${m.name}`} onChange={(e) => patchMember(mi, { notes: e.target.value || undefined })} />
            </div>
            <div className="wk-seg wk-seg-sm" role="group" aria-label={`Cómo se mide ${m.name}`}>
              <button type="button" className={measureOf(m) === 'reps' ? 'is-on' : ''} aria-pressed={measureOf(m) === 'reps'} onClick={() => onChange(members.map((x, i) => (i === mi ? withMeasure(x, 'reps') : x)))}>Reps</button>
              <button type="button" className={measureOf(m) === 'time' ? 'is-on' : ''} aria-pressed={measureOf(m) === 'time'} onClick={() => onChange(members.map((x, i) => (i === mi ? withMeasure(x, 'time') : x)))}>Tiempo</button>
            </div>
            <label className="wk-check">
              <input type="checkbox" checked={Boolean(m.perSide)} onChange={(e) => patchMember(mi, { perSide: e.target.checked || undefined })} />
              Por lado
            </label>
          </div>
        ))}
      </div>

      <div className="wk-rounds">
        {Array.from({ length: rounds }, (_, round) => (
          <div key={round} className="wk-round">
            <div className="wk-round-head">
              <strong>Ronda {round + 1}</strong>
              <button type="button" className="secondary-button wk-icon-btn wk-danger" onClick={() => onChange(removeRound(members, round))} aria-label={`Eliminar ronda ${round + 1}`} title="Eliminar ronda">
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
            {members.map((m, mi) => {
              const set = m.sets[round]
              if (!set) return null
              const id = `${round}-${mi}`
              return (
                <div key={m.id} className={`wk-set-wrap${open === id ? ' is-open' : ''}`}>
                  <div className="wk-set wk-set-member">
                    <span className="wg-letter" aria-hidden>{letter(mi)}</span>
                    <span className="wk-member-name">{m.name}</span>
                    <SetValues set={set} measure={measureOf(m)} weightUnit={weightUnit} perSide={m.perSide} label={`${m.name}, ronda ${round + 1}`} onChange={(p) => patchSet(mi, round, p)} />
                    <button type="button" className="secondary-button wk-more" aria-expanded={open === id} aria-label={`Opciones de ${m.name}, ronda ${round + 1}`} onClick={() => setOpen(open === id ? null : id)}>
                      <MoreHorizontal size={16} aria-hidden />
                    </button>
                    <SetBadges set={set} />
                  </div>
                  {open === id ? <SetOptions set={set} measure={measureOf(m)} weightUnit={weightUnit} label={`${m.name}, ronda ${round + 1}`} onChange={(p) => patchSet(mi, round, p)} /> : null}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <button type="button" className="secondary-button wk-small wk-add" onClick={() => onChange(addRound(members))}>
        + Ronda
      </button>
    </div>
  )
}
