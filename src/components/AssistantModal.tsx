import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Send, ArrowUpRight, ShieldCheck, Sparkles, Bot, User, Trash2, Cpu } from 'lucide-react'
import { Modal } from './Modal'
import { useAppData } from '../hooks/useAppData'
import { processAssistantQuery, type AssistantMessage } from '../services/assistant/localAssistant'
import { checkOllamaStatus, queryOllama, type OllamaStatus } from '../services/assistant/ollamaClient'

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
              }}
            >
              <span style={{ color: 'var(--color-accent-cyan)', fontSize: '0.85rem', flexShrink: 0, marginTop: '0.1rem' }}>
                •
              </span>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {renderedText}
              </span>
            </div>
          )
        }

        return (
          <div
            key={lineIdx}
            style={{
              lineHeight: '1.55',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
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
  }, [open, messages, isTyping])

  const handleSend = async (userText: string) => {
    const text = userText.trim()
    if (!text) return

    const userMsg: AssistantMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Intento 1: LLM Real en Servidor (Ollama)
    if (ollamaStatus.online && ollamaStatus.activeModel) {
      try {
        const history = messages
          .filter((m) => m.id !== 'welcome')
          .map((m) => ({
            role: m.sender,
            content: m.text,
          }))

        const llmResponse = await queryOllama(text, history, data, ollamaStatus.activeModel)
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: llmResponse,
            timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          },
        ])
        setIsTyping(false)
        return
      } catch (err) {
        console.warn('Ollama falló o está ocupado, usando fallback semántico local:', err)
      }
    }

    // Intento 2: Fallback semántico local
    try {
      const response = await processAssistantQuery(text, data)
      setMessages((prev) => [...prev, response])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: 'Ocurrió un error al procesar tu consulta. Por favor probá nuevamente.',
          timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        },
      ])
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
      maxWidth="840px"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'min(620px, 78vh)',
          gap: '0.75rem',
        }}
      >
        {/* Banner de Estado del Motor */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.6rem 1rem',
            background: isLlmActive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(14, 165, 233, 0.08)',
            border: isLlmActive ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(14, 165, 233, 0.2)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {isLlmActive ? (
              <>
                <Cpu size={16} color="var(--color-success)" />
                <span style={{ fontWeight: 500, color: 'var(--color-success)' }}>
                  LLM Local Activo ({ollamaStatus.activeModel})
                </span>
                <span style={{ opacity: 0.8 }}>· Razonamiento natural en tu servidor Dell</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} color="var(--color-accent-cyan)" />
                <span>Consultas procesadas 100% en tu servidor/dispositivo. Bóveda cifrada.</span>
              </>
            )}
          </div>
          {messages.length > 1 && (
            <button
              type="button"
              onClick={clearChat}
              title="Limpiar conversación"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                padding: '0.2rem 0.4rem',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Trash2 size={13} />
              <span>Limpiar</span>
            </button>
          )}
        </div>

        {/* Historial de Mensajes */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem',
            padding: '0.5rem 0.5rem 0.5rem 0.25rem',
          }}
        >
          {messages.map((m) => {
            const isUser = m.sender === 'user'

            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: isUser ? '82%' : '90%',
                  width: 'auto',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                }}
              >
                {/* Avatar Icon */}
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: isUser
                      ? 'var(--color-accent-blue)'
                      : isLlmActive
                      ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                      : 'linear-gradient(135deg, var(--color-accent-cyan), var(--color-accent-purple))',
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                    marginTop: '2px',
                  }}
                >
                  {isUser ? <User size={16} /> : isLlmActive ? <Cpu size={18} /> : <Bot size={18} />}
                </div>

                {/* Burbuja de contenido */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    minWidth: 0,
                    flex: 1,
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
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      boxShadow: 'var(--shadow-sm)',
                      width: 'fit-content',
                      maxWidth: '100%',
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

          {/* Indicador de escritura animado */}
          {isTyping && (
            <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isLlmActive
                    ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                    : 'linear-gradient(135deg, var(--color-accent-cyan), var(--color-accent-purple))',
                  color: '#ffffff',
                  flexShrink: 0,
                }}
              >
                <Sparkles size={16} />
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
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--color-accent-cyan)',
                    display: 'inline-block',
                    animation: 'pulse 1s infinite alternate',
                  }}
                />
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--color-accent-blue)',
                    display: 'inline-block',
                    animation: 'pulse 1s infinite alternate 0.2s',
                  }}
                />
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--color-accent-purple)',
                    display: 'inline-block',
                    animation: 'pulse 1s infinite alternate 0.4s',
                  }}
                />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugerencias Rápidas tipo Chips */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            padding: '0.35rem 0',
            scrollbarWidth: 'thin',
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
                ? 'Preguntale a tu LLM local lo que quieras (interpretación libre y natural)...'
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
            disabled={!input.trim()}
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
