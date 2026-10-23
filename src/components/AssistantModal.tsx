import { useState, useRef, useEffect, type FormEvent } from 'react'
import {
  Send,
  ArrowUpRight,
  User,
  Trash2,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Modal } from './Modal'
import { useAppData } from '../hooks/useAppData'
import { processAssistantQuery, type AssistantMessage } from '../services/assistant/localAssistant'
import {
  checkOllamaStatus,
  queryOllamaStream,
  streamTextTypewriter,
  type OllamaStatus,
} from '../services/assistant/ollamaClient'

interface AssistantModalProps {
  open: boolean
  onClose: () => void
}

const INITIAL_MESSAGES: AssistantMessage[] = [
  {
    id: 'welcome',
    sender: 'assistant',
    text: '¡Hola! Soy tu **Asistente Inteligente de LifeKeeper**.\n\nPodés preguntarme lo que quieras, como se te ocurra: sobre tu **salud e historia clínica**, **medicación**, **finanzas y gastos**, **si va a llover hoy o esta semana**, o pedirme consejos sobre tu día a día.\n\n¿En qué te puedo ayudar hoy?',
    timestamp: 'Ahora',
  },
]

const QUICK_PROMPTS = [
  { label: '🌦️ ¿Va a llover hoy?', query: '¿Va a llover hoy?' },
  { label: '🌧️ ¿Lloverá esta semana?', query: '¿Va a llover esta semana?' },
  { label: '🩺 Mi historia clínica', query: 'Decime mi historia clínica' },
  { label: '📊 ¿Cuánto gasté este mes?', query: '¿Cuánto gasté este mes?' },
  { label: '💊 ¿Qué pastillas tomo hoy?', query: '¿Qué pastillas tomo hoy?' },
  { label: '💧 ¿Cuánta agua tomé?', query: '¿Cuánta agua tomé hoy?' },
  { label: '🔐 ¿Mis claves están seguras?', query: '¿Tengo contraseñas débiles?' },
  { label: '🗓️ ¿Qué tengo que hacer hoy?', query: '¿Qué tengo que hacer hoy?' },
  { label: '📋 Resumen general', query: 'Haceme un resumen general de mi bóveda' },
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
  const { data } = useAppData()
  const [messages, setMessages] = useState<AssistantMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({
    online: false,
    models: [],
    activeModel: null,
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  const handleSend = async (userText: string) => {
    const text = userText.trim()
    if (!text || isTyping) return

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

    setMessages((prev) => [...prev, userMsg, placeholderMsg])
    setInput('')
    setIsTyping(true)

    // Intento 1: Streaming en tiempo real con Ollama
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
        setIsTyping(false)
        return
      } catch (err) {
        console.warn('Ollama streaming falló, pasando a fallback semántico local:', err)
      }
    }

    // Intento 2: Fallback semántico local con efecto máquina de escribir palabra a palabra
    try {
      const response = await processAssistantQuery(text, data)
      await streamTextTypewriter(response.text, (currentText) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, text: currentText, action: response.action } : m,
          ),
        )
      })
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: 'Ocurrió un error al procesar tu consulta. Por favor probá nuevamente.',
              }
            : m,
        ),
      )
    } finally {
      setIsTyping(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSend(input)
  }

  const handleActionClick = (hash: string) => {
    window.location.hash = hash
    onClose()
  }

  const clearChat = () => {
    setMessages(INITIAL_MESSAGES)
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
          ? `Motor LLM Local (${ollamaStatus.activeModel}) · Cifrado Zero-Knowledge`
          : 'Inteligencia semántica local · Cifrado Zero-Knowledge · Meteorología en vivo'
      }
      className={`assistant-modal ${isExpanded ? 'is-expanded' : ''}`.trim()}
      headerActions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {messages.length > 1 && (
            <button
              type="button"
              className="pref-modal-action-btn"
              onClick={clearChat}
              title="Eliminar conversación"
              aria-label="Eliminar conversación"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            type="button"
            className="pref-modal-action-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? 'Contraer ventana' : 'Expandir ventana'}
            aria-label={isExpanded ? 'Contraer ventana' : 'Expandir ventana'}
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
        }}
      >
        {/* Historial de Mensajes con Scrollbar Oculta */}
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

            // Si está vacío (mientras arranca el primer token del stream), no mostramos burbuja vacía
            if (!isUser && !m.text && isTyping) {
              return null
            }

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
                  </div>

                  {/* Botón de acción contextual */}
                  {m.action && (
                    <button
                      type="button"
                      className="primary-button"
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.4rem 0.85rem',
                        marginTop: '0.5rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        borderRadius: '20px',
                      }}
                      onClick={() => handleActionClick(m.action!.hash)}
                    >
                      <span>{m.action.label}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  )}

                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-muted)',
                      marginTop: '0.25rem',
                      padding: '0 0.25rem',
                    }}
                  >
                    {m.timestamp}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Indicador de escritura animado (cuando todavía no llegó el primer token) */}
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

        {/* Sugerencias Rápidas tipo Chips con Scroll Oculto */}
        <div
          className="app-chat-scroll"
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            padding: '0.35rem 0',
            scrollbarWidth: 'none',
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
              }}
              onClick={() => handleSend(p.query)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input bar moderna */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isLlmActive
                ? 'Escribile a tu LLM local (interpretación natural y fluida)...'
                : 'Preguntale a tu asistente (ej. ¿va a llover hoy?, mi historia clínica, ¿cuánto gasté?)...'
            }
            style={{
              flex: 1,
              borderRadius: '24px',
              padding: '0.85rem 1.35rem',
              background: 'var(--color-surface-sunken)',
              border: isLlmActive ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--color-border-strong)',
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
