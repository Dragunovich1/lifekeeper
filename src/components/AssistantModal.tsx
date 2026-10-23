import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Send, ArrowUpRight, ShieldCheck } from 'lucide-react'
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
    text: '¡Hola! Soy tu Asistente LifeKeeper. Conozco tu bóveda de forma 100% privada y en tu dispositivo. ¿En qué te puedo ayudar hoy?',
    timestamp: 'Ahora',
  },
]

const QUICK_PROMPTS = [
  '¿Cuánto gasté este mes?',
  '¿Qué pastillas tengo que tomar hoy?',
  '¿Cuánta agua tomé hoy?',
  '¿Cómo está el puntaje de mi bóveda?',
  'Resumen general',
]

export const AssistantModal = ({ open, onClose }: AssistantModalProps) => {
  const { data } = useAppData()
  const [messages, setMessages] = useState<AssistantMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (open) {
      setTimeout(scrollToBottom, 100)
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
    }, 250)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSend(input)
  }

  const handleActionClick = (hash: string) => {
    window.location.hash = hash
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asistente LifeKeeper"
      subtitle="Inteligencia semántica local · Cifrado en tu dispositivo"
      maxWidth="620px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '480px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.75rem',
            background: 'var(--color-surface-sunken)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            marginBottom: '0.75rem',
          }}
        >
          <ShieldCheck size={14} color="var(--color-success)" />
          <span>Tus consultas se procesan 100% en local en tu navegador. Nada sale a la nube.</span>
        </div>

        {/* Historial de mensajes */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            paddingRight: '0.25rem',
          }}
        >
          {messages.map((m) => {
            const isUser = m.sender === 'user'
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-lg)',
                    background: isUser ? 'var(--color-accent-blue)' : 'var(--color-surface-sunken)',
                    color: isUser ? '#ffffff' : 'var(--color-text-primary)',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-line',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.text}
                </div>

                {m.action && (
                  <button
                    type="button"
                    className="secondary-button"
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.6rem',
                      marginTop: '0.35rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                    onClick={() => handleActionClick(m.action!.hash)}
                  >
                    <span>{m.action.label}</span>
                    <ArrowUpRight size={12} />
                  </button>
                )}

                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--color-text-muted)',
                    marginTop: '0.2rem',
                    padding: '0 0.25rem',
                  }}
                >
                  {m.timestamp}
                </span>
              </div>
            )
          })}

          {isTyping && (
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface-sunken)',
                fontSize: '0.8125rem',
                color: 'var(--color-text-muted)',
              }}
            >
              Consultando tu bóveda...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugerencias rápidas */}
        <div
          style={{
            display: 'flex',
            gap: '0.35rem',
            overflowX: 'auto',
            padding: '0.5rem 0',
            scrollbarWidth: 'none',
          }}
        >
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="chip"
              style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
              onClick={() => handleSend(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input box */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Preguntale a tu bóveda (ej. ¿cuánto gasté este mes?)..."
            style={{ flex: 1 }}
            autoFocus
          />
          <button
            type="submit"
            className="primary-button"
            disabled={!input.trim()}
            style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Send size={15} />
            <span>Enviar</span>
          </button>
        </form>
      </div>
    </Modal>
  )
}
