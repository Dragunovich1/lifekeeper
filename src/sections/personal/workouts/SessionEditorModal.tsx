import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { Activity } from 'lucide-react'
import { DatePicker } from '../../../components/DatePicker'
import { Modal } from '../../../components/Modal'
import { Select } from '../../../components/Select'
import type { WorkoutExercise, WorkoutSession, WorkoutType } from '../../../types'
import { fromLocalDateOrDateTime, toLocalDateKey } from '../../../utils/dates'
import { convertExerciseWeights, displayToKg, kgToDisplay, normalizeSet } from '../../../utils/workoutSets'
import { DISTANCE_TYPES, WORKOUT_TYPES, computePace } from './constants'
import { ItemsEditor } from './ItemsEditor'

interface Form {
  title: string
  date: string
  type: WorkoutType
  durationMinutes: number | ''
  distance: number | ''
  calories: number | ''
  notes: string
  exercises: WorkoutExercise[]
}

const blank = (): Form => ({ title: '', date: new Date().toISOString(), type: 'fuerza', durationMinutes: 45, distance: '', calories: '', notes: '', exercises: [] })

interface Props {
  open: boolean
  /** null = sesión nueva (se registra una que ya hiciste). */
  session: WorkoutSession | null
  onClose: () => void
  onSave: (session: WorkoutSession) => void
  isImperial: boolean
  suggestions: string[]
}

/** Modal para registrar una sesión ya hecha o editar una guardada. */
export function SessionEditorModal({ open, session, onClose, onSave, isImperial, suggestions }: Props) {
  const weightUnit = isImperial ? 'lb' : 'kg'
  const distUnit = isImperial ? 'mi' : 'km'
  const [form, setForm] = useState<Form>(blank)

  useEffect(() => {
    if (!open) return
    if (!session) {
      setForm(blank())
      return
    }
    setForm({
      title: session.title,
      date: session.date,
      type: session.type,
      durationMinutes: session.durationMinutes ?? '',
      distance: typeof session.distanceKm === 'number' ? Number((isImperial ? session.distanceKm / 1.60934 : session.distanceKm).toFixed(2)) : '',
      calories: session.calories ?? '',
      notes: session.notes ?? '',
      exercises: convertExerciseWeights(
        session.exercises.map((e) => ({ ...e, sets: e.sets.map(normalizeSet) })),
        (kg) => kgToDisplay(kg, isImperial),
      ),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session])

  const showDistance = DISTANCE_TYPES.includes(form.type) || (typeof form.distance === 'number' && form.distance > 0)
  const distanceKm = typeof form.distance === 'number' && form.distance > 0 ? (isImperial ? Number((form.distance * 1.60934).toFixed(2)) : form.distance) : undefined
  const pace = useMemo(() => computePace(distanceKm ?? '', form.durationMinutes, form.type), [distanceKm, form.durationMinutes, form.type])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const saved: WorkoutSession = {
      ...(session ?? {}),
      id: session?.id ?? uuid(),
      title: form.title.trim(),
      date: form.date,
      type: form.type,
      durationMinutes: typeof form.durationMinutes === 'number' ? form.durationMinutes : undefined,
      distanceKm,
      pace: pace || undefined,
      calories: typeof form.calories === 'number' ? form.calories : undefined,
      notes: form.notes.trim() || undefined,
      exercises: convertExerciseWeights(form.exercises, (v) => displayToKg(v, isImperial)).map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s, notes: s.notes?.trim() || undefined })) })),
    }
    onSave(saved)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={session ? 'Editar entrenamiento' : 'Registrar entrenamiento'}
      subtitle={session ? 'Cambiá los datos, las series o las notas' : 'Cargá una sesión que ya hiciste'}
      maxWidth={860}
      footer={
        <>
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button type="submit" form="session-editor-form" className="primary-button">{session ? 'Guardar cambios' : 'Guardar entrenamiento'}</button>
        </>
      }
    >
      <form id="session-editor-form" className="wk-form" onSubmit={submit}>
        <div className="wk-form-grid">
          <div className="field wk-span-2">
            <label htmlFor="se-title">Nombre o foco de la sesión *</label>
            <input id="se-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Pecho y tríceps, Fondo 10k, Bici nocturna" required />
          </div>
          <div className="field">
            <label htmlFor="se-type">Disciplina</label>
            <Select id="se-type" value={form.type} onChange={(v) => setForm({ ...form, type: v as WorkoutType })} options={WORKOUT_TYPES} ariaLabel="Disciplina" />
          </div>
          <div className="field">
            <label htmlFor="se-date">Fecha</label>
            <DatePicker id="se-date" value={toLocalDateKey(form.date)} onChange={(v) => setForm({ ...form, date: fromLocalDateOrDateTime(v, true) })} ariaLabel="Fecha del entrenamiento" />
          </div>
          <div className="field">
            <label htmlFor="se-duration">Duración (min)</label>
            <input id="se-duration" type="number" min="1" inputMode="numeric" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="45" />
          </div>
          {showDistance ? (
            <>
              <div className="field">
                <label htmlFor="se-distance">Distancia ({distUnit})</label>
                <input id="se-distance" type="number" step="0.01" min="0" inputMode="decimal" value={form.distance} onChange={(e) => setForm({ ...form, distance: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Ej. 6.5" />
              </div>
              <div className="field">
                <label htmlFor="se-calories">Calorías (kcal)</label>
                <input id="se-calories" type="number" min="0" inputMode="numeric" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Ej. 380" />
              </div>
            </>
          ) : null}
        </div>

        {pace ? (
          <div className="wk-pace">
            <Activity size={16} aria-hidden /> Ritmo promedio: <strong>{pace}</strong>
          </div>
        ) : null}

        <div className="wk-form-section">
          <h4>Ejercicios y series</h4>
          <ItemsEditor exercises={form.exercises} onChange={(exercises) => setForm((f) => ({ ...f, exercises }))} weightUnit={weightUnit} suggestions={suggestions} emptyText="Sumá ejercicios con “Agregar”. Para una salida de running o bici alcanza con la distancia y el tiempo." />
        </div>

        <div className="field">
          <label htmlFor="se-notes">Notas y sensaciones</label>
          <textarea id="se-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Energía, descanso previo, recuperación muscular…" />
        </div>
      </form>
    </Modal>
  )
}
