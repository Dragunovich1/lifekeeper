import { useEffect, useRef } from 'react'

/** Scrollbar flotante de página: no reserva ancho y se desvanece al detenerse. */
export function PageScrollbar() {
  const thumb = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; scroll: number } | null>(null)

  useEffect(() => {
    const update = () => {
      const element = thumb.current
      if (!element) return
      const root = document.documentElement
      const viewport = root.clientHeight
      const track = Math.max(0, viewport - 8)
      const height = Math.min(track, Math.max(36, (track * viewport) / root.scrollHeight))
      const range = root.scrollHeight - viewport
      element.style.height = `${height}px`
      element.style.transform = `translateY(${range > 0 ? ((track - height) * window.scrollY) / range : 0}px)`
      element.hidden = range <= 0
    }
    document.documentElement.classList.add('lk-overlay-scroll')
    const resize = new ResizeObserver(update)
    resize.observe(document.body)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => {
      document.documentElement.classList.remove('lk-overlay-scroll')
      resize.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [])

  return (
    <div className="lk-page-scrollbar" aria-hidden="true">
      <div
        ref={thumb}
        className="lk-page-scroll-thumb"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          drag.current = { y: event.clientY, scroll: window.scrollY }
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.classList.add('dragging')
          event.preventDefault()
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          const root = document.documentElement
          const travel = root.clientHeight - 8 - event.currentTarget.offsetHeight
          if (travel > 0) {
            window.scrollTo({
              top:
                drag.current.scroll +
                ((event.clientY - drag.current.y) * (root.scrollHeight - root.clientHeight)) / travel,
              behavior: 'instant',
            })
          }
        }}
        onLostPointerCapture={(event) => {
          drag.current = null
          event.currentTarget.classList.remove('dragging')
        }}
      />
    </div>
  )
}
