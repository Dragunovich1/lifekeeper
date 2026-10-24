import { useEffect, useRef } from 'react'
import { triggerHaptic } from '../services/platform'

interface SwipeHandlers {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

interface SwipeOptions {
  threshold?: number
  verticalToleranceRatio?: number
  enabled?: boolean
}

export const useSwipeGesture = (
  targetRef: React.RefObject<HTMLElement | null>,
  handlers: SwipeHandlers,
  options: SwipeOptions = {},
) => {
  const { threshold = 55, verticalToleranceRatio = 1.3, enabled = true } = options
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null)

  useEffect(() => {
    const el = targetRef.current
    if (!el || !enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      // Don't hijack input/textarea/select interactions or horizontal sliders
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.closest('.no-swipe') ||
          target.closest('input[type="range"]') ||
          target.closest('.mobile-subnav-scroll'))
      ) {
        startRef.current = null
        return
      }

      if (e.touches.length === 1) {
        startRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          time: Date.now(),
        }
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!startRef.current || e.changedTouches.length === 0) return

      const deltaX = e.changedTouches[0].clientX - startRef.current.x
      const deltaY = e.changedTouches[0].clientY - startRef.current.y
      const elapsed = Date.now() - startRef.current.time

      startRef.current = null

      // Swipes must be reasonably fast (under 600ms)
      if (elapsed > 600) return

      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      // Horizontal swipe detection
      if (absX >= threshold && absX > absY * verticalToleranceRatio) {
        if (deltaX < 0 && handlers.onSwipeLeft) {
          triggerHaptic('light')
          handlers.onSwipeLeft()
        } else if (deltaX > 0 && handlers.onSwipeRight) {
          triggerHaptic('light')
          handlers.onSwipeRight()
        }
        return
      }

      // Vertical swipe detection (e.g. pull down / swipe up)
      if (absY >= threshold && absY > absX * verticalToleranceRatio) {
        if (deltaY < 0 && handlers.onSwipeUp) {
          handlers.onSwipeUp()
        } else if (deltaY > 0 && handlers.onSwipeDown) {
          handlers.onSwipeDown()
        }
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [targetRef, handlers, threshold, verticalToleranceRatio, enabled])
}
