import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ExerciseAdder, type ExerciseMeta } from './ExerciseAdder'
import { GROUP_MAX, type ExerciseDraft } from '../utils/workoutGroups'
import '../styles/workout-groups.css'

type Mode = 'single' | 'biserie' | 'triserie' | 'circuito'

const MODES: { value: Mode; label: string; slots: number; hint: string }[] = [
  { value: 'single', label: 'Ejercicio', slots: 1, hint: '' },
  { value: 'biserie', label: 'Biserie', slots: 2, hint: 'Dos ejercicios seguidos, sin descanso entre ellos.' },
  { value: 'triserie', label: 'Triserie', slots: 3, hint: 'Tres ejercicios seguidos en cada ronda.' },
  { value: 'circuito', label: 'Circuito', slots: 4, hint: 'Cuatro o más ejercicios en cada ronda.' },
]

interface Slot {
  name: string
  meta?: ExerciseMeta
}

interface Props {
  onAddSingle: (name: string, meta?: ExerciseMeta) => void
  onAddGroup: (drafts: ExerciseDraft[]) => void
  placeholder?: string
}

const letter = (i: number) => String.fromCharCode(65 + i)

/**
 * Agregar un ítem al entrenamiento: un ejercicio suelto, o una biserie / triserie / circuito,
 * donde se eligen varios ejercicios (dos en la biserie) para un mismo ítem.
 */
export function ExerciseItemAdder({ onAddSingle, onAddGroup, placeholder = 'Buscá un ejercicio: press, sentadilla, dominadas...' }: Props) {
  const [mode, setMode] = useState<Mode>('single')
  const [slots, setSlots] = useState<Slot[]>([{ name: '' }, { name: '' }])
  const current = MODES.find((m) => m.value === mode)!

  const changeMode = (next: Mode) => {
    setMode(next)
    const wanted = MODES.find((m) => m.value === next)!.slots
    setSlots((prev) => {
      const base = prev.slice(0, Math.max(wanted, 1))
      while (base.length < wanted) base.push({ name: '' })
      return base
    })
  }

  const setSlot = (i: number, name: string, meta?: ExerciseMeta) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { name, meta } : s)))

  const ready = slots.length >= 2 && slots.every((s) => s.name.trim())

  const submit = () => {
    if (!ready) return
    onAddGroup(slots.map((s) => ({ name: s.name.trim(), muscles: s.meta?.muscles, equipment: s.meta?.equipment })))
    setSlots(Array.from({ length: current.slots }, () => ({ name: '' })))
  }

  return (
    <div className="wg-adder">
      <div className="wg-modes" role="tablist" aria-label="Tipo de ítem">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            className={`wg-mode${mode === m.value ? ' is-active' : ''}`}
            onClick={() => changeMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'single' ? (
        <ExerciseAdder onAdd={onAddSingle} placeholder={placeholder} maxWidth="100%" />
      ) : (
        <div className="wg-slots">
          <p className="wg-hint">{current.hint} Elegí los ejercicios de este ítem:</p>
          {slots.map((slot, i) => (
            <div key={i} className="wg-slot">
              <span className="wg-letter" aria-hidden>{letter(i)}</span>
              <ExerciseAdder
                value={slot.name}
                onValueChange={(name, meta) => setSlot(i, name, meta)}
                placeholder={`Ejercicio ${letter(i)}`}
                ariaLabel={`Ejercicio ${letter(i)} del ítem`}
                maxWidth="100%"
              />
              {mode === 'circuito' && slots.length > 4 ? (
                <button
                  type="button"
                  className="secondary-button wg-icon-btn"
                  aria-label={`Quitar ejercicio ${letter(i)}`}
                  onClick={() => setSlots((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <X size={15} aria-hidden />
                </button>
              ) : null}
            </div>
          ))}
          <div className="wg-slot-actions">
            {mode === 'circuito' && slots.length < GROUP_MAX ? (
              <button type="button" className="secondary-button" onClick={() => setSlots((prev) => [...prev, { name: '' }])}>
                <Plus size={15} aria-hidden /> Otro ejercicio
              </button>
            ) : null}
            <button type="button" className="primary-button" onClick={submit} disabled={!ready}>
              <Plus size={16} aria-hidden /> Agregar {current.label.toLowerCase()}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
