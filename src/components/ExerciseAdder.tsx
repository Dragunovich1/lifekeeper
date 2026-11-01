import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { searchExercises } from '../services/api/publicData'
import { searchLocalExercises, type ExerciseSuggestion } from '../utils/exerciseCatalog'
import '../styles/exercise-adder.css'

export interface ExerciseMeta {
  muscles?: string[]
  equipment?: string[]
}

interface Props {
  onAdd: (name: string, meta?: ExerciseMeta) => void
  placeholder?: string
  maxWidth?: number | string
}

/** Campo para agregar un ejercicio con sugerencias del catálogo (base local + wger cuando hay conexión). */
export function ExerciseAdder({ onAdd, placeholder = 'Nombre del ejercicio…', maxWidth = 420 }: Props) {
  const listId = useId()
  const [text, setText] = useState('')
  const [items, setItems] = useState<ExerciseSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [remoteUsed, setRemoteUsed] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  // Catálogo base al instante; el de wger se suma después de una pausa corta al tipear
  useEffect(() => {
    const q = text.trim()
    if (q.length < 2) {
      setItems([])
      setRemoteUsed(false)
      return
    }
    setItems(searchLocalExercises(q, 8))
    const mine = ++seq.current
    const timer = window.setTimeout(() => {
      void searchExercises(q, 8).then((merged) => {
        if (mine !== seq.current) return
        setItems(merged)
        setRemoteUsed(merged.some((m) => m.source === 'wger'))
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [text])

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [])

  const commit = (name: string, meta?: ExerciseMeta) => {
    const clean = name.trim()
    if (!clean) return
    onAdd(clean, meta)
    setText('')
    setItems([])
    setOpen(false)
    setActive(-1)
  }

  const pick = (s: ExerciseSuggestion) => commit(s.name, { muscles: s.muscles.slice(0, 4), equipment: s.equipment.slice(0, 3) })

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault()
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && active >= 0 && items[active]) pick(items[active])
      else commit(text)
    }
  }

  const showList = open && items.length > 0

  return (
    <div className="ex-adder" ref={wrapRef} style={{ maxWidth }}>
      <div className="ex-adder-row">
        <input
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button type="button" className="secondary-button" onClick={() => commit(text)} disabled={!text.trim()}>
          <Plus size={16} /> Agregar
        </button>
      </div>

      {showList && (
        <ul className="ex-suggest" id={listId} role="listbox">
          {items.map((s, i) => (
            <li key={`${s.source}-${s.name}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'is-active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
                <strong>{s.name}</strong>
                <small>{[...s.muscles.slice(0, 2), ...s.equipment.slice(0, 1)].join(' · ') || s.category}</small>
              </button>
            </li>
          ))}
          <li className="ex-suggest-foot" aria-hidden="true">{remoteUsed ? 'Catálogo base + wger.de' : 'Catálogo base de LifeKeeper'}</li>
        </ul>
      )}
    </div>
  )
}
