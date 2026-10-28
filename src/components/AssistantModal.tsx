import { useState, useRef, useEffect, useMemo } from 'react'
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
import {
  guardFalseSaveClaims,
  looksLikeActionRequest,
  looksMultiIntent,
  planLlmActions,
  planLocalActions,
} from '../services/assistant/actionExtractor'
import { CREATE_INITIAL_MESSAGES } from './assistant/constants'
import { useAssistantVoice } from './assistant/useAssistantVoice'
import { HeaderActions } from './assistant/HeaderActions'
import { VoiceMenu } from './assistant/VoiceMenu'
import { ChatHistoryPanel } from './assistant/ChatHistoryPanel'
import { MessageBubble } from './assistant/MessageBubble'
import { WelcomeCards } from './assistant/WelcomeCards'
import { QuickPrompts } from './assistant/QuickPrompts'
import { ChatInput } from './assistant/ChatInput'
import './assistant/assistant.css'

interface AssistantModalProps {
  open: boolean
  onClose: () => void
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
  const [showVoiceMenu, setShowVoiceMenu] = useState(false)

  const voice = useAssistantVoice({ open, showVoiceMenu, onTranscript: setInput })
  const { speakText, autoSpeak } = voice

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
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottomRef = useRef(true)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // Solo se baja automáticamente si el usuario ya estaba al final del chat
  const handleLogScroll = () => {
    const el = logRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
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

      stickToBottomRef.current = true
      setTimeout(() => {
        scrollToBottom('auto')
        inputRef.current?.focus()
      }, 150)
    }
  }, [open])

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (stickToBottomRef.current || last?.sender === 'user') {
      stickToBottomRef.current = true
      scrollToBottom(isTyping ? 'auto' : 'smooth')
    }
  }, [messages, isTyping])

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

    // Aplica una mutación real sobre la bóveda y la muestra con efecto de escritura
    const applyMutation = async (result: NonNullable<ReturnType<typeof tryExecuteAssistantMutation>>) => {
      updateData(result.updater)
      await streamTextTypewriter(result.message.text, (currentText) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, text: currentText, action: result.message.action, mutationCard: result.message.mutationCard }
              : m,
          ),
        )
      })

      const finalMessages = currentMessages.map((m) => (m.id === assistantMsgId ? result.message : m))
      persistMessagesToVault(finalMessages)
      if (autoSpeak && result.message.text) {
        speakText(result.message.text, assistantMsgId)
      }
      setIsTyping(false)
    }

    const history = messages
      .filter((m) => m.id !== 'welcome' && m.id !== assistantMsgId)
      .map((m) => ({ role: m.sender, content: m.text }))
    const lastAssistantText = [...messages].reverse().find((m) => m.sender === 'assistant')?.text ?? ''

    const llmReady = ollamaStatus.online && Boolean(ollamaStatus.activeModel)

    // Mensajes con varias cosas a la vez: se interpreta primero con el LLM (las reglas rápidas solo captan una)
    if (llmReady && looksMultiIntent(text, lastAssistantText)) {
      try {
        const multi = await planLlmActions(text, history, ollamaStatus.activeModel!, data, lastAssistantText)
        if (multi) {
          await applyMutation(multi)
          return
        }
      } catch (err) {
        console.warn('Interpretación múltiple falló, se sigue con las reglas locales:', err)
      }
    }

    // Intento 1: Detección y ejecución inmediata de comandos de mutación
    const mutationResult = tryExecuteAssistantMutation(text, data)
    if (mutationResult) {
      await applyMutation(mutationResult)
      return
    }

    // Intento 2: reglas locales del catálogo (ánimo, vencimientos, tomas de medicación...): instantáneas y sin conexión
    const localResult = planLocalActions(text, data, lastAssistantText)
    if (localResult) {
      await applyMutation(localResult)
      return
    }

    // Intento 3: Streaming en tiempo real con Ollama Local
    if (ollamaStatus.online && ollamaStatus.activeModel) {
      // 3a. Pedidos de guardar/agendar/cargar: el LLM los interpreta, la app los ejecuta y confirma
      if (looksLikeActionRequest(text, lastAssistantText)) {
        try {
          const llmResult = await planLlmActions(text, history, ollamaStatus.activeModel, data, lastAssistantText)
          if (llmResult) {
            await applyMutation(llmResult)
            return
          }
        } catch (err) {
          console.warn('No se pudo interpretar el pedido como acción, se responde en modo conversación:', err)
        }
      }

      // 3b. Conversación normal. Si el LLM afirma haber guardado algo, se aclara que no fue así
      try {
        const rawText = await queryOllamaStream(
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

        const finalText = guardFalseSaveClaims(rawText)
        const finalMessages = currentMessages.map((m) => (m.id === assistantMsgId ? { ...m, text: finalText } : m))
        setMessages(finalMessages)
        persistMessagesToVault(finalMessages)
        if (autoSpeak && finalText) {
          speakText(finalText, assistantMsgId)
        }
        setIsTyping(false)
        return
      } catch (err) {
        console.warn('Ollama streaming falló, pasando a procesador semántico local:', err)
      }
    }

    // Intento 4: Motor semántico local porteño con efecto máquina de escribir
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
      if (autoSpeak && response.text) {
        speakText(response.text, assistantMsgId)
      }
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

  const handleActionClick = (hash: string) => {
    window.location.hash = hash
    onClose()
  }

  const isLlmActive = ollamaStatus.online && Boolean(ollamaStatus.activeModel)
  const userAvatar = data.profile.avatar
  const userName = data.profile.nickName || data.profile.fullName || 'Usuario'
  const showWelcomeCards = messages.length === 1 && messages[0].id === 'welcome' && !isTyping

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asistente LifeKeeper"
      subtitle={isLlmActive ? `LLM local en línea · ${ollamaStatus.activeModel}` : 'Asistente local · Cifrado Zero-Knowledge'}
      className={`assistant-modal ${isExpanded ? 'is-expanded' : ''}`.trim()}
      headerActions={
        <HeaderActions
          onNewChat={handleNewChat}
          onOpenVoice={() => {
            setShowVoiceMenu(true)
            setShowHistory(false)
          }}
          onOpenHistory={() => {
            setShowHistory(true)
            setShowVoiceMenu(false)
          }}
          onDeleteChat={handleDeleteCurrentChat}
          canDelete={messages.length > 1}
          autoSpeak={autoSpeak}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded((prev) => !prev)}
        />
      }
    >
      <div className="asst-root">
        {showVoiceMenu && <VoiceMenu voice={voice} onClose={() => setShowVoiceMenu(false)} />}

        {showHistory && (
          <ChatHistoryPanel
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={handleSelectSession}
            onClose={() => setShowHistory(false)}
          />
        )}

        <div
          ref={logRef}
          className="asst-log app-chat-scroll"
          role="log"
          aria-live="polite"
          aria-label="Conversación con el asistente"
          onScroll={handleLogScroll}
        >
          {messages.map((m, idx) => {
            if (m.sender !== 'user' && !m.text && isTyping) return null

            const isProposalSaved = Boolean(
              m.proposalCard &&
                ((m.proposalCard.type === 'workout_template' && savedProposalIds.has(m.proposalCard.payload?.id)) ||
                  (m.proposalCard.type === 'nutrition_plan' && savedProposalIds.has(m.id))),
            )

            return (
              <MessageBubble
                key={m.id}
                message={m}
                showAvatar={idx === 0 || messages[idx - 1].sender !== m.sender}
                userAvatar={userAvatar}
                userName={userName}
                isSpeaking={voice.speakingMessageId === m.id}
                isUndone={Boolean(m.mutationCard?.entityId && undoneEntityIds.has(m.mutationCard.entityId))}
                isProposalSaved={isProposalSaved}
                onToggleSpeak={() => voice.handleToggleSpeak(m.id, m.text)}
                onAction={handleActionClick}
                onUndo={handleUndoMutation}
                onSaveWorkout={handleSaveWorkoutTemplate}
                onApplyNutrition={handleApplyNutritionGoals}
              />
            )
          })}

          {showWelcomeCards && <WelcomeCards onSelect={handleSend} />}

          {isTyping && messages[messages.length - 1]?.text === '' && (
            <div className="asst-typing">
              <div className="asst-avatar-slot">
                <div className="asst-avatar">
                  <img src="/brand/assistant.png?v=2" alt="Asistente LifeKeeper" />
                </div>
              </div>
              <div className="asst-typing-bubble" aria-label="El asistente está escribiendo">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <QuickPrompts onSelect={handleSend} disabled={isTyping} />

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={() => handleSend(input)}
          isListening={voice.isListening}
          onToggleMic={voice.toggleSpeechRecognition}
          isTyping={isTyping}
          isLlmActive={isLlmActive}
          textareaRef={inputRef}
        />
      </div>
    </Modal>
  )
}
