import { Haptics, ImpactStyle } from '@capacitor/haptics'

export const playRestTimerSound = () => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // Two pleasant high beeps (880Hz -> A5, 1174Hz -> D6)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    gain1.gain.setValueAtTime(0.25, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.15)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1174.66, now + 0.18)
    gain2.gain.setValueAtTime(0.3, now + 0.18)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.18)
    osc2.stop(now + 0.38)
  } catch (err) {
    console.warn('AudioContext not available:', err)
  }
}

export const triggerHapticFeedback = async (
  type: 'impact' | 'notification' | 'double' = 'impact',
) => {
  try {
    if (type === 'double') {
      await Haptics.vibrate({ duration: 300 })
      setTimeout(() => {
        Haptics.vibrate({ duration: 300 }).catch(() => {})
      }, 400)
    } else {
      await Haptics.impact({ style: ImpactStyle.Heavy })
    }
  } catch {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(type === 'double' ? [200, 100, 200] : 100)
    }
  }
}
