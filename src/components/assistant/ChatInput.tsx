import { useEffect, useRef, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { Mic, MicOff, Send } from 'lucide-react'

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isListening,
  onToggleMic,
  isTyping,
  isLlmActive,
  textareaRef,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isListening: boolean
  onToggleMic: () => void
  isTyping: boolean
  isLlmActive: boolean
  textareaRef: Ref<HTMLTextAreaElement>
}) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)

  // Crece con el contenido hasta un máximo
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [value])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onSubmit()
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="asst-input-bar">
      <button
        type="button"
        onClick={onToggleMic}
        className={`asst-round-btn asst-mic ${isListening ? 'is-listening' : ''}`}
        aria-label={isListening ? 'Detener dictado' : 'Hablarle al asistente (voz)'}
        title={isListening ? 'Escuchando… hacé clic para detener' : 'Hablarle al asistente (voz)'}
      >
        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
      </button>

      <div className={`asst-input-wrap ${isListening ? 'is-listening' : ''} ${isLlmActive ? 'is-llm' : ''}`}>
        {isListening ? (
          <div className="asst-listening" aria-live="polite">
            <span className="asst-wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>{value || 'Escuchando tu voz…'}</span>
          </div>
        ) : (
          <textarea
            ref={(el) => {
              innerRef.current = el
              if (typeof textareaRef === 'function') textareaRef(el)
              else if (textareaRef) (textareaRef as { current: HTMLTextAreaElement | null }).current = el
            }}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isLlmActive
                ? 'Escribile a tu LLM local…  (Shift+Enter para nueva línea)'
                : 'Pedime algo: ¿cómo viene mi día?, le presté 20 lucas a Juan…'
            }
            aria-label="Mensaje para el asistente"
          />
        )}
      </div>

      <button
        type="submit"
        className="primary-button asst-round-btn"
        disabled={!value.trim() || isTyping}
        aria-label="Enviar mensaje"
        title="Enviar mensaje"
      >
        <Send size={17} />
      </button>
    </form>
  )
}
