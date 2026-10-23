import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface ScrollbarOverlayProps {
  targetRef: RefObject<HTMLElement | null>
  zIndex?: number
  minThumb?: number
}

interface Geometry {
  top: number
  height: number
  left: number
  travel: number
  range: number
}

/**
 * Scrollbar flotante para contenedores con scroll propio (sidebar, modales).
 * Se renderiza en un portal para no depender de transforms del contenedor.
 */
export const ScrollbarOverlay = ({ targetRef, zIndex = 1035, minThumb = 36 }: ScrollbarOverlayProps) => {
  const [visible, setVisible] = useState(false)
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const geometryRef = useRef<Geometry | null>(null)
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const element = targetRef.current
    if (!element) return

    // En táctil se conserva la scrollbar nativa (regla del kit)
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) {
      return
    }

    element.classList.add('lk-hide-scrollbar')

    const clearHide = () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
    }

    const scheduleHide = () => {
      clearHide()
      hideTimer.current = setTimeout(() => setVisible(false), 900)
    }

    const show = () => {
      clearHide()
      setVisible(true)
    }

    const update = () => {
      const rect = element.getBoundingClientRect()
      const viewport = window.innerHeight
      const trackTop = Math.max(rect.top, 0) + 4
      const trackBottom = Math.min(rect.bottom, viewport) - 4
      const track = trackBottom - trackTop
      const overflows = element.scrollHeight > element.clientHeight + 1

      if (!overflows || track < minThumb + 8 || rect.width === 0 || rect.right <= 0) {
        geometryRef.current = null
        setGeometry(null)
        setVisible(false)
        return
      }

      const height = Math.min(track, Math.max(minThumb, (track * element.clientHeight) / element.scrollHeight))
      const range = element.scrollHeight - element.clientHeight
      const travel = track - height
      const progress = range > 0 ? element.scrollTop / range : 0
      const next: Geometry = {
        top: trackTop + travel * progress,
        height,
        left: rect.right - 8,
        travel,
        range,
      }
      geometryRef.current = next
      setGeometry(next)
    }

    const onScroll = () => {
      update()
      show()
      scheduleHide()
    }

    const onPointerEnter = () => {
      update()
      if (geometryRef.current) show()
    }

    element.addEventListener('scroll', onScroll, { passive: true })
    element.addEventListener('pointerenter', onPointerEnter)
    element.addEventListener('pointerleave', scheduleHide)

    const resize = new ResizeObserver(() => update())
    resize.observe(element)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })
    update()

    return () => {
      clearHide()
      element.classList.remove('lk-hide-scrollbar')
      element.removeEventListener('scroll', onScroll)
      element.removeEventListener('pointerenter', onPointerEnter)
      element.removeEventListener('pointerleave', scheduleHide)
      resize.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [targetRef, minThumb])

  if (!geometry || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={`lk-overlay-scrollbar${visible ? ' visible' : ''}`}
      style={{ top: geometry.top, height: geometry.height, left: geometry.left, zIndex }}
      aria-hidden="true"
    >
      <div
        className="lk-overlay-thumb"
        style={{ height: geometry.height }}
        onPointerDown={(event) => {
          const element = targetRef.current
          if (!element || event.button !== 0) return
          dragRef.current = { startY: event.clientY, startScroll: element.scrollTop }
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.classList.add('dragging')
          event.preventDefault()
        }}
        onPointerMove={(event) => {
          const element = targetRef.current
          const drag = dragRef.current
          const current = geometryRef.current
          if (!element || !drag || !current) return
          const delta = ((event.clientY - drag.startY) * current.range) / Math.max(1, current.travel)
          element.scrollTop = drag.startScroll + delta
        }}
        onLostPointerCapture={(event) => {
          dragRef.current = null
          event.currentTarget.classList.remove('dragging')
        }}
      />
    </div>,
    document.body,
  )
}
