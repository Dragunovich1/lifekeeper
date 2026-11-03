import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { ArrowLeft, ArrowRight, Copy, Plus, Trash2 } from 'lucide-react'
import { Modal } from '../../../components/Modal'
import { Select } from '../../../components/Select'
import type { WorkoutRoutine, WorkoutRoutineDay, WorkoutSession, WorkoutType } from '../../../types'
import { formatDate } from '../../../utils/dates'
import { cloneExercises } from '../../../utils/workoutGroups'
import { moveItem, newRoutine, sessionToDay } from '../../../utils/workoutRoutines'
import { convertExerciseWeights, displayToKg, kgToDisplay, normalizeSet } from '../../../utils/workoutSets'
import { WORKOUT_TYPES } from './constants'
import { ItemsEditor } from './ItemsEditor'

interface Props {
  open: boolean
  /** null = rutina nueva. */
  routine: WorkoutRoutine | null
  onClose: () => void
  onSave: (routine: WorkoutRoutine) => void
  workouts: WorkoutSession[]
  isImperial: boolean
  suggestions: string[]
}

const mapDays = (days: WorkoutRoutineDay[], fn: (kg: number) => number): WorkoutRoutineDay[] =>
  days.map((d) => ({ ...d, exercises: convertExerciseWeights(d.exercises.map((e) => ({ ...e, sets: e.sets.map(normalizeSet) })), fn) }))

/** Modal para crear o editar una rutina: nombre, días y los ejercicios de cada día. */
export function RoutineEditorModal({ open, routine, onClose, onSave, workouts, isImperial, suggestions }: Props) {
  const weightUnit = isImperial ? 'lb' : 'kg'
  const [draft, setDraft] = useState<WorkoutRoutine>(() => newRoutine('', uuid))
  const [dayIndex, setDayIndex] = useState(0)
  const [importId, setImportId] = useState('')

  useEffect(() => {
    if (!open) return
    const base = routine ?? newRoutine('', uuid)
    setDraft({ ...base, days: mapDays(base.days, (kg) => kgToDisplay(kg, isImperial)) })
    setDayIndex(0)
    setImportId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routine])

  const day = draft.days[Math.min(dayIndex, draft.days.length - 1)]
  const idx = Math.min(dayIndex, Math.max(0, draft.days.length - 1))
  const patchDay = (patch: Partial<WorkoutRoutineDay>) => setDraft((d) => ({ ...d, days: d.days.map((x, i) => (i === idx ? { ...x, ...patch } : x)) }))

  const importable = useMemo(() => workouts.filter((w) => w.exercises.length > 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40), [workouts])

  const addDay = () => {
    setDraft((d) => ({ ...d, days: [...d.days, { id: uuid(), name: `Día ${d.days.length + 1}`, type: 'fuerza', exercises: [] }] }))
    setDayIndex(draft.days.length)
  }
  const importDay = () => {
    const s = importable.find((w) => w.id === importId)
    if (!s) return
    const d = sessionToDay(s, uuid)
    const converted = mapDays([d], (kg) => kgToDisplay(kg, isImperial))[0]
    setDraft((r) => ({ ...r, days: [...r.days, converted] }))
    setDayIndex(draft.days.length)
    setImportId('')
  }
  const duplicateDay = () => {
    if (!day) return
    const copy: WorkoutRoutineDay = { ...day, id: uuid(), name: `${day.name} (copia)`, exercises: cloneExercises(day.exercises, uuid) }
    setDraft((r) => ({ ...r, days: [...r.days.slice(0, idx + 1), copy, ...r.days.slice(idx + 1)] }))
    setDayIndex(idx + 1)
  }
  const removeDay = () => {
    if (draft.days.length <= 1) return
    setDraft((r) => ({ ...r, days: r.days.filter((_, i) => i !== idx) }))
    setDayIndex(Math.max(0, idx - 1))
  }
  const moveDay = (dir: -1 | 1) => {
    setDraft((r) => ({ ...r, days: moveItem(r.days, idx, idx + dir) }))
    setDayIndex(idx + dir)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim()) return
    onSave({
      ...draft,
      name: draft.name.trim(),
      notes: draft.notes?.trim() || undefined,
      updatedAt: new Date().toISOString(),
      days: mapDays(draft.days, (v) => displayToKg(v, isImperial)).map((d) => ({ ...d, name: d.name.trim() || 'Día', notes: d.notes?.trim() || undefined })),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={routine ? 'Editar rutina' : 'Nueva rutina'}
      subtitle="Un programa con uno o más días (por ejemplo: Día 1 · Piernas, Día 2 · Tren superior)"
      maxWidth={940}
      footer={
        <>
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button type="submit" form="routine-editor-form" className="primary-button">{routine ? 'Guardar cambios' : 'Crear rutina'}</button>
        </>
      }
    >
      <form id="routine-editor-form" className="wk-form" onSubmit={submit}>
        <div className="wk-form-grid">
          <div className="field wk-span-2">
            <label htmlFor="re-name">Nombre de la rutina *</label>
            <input id="re-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej. Rutina Septiembre, Hipertrofia 4 días" required />
          </div>
          <div className="field wk-span-2">
            <label htmlFor="re-notes">Notas (opcional)</label>
            <input id="re-notes" value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Objetivo, duración del plan, indicaciones del profe…" />
          </div>
        </div>

        <div className="wk-days" role="tablist" aria-label="Días de la rutina">
          {draft.days.map((d, i) => (
            <button key={d.id} type="button" role="tab" aria-selected={i === idx} className={`wk-day-tab${i === idx ? ' is-active' : ''}`} onClick={() => setDayIndex(i)}>
              {d.name || `Día ${i + 1}`}
            </button>
          ))}
          <button type="button" className="wk-day-tab wk-day-add" onClick={addDay}><Plus size={14} aria-hidden /> Día</button>
        </div>

        {day ? (
          <div className="wk-day-panel">
            <div className="wk-form-grid">
              <div className="field">
                <label htmlFor="re-day-name">Nombre del día</label>
                <input id="re-day-name" value={day.name} onChange={(e) => patchDay({ name: e.target.value })} placeholder="Ej. Día 1 · Piernas" />
              </div>
              <div className="field">
                <label htmlFor="re-day-type">Disciplina</label>
                <Select id="re-day-type" value={day.type ?? 'fuerza'} onChange={(v) => patchDay({ type: v as WorkoutType })} options={WORKOUT_TYPES} ariaLabel="Disciplina del día" />
              </div>
              <div className="field wk-span-2">
                <label htmlFor="re-day-notes">Notas del día (opcional)</label>
                <input id="re-day-notes" value={day.notes ?? ''} onChange={(e) => patchDay({ notes: e.target.value })} placeholder="Ej. Cinta 20–30 min al final" />
              </div>
            </div>

            <div className="wk-day-tools">
              <button type="button" className="secondary-button wk-small" disabled={idx === 0} onClick={() => moveDay(-1)}><ArrowLeft size={14} aria-hidden /> Mover antes</button>
              <button type="button" className="secondary-button wk-small" disabled={idx === draft.days.length - 1} onClick={() => moveDay(1)}>Mover después <ArrowRight size={14} aria-hidden /></button>
              <button type="button" className="secondary-button wk-small" onClick={duplicateDay}><Copy size={14} aria-hidden /> Duplicar día</button>
              <button type="button" className="secondary-button wk-small wk-danger" disabled={draft.days.length <= 1} onClick={removeDay}><Trash2 size={14} aria-hidden /> Quitar día</button>
            </div>

            <ItemsEditor exercises={day.exercises} onChange={(exercises) => patchDay({ exercises })} weightUnit={weightUnit} suggestions={suggestions} emptyText="Este día todavía no tiene ejercicios. Usá “Agregar ejercicio o ítem”." />
          </div>
        ) : null}

        {importable.length > 0 ? (
          <div className="wk-import" data-no-dirty>
            <span className="wk-import-title">Traer un día desde tu historial</span>
            <div className="wk-import-row">
              <Select value={importId} onChange={setImportId} placeholder="Elegí una sesión…" options={importable.map((w) => ({ value: w.id, label: `${w.title} · ${formatDate(w.date)}` }))} ariaLabel="Sesión a importar" />
              <button type="button" className="secondary-button" disabled={!importId} onClick={importDay}>Agregar como día</button>
            </div>
          </div>
        ) : null}
      </form>
    </Modal>
  )
}
