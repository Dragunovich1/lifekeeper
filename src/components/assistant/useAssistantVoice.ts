import { useCallback, useEffect, useRef, useState } from 'react'
import { isPiperAvailable, speakWithPiper, stopPiper } from '../../services/assistant/piperTts'

export type VoiceChoice = 'piper-female' | 'piper-male' | 'female' | 'male' | 'system'

const FEMALE_NAMES = ['sabina', 'elena', 'monica', 'laura', 'helena', 'zira', 'francisca', 'victoria', 'paulina', 'rosa', 'female', 'mujer', 'sofia', 'lucia', 'paloma']
const MALE_NAMES = ['raul', 'pablo', 'jorge', 'alvaro', 'david', 'diego', 'carlos', 'male', 'hombre', 'miguel', 'juan', 'alberto']

interface Options {
  open: boolean
  showVoiceMenu: boolean
  onTranscript: (text: string) => void
}

/**
 * Voz del asistente: síntesis (Piper local con respaldo del navegador) y dictado (STT).
 */
export function useAssistantVoice({ open, showVoiceMenu, onTranscript }: Options) {
  const [isListening, setIsListening] = useState(false)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [voiceChoice, setVoiceChoice] = useState<VoiceChoice>('piper-female')
  const [piperOnline, setPiperOnline] = useState<boolean | null>(null)
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('')
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const recognitionRef = useRef<any>(null)

  const usePiper = voiceChoice.startsWith('piper-')
  // Género para la voz del navegador (también es el respaldo si Piper no responde)
  const voiceGender: 'female' | 'male' | 'system' =
    voiceChoice === 'system' ? 'system' : voiceChoice.includes('female') ? 'female' : 'male'

  // Verificar si el servicio Piper responde al abrir el menú de voz
  useEffect(() => {
    if (!showVoiceMenu) return
    let cancelled = false
    setPiperOnline(null)
    isPiperAvailable().then((ok) => {
      if (!cancelled) setPiperOnline(ok)
    })
    return () => {
      cancelled = true
    }
  }, [showVoiceMenu, voiceChoice])

  // Cargar lista de voces del navegador
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices && voices.length > 0) setAvailableVoices(voices)
    }
    updateVoices()
    window.speechSynthesis.onvoiceschanged = updateVoices
  }, [])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel()
    stopPiper()
    setSpeakingMessageId(null)
  }, [])

  // Detener TTS y dictado si se cierra el modal
  useEffect(() => {
    if (!open) {
      stopSpeaking()
      recognitionRef.current?.stop?.()
    }
  }, [open, stopSpeaking])

  const getActiveVoiceConfig = () => {
    let voice: SpeechSynthesisVoice | null = null
    let pitch = 1.0

    const currentVoices =
      availableVoices.length > 0
        ? availableVoices
        : typeof window !== 'undefined' && window.speechSynthesis
        ? window.speechSynthesis.getVoices()
        : []
    const spanishVoices = currentVoices.filter((v) => v.lang.toLowerCase().startsWith('es'))
    const pool = spanishVoices.length > 0 ? spanishVoices : currentVoices

    if (selectedVoiceURI) {
      voice = currentVoices.find((v) => v.voiceURI === selectedVoiceURI) || null
    }

    if (!voice) {
      if (voiceGender === 'female') {
        voice = pool.find((v) => FEMALE_NAMES.some((n) => v.name.toLowerCase().includes(n))) || null
        pitch = 1.15
      } else if (voiceGender === 'male') {
        voice = pool.find((v) => MALE_NAMES.some((n) => v.name.toLowerCase().includes(n))) || null
        pitch = 0.88
      }
    }

    if (!voice) {
      voice = pool.find((v) => v.lang.toLowerCase().replace('_', '-') === 'es-ar') || pool[0] || null
    }

    if (voiceGender === 'female' && pitch === 1.0) pitch = 1.15
    if (voiceGender === 'male' && pitch === 1.0) pitch = 0.88

    return { voice, pitch }
  }

  const speakText = async (textToSpeak: string, msgId?: string) => {
    if (typeof window === 'undefined') return

    window.speechSynthesis?.cancel()
    stopPiper()

    if (usePiper && (await isPiperAvailable())) {
      if (msgId) setSpeakingMessageId(msgId)
      const ok = await speakWithPiper(textToSpeak, voiceGender === 'male' ? 'male' : 'female', {
        onEnd: () => setSpeakingMessageId(null),
      })
      if (ok) return
      if (msgId) setSpeakingMessageId(null)
    }

    if (!window.speechSynthesis) return

    const cleanText = textToSpeak
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/[•\-#_*\`~>]/g, ' ')
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleanText) return

    const utterance = new SpeechSynthesisUtterance(cleanText)
    const { voice, pitch } = getActiveVoiceConfig()
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = 'es-AR'
    }
    utterance.pitch = pitch
    utterance.rate = 1.05

    if (msgId) setSpeakingMessageId(msgId)
    utterance.onend = () => setSpeakingMessageId(null)
    utterance.onerror = () => setSpeakingMessageId(null)
    window.speechSynthesis.speak(utterance)
  }

  const handleToggleSpeak = (msgId: string, text: string) => {
    if (speakingMessageId === msgId) {
      stopSpeaking()
      return
    }
    speakText(text, msgId)
  }

  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return

    const w = window as unknown as { webkitSpeechRecognition?: any; SpeechRecognition?: any }
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRec) {
      alert('Tu navegador o dispositivo no soporta reconocimiento de voz nativo.')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRec()
      recognition.lang = 'es-AR'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.onstart = () => setIsListening(true)
      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        if (transcript) onTranscript(transcript)
      }
      recognition.onerror = (e: any) => {
        console.warn('Error en SpeechRecognition:', e)
        setIsListening(false)
      }
      recognition.onend = () => setIsListening(false)
      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('No se pudo iniciar el reconocimiento de voz:', err)
      setIsListening(false)
    }
  }

  return {
    isListening,
    speakingMessageId,
    autoSpeak,
    setAutoSpeak,
    voiceChoice,
    setVoiceChoice,
    usePiper,
    piperOnline,
    selectedVoiceURI,
    setSelectedVoiceURI,
    availableVoices,
    speakText,
    stopSpeaking,
    handleToggleSpeak,
    toggleSpeechRecognition,
  }
}

export type AssistantVoice = ReturnType<typeof useAssistantVoice>
