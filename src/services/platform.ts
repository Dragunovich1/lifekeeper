import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform()
}

export const getPlatform = (): 'android' | 'ios' | 'web' => {
  return Capacitor.getPlatform() as 'android' | 'ios' | 'web'
}

/**
 * Configure native Android / iOS Status Bar
 */
export const configureNativeStatusBar = async (isDarkMode: boolean) => {
  if (!isNativePlatform()) return
  try {
    await StatusBar.setStyle({
      style: isDarkMode ? Style.Dark : Style.Light,
    })
    if (getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({
        color: isDarkMode ? '#0a0a0c' : '#f8fafc',
      })
      await StatusBar.setOverlaysWebView({ overlay: false })
    }
  } catch (err) {
    console.debug('StatusBar configuration not supported on current platform', err)
  }
}

/**
 * Tactile Haptic Feedback
 */
export const triggerHaptic = async (style: 'light' | 'medium' | 'heavy' = 'light') => {
  try {
    if (isNativePlatform()) {
      const impactMap: Record<string, ImpactStyle> = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      }
      await Haptics.impact({ style: impactMap[style] ?? ImpactStyle.Light })
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const vibrateTimes: Record<string, number> = {
        light: 10,
        medium: 25,
        heavy: 45,
      }
      navigator.vibrate(vibrateTimes[style] ?? 10)
    }
  } catch {
    // Silently ignore if vibration is not supported/granted
  }
}

export const triggerHapticSelection = async () => {
  try {
    if (isNativePlatform()) {
      await Haptics.selectionChanged()
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8)
    }
  } catch {
    // Ignore
  }
}

export const triggerHapticNotification = async (type: 'success' | 'warning' | 'error' = 'success') => {
  try {
    if (isNativePlatform()) {
      const notifMap: Record<string, NotificationType> = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      }
      await Haptics.notification({ type: notifMap[type] ?? NotificationType.Success })
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const pattern = type === 'success' ? [15, 50, 15] : [40, 60, 40]
      navigator.vibrate(pattern)
    }
  } catch {
    // Ignore
  }
}
