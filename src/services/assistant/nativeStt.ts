import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { isNativePlatform } from '../platform'

/**
 * Dictado por voz con el reconocedor de Android (el WebView no trae `webkitSpeechRecognition`).
 */
export const isNativeSttAvailable = (): boolean => isNativePlatform()

export type NativeSttStart = 'ok' | 'unavailable' | 'denied' | 'error'

export async function startNativeStt(onText: (text: string) => void, onEnd: () => void): Promise<NativeSttStart> {
  try {
    const { available } = await SpeechRecognition.available()
    if (!available) return 'unavailable'

    let perm = await SpeechRecognition.checkPermissions()
    if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions()
    if (perm.speechRecognition !== 'granted') return 'denied'

    await SpeechRecognition.removeAllListeners()
    await SpeechRecognition.addListener('partialResults', (data) => {
      const text = data.matches?.[0]
      if (text) onText(text)
    })
    await SpeechRecognition.addListener('listeningState', (data) => {
      if (data.status === 'stopped') onEnd()
    })
    await SpeechRecognition.start({ language: 'es-AR', partialResults: true, popup: false })
    return 'ok'
  } catch {
    return 'error'
  }
}

export async function stopNativeStt(): Promise<void> {
  try {
    await SpeechRecognition.stop()
  } catch {
    /* ya estaba detenido */
  }
  await SpeechRecognition.removeAllListeners().catch(() => undefined)
}
