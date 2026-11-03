import { useEffect, useRef, useState } from 'react'
import { triggerHaptic } from '../services/platform'

/** Tirar hacia abajo desde el tope de la pantalla dispara `onRefresh` (estilo app nativa). */
export const usePullToRefresh = (
  targetRef: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void>,
  { enabled = true, threshold = 80 } = {},
) => {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const pullRef = useRef(0)
  const busy = useRef(false)
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh

  useEffect(() => {
    const el = targetRef.current
    if (!el || !enabled) return

    const onStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement | null
      if (busy.current || el.scrollTop > 0 || t?.closest('input, textarea, select, .no-swipe, .mobile-subnav-scroll')) {
        startY.current = null
        return
      }
      startY.current = e.touches[0].clientY
    }
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || el.scrollTop > 0) {
        pullRef.current = 0
        setPull(0)
        return
      }
      pullRef.current = Math.min(dy * 0.5, threshold * 1.4)
      setPull(pullRef.current)
    }
    const onEnd = async () => {
      const reached = pullRef.current >= threshold
      startY.current = null
      pullRef.current = 0
      setPull(0)
      if (!reached || busy.current) return
      busy.current = true
      setRefreshing(true)
      void triggerHaptic('medium')
      try {
        await refreshRef.current()
      } finally {
        busy.current = false
        setRefreshing(false)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [targetRef, enabled, threshold])

  return { pull, refreshing }
}
