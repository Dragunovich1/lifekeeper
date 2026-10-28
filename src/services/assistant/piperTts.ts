/**
 * Cliente de voz neural local (Piper TTS) para el asistente.
 * El texto viaja únicamente hacia el contenedor `tts` del servidor propio (vía nginx).
 * Si el servicio no está disponible, el asistente cae a la voz del navegador.
 */

export type PiperVoiceKey = 'female' | 'male'

let currentAudio: HTMLAudioElement | null = null
let currentUrl: string | null = null
let controller: AbortController | null = null
let availability: { value: boolean; checkedAt: number } | null = null

const AVAILABILITY_TTL_MS = 60_000

export async function isPiperAvailable(): Promise<boolean> {
  const now = Date.now()
  if (availability && now - availability.checkedAt < AVAILABILITY_TTL_MS) return availability.value
  try {
    const res = await fetch('/api/tts/health', { signal: AbortSignal.timeout(3000) })
    availability = { value: res.ok, checkedAt: now }
  } catch {
    availability = { value: false, checkedAt: now }
  }
  return availability.value
}

export function stopPiper(): void {
  controller?.abort()
  controller = null
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio = null
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl)
    currentUrl = null
  }
}

/**
 * Sintetiza y reproduce el texto. Resuelve `true` si se reprodujo con Piper,
 * `false` si hubo que abandonar (para que el llamador use el fallback).
 */
export async function speakWithPiper(
  text: string,
  voice: PiperVoiceKey,
  opts: { speed?: number; onEnd?: () => void } = {},
): Promise<boolean> {
  stopPiper()
  const ctrl = new AbortController()
  controller = ctrl
  try {
    const res = await fetch('/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, speed: opts.speed ?? 1.0 }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`TTS ${res.status}`)
    const blob = await res.blob()
    if (ctrl.signal.aborted) return true

    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    currentUrl = url
    currentAudio = audio
    const done = () => {
      if (currentAudio === audio) stopPiper()
      opts.onEnd?.()
    }
    audio.onended = done
    audio.onerror = done
    await audio.play()
    return true
  } catch (err) {
    if ((err as Error).name === 'AbortError') return true
    availability = { value: false, checkedAt: Date.now() }
    return false
  }
}
