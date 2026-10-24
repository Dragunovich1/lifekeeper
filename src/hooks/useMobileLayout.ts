import { useState, useEffect } from 'react'
import { isNativePlatform, getPlatform } from '../services/platform'

export interface MobileLayoutState {
  isNative: boolean
  isMobile: boolean
  isTouch: boolean
  platform: 'android' | 'ios' | 'web'
}

export const useMobileLayout = (): MobileLayoutState => {
  const [state, setState] = useState<MobileLayoutState>(() => {
    const native = isNativePlatform()
    const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    const mobileWidth = typeof window !== 'undefined' ? window.innerWidth <= 820 : false
    return {
      isNative: native,
      isMobile: native || mobileWidth,
      isTouch: touch,
      platform: getPlatform(),
    }
  })

  useEffect(() => {
    const update = () => {
      const native = isNativePlatform()
      const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
      const mobileWidth = window.innerWidth <= 820
      setState({
        isNative: native,
        isMobile: native || mobileWidth,
        isTouch: touch,
        platform: getPlatform(),
      })
    }

    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('orientationchange', update, { passive: true })
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return state
}
