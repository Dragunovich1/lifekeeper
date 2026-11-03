import { useEffect, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { ExerciseAdder, type ExerciseMeta } from '../../../components/ExerciseAdder'
import { Modal } from '../../../components/Modal'
import type { WorkoutExercise } from '../../../types'
import { GROUP_MAX, createGroup, createSingle, type ExerciseDraft } from '../../../utils/workoutGroups'
import { guessMeasure } from '../../../utils/workoutSets'
import { REST_CHOICES, restLabel } from './ExerciseCard'
import '../../../styles/workout-groups.css'

type Mode = 'single' | 'biserie' | 'triserie' | 'circuito'

const MODES: { value: Mode; label: string; slots: number; hint: string }[] = [
  { value: 'single', label: 'Ejercicio', slots: 1, hint: 'Un ejercicio con sus series.' },
  { value: 'biserie', label: 'Biserie', slots: 2, hint: 'Dos ejercicios seguidos, sin descanso entre ellos.' },
  { value: 'triserie', label: 'Triserie', slots: 3, hint: 'Tres ejercicios seguidos en cada ronda.' },
  { value: 'circuito', label: 'Circuito', slots: 4, hint: 'Cuatro o más ejercicios en cada ronda.' },
]

interface Slot {
  name: string
  meta?: ExerciseMeta
}

const letter = (i: number) => String.fromCharCode(65 + i)
const emptySlots = (n: number): Slot[] => Array.from({ length: n }, () => ({ name: '' }))

interface Props {
  open: boolean
  onClose: () => void
  /** Se llama con los ejercicios nuevos (1 si es suelto; varios con el mismo grupo si es biserie/triserie/circuito). */
  onAdd: (items: WorkoutExercise[]) => void
  newId: () => string
  /** Ejercicios que ya usaste o son comunes, para elegir con un toque. */
  suggestions?: string[]
}

/** Modal para agregar un ítem: un ejercicio, una biserie, una triserie o un circuito. */
export function AddItemModal({ open, onClose, onAdd, newId, suggestions = [] }: Props) {
  const [mode, setMode] = useState<Mode>('single')
  const [slots, setSlots] = useState<Slot[]>(emptySlots(1))
  const [sets, setSets] = useState(3)
  const [rest, setRest] = useState(0)
  const current = MODES.find((m) => m.value === mode)!

  useEffect(() => {
    if (open) {
      setMode('single')
      setSlots(emptySlots(1))
      setSets(3)
      setRest(0)
    }
  }, [open])

  const changeMode = (next: Mode) => {
    setMode(next)
    const wanted = MODES.find((m) => m.value === next)!.slots
    setSlots((prev) => {
      const base = prev.slice(0, wanted)
      while (base.length < wanted) base.push({ name: '' })
      return base
    })
  }
  const setSlot = (i: number, name: string, meta?: ExerciseMeta) => setSlots((prev) => prev.map((s, idx) => (idx === i ? { name, meta } : s)))
  const pickSuggestion = (name: string) =>
    setSlots((prev) => {
      const i = prev.findIndex((s) => !s.name.trim())
      return prev.map((s, idx) => (idx === (i >= 0 ? i : prev.length - 1) ? { name } : s))
    })

  const filled = slots.filter((s) => s.name.trim())
  const ready = mode === 'single' ? filled.length === 1 : slots.length >= 2 && filled.length === slots.length

  const build = (): WorkoutExercise[] => {
    const drafts: ExerciseDraft[] = slots.map((s) => ({ name: s.name.trim(), muscles: s.meta?.muscles, equipment: s.meta?.equipment, measure: guessMeasure(s.name) }))
    return mode === 'single' ? [createSingle(drafts[0], newId, sets, rest || undefined)] : createGroup(drafts, newId, sets, rest || undefined)
  }

  const submit = (keepOpen: boolean) => {
    if (!ready) return
    onAdd(build())
    if (keepOpen) setSlots(emptySlots(current.slots))
    else onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar al entrenamiento"
      subtitle="Elegí el tipo de ítem y los ejercicios"
      maxWidth={560}
      confirmDiscard={false}
      footer={
        <>
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button type="button" className="secondary-button" disabled={!ready} onClick={() => submit(true)}>Agregar y seguir</button>
          <button type="button" className="primary-button" disabled={!ready} onClick={() => submit(false)}>
            <Plus size={16} aria-hidden /> Agregar
          </button>
        </>
      }
    >
      <form className="wg-adder" onSubmit={(e: FormEvent) => { e.preventDefault(); submit(false) }}>
        <div className="wg-modes" role="tablist" aria-label="Tipo de ítem">
          {MODES.map((m) => (
            <button key={m.value} type="button" role="tab" aria-selected={mode === m.value} className={`wg-mode${mode === m.value ? ' is-active' : ''}`} onClick={() => changeMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="wg-hint">{current.hint}</p>

        <div className="wg-slots">
          {slots.map((slot, i) => (
            <div key={i} className="wg-slot">
              {mode !== 'single' ? <span className="wg-letter" aria-hidden>{letter(i)}</span> : null}
              <ExerciseAdder
                value={slot.name}
                onValueChange={(name, meta) => setSlot(i, name, meta)}
                placeholder={mode === 'single' ? 'Buscá un ejercicio: press, sentadilla, dominadas…' : `Ejercicio ${letter(i)}`}
                ariaLabel={mode === 'single' ? 'Ejercicio' : `Ejercicio ${letter(i)} del ítem`}
                maxWidth="100%"
              />
              {mode === 'circuito' && slots.length > 4 ? (
                <button type="button" className="secondary-button wg-icon-btn" aria-label={`Quitar ejercicio ${letter(i)}`} onClick={() => setSlots((prev) => prev.filter((_, idx) => idx !== i))}>
                  <X size={15} aria-hidden />
                </button>
              ) : null}
            </div>
          ))}
          {mode === 'circuito' && slots.length < GROUP_MAX ? (
            <button type="button" className="secondary-button wg-more-slot" onClick={() => setSlots((prev) => [...prev, { name: '' }])}>
              <Plus size={15} aria-hidden /> Otro ejercicio
            </button>
          ) : null}
        </div>

        {suggestions.length > 0 ? (
          <div className="wg-suggest" aria-label="Ejercicios frecuentes">
            <span className="wg-suggest-title">Frecuentes</span>
            <div className="wg-suggest-list">
              {suggestions.slice(0, 14).map((n) => (
                <button key={n} type="button" className="wg-suggest-chip" onClick={() => pickSuggestion(n)}>{n}</button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="wg-defaults">
          <label className="wk-field wk-field-lg">
            <input type="number" min="1" max="20" inputMode="numeric" value={sets} onChange={(e) => setSets(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} aria-label={mode === 'single' ? 'Cantidad de series' : 'Cantidad de rondas'} />
            <small>{mode === 'single' ? 'series' : 'rondas'}</small>
          </label>
          <label className="wk-rest">
            <span>Descanso</span>
            <select className="select" value={rest} onChange={(e) => setRest(Number(e.target.value))}>
              {REST_CHOICES.map((s) => <option key={s} value={s}>{restLabel(s)}</option>)}
            </select>
          </label>
        </div>
      </form>
    </Modal>
  )
}
