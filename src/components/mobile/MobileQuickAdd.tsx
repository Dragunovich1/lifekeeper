import { useEffect, useRef, useState } from 'react'
import { Check, Droplet, HeartPulse, NotebookPen, Plus, ShoppingCart, Wallet, Bell, X } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useAppData } from '../../hooks/useAppData'
import { triggerHaptic, triggerHapticNotification } from '../../services/platform'
import { toLocalDateKey } from '../../utils/dates'

interface Props {
  onNavigate: (section: string, subSection: string) => void
  hidden?: boolean
}

const GLASS_ML = 250

/** Botón flotante "+" con accesos rápidos para cargar cosas con el pulgar. */
export const MobileQuickAdd = ({ onNavigate, hidden }: Props) => {
  const { data, updateData } = useAppData()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])

  const toast = (msg: string) => {
    setFlash(msg)
    void triggerHapticNotification('success')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(null), 1800)
  }

  const addGlass = () => {
    const key = toLocalDateKey(new Date())
    const target = data.health.hydrationTargetMl ?? 2500
    updateData((prev) => {
      const logs = [...(prev.health.hydrationLogs ?? [])]
      const i = logs.findIndex((l) => l.date === key)
      if (i >= 0) logs[i] = { ...logs[i], amountMl: logs[i].amountMl + GLASS_ML, targetMl: target }
      else logs.unshift({ date: key, amountMl: GLASS_ML, targetMl: target })
      return { ...prev, health: { ...prev.health, hydrationLogs: logs } }
    })
    setOpen(false)
    toast(`+1 vaso de agua (${GLASS_ML} ml)`)
  }

  const saveNote = () => {
    const text = note.trim()
    if (!text) return
    const now = new Date().toISOString()
    updateData((prev) => ({
      ...prev,
      utilities: {
        ...prev.utilities,
        quickNotes: [{ id: uuid(), text, color: 'amarillo', pinned: false, createdAt: now, updatedAt: now }, ...(prev.utilities.quickNotes ?? [])],
      },
    }))
    setNote('')
    setOpen(false)
    toast('Nota guardada')
  }

  const go = (section: string, sub: string) => {
    setOpen(false)
    onNavigate(section, sub)
  }

  if (hidden) return null

  return (
    <>
      {open && <div className="mqa-backdrop" onClick={() => setOpen(false)} aria-hidden />}
      {open && (
        <div className="mqa-sheet" role="dialog" aria-label="Carga rápida">
          <div className="mqa-note">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveNote()}
              placeholder="Nota rápida…"
              enterKeyHint="done"
              aria-label="Nota rápida"
            />
            <button type="button" onClick={saveNote} disabled={!note.trim()} aria-label="Guardar nota">
              <Check size={18} />
            </button>
          </div>
          <div className="mqa-grid">
            <button type="button" onClick={addGlass}>
              <Droplet size={20} /> <span>Vaso de agua</span>
            </button>
            <button type="button" onClick={() => go('personal', 'finances')}>
              <Wallet size={20} /> <span>Gasto / ingreso</span>
            </button>
            <button type="button" onClick={() => go('health', 'measurements')}>
              <HeartPulse size={20} /> <span>Medición</span>
            </button>
            <button type="button" onClick={() => go('utilities', 'reminders')}>
              <Bell size={20} /> <span>Recordatorio</span>
            </button>
            <button type="button" onClick={() => go('utilities', 'shopping')}>
              <ShoppingCart size={20} /> <span>Compras</span>
            </button>
            <button type="button" onClick={() => go('utilities', 'quick-notes')}>
              <NotebookPen size={20} /> <span>Mis notas</span>
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className={`mqa-fab${open ? ' is-open' : ''}`}
        onClick={() => {
          void triggerHaptic('light')
          setOpen((v) => !v)
        }}
        aria-label={open ? 'Cerrar carga rápida' : 'Carga rápida'}
        aria-expanded={open}
      >
        {open ? <X size={24} /> : <Plus size={26} />}
      </button>
      {flash && (
        <div className="mqa-toast" role="status">
          {flash}
        </div>
      )}
    </>
  )
}
