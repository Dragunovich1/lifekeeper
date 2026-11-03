import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, Droplet, EyeOff, HeartPulse, NotebookPen, Plus, ShoppingCart, Wallet, Bell, X } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useAppData } from '../../hooks/useAppData'
import { usePreferences } from '../../preferences/context'
import { triggerHaptic, triggerHapticNotification } from '../../services/platform'
import { toLocalDateKey } from '../../utils/dates'
import { requestQuickAction, type QuickActionKind } from '../../utils/quickAction'

interface Props {
  onNavigate: (section: string, subSection: string) => void
  hidden?: boolean
}

const GLASS_ML = 250
const POS_KEY = 'lifekeeper:fab-pos'
const SIZE = 52
const MARGIN = 16

interface FabPos {
  side: 'left' | 'right'
  /** Distancia desde el borde inferior de la pantalla, en px. */
  bottom: number
}

const loadPos = (): FabPos | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null')
    if (raw && (raw.side === 'left' || raw.side === 'right') && typeof raw.bottom === 'number') return raw
  } catch {
    /* sin posición guardada */
  }
  return null
}

/** Botón flotante "+" con accesos rápidos para cargar cosas con el pulgar. */
export const MobileQuickAdd = ({ onNavigate, hidden }: Props) => {
  const { data, updateData } = useAppData()
  const { preferences, updatePreferences } = usePreferences()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<FabPos | null>(loadPos)
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const gesture = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)
  const movedRef = useRef(false)
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

  const go = (section: string, sub: string, action?: QuickActionKind) => {
    setOpen(false)
    if (action) requestQuickAction(action)
    onNavigate(section, sub)
  }

  // Alto de la barra inferior (para no taparla ni quedar debajo de ella) y de la barra superior
  const bounds = () => {
    const nav = document.querySelector('.mobile-bottom-nav')?.getBoundingClientRect().height ?? 64
    const top = (document.querySelector('.mobile-top-bar')?.getBoundingClientRect().bottom ?? 56) + 8
    return { minBottom: nav + 8, maxBottom: Math.max(nav + 8, window.innerHeight - top - SIZE) }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    gesture.current = { startX: e.clientX, startY: e.clientY, moved: false }
    movedRef.current = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = gesture.current
    if (!g) return
    if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 8) return
    g.moved = true
    movedRef.current = true
    setOpen(false)
    const { minBottom, maxBottom } = bounds()
    const y = Math.min(window.innerHeight - minBottom - SIZE, Math.max(window.innerHeight - maxBottom - SIZE, e.clientY - SIZE / 2))
    setDrag({ x: Math.min(window.innerWidth - SIZE, Math.max(0, e.clientX - SIZE / 2)), y })
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = gesture.current
    gesture.current = null
    if (!g?.moved) return
    // Se pega al borde más cercano y se recuerda
    const { minBottom, maxBottom } = bounds()
    const centerX = (drag?.x ?? e.clientX) + SIZE / 2
    const rawBottom = window.innerHeight - ((drag?.y ?? e.clientY) + SIZE)
    const next: FabPos = {
      side: centerX < window.innerWidth / 2 ? 'left' : 'right',
      bottom: Math.round(Math.min(maxBottom, Math.max(minBottom, rawBottom))),
    }
    setPos(next)
    setDrag(null)
    void triggerHaptic('light')
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(next))
    } catch {
      /* no se pudo guardar */
    }
  }

  const hideFab = () => {
    setOpen(false)
    try {
      localStorage.removeItem(POS_KEY)
    } catch {
      /* nada */
    }
    setPos(null)
    updatePreferences({ quickAddFab: false })
    toast('Botón oculto. Volvé a activarlo en Configuración')
  }

  const fabStyle: CSSProperties = drag
    ? { left: drag.x, top: drag.y, right: 'auto', bottom: 'auto', transition: 'none' }
    : pos
      ? pos.side === 'left'
        ? { left: MARGIN, right: 'auto', bottom: pos.bottom }
        : { right: MARGIN, bottom: pos.bottom }
      : {}

  const toastEl = flash ? (
    <div className="mqa-toast" role="status">
      {flash}
    </div>
  ) : null

  if (hidden || !preferences.quickAddFab) return toastEl

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
            <button type="button" onClick={() => go('personal', 'finances', 'expense')}>
              <Wallet size={20} /> <span>Gasto / ingreso</span>
            </button>
            <button type="button" onClick={() => go('health', 'measurements', 'measurement')}>
              <HeartPulse size={20} /> <span>Medición</span>
            </button>
            <button type="button" onClick={() => go('utilities', 'reminders', 'reminder')}>
              <Bell size={20} /> <span>Recordatorio</span>
            </button>
            <button type="button" onClick={() => go('utilities', 'shopping')}>
              <ShoppingCart size={20} /> <span>Compras</span>
            </button>
            <button type="button" onClick={() => go('utilities', 'quick-notes')}>
              <NotebookPen size={20} /> <span>Mis notas</span>
            </button>
          </div>
          <p className="mqa-hint">Podés arrastrar el botón para moverlo.</p>
          <button type="button" className="mqa-hide" onClick={hideFab}>
            <EyeOff size={15} aria-hidden /> Ocultar este botón
          </button>
        </div>
      )}
      <button
        type="button"
        className={`mqa-fab${open ? ' is-open' : ''}${drag ? ' is-dragging' : ''}`}
        style={fabStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (movedRef.current) {
            movedRef.current = false
            return
          }
          void triggerHaptic('light')
          setOpen((v) => !v)
        }}
        aria-label={open ? 'Cerrar carga rápida' : 'Carga rápida'}
        aria-expanded={open}
      >
        {open ? <X size={24} /> : <Plus size={26} />}
      </button>
      {toastEl}
    </>
  )
}
