import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { QUICK_PROMPTS } from './constants'

/**
 * Carrusel de sugerencias. En escritorio se maneja con flechas y rueda del mouse;
 * en móvil, con scroll táctil. Las flechas se ocultan en los extremos.
 */
export function QuickPrompts({
  onSelect,
  disabled,
}: {
  onSelect: (query: string) => void
  disabled?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const updateEdges = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateEdges()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(updateEdges)
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateEdges])

  // La rueda vertical del mouse desplaza el carrusel en horizontal
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollBy({ left: e.deltaY })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const scrollBy = (dir: -1 | 1) => {
    const el = trackRef.current
    if (el) el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.6), behavior: 'smooth' })
  }

  return (
    <div className="asst-quick" role="group" aria-label="Sugerencias rápidas">
      <button
        type="button"
        className="asst-quick-arrow"
        onClick={() => scrollBy(-1)}
        aria-label="Ver sugerencias anteriores"
        tabIndex={canLeft ? 0 : -1}
        data-hidden={!canLeft}
      >
        <ChevronLeft size={16} />
      </button>

      <div
        ref={trackRef}
        className="asst-quick-track"
        onScroll={updateEdges}
        data-fade-left={canLeft}
        data-fade-right={canRight}
      >
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p.query}
            type="button"
            className="asst-chip"
            disabled={disabled}
            onClick={() => onSelect(p.query)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="asst-quick-arrow"
        onClick={() => scrollBy(1)}
        aria-label="Ver más sugerencias"
        tabIndex={canRight ? 0 : -1}
        data-hidden={!canRight}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
