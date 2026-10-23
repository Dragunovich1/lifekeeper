import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Send, ArrowUpRight, ShieldCheck, Sparkles, Bot, User, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { useAppData } from '../hooks/useAppData'
import { processAssistantQuery, type AssistantMessage } from '../services/assistant/localAssistant'

interface AssistantModalProps {
  open: boolean
  onClose: () => void
}

const INITIAL_MESSAGES: AssistantMessage[] = [
  {
    id: 'welcome',
    sender: 'assistant',
    text: '¡Hola! Soy tu **Asistente LifeKeeper**. Conozco tu bóveda de forma 100% privada y local en tu dispositivo.\n\n¿Qué querés consultar hoy?',
    timestamp: 'Ahora',
  },
]

const QUICK_PROMPTS = [
  { label: '📊 ¿Cuánto gasté este mes?', query: '¿Cuánto gasté este mes?' },
  { label: '💊 ¿Qué pastillas tomo hoy?', query: '¿Qué pastillas tomo hoy?' },
  { label: '💧 ¿Cuánta agua tomé?', query: '¿Cuánta agua tomé hoy?' },
  { label: '⚖️ ¿Cómo está mi peso e IMC?', query: '¿Cómo está mi peso o IMC?' },
  { label: '🔐 ¿Mis claves están seguras?', query: '¿Tengo contraseñas débiles?' },
  { label: '🗓️ ¿Qué tengo pendiente hoy?', query: '¿Qué recordatorios tengo hoy?' },
  { label: '📋 Resumen general', query: 'Haceme un resumen general' },
]

/**
 * Renderiza texto enriquecido con soporte simple de **negritas** y listas con viñetas.
 */
function renderFormattedMessage(content: string) {
  const lines = content.split('\n')

  return lines.map((line, lineIdx) => {
    // Parser simple de **negrita**
    const parts = line.split(/(\*\*.*?\*\*)/g)
    const formattedLine = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={partIdx} style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      }
      return part
    })

    return (
      <div key={lineIdx} style={{ minHeight: line.trim() ? 'auto' : '0.5rem', margin: '0.15rem 0' }}>
        {formattedLine}
      </div>
    )
  })
}

export const AssistantModal = ({ open, onClose }: AssistantModalProps) => {
  const { data } = useAppData()
  const [messages, setMessages] = useState<AssistantMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        scrollToBottom()
        inputRef.current?.focus()
      }, 150)
    }
  }, [open, messages, isTyping])

  const handleSend = (userText: string) => {
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

    // Breve pausa para efecto de procesamiento local natural
    setTimeout(() => {
      const response = processAssistantQuery(text, data)
      setMessages((prev) => [...prev, response])
      setIsTyping(false)
    }, 200)
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asistente LifeKeeper"
      subtitle="Inteligencia semántica local · Cifrado en tu dispositivo"
      maxWidth="680px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '520px', gap: '0.75rem' }}>
        {/* Banner de Privacidad */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.875rem',
            background: 'rgba(14, 165, 233, 0.08)',
            border: '1px solid rgba(14, 165, 233, 0.2)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={16} color="var(--color-accent-cyan)" />
            <span>Consultas procesadas 100% en local. Nada sale a servidores externos.</span>
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
                padding: '0.2rem',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Historial de Mensajes */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '0.5rem 0.25rem',
          }}
        >
          {messages.map((m) => {
            const isUser = m.sender === 'user'

            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  gap: '0.625rem',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                }}
              >
                {/* Avatar Icon */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: isUser
                      ? 'var(--color-accent-blue)'
                      : 'linear-gradient(135deg, var(--color-accent-cyan), var(--color-accent-purple))',
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  {isUser ? <User size={16} /> : <Bot size={17} />}
                </div>

                {/* Burbuja de contenido */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      padding: '0.85rem 1.125rem',
                      borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      background: isUser
                        ? 'linear-gradient(135deg, var(--color-accent-blue), #2563eb)'
                        : 'var(--color-surface-hover)',
                      border: isUser ? 'none' : '1px solid var(--color-border)',
                      color: isUser ? '#ffffff' : 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                      lineHeight: '1.6',
                      wordBreak: 'break-word',
                      boxShadow: 'var(--shadow-sm)',
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
                        padding: '0.35rem 0.75rem',
                        marginTop: '0.4rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
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
            <div style={{ display: 'flex', gap: '0.625rem', alignSelf: 'flex-start' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, var(--color-accent-cyan), var(--color-accent-purple))',
                  color: '#ffffff',
                }}
              >
                <Sparkles size={16} />
              </div>
              <div
                style={{
                  padding: '0.65rem 1rem',
                  borderRadius: '4px 16px 16px 16px',
                  background: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--color-accent-cyan)',
                    display: 'inline-block',
                    animation: 'pulse 1s infinite alternate',
                  }}
                />
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--color-accent-blue)',
                    display: 'inline-block',
                    animation: 'pulse 1s infinite alternate 0.2s',
                  }}
                />
                <span
                  style={{
                    width: '6px',
                    height: '6px',
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
            gap: '0.4rem',
            overflowX: 'auto',
            padding: '0.25rem 0',
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
                padding: '0.35rem 0.75rem',
                borderRadius: '16px',
                cursor: 'pointer',
                background: 'var(--color-surface-sunken)',
                border: '1px solid var(--color-border)',
              }}
              onClick={() => handleSend(p.query)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input bar flotante moderno */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribile a tu bóveda (ej. ¿cuánto gasté?, ¿qué pastillas tomo?)..."
            style={{
              flex: 1,
              borderRadius: '24px',
              padding: '0.75rem 1.25rem',
              background: 'var(--color-surface-sunken)',
              border: '1px solid var(--color-border-strong)',
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
              width: '42px',
              height: '42px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            title="Enviar mensaje"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </Modal>
  )
}
