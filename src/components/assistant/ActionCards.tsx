import { Check, CheckCircle2, Dumbbell, Salad, Undo2 } from 'lucide-react'
import type { AssistantMessage } from '../../services/assistant/localAssistant'
import type { WorkoutTemplate } from '../../types'

type MutationCardData = NonNullable<AssistantMessage['mutationCard']>
type ProposalCardData = NonNullable<AssistantMessage['proposalCard']>

export function MutationCard({
  card,
  undone,
  onUndo,
}: {
  card: MutationCardData
  undone: boolean
  onUndo: () => void
}) {
  return (
    <div className={`asst-card asst-card-mutation ${undone ? 'is-undone' : ''}`}>
      <span className="asst-card-icon" aria-hidden="true">
        {undone ? <Undo2 size={16} /> : <CheckCircle2 size={16} />}
      </span>
      <div className="asst-card-body">
        <div className="asst-card-title">
          <span>{card.title}</span>
          {card.badge && <span className="asst-card-badge">{card.badge}</span>}
        </div>
        <span className="asst-card-details">{card.details}</span>
      </div>
      {undone ? (
        <span className="asst-card-state">Deshecho</span>
      ) : (
        <button
          type="button"
          className="asst-pill-btn"
          onClick={onUndo}
          title="Deshacer este registro en tu bóveda"
        >
          <Undo2 size={13} />
          <span>Deshacer</span>
        </button>
      )}
    </div>
  )
}

export function ProposalCard({
  card,
  saved,
  onSaveWorkout,
  onApplyNutrition,
}: {
  card: ProposalCardData
  saved: boolean
  onSaveWorkout: (template: WorkoutTemplate) => void
  onApplyNutrition: (goals: ProposalCardData['payload']) => void
}) {
  const isWorkout = card.type === 'workout_template'
  const idleLabel = isWorkout ? 'Guardar como plantilla' : 'Aplicar metas en Nutrición'
  const doneLabel = isWorkout ? 'Guardada en Workouts' : 'Metas aplicadas en Nutrición'

  return (
    <div className={`asst-card asst-card-proposal ${saved ? 'is-done' : ''}`}>
      <div className="asst-card-head">
        <span className="asst-card-icon" aria-hidden="true">
          {isWorkout ? <Dumbbell size={16} /> : <Salad size={16} />}
        </span>
        <div className="asst-card-body">
          <div className="asst-card-title">
            <span>{card.title}</span>
            <span className="asst-card-badge">Propuesta</span>
          </div>
          <span className="asst-card-details">{card.summary}</span>
        </div>
      </div>
      <button
        type="button"
        className="primary-button asst-card-cta"
        disabled={saved}
        onClick={() => (isWorkout ? onSaveWorkout(card.payload) : onApplyNutrition(card.payload))}
      >
        {saved ? <Check size={14} /> : isWorkout ? <Dumbbell size={14} /> : <Salad size={14} />}
        <span>{saved ? doneLabel : idleLabel}</span>
      </button>
    </div>
  )
}
