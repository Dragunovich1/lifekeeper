import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Check, MoreHorizontal, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { Modal } from '../../../components/Modal'
import type { LiveWorkoutDraft, WorkoutExercise, WorkoutExerciseSet, WorkoutSession } from '../../../types'
import { playRestTimerSound, triggerHapticFeedback } from '../../../utils/audioHaptics'
import { GROUP_LABELS, buildBlocks, groupKindFor, groupRest, groupTitle, isRoundDone, removeRound, replaceGroup, roundCount, addRound } from '../../../utils/workoutGroups'
import {
  convertExerciseWeights,
  displayToKg,
  formatSeconds,
  kgToDisplay,
  lastPerformance,
  describeSet,
  measureOf,
  newRecords,
  nextSetFrom,
  setVolumeKg,
  summarizeSession,
} from '../../../utils/workoutSets'
import { AddItemModal } from './ExerciseItemAdder'
import { SetBadges, SetOptions } from './SetFields'
import '../../../styles/live-workout.css'

const PRESETS = [30, 45, 60, 90, 120, 180]
const letter = (i: number) => String.fromCharCode(65 + i)

interface StepperProps {
  set: WorkoutExerciseSet
  ex: WorkoutExercise
  weightUnit: string
  weightStep: number
  patch: (p: Partial<WorkoutExerciseSet>) => void
}

/** Botones − / + grandes para tocar con el pulgar: repeticiones y peso (o tiempo). */
function Steppers({ set, ex, weightUnit, weightStep, patch }: StepperProps) {
  if (measureOf(ex) === 'time') {
    return (
      <div className="lw-stepper wk-stepper-wide" aria-label={`Tiempo de ${ex.name}`}>
        <button type="button" className="secondary-button" onClick={() => patch({ seconds: Math.max(0, (set.seconds ?? 0) - 15) })} aria-label="15 segundos menos">−</button>
        <span className="lw-stepper-value">{formatSeconds(set.seconds ?? 0)}{ex.perSide ? <small> c/lado</small> : null}</span>
        <button type="button" className="secondary-button" onClick={() => patch({ seconds: (set.seconds ?? 0) + 15 })} aria-label="15 segundos más">+</button>
      </div>
    )
  }
  return (
    <>
      <div className="lw-stepper" aria-label={`Repeticiones de ${ex.name}`}>
        <button type="button" className="secondary-button" onClick={() => patch({ reps: Math.max(0, (set.reps || 0) - 1) })} aria-label={`Menos repeticiones de ${ex.name}`}>−</button>
        <span className="lw-stepper-value">{set.reps || 0} <small>{ex.perSide ? 'c/lado' : 'reps'}</small></span>
        <button type="button" className="secondary-button" onClick={() => patch({ reps: (set.reps || 0) + 1 })} aria-label={`Más repeticiones de ${ex.name}`}>+</button>
      </div>
      <div className="lw-stepper" aria-label={`Carga de ${ex.name}`}>
        <button type="button" className="secondary-button" onClick={() => patch({ weight: Math.max(0, Number(((set.weight ?? 0) - weightStep).toFixed(1))) })} aria-label={`Menos peso de ${ex.name}`}>−</button>
        <span className="lw-stepper-value">{set.weight ?? 0} <small>{weightUnit}</small></span>
        <button type="button" className="secondary-button" onClick={() => patch({ weight: Number(((set.weight ?? 0) + weightStep).toFixed(1)) })} aria-label={`Más peso de ${ex.name}`}>+</button>
      </div>
    </>
  )
}

interface Props {
  draft: LiveWorkoutDraft
  /** Se llama con cada cambio (el padre lo guarda cifrado con un pequeño retraso) o con null si se descarta/termina. */
  onChange: (draft: LiveWorkoutDraft | null) => void
  onFinish: (session: WorkoutSession, records: ReturnType<typeof newRecords>) => void
  workouts: WorkoutSession[]
  isImperial: boolean
  suggestions: string[]
}

export function LiveSession({ draft, onChange, onFinish, workouts, isImperial, suggestions }: Props) {
  const weightUnit = isImperial ? 'lb' : 'kg'
  const weightStep = isImperial ? 5 : 2.5
  const toDisp = (kg: number) => kgToDisplay(kg, isImperial)
  const toKg = (v: number) => displayToKg(v, isImperial)

  // El estado vive en la unidad que ve la persona; al guardar se vuelve a kg
  const [state, setState] = useState<LiveWorkoutDraft>(() => ({ ...draft, exercises: convertExerciseWeights(draft.exercises, toDisp) }))
  const [now, setNow] = useState(() => Date.now())
  const [restTotal, setRestTotal] = useState(60)
  const [restPreset, setRestPreset] = useState(60)
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [dropIncomplete, setDropIncomplete] = useState(true)
  const [openSet, setOpenSet] = useState<string | null>(null)
  const restFired = useRef(false)

  // Guardar cada cambio (el padre lo hace con un pequeño retraso)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    onChange({ ...state, exercises: convertExerciseWeights(state.exercises, toKg) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const running = state.runningSince !== null
  const elapsed = state.accumulatedSeconds + (state.runningSince ? Math.max(0, Math.floor((now - new Date(state.runningSince).getTime()) / 1000)) : 0)
  const restRemaining = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0
  const restActive = restEndsAt !== null && restRemaining > 0

  useEffect(() => {
    if (restEndsAt && restRemaining === 0 && !restFired.current) {
      restFired.current = true
      playRestTimerSound()
      void triggerHapticFeedback('double')
      setRestEndsAt(null)
    }
  }, [restEndsAt, restRemaining])

  const startRest = (seconds?: number) => {
    const s = seconds || restPreset
    restFired.current = false
    setRestTotal(s)
    setRestEndsAt(Date.now() + s * 1000)
    void triggerHapticFeedback('impact')
  }
  const stopRest = () => setRestEndsAt(null)

  const toggleRun = () =>
    setState((p) =>
      p.runningSince
        ? { ...p, accumulatedSeconds: p.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - new Date(p.runningSince).getTime()) / 1000)), runningSince: null }
        : { ...p, runningSince: new Date().toISOString() },
    )

  const setExercises = (fn: (list: WorkoutExercise[]) => WorkoutExercise[]) => setState((p) => ({ ...p, exercises: fn(p.exercises) }))
  const patchExercise = (id: string, fn: (e: WorkoutExercise) => WorkoutExercise) => setExercises((list) => list.map((e) => (e.id === id ? fn(e) : e)))
  const patchSet = (id: string, si: number, p: Partial<WorkoutExerciseSet>) => patchExercise(id, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === si ? { ...s, ...p } : s)) }))

  const toggleDone = (ex: WorkoutExercise, si: number) => {
    const wasDone = Boolean(ex.sets[si]?.done)
    patchSet(ex.id, si, { done: !wasDone })
    if (!wasDone) startRest(ex.restSeconds)
  }
  const toggleRound = (groupId: string, round: number) => {
    const members = state.exercises.filter((e) => e.groupId === groupId)
    const all = isRoundDone(members, round)
    setExercises((list) => list.map((e) => (e.groupId === groupId ? { ...e, sets: e.sets.map((s, i) => (i === round ? { ...s, done: !all } : s)) } : e)))
    if (!all) startRest(groupRest(members))
  }

  const stats = useMemo(() => {
    let done = 0
    let total = 0
    let vol = 0
    for (const ex of state.exercises)
      for (const s of ex.sets) {
        total += 1
        if (s.done) {
          done += 1
          vol += setVolumeKg(s, measureOf(ex)) // ya en la unidad que ve la persona
        }
      }
    return { done, total, vol: Math.round(vol), pct: total ? Math.round((done / total) * 100) : 0 }
  }, [state.exercises])

  const buildSession = (): WorkoutSession => {
    let exercises = convertExerciseWeights(state.exercises, toKg)
    if (dropIncomplete && stats.done > 0) {
      exercises = exercises
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
        .filter((e) => e.sets.length > 0)
    }
    return {
      id: uuid(),
      title: state.title.trim() || 'Entrenamiento en Gym',
      date: new Date().toISOString(),
      type: state.type,
      durationMinutes: Math.max(1, Math.round(elapsed / 60)),
      notes: state.notes.trim() || undefined,
      exercises,
      routineId: state.routineId,
      routineDayId: state.routineDayId,
    }
  }

  const finish = () => {
    const session = buildSession()
    onFinish(session, newRecords(session, workouts))
    onChange(null)
  }

  const lastHint = (ex: WorkoutExercise) => {
    const last = lastPerformance(workouts, ex.name)
    if (!last) return null
    const best = last.sets.filter((s) => !s.warmup && s.setType !== 'warmup')
    if (best.length === 0) return null
    const top = best.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a), best[0])
    return `Última vez: ${describeSet(top, ex, weightUnit, toDisp)} · ${best.length} series`
  }

  const blocks = buildBlocks(state.exercises)
  const incomplete = stats.total - stats.done

  return (
    <div className="wk-live">
      {/* Consola: cronómetro y descanso */}
      <div className="panel wk-console">
        <div className="wk-console-main">
          <div>
            <span className="wk-console-label">Tiempo</span>
            <div className="wk-clock">{formatSeconds(elapsed)}</div>
          </div>
          <button type="button" className="secondary-button wk-icon-btn" onClick={toggleRun} aria-label={running ? 'Pausar cronómetro' : 'Reanudar cronómetro'} title={running ? 'Pausar' : 'Reanudar'}>
            {running ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          </button>
          <div className="wk-console-stats">
            <div><span className="wk-console-label">Series</span><strong>{stats.done} / {stats.total}</strong></div>
            <div><span className="wk-console-label">Volumen</span><strong>{stats.vol.toLocaleString('es-AR')} {weightUnit}</strong></div>
          </div>
        </div>

        <div className={`wk-rest-bar${restActive ? ' is-active' : ''}`}>
          <div className="wk-rest-info">
            <span className="wk-console-label">Descanso</span>
            <strong className="wk-rest-time">{restActive ? formatSeconds(restRemaining) : formatSeconds(restPreset)}</strong>
          </div>
          <div className="wk-presets" role="group" aria-label="Duración del descanso">
            {PRESETS.map((s) => (
              <button key={s} type="button" className={restPreset === s ? 'primary-button' : 'secondary-button'} onClick={() => { setRestPreset(s); if (restActive) startRest(s) }}>{s}s</button>
            ))}
          </div>
          {restActive ? (
            <button type="button" className="secondary-button wk-danger" onClick={stopRest}>Detener</button>
          ) : (
            <button type="button" className="primary-button" onClick={() => startRest()}>Iniciar descanso</button>
          )}
          {restActive ? <div className="wk-rest-progress"><div style={{ width: `${Math.round((restRemaining / Math.max(1, restTotal)) * 100)}%`, background: restRemaining <= 10 ? 'var(--color-error)' : 'var(--color-warning)' }} /></div> : null}
        </div>
      </div>

      <div className="lw-title-row">
        <input value={state.title} onChange={(e) => setState((p) => ({ ...p, title: e.target.value }))} placeholder="Nombre del entrenamiento (Ej. Pecho y bíceps)" aria-label="Nombre del entrenamiento" />
        <div className="lw-title-actions">
          <button type="button" className="secondary-button lw-discard" onClick={() => setDiscardOpen(true)}><Trash2 size={15} aria-hidden /> Descartar</button>
          <button type="button" className="primary-button lw-finish" onClick={() => setFinishOpen(true)}>🏁 Finalizar</button>
        </div>
      </div>

      {state.exercises.length === 0 ? (
        <div className="empty-state wk-empty">
          <p>Agregá ejercicios para empezar a registrar tus series.</p>
          <button type="button" className="primary-button" onClick={() => setAdding(true)}><Plus size={16} aria-hidden /> Agregar ejercicio</button>
        </div>
      ) : (
        <div className="lw-exercises">
          {blocks.map((block, bi) => {
            if (block.kind === 'group') {
              const members = block.indices.map((i) => state.exercises[i])
              const rounds = roundCount(members)
              const kind = groupKindFor(members.length)
              const gid = block.groupId
              return (
                <div key={gid} className="subpanel lw-exercise wg-live" data-testid="exercise-group-live">
                  <div className="lw-ex-head">
                    <h4 className="lw-ex-title">
                      <span className={`wg-badge wg-badge-${kind}`}>{GROUP_LABELS[kind]}</span> {groupTitle(members)}
                    </h4>
                    <div className="lw-ex-actions">
                      <button type="button" className="secondary-button" onClick={() => setExercises((l) => replaceGroup(l, gid, addRound(members)))}>+ Ronda</button>
                      <button type="button" className="secondary-button lw-icon-btn lw-danger" onClick={() => setExercises((l) => replaceGroup(l, gid, null))} aria-label={`Eliminar ${groupTitle(members)}`} title="Eliminar ítem"><Trash2 size={16} aria-hidden /></button>
                    </div>
                  </div>
                  {members.some((m) => m.notes) ? (
                    <ul className="wg-live-notes">{members.map((m, mi) => (m.notes ? <li key={m.id}><strong>{letter(mi)}</strong> {m.notes}</li> : null))}</ul>
                  ) : null}
                  <div className="lw-sets">
                    {Array.from({ length: rounds }, (_, round) => {
                      const done = isRoundDone(members, round)
                      return (
                        <div key={round} className={`wg-live-round${done ? ' is-done' : ''}`}>
                          <div className="wg-round-head">
                            <strong>Ronda {round + 1}</strong>
                            <button type="button" className="secondary-button wg-icon-btn wg-danger" onClick={() => setExercises((l) => replaceGroup(l, gid, removeRound(members, round)))} aria-label={`Eliminar ronda ${round + 1}`} title="Eliminar ronda"><Trash2 size={14} aria-hidden /></button>
                          </div>
                          {members.map((m, mi) => {
                            const set = m.sets[round]
                            if (!set) return null
                            const key = `${m.id}-${round}`
                            return (
                              <div key={m.id} className="wg-live-member">
                                <div className="wg-live-row">
                                  <span className="wg-live-name">
                                    <span className="wg-letter" aria-hidden>{letter(mi)}</span> {m.name}
                                    <button type="button" className="secondary-button wk-more" aria-expanded={openSet === key} aria-label={`Opciones de ${m.name}, ronda ${round + 1}`} onClick={() => setOpenSet(openSet === key ? null : key)}><MoreHorizontal size={15} aria-hidden /></button>
                                  </span>
                                  <Steppers set={set} ex={m} weightUnit={weightUnit} weightStep={weightStep} patch={(p) => patchSet(m.id, round, p)} />
                                </div>
                                <SetBadges set={set} />
                                {openSet === key ? <SetOptions set={set} measure={measureOf(m)} weightUnit={weightUnit} label={`${m.name}, ronda ${round + 1}`} onChange={(p) => patchSet(m.id, round, p)} /> : null}
                              </div>
                            )
                          })}
                          <button type="button" className={`${done ? 'primary-button' : 'secondary-button'} lw-done wg-live-done`} onClick={() => toggleRound(gid, round)}>
                            <Check size={16} aria-hidden /> {done ? 'Ronda hecha' : 'Completar ronda'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }

            const ex = state.exercises[block.index]
            const hint = lastHint(ex)
            return (
              <div key={ex.id} className="subpanel lw-exercise" data-testid="exercise-live">
                <div className="lw-ex-head">
                  <h4 className="lw-ex-title">
                    {bi + 1}. {ex.name}
                    {ex.perSide ? <span className="wk-chip">por lado</span> : null}
                  </h4>
                  <div className="lw-ex-actions">
                    <button type="button" className="secondary-button" onClick={() => patchExercise(ex.id, (e) => ({ ...e, sets: [...e.sets, nextSetFrom(e.sets[e.sets.length - 1])] }))}>+ Serie</button>
                    <button type="button" className="secondary-button lw-icon-btn lw-danger" onClick={() => setExercises((l) => l.filter((e) => e.id !== ex.id))} aria-label={`Eliminar ${ex.name}`} title="Eliminar ejercicio"><Trash2 size={16} aria-hidden /></button>
                  </div>
                </div>
                {hint ? <p className="wk-hint-last">{hint}</p> : null}
                {ex.notes ? <p className="wk-hint-last">📝 {ex.notes}</p> : null}
                {ex.sets.length === 0 ? <p className="lw-empty">Sin series. Tocá "+ Serie" para agregar una.</p> : null}
                <div className="lw-sets">
                  {ex.sets.map((set, si) => {
                    const key = `${ex.id}-${si}`
                    return (
                      <div key={si} className="wk-live-set-wrap">
                        <div className={`lw-set${set.done ? ' is-done' : ''}`}>
                          <span className="lw-set-num">#{si + 1}</span>
                          <Steppers set={set} ex={ex} weightUnit={weightUnit} weightStep={weightStep} patch={(p) => patchSet(ex.id, si, p)} />
                          <div className="lw-set-actions">
                            <button type="button" className={`${set.done ? 'primary-button' : 'secondary-button'} lw-done`} onClick={() => toggleDone(ex, si)}>
                              <Check size={16} aria-hidden /> {set.done ? 'Hecha' : 'Completar'}
                            </button>
                            <button type="button" className="secondary-button lw-icon-btn" aria-expanded={openSet === key} aria-label={`Opciones de la serie ${si + 1}`} title="Calentamiento, al fallo, caídas…" onClick={() => setOpenSet(openSet === key ? null : key)}><MoreHorizontal size={16} aria-hidden /></button>
                            <button type="button" className="secondary-button lw-icon-btn lw-danger" onClick={() => patchExercise(ex.id, (e) => ({ ...e, sets: e.sets.filter((_, i) => i !== si) }))} aria-label={`Eliminar serie ${si + 1}`} title="Eliminar serie"><Trash2 size={15} aria-hidden /></button>
                          </div>
                        </div>
                        <SetBadges set={set} />
                        {openSet === key ? <SetOptions set={set} measure={measureOf(ex)} weightUnit={weightUnit} label={`${ex.name}, serie ${si + 1}`} onChange={(p) => patchSet(ex.id, si, p)} /> : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <button type="button" className="secondary-button wk-add-item" onClick={() => setAdding(true)}><Plus size={16} aria-hidden /> Agregar ejercicio o ítem</button>
        </div>
      )}

      <AddItemModal open={adding} onClose={() => setAdding(false)} newId={uuid} suggestions={suggestions} onAdd={(items) => setExercises((l) => [...l, ...items])} />

      <ConfirmModal
        open={discardOpen}
        title="¿Descartar este entrenamiento?"
        message="Se pierde todo lo que cargaste en esta sesión en vivo."
        confirmLabel="Descartar"
        onConfirm={() => { setDiscardOpen(false); onChange(null) }}
        onClose={() => setDiscardOpen(false)}
      />

      <Modal
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Finalizar entrenamiento"
        subtitle="Revisá el resumen y guardalo en tu historial"
        maxWidth={520}
        confirmDiscard={false}
        footer={
          <>
            <button type="button" className="secondary-button" onClick={() => setFinishOpen(false)}>Seguir entrenando</button>
            <button type="button" className="primary-button" style={{ background: '#10b981', borderColor: '#10b981' }} onClick={finish}>Guardar sesión</button>
          </>
        }
      >
        <div className="wk-finish">
          <div className="wk-finish-grid">
            <div><span className="wk-console-label">Tiempo</span><strong>{Math.max(1, Math.round(elapsed / 60))} min</strong></div>
            <div><span className="wk-console-label">Series hechas</span><strong>{stats.done} de {stats.total}</strong></div>
            <div><span className="wk-console-label">Volumen</span><strong>{stats.vol.toLocaleString('es-AR')} {weightUnit}</strong></div>
            <div><span className="wk-console-label">Ejercicios</span><strong>{summarizeSession({ exercises: state.exercises }).items}</strong></div>
          </div>
          {incomplete > 0 && stats.done > 0 ? (
            <label className="wk-check wk-finish-check">
              <input type="checkbox" checked={dropIncomplete} onChange={(e) => setDropIncomplete(e.target.checked)} />
              No guardar las {incomplete} serie{incomplete === 1 ? '' : 's'} que no completé
            </label>
          ) : null}
          <label className="wk-finish-notes">
            <span className="wk-console-label">Notas y sensaciones</span>
            <textarea rows={3} value={state.notes} onChange={(e) => setState((p) => ({ ...p, notes: e.target.value }))} placeholder="Energía, descanso previo, cómo te sentiste…" />
          </label>
        </div>
      </Modal>
    </div>
  )
}
