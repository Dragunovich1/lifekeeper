import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { isNativePlatform } from '../platform'

/**
 * Voz del sistema Android (motor de texto a voz del teléfono, funciona sin internet).
 * `speechSynthesis` del WebView es poco confiable (sin voces o mudo), por eso en la APK se usa este plugin.
 */
export const isNativeTtsAvailable = (): boolean => isNativePlatform()

const LANG_PREFERENCE = ['es-AR', 'es-MX', 'es-US', 'es-419', 'es-ES', 'es']
let cachedLang: string | null = null

async function pickLang(): Promise<string> {
  if (cachedLang) return cachedLang
  try {
    const { languages } = await TextToSpeech.getSupportedLanguages()
    const norm = languages.map((l) => l.replace('_', '-'))
    const found = LANG_PREFERENCE.find((p) => norm.some((l) => l.toLowerCase() === p.toLowerCase()))
    cachedLang = found ?? norm.find((l) => l.toLowerCase().startsWith('es')) ?? 'es-ES'
  } catch {
    cachedLang = 'es-ES'
  }
  return cachedLang
}

export const cleanForSpeech = (text: string): string =>
  text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/[•\-#_*`~>]/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Lee el texto con el motor del teléfono. Resuelve al terminar de hablar. */
export async function speakNative(text: string, opts: { gender?: 'female' | 'male' | 'system'; rate?: number } = {}): Promise<boolean> {
  const clean = cleanForSpeech(text)
  if (!clean) return false
  try {
    await TextToSpeech.stop().catch(() => undefined)
    await TextToSpeech.speak({
      text: clean.slice(0, 3500),
      lang: await pickLang(),
      rate: opts.rate ?? 1.0,
      pitch: opts.gender === 'female' ? 1.12 : opts.gender === 'male' ? 0.88 : 1.0,
      volume: 1.0,
    })
    return true
  } catch {
    return false
  }
}

export const stopNative = (): void => {
  if (!isNativePlatform()) return
  void TextToSpeech.stop().catch(() => undefined)
}
