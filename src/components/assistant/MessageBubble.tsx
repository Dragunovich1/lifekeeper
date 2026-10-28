import { useState } from 'react'
import { ArrowUpRight, Check, Copy, User, Volume2, VolumeX } from 'lucide-react'
import type { AssistantMessage } from '../../services/assistant/localAssistant'
import type { WorkoutTemplate } from '../../types'
import { MessageContent } from './MessageContent'
import { MutationCard, ProposalCard } from './ActionCards'

export interface MessageBubbleProps {
  message: AssistantMessage
  /** Muestra el avatar (primer mensaje de un grupo del mismo emisor). */
  showAvatar: boolean
  userAvatar?: string
  userName: string
  isSpeaking: boolean
  isUndone: boolean
  isProposalSaved: boolean
  onToggleSpeak: () => void
  onAction: (hash: string) => void
  onUndo: (entityId?: string) => void
  onSaveWorkout: (template: WorkoutTemplate) => void
  onApplyNutrition: (goals: any, key: string) => void
}

export function MessageBubble({
  message: m,
  showAvatar,
  userAvatar,
  userName,
  isSpeaking,
  isUndone,
  isProposalSaved,
  onToggleSpeak,
  onAction,
  onUndo,
  onSaveWorkout,
  onApplyNutrition,
}: MessageBubbleProps) {
  const isUser = m.sender === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(m.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* el portapapeles puede estar bloqueado */
    }
  }

  return (
    <div className={`asst-msg ${isUser ? 'is-user' : 'is-assistant'} ${showAvatar ? '' : 'is-grouped'}`}>
      <div className="asst-avatar-slot">
        {showAvatar && (
          <div className={`asst-avatar ${isUser ? 'is-user' : ''}`}>
            {isUser ? (
              userAvatar ? (
                <img src={userAvatar} alt={userName} />
              ) : (
                <User size={18} color="#ffffff" />
              )
            ) : (
              <img src="/brand/assistant.png?v=2" alt="Asistente LifeKeeper" />
            )}
          </div>
        )}
      </div>

      <div className="asst-msg-col">
        <div className="asst-bubble">
          <MessageContent content={m.text} />

          {m.mutationCard && (
            <MutationCard card={m.mutationCard} undone={isUndone} onUndo={() => onUndo(m.mutationCard?.entityId)} />
          )}

          {m.proposalCard && (
            <ProposalCard
              card={m.proposalCard}
              saved={isProposalSaved}
              onSaveWorkout={onSaveWorkout}
              onApplyNutrition={(goals) => onApplyNutrition(goals, m.id)}
            />
          )}
        </div>

        <div className="asst-msg-meta">
          {m.action && (
            <button type="button" className="asst-pill-btn is-primary" onClick={() => onAction(m.action!.hash)}>
              <span>{m.action.label}</span>
              <ArrowUpRight size={12} />
            </button>
          )}

          <span className="asst-msg-time">{m.timestamp}</span>

          <span className="asst-msg-tools">
            {!isUser && (
              <button
                type="button"
                className={`asst-tool-btn ${isSpeaking ? 'is-active' : ''}`}
                onClick={onToggleSpeak}
                aria-label={isSpeaking ? 'Silenciar lectura' : 'Escuchar respuesta'}
                title={isSpeaking ? 'Silenciar lectura' : 'Escuchar respuesta con la voz seleccionada'}
              >
                {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            )}
            <button
              type="button"
              className="asst-tool-btn"
              onClick={handleCopy}
              aria-label="Copiar mensaje"
              title={copied ? 'Copiado' : 'Copiar mensaje'}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
