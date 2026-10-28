import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, PinOff, StickyNote } from 'lucide-react'
import { useAppData } from '../hooks/useAppData'
import '../styles/utility-tools.css'

/**
 * Una sola card del Dashboard con las notas rápidas fijadas, en carrusel:
 * flechas y puntos en escritorio, deslizar con el dedo en el celular.
 */
export const PinnedNotesCard = () => {
  const { data, updateData } = useAppData()
  const pinned = useMemo(
    () => (data.utilities.quickNotes ?? []).filter((n) => n.pinned).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.utilities.quickNotes],
  )

  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const syncIndex = useCallback(() => {
    const el = trackRef.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }, [])

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(pinned.length - 1, i))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
    setIndex(clamped)
  }

  // Si se desfija una nota y el índice queda fuera de rango, se corrige
  useEffect(() => {
    if (index > pinned.length - 1) setIndex(Math.max(0, pinned.length - 1))
  }, [pinned.length, index])

  if (pinned.length === 0) return null

  const unpin = (id: string) =>
    updateData((prev) => ({
      ...prev,
      utilities: { ...prev.utilities, quickNotes: (prev.utilities.quickNotes ?? []).map((n) => (n.id === id ? { ...n, pinned: false } : n)) },
    }))

  const current = pinned[Math.min(index, pinned.length - 1)]

  return (
    <section className="pinned-card" data-color={current.color} aria-label="Notas fijadas" aria-roledescription="carrusel">
      <header className="pinned-head">
        <span className="pinned-title">
          <StickyNote size={16} aria-hidden="true" /> Notas fijadas
        </span>
        <span className="pinned-count">{pinned.length > 1 ? `${Math.min(index, pinned.length - 1) + 1} / ${pinned.length}` : '1 nota'}</span>
        <a className="pinned-link" href="#utilities:quick-notes">Ver todas</a>
      </header>

      <div className="pinned-body">
        {pinned.length > 1 && (
          <button type="button" className="pinned-arrow" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Nota anterior">
            <ChevronLeft size={18} />
          </button>
        )}

        <div className="pinned-track" ref={trackRef} onScroll={syncIndex} tabIndex={0} aria-live="polite">
          {pinned.map((n, i) => (
            <article key={n.id} className="pinned-slide" data-color={n.color} aria-roledescription="diapositiva" aria-label={`Nota ${i + 1} de ${pinned.length}`}>
              <a href="#utilities:quick-notes" className="pinned-text">{n.text}</a>
              <button type="button" className="pinned-unpin" onClick={() => unpin(n.id)} aria-label="Quitar del Dashboard" title="Quitar del Dashboard">
                <PinOff size={14} />
              </button>
            </article>
          ))}
        </div>

        {pinned.length > 1 && (
          <button type="button" className="pinned-arrow" onClick={() => goTo(index + 1)} disabled={index >= pinned.length - 1} aria-label="Nota siguiente">
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      {pinned.length > 1 && (
        <div className="pinned-dots" role="tablist" aria-label="Elegir nota">
          {pinned.map((n, i) => (
            <button key={n.id} type="button" role="tab" aria-selected={i === index} aria-label={`Ir a la nota ${i + 1}`} className={i === index ? 'is-active' : ''} onClick={() => goTo(i)} />
          ))}
        </div>
      )}
    </section>
  )
}
