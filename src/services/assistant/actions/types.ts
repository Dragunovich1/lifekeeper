import type { AppData, AssistantMutationCard } from '../../../types'

export interface ActionContext {
  now: Date
  data: AppData
  todayKey: string
  /** Último mensaje del asistente: sirve para entender respuestas cortas a una pregunta suya. */
  lastAssistantText?: string
}

export interface ActionOutcome {
  /** Cambio real sobre la bóveda. */
  apply: (prev: AppData) => AppData
  /** Línea de confirmación (markdown) que se muestra al usuario. */
  line: string
  card: AssistantMutationCard
  link?: { label: string; hash: string }
  /** Texto extra opcional (por ejemplo, un mensaje de contención). */
  note?: string
}

/** Falta un dato imprescindible: el asistente pregunta en lugar de adivinar. */
export interface ActionClarify {
  clarify: string
}

export type BuildResult = ActionOutcome | ActionClarify | null
export type RawAction = Record<string, unknown>

export interface ActionDef {
  type: string
  /** Se evalúa sobre texto normalizado (sin tildes): decide si la acción entra al prompt del LLM. */
  hints: RegExp
  /** Descripción del JSON esperado, para el prompt. */
  schema: string
  /** Ejemplo "frase" → JSON, para guiar al modelo. */
  example: string
  /** Valida lo que devolvió el LLM (o el parser local) y arma el cambio real. */
  build: (raw: RawAction, ctx: ActionContext) => BuildResult
  /** Interpretación determinística sin LLM (sirve sin conexión y es instantánea). */
  local?: (text: string, ctx: ActionContext) => RawAction[] | null
}

export const isClarify = (r: BuildResult): r is ActionClarify => Boolean(r && 'clarify' in r)
