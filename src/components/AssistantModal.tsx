import { useState, useRef, useEffect, useMemo, type FormEvent } from 'react'
import {
  Send,
  ArrowUpRight,
  User,
  Trash2,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Plus,
  History,
  Undo2,
  Dumbbell,
  Check,
  Sparkles,
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Modal } from './Modal'
import { useAppData } from '../hooks/useAppData'
import {
  processAssistantQuery,
  tryExecuteAssistantMutation,
  type AssistantMessage,
} from '../services/assistant/localAssistant'
import {
  checkOllamaStatus,
  queryOllamaStream,
  streamTextTypewriter,
  type OllamaStatus,
} from '../services/assistant/ollamaClient'
import type { AppData, AssistantChatSession, WorkoutTemplate } from '../types'

interface AssistantModalProps {
  open: boolean
  onClose: () => void
}

const INITIAL_WELCOME_TEXT =
  '¡Qué hacés, che! 👋 Soy tu **Asistente Inteligente de LifeKeeper** con acento bien porteño y la mejor onda.\n\n' +
  'Tengo toda tu bóveda bajo la lupa:\n' +
  '• 🩺 **Salud e Historia Clínica:** pastillas, consultas, vacunas y ficha médica.\n' +
  '• 🤝 **Deudas y Préstamos:** anotá plata prestada, compromisos o pagos.\n' +
  '• 🏋️ **Gym & Nutrición:** puedo armarte rutinas de entrenamiento o dietas y dejártelas guardadas en 1 clic.\n' +
  '• ☀️ **Daily Briefing:** preguntame *"¿Cómo viene mi día?"* para un panorama completo con clima, remedios y tareas.\n' +
  '• 🎙️ **Micrófono y Voz:** podés hablarme con el botón del mic o escucharme con el parlante.\n\n' +
  '¿En qué te doy una mano hoy, papá?'

const CREATE_INITIAL_MESSAGES = (): AssistantMessage[] => [
  {
    id: 'welcome',
    sender: 'assistant',
    text: INITIAL_WELCOME_TEXT,
    timestamp: 'Ahora',
  },
]

const QUICK_PROMPTS = [
  { label: '☀️ ¿Cómo viene mi día?', query: '¿Cómo viene mi día?' },
  { label: '🤝 ¿Quién me debe plata?', query: '¿Quién me debe plata?' },
  { label: '🏋️ Armame rutina hipertrofia', query: 'Armame una rutina de 4 días hipertrofia' },
  { label: '🥗 Armame una dieta 2200 kcal', query: 'Armame una dieta de 2200 calorias' },
  { label: '💧 Anotá 500ml de agua', query: 'Anotá que tomé 500ml de agua' },
  { label: '💳 Gasté $5000 en comida', query: 'Gasté $5000 en comida' },
  { label: '🌦️ ¿Va a llover hoy?', query: '¿Va a llover hoy?' },
  { label: '💊 Medicación de hoy', query: '¿Qué pastillas tomo hoy?' },
  { label: '⚖️ Anotá mi peso 75 kg', query: 'Anotá mi peso 75 kg' },
  { label: '📋 Resumen de mi bóveda', query: 'Haceme un resumen general de mi bóveda' },
]

/**
 * Renderiza texto enriquecido con soporte de viñetas, negritas y saltos de línea con contención visual estricta.
 */
function renderFormattedMessage(content: string) {
  const lines = content.split('\n')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', minWidth: 0 }}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={lineIdx} style={{ height: '0.4rem' }} />
        }

        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)
        const cleanLine = isBullet ? trimmed.replace(/^[•\-]\s*|^\d+\.\s*/, '') : line

        const parts = cleanLine.split(/(\*\*.*?\*\*)/g)
        const renderedText = parts.map((part, partIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={partIdx} style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                {part.slice(2, -2)}
              </strong>
            )
          }
          return part
        })

        if (isBullet) {
          return (
            <div
              key={lineIdx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                paddingLeft: trimmed.startsWith('  ') ? '1.25rem' : '0.25rem',
                lineHeight: '1.55',
                minWidth: 0,
                width: '100%',
              }}
            >
              <span style={{ color: 'var(--color-accent-cyan)', fontSize: '0.85rem', flexShrink: 0, marginTop: '0.1rem' }}>
                •
              </span>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {renderedText}
              </div>
            </div>
          )
        }

        return (
          <div
            key={lineIdx}
            style={{
              lineHeight: '1.55',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              width: '100%',
              minWidth: 0,
            }}
          >
            {renderedText}
          </div>
        )
      })}
    </div>
  )
}

export const AssistantModal = ({ open, onClose }: AssistantModalProps) => {
  const { data, updateData } = useAppData()

  // Sesiones guardadas en la bóveda
  const sessions = useMemo(() => data.utilities.assistantChats ?? [], [data.utilities.assistantChats])
  const activeSessionId = data.utilities.activeAssistantChatId || (sessions[0]?.id ?? null)

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null
  }, [sessions, activeSessionId])

  const [messages, setMessages] = useState<AssistantMessage[]>(() => {
    return activeSession?.messages?.length ? activeSession.messages : CREATE_INITIAL_MESSAGES()
  })

  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Estados de Voz (STT y TTS)
  const [isListening, setIsListening] = useState(false)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)

  // Acciones y Undo
  const previousVaultSnapshotRef = useRef<AppData | null>(null)
  const [undoneEntityIds, setUndoneEntityIds] = useState<Set<string>>(new Set())
  const [savedProposalIds, setSavedProposalIds] = useState<Set<string>>(new Set())

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({
    online: false,
    models: [],
    activeModel: null,
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const quickPromptsRef = useRef<HTMLDivElement>(null)

  const scrollQuickPrompts = (direction: 'left' | 'right') => {
    if (quickPromptsRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220
      quickPromptsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Sincronizar mensajes cuando cambia la sesión activa
  useEffect(() => {
    if (activeSession?.messages?.length) {
      setMessages(activeSession.messages)
    } else if (!activeSession) {
      setMessages(CREATE_INITIAL_MESSAGES())
    }
  }, [activeSessionId])

  // Guardar mensajes en la sesión activa dentro de la bóveda
  const persistMessagesToVault = (updatedMessages: AssistantMessage[]) => {
    const nowIso = new Date().toISOString()
    const currentId = activeSessionId || `chat-${Date.now()}`

    updateData((prev) => {
      const currentSessions = [...(prev.utilities.assistantChats ?? [])]
      const existingIdx = currentSessions.findIndex((s) => s.id === currentId)

      let title = 'Conversación de hoy'
      const firstUserMsg = updatedMessages.find((m) => m.sender === 'user')
      if (firstUserMsg) {
        title = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '')
      }

      if (existingIdx >= 0) {
        currentSessions[existingIdx] = {
          ...currentSessions[existingIdx],
          title: currentSessions[existingIdx].title || title,
          updatedAt: nowIso,
          messages: updatedMessages,
        }
      } else {
        const newSession: AssistantChatSession = {
          id: currentId,
          title,
          createdAt: nowIso,
          updatedAt: nowIso,
          messages: updatedMessages,
        }
        currentSessions.unshift(newSession)
      }

      return {
        ...prev,
        utilities: {
          ...prev.utilities,
          assistantChats: currentSessions,
          activeAssistantChatId: currentId,
        },
      }
    })
  }

  // Comprobar disponibilidad de Ollama al abrir el modal
  useEffect(() => {
    if (open) {
      checkOllamaStatus()
        .then((status) => setOllamaStatus(status))
        .catch(() => setOllamaStatus({ online: false, models: [], activeModel: null }))

      setTimeout(() => {
        scrollToBottom()
        inputRef.current?.focus()
      }, 150)
    }
  }, [open])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  // Detener TTS si se cierra el modal
  useEffect(() => {
    if (!open && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setSpeakingMessageId(null)
    }
  }, [open])

  // Configuración de Speech Recognition (Voz a Texto / STT)
  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return

    const SpeechRec =
      (window as unknown as { webkitSpeechRecognition?: any; SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any; SpeechRecognition?: any }).webkitSpeechRecognition

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

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        if (transcript) {
          setInput(transcript)
        }
      }

      recognition.onerror = (e: any) => {
        console.warn('Error en SpeechRecognition:', e)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('No se pudo iniciar el reconocimiento de voz:', err)
      setIsListening(false)
    }
  }

  // Configuración de Text to Speech (Texto a Voz / TTS Porteño)
  const handleToggleSpeak = (msgId: string, textToSpeak: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Tu navegador no soporta síntesis de voz.')
      return
    }

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel()
      setSpeakingMessageId(null)
      return
    }

    window.speechSynthesis.cancel()

    // Limpiar asteriscos y emojis para una lectura más natural
    const cleanText = textToSpeak
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/[•\-]/g, '')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .trim()

    const utterance = new SpeechSynthesisUtterance(cleanText)
    const voices = window.speechSynthesis.getVoices()

    // Preferir voz en español de Argentina o cualquier español
    const arVoice = voices.find((v) => v.lang.toLowerCase().replace('_', '-') === 'es-ar')
    const esVoice = voices.find((v) => v.lang.toLowerCase().startsWith('es'))
    if (arVoice) utterance.voice = arVoice
    else if (esVoice) utterance.voice = esVoice

    utterance.rate = 1.05
    utterance.pitch = 1.0

    utterance.onend = () => setSpeakingMessageId(null)
    utterance.onerror = () => setSpeakingMessageId(null)

    setSpeakingMessageId(msgId)
    window.speechSynthesis.speak(utterance)
  }

  const handleSend = async (userText: string) => {
    const text = userText.trim()
    if (!text || isTyping) return

    // Guardar snapshot previo para posible Deshacer
    previousVaultSnapshotRef.current = data

    const timeStr = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

    const userMsg: AssistantMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: timeStr,
    }

    const assistantMsgId = `asst-${Date.now()}`
    const placeholderMsg: AssistantMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      text: '',
      timestamp: timeStr,
    }

    const currentMessages = [...messages, userMsg, placeholderMsg]
    setMessages(currentMessages)
    setInput('')
    setIsTyping(true)

    // Intento 1: Detección y ejecución inmediata de comandos de mutación
    const mutationResult = tryExecuteAssistantMutation(text, data)
    if (mutationResult) {
      updateData(mutationResult.updater)
      await streamTextTypewriter(mutationResult.message.text, (currentText) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  text: currentText,
                  action: mutationResult.message.action,
                  mutationCard: mutationResult.message.mutationCard,
                }
              : m,
          ),
        )
      })

      const finalMessages = currentMessages.map((m) =>
        m.id === assistantMsgId ? mutationResult.message : m,
      )
      persistMessagesToVault(finalMessages)
      setIsTyping(false)
      return
    }

    // Intento 2: Streaming en tiempo real con Ollama Local
    if (ollamaStatus.online && ollamaStatus.activeModel) {
      try {
        const history = messages
          .filter((m) => m.id !== 'welcome' && m.id !== assistantMsgId)
          .map((m) => ({
            role: m.sender,
            content: m.text,
          }))

        await queryOllamaStream(
          text,
          history,
          data,
          ollamaStatus.activeModel,
          (_chunk, fullText) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, text: fullText } : m)),
            )
          },
        )

        setMessages((prev) => {
          persistMessagesToVault(prev)
          return prev
        })
        setIsTyping(false)
        return
      } catch (err) {
        console.warn('Ollama streaming falló, pasando a procesador semántico local:', err)
      }
    }

    // Intento 3: Motor semántico local porteño con efecto máquina de escribir
    try {
      const response = await processAssistantQuery(text, data)
      await streamTextTypewriter(response.text, (currentText) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  text: currentText,
                  action: response.action,
                  mutationCard: response.mutationCard,
                  proposalCard: response.proposalCard,
                }
              : m,
          ),
        )
      })

      const finalMessages = currentMessages.map((m) =>
        m.id === assistantMsgId ? response : m,
      )
      persistMessagesToVault(finalMessages)
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: 'Che, ocurrió un tropezón al procesar tu consulta. Porfa probá nuevamente.',
              }
            : m,
        ),
      )
    } finally {
      setIsTyping(false)
    }
  }

  // Revertir última mutación
  const handleUndoMutation = (entityId?: string) => {
    if (previousVaultSnapshotRef.current) {
      updateData(() => previousVaultSnapshotRef.current!)
      if (entityId) {
        setUndoneEntityIds((prev) => new Set(prev).add(entityId))
      }
    }
  }

  // Guardar propuesta de Rutina en Workouts
  const handleSaveWorkoutTemplate = (template: WorkoutTemplate) => {
    updateData((prev) => {
      const existing = prev.personal.workoutTemplates ?? []
      return {
        ...prev,
        personal: {
          ...prev.personal,
          workoutTemplates: [template, ...existing.filter((t) => t.id !== template.id)],
        },
      }
    })
    setSavedProposalIds((prev) => new Set(prev).add(template.id))
  }

  // Aplicar propuesta de Nutrición
  const handleApplyNutritionGoals = (
    goals: { calories: number; proteinGrams: number; carbsGrams: number; fatsGrams: number },
    proposalKey: string,
  ) => {
    updateData((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        nutrition: {
          ...(prev.personal.nutrition ?? { dailyLogs: [] }),
          dailyGoals: goals,
        },
      },
    }))
    setSavedProposalIds((prev) => new Set(prev).add(proposalKey))
  }

  // Crear un Nuevo Chat
  const handleNewChat = () => {
    const newId = `chat-${Date.now()}`
    const initialMsgs = CREATE_INITIAL_MESSAGES()
    const newSession: AssistantChatSession = {
      id: newId,
      title: 'Nueva conversación',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: initialMsgs,
    }

    updateData((prev) => ({
      ...prev,
      utilities: {
        ...prev.utilities,
        assistantChats: [newSession, ...(prev.utilities.assistantChats ?? [])],
        activeAssistantChatId: newId,
      },
    }))
    setMessages(initialMsgs)
    setShowHistory(false)
  }

  // Eliminar chat actual
  const handleDeleteCurrentChat = () => {
    const currentId = activeSessionId
    updateData((prev) => {
      const filtered = (prev.utilities.assistantChats ?? []).filter((s) => s.id !== currentId)
      return {
        ...prev,
        utilities: {
          ...prev.utilities,
          assistantChats: filtered,
          activeAssistantChatId: filtered[0]?.id ?? undefined,
        },
      }
    })
    setMessages(CREATE_INITIAL_MESSAGES())
  }

  // Seleccionar sesión del historial
  const handleSelectSession = (id: string) => {
    updateData((prev) => ({
      ...prev,
      utilities: {
        ...prev.utilities,
        activeAssistantChatId: id,
      },
    }))
    setShowHistory(false)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSend(input)
  }

  const handleActionClick = (hash: string) => {
    window.location.hash = hash
    onClose()
  }

  const isLlmActive = ollamaStatus.online && Boolean(ollamaStatus.activeModel)
  const userAvatar = data.profile.avatar
  const userName = data.profile.nickName || data.profile.fullName || 'Usuario'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asistente LifeKeeper"
      subtitle={
        isLlmActive
          ? `Motor LLM Local (${ollamaStatus.activeModel}) · Acento Porteño · Cifrado E2EE`
          : 'Inteligencia Porteña Local · Cifrado Zero-Knowledge · Meteorología en vivo'
      }
      className={`assistant-modal ${isExpanded ? 'is-expanded' : ''}`.trim()}
      headerActions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* Botón Nuevo Chat */}
          <button
            type="button"
            className="pref-modal-action-btn"
            onClick={handleNewChat}
            title="Iniciar nueva conversación"
            style={{ gap: '0.3rem', display: 'inline-flex', alignItems: 'center' }}
          >
            <Plus size={15} />
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Nuevo</span>
          </button>

          {/* Botón Historial de Chats */}
          <button
            type="button"
            className={`pref-modal-action-btn ${showHistory ? 'is-active' : ''}`}
            onClick={() => setShowHistory((prev) => !prev)}
            title="Ver conversaciones anteriores"
          >
            <History size={16} />
          </button>

          {messages.length > 1 && (
            <button
              type="button"
              className="pref-modal-action-btn"
              onClick={handleDeleteCurrentChat}
              title="Eliminar esta conversación"
            >
              <Trash2 size={16} />
            </button>
          )}

          <button
            type="button"
            className="pref-modal-action-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? 'Contraer ventana' : 'Expandir ventana'}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          flex: 1,
          minHeight: 0,
          gap: '0.75rem',
          position: 'relative',
        }}
      >
        {/* Panel Desplegable de Historial de Chats */}
        {showHistory && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'var(--color-surface)',
              zIndex: 30,
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                <Clock size={16} color="var(--color-accent-cyan)" />
                <span>Conversaciones Guardadas ({sessions.length})</span>
              </div>
              <button
                type="button"
                className="pref-modal-action-btn"
                onClick={() => setShowHistory(false)}
                title="Cerrar historial"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sessions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 1rem', fontSize: '0.85rem' }}>
                  No hay conversaciones anteriores guardadas en tu bóveda.
                </div>
              ) : (
                sessions.map((s) => {
                  const isCur = s.id === activeSessionId
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSession(s.id)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        background: isCur ? 'var(--color-surface-hover)' : 'var(--color-surface-sunken)',
                        border: isCur ? '1.5px solid var(--color-accent-blue)' : '1px solid var(--color-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isCur ? 'var(--color-accent-cyan)' : 'var(--color-text-primary)' }}>
                        {s.title || 'Conversación'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        {new Date(s.updatedAt).toLocaleDateString('es-AR')} · {s.messages?.length || 0} mensajes
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Historial de Mensajes */}
        <div
          className="app-chat-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem',
            padding: '0.5rem 0.5rem 0.5rem 0.25rem',
            scrollbarWidth: 'none',
          }}
        >
          {messages.map((m) => {
            const isUser = m.sender === 'user'
            if (!isUser && !m.text && isTyping) return null

            const isSpeakingThis = speakingMessageId === m.id
            const isUndone = m.mutationCard?.entityId && undoneEntityIds.has(m.mutationCard.entityId)
            const isProposalSaved = m.proposalCard && (
              (m.proposalCard.type === 'workout_template' && savedProposalIds.has(m.proposalCard.payload?.id)) ||
              (m.proposalCard.type === 'nutrition_plan' && savedProposalIds.has(m.id))
            )

            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: isUser ? '85%' : '100%',
                  width: '100%',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: isUser ? '0 2px 8px rgba(0, 0, 0, 0.25)' : '0 2px 10px rgba(0, 200, 255, 0.25)',
                    border: isUser ? '1.5px solid rgba(255, 255, 255, 0.15)' : '1.5px solid rgba(14, 165, 233, 0.4)',
                    background: isUser ? 'var(--color-accent-blue)' : '#07111f',
                    marginTop: '2px',
                  }}
                >
                  {isUser ? (
                    userAvatar ? (
                      <img
                        src={userAvatar}
                        alt={userName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                      />
                    ) : (
                      <User size={18} color="#ffffff" />
                    )
                  ) : (
                    <img
                      src="/brand/assistant.png?v=2"
                      alt="Asistente LifeKeeper"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    />
                  )}
                </div>

                {/* Burbuja de contenido */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    minWidth: 0,
                    flex: 1,
                    maxWidth: isUser ? '100%' : 'calc(100% - 48px)',
                  }}
                >
                  <div
                    style={{
                      padding: '0.95rem 1.25rem',
                      borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                      background: isUser
                        ? 'linear-gradient(135deg, var(--color-accent-blue), #2563eb)'
                        : 'var(--color-surface-hover)',
                      border: isUser ? 'none' : '1px solid var(--color-border)',
                      color: isUser ? '#ffffff' : 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                      lineHeight: '1.6',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      boxShadow: 'var(--shadow-sm)',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    {renderFormattedMessage(m.text)}

                    {/* MUTATION ACTION CARD (con botón Deshacer) */}
                    {m.mutationCard && (
                      <div
                        style={{
                          marginTop: '0.85rem',
                          padding: '0.75rem 0.95rem',
                          borderRadius: '10px',
                          background: 'rgba(14, 165, 233, 0.08)',
                          border: '1px solid rgba(14, 165, 233, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{m.mutationCard.title}</span>
                            {m.mutationCard.badge && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '10px',
                                  background: 'var(--color-accent-blue)',
                                  color: '#fff',
                                  fontWeight: 600,
                                }}
                              >
                                {m.mutationCard.badge}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {m.mutationCard.details}
                          </span>
                        </div>

                        {/* Botón Deshacer */}
                        {isUndone ? (
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            Deshecho
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUndoMutation(m.mutationCard?.entityId)}
                            className="secondary-button"
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '14px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              flexShrink: 0,
                            }}
                            title="Deshacer este registro en tu bóveda"
                          >
                            <Undo2 size={13} />
                            <span>Deshacer</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* PROPOSAL ACTION CARD (Guardar Rutina o Metas Nutricionales en 1 Clic) */}
                    {m.proposalCard && (
                      <div
                        style={{
                          marginTop: '0.85rem',
                          padding: '0.85rem 1rem',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(14, 165, 233, 0.1))',
                          border: '1.5px solid rgba(34, 197, 94, 0.4)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.6rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Sparkles size={16} color="var(--color-accent-green)" />
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{m.proposalCard.title}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {m.proposalCard.summary}
                        </p>

                        {m.proposalCard.type === 'workout_template' && (
                          <button
                            type="button"
                            disabled={isProposalSaved}
                            onClick={() => handleSaveWorkoutTemplate(m.proposalCard!.payload)}
                            className="primary-button"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '16px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              alignSelf: 'flex-start',
                              background: isProposalSaved ? 'var(--color-surface-hover)' : undefined,
                            }}
                          >
                            {isProposalSaved ? <Check size={14} /> : <Dumbbell size={14} />}
                            <span>{isProposalSaved ? '¡Guardada en Workouts!' : '💾 Guardar como Plantilla'}</span>
                          </button>
                        )}

                        {m.proposalCard.type === 'nutrition_plan' && (
                          <button
                            type="button"
                            disabled={isProposalSaved}
                            onClick={() => handleApplyNutritionGoals(m.proposalCard!.payload, m.id)}
                            className="primary-button"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '16px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              alignSelf: 'flex-start',
                              background: isProposalSaved ? 'var(--color-surface-hover)' : undefined,
                            }}
                          >
                            {isProposalSaved ? <Check size={14} /> : <Check size={14} />}
                            <span>{isProposalSaved ? '¡Metas aplicadas en Nutrición!' : '🥗 Aplicar Metas en Nutrición'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Acciones del mensaje (Link contextual y Botón Voz TTS) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '0.35rem',
                      padding: '0 0.25rem',
                      width: '100%',
                    }}
                  >
                    {m.action && (
                      <button
                        type="button"
                        className="primary-button"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.3rem 0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          borderRadius: '18px',
                        }}
                        onClick={() => handleActionClick(m.action!.hash)}
                      >
                        <span>{m.action.label}</span>
                        <ArrowUpRight size={12} />
                      </button>
                    )}

                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleToggleSpeak(m.id, m.text)}
                        title={isSpeakingThis ? 'Silenciar voz' : 'Escuchar respuesta con voz porteña'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: isSpeakingThis ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)',
                          padding: '0.2rem',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '50%',
                        }}
                      >
                        {isSpeakingThis ? <VolumeX size={15} /> : <Volume2 size={15} />}
                      </button>
                    )}

                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--color-text-muted)',
                        marginLeft: 'auto',
                      }}
                    >
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Indicador de escritura */}
          {isTyping && messages[messages.length - 1]?.text === '' && (
            <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: '0 2px 10px rgba(0, 200, 255, 0.25)',
                  border: '1.5px solid rgba(14, 165, 233, 0.4)',
                  background: '#07111f',
                }}
              >
                <img
                  src="/brand/assistant.png?v=2"
                  alt="Asistente LifeKeeper"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
              </div>
              <div
                style={{
                  padding: '0.75rem 1.1rem',
                  borderRadius: '4px 18px 18px 18px',
                  background: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Carrusel de Sugerencias Rápidas con Botones Deslizables < y > */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            width: '100%',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={() => scrollQuickPrompts('left')}
            className="pref-modal-action-btn"
            title="Deslizar sugerencias a la izquierda"
            aria-label="Deslizar sugerencias a la izquierda"
            style={{
              width: '28px',
              height: '28px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              flexShrink: 0,
              background: 'var(--color-surface-sunken)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
            }}
          >
            <ChevronLeft size={16} />
          </button>

          <div
            ref={quickPromptsRef}
            className="app-chat-scroll"
            style={{
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              padding: '0.35rem 0.2rem',
              scrollbarWidth: 'none',
              flex: 1,
              minWidth: 0,
              scrollBehavior: 'smooth',
            }}
          >
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.query}
                type="button"
                className="secondary-button"
                style={{
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '18px',
                  cursor: 'pointer',
                  background: 'var(--color-surface-sunken)',
                  border: '1px solid var(--color-border)',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onClick={() => handleSend(p.query)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollQuickPrompts('right')}
            className="pref-modal-action-btn"
            title="Deslizar sugerencias a la derecha"
            aria-label="Deslizar sugerencias a la derecha"
            style={{
              width: '28px',
              height: '28px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              flexShrink: 0,
              background: 'var(--color-surface-sunken)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Input Bar con Micrófono STT */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Botón de Dictado por Voz (Mic) */}
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            title={isListening ? 'Escuchando... hacé clic para detener' : 'Hablarle al asistente (voz)'}
            style={{
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'pointer',
              border: isListening ? '2px solid #ef4444' : '1px solid var(--color-border-strong)',
              background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'var(--color-surface-sunken)',
              color: isListening ? '#ef4444' : 'var(--color-text-secondary)',
              transition: 'all 0.2s ease',
              animation: isListening ? 'pulse 1.2s infinite' : 'none',
            }}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isListening
                ? '🎙️ Escuchando tu voz...'
                : isLlmActive
                ? 'Escribile o hablále a tu LLM local...'
                : 'Pedime algo (ej: ¿cómo viene mi día?, le presté 20 lucas a Juan, rutina 4 días)...'
            }
            style={{
              flex: 1,
              borderRadius: '24px',
              padding: '0.85rem 1.35rem',
              background: 'var(--color-surface-sunken)',
              border: isListening
                ? '1.5px solid #ef4444'
                : isLlmActive
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : '1px solid var(--color-border-strong)',
              color: 'var(--color-text-primary)',
              fontSize: '0.875rem',
            }}
          />

          <button
            type="submit"
            className="primary-button"
            disabled={!input.trim() || isTyping}
            style={{
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            title="Enviar mensaje"
          >
            <Send size={17} />
          </button>
        </form>
      </div>
    </Modal>
  )
}
