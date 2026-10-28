/**
 * Carga por conversación: convierte lo que dice el usuario en cambios reales sobre la bóveda.
 *
 * Dos vías, ambas hacia el mismo catálogo de acciones (`./actions`):
 *  1. Parsers locales determinísticos (instantáneos y sin conexión).
 *  2. El LLM local interpreta el pedido y devuelve JSON.
 *
 * El LLM nunca guarda ni confirma nada: eso lo hace esta capa, así el asistente
 * no afirma haber guardado algo que no se guardó.
 */

import type { AppData, AssistantMutationCard } from '../../types'
import { toLocalDateKey } from '../../utils/dates'
import type { AssistantMessage, AssistantMutationResult } from './localAssistant'
import type { ChatHistoryItem } from './ollamaClient'
import { ALL_ACTIONS, isClarify, type ActionContext, type ActionOutcome, type RawAction } from './actions'
import { normalizeText } from './actions/helpers'

const MAX_ACTIONS = 4

// ---------------------------------------------------------------------------
// Detección de pedidos
// ---------------------------------------------------------------------------
const ACTION_VERBS =
  /\b(carga|cargalo|cargarlo|cargar|guarda|guardalo|guardarlo|guardar|anota|anotalo|anotar|agenda|agendalo|agendame|agendar|recorda|recordame|recordatorio|agrega|agregalo|agregar|registra|registralo|registrar|apunta|apuntalo|crea|crealo|programa|programalo|ponelo|pone|sumale|suma)\b/
const AFFIRMATIVE = /^(si|sii+|dale|ok|okey|listo|claro|obvio|porfa|por favor|bueno|de una|metele|hacelo)\b/
const OFFER_HINT = /(queres que|te lo guardo|te lo cargo|te lo agendo|lo guardo|lo cargo|lo agendo|te envie|te guarde|te agende)/
const ASKED_HINT = /para que fecha|de cual vehiculo|a que (deuda|meta|proyecto)|con quien es|como se llama el proyecto/

/** Acciones cuyas pistas aparecen en el texto (y en el último mensaje del asistente, para respuestas cortas). */
const relevantActions = (userText: string, lastAssistantText: string) => {
  const hay = `${normalizeText(userText)} ${normalizeText(lastAssistantText).slice(-300)}`
  return ALL_ACTIONS.filter((a) => a.hints.test(hay))
}

/** Filtro barato para no consultar al LLM en cada mensaje. */
export function looksLikeActionRequest(userText: string, lastAssistantText = ''): boolean {
  const n = normalizeText(userText)
  const isQuestion = /\?\s*$/.test(userText.trim()) || /^(cuanto|cuantos|cuantas|como|que|cual|cuales|quien|donde|cuando|por que)\b/.test(n)
  if (ACTION_VERBS.test(n)) return true
  const lastAsst = normalizeText(lastAssistantText)
  if (AFFIRMATIVE.test(n) && OFFER_HINT.test(lastAsst)) return true
  if (ASKED_HINT.test(lastAsst) && n.length < 120) return true
  if (isQuestion) return false
  return relevantActions(userText, lastAssistantText).length > 0
}

/** Un mismo mensaje con varias cosas ("tomé 2 vasos de agua y almorcé milanesa"): lo resuelve mejor el LLM. */
export function looksMultiIntent(userText: string, lastAssistantText = ''): boolean {
  const n = normalizeText(userText)
  const joined = /(\by\b|\be\b|,|\bademas\b|\btambien\b|\bluego\b)/.test(n)
  if (!joined) return false
  const hay = normalizeText(userText)
  const matched = new Set(ALL_ACTIONS.filter((a) => a.hints.test(hay)).map((a) => a.type))
  return matched.size >= 2 && looksLikeActionRequest(userText, lastAssistantText)
}

// ---------------------------------------------------------------------------
// Honestidad: el LLM no guarda nada
// ---------------------------------------------------------------------------
const FALSE_SAVE_CLAIM =
  /\b(he|ya|te)\s+(guard|carg|agend|anot|registr|program|agreg)\w+|\b(guard|carg|agend|anot|registr|program|agreg)(e|é|o|ó|amos)\b.{0,40}\b(en tu|en la|en el|en estudios|a tu|en su)\b|\b(qued[oó]|quedaron)\s+(guardad|cargad|agendad|anotad|registrad)\w+/i

/** Si el LLM afirma haber guardado algo (y la app no ejecutó ninguna acción), se aclara. */
export function guardFalseSaveClaims(text: string): string {
  if (!FALSE_SAVE_CLAIM.test(text)) return text
  return (
    text.trim() +
    '\n\n⚠️ **Ojo, che:** eso todavía **no quedó guardado**. Decímelo directo y lo hago, por ejemplo: ' +
    '**"se me vence la VTV el 15 de noviembre"**, **"tomé 3 vasos de agua"** o **"hoy me siento bajón"**.'
  )
}

// ---------------------------------------------------------------------------
// Armado del resultado real
// ---------------------------------------------------------------------------
const makeContext = (data: AppData, lastAssistantText?: string): ActionContext => {
  const now = new Date()
  return { now, data, todayKey: toLocalDateKey(now), lastAssistantText }
}

function buildResult(raws: RawAction[], ctx: ActionContext): AssistantMutationResult | null {
  const outcomes: ActionOutcome[] = []
  const questions: string[] = []

  for (const raw of raws.slice(0, MAX_ACTIONS)) {
    if (raw.type === 'clarify') {
      const q = typeof raw.question === 'string' ? raw.question.trim().slice(0, 200) : ''
      if (q) questions.push(q)
      continue
    }
    const def = ALL_ACTIONS.find((a) => a.type === raw.type)
    if (!def) continue
    const built = def.build(raw, ctx)
    if (!built) continue
    if (isClarify(built)) questions.push(built.clarify)
    else outcomes.push(built)
  }

  if (outcomes.length === 0 && questions.length === 0) return null

  const parts: string[] = []
  if (outcomes.length) {
    parts.push(`✅ **¡Listo, che! Esto quedó guardado:**\n\n${outcomes.map((o) => o.line).join('\n')}`)
    const notes = outcomes.map((o) => o.note).filter(Boolean)
    if (notes.length) parts.push(notes.join('\n\n'))
    parts.push('Si no era lo que querías, tocá **Deshacer**.')
  }
  if (questions.length) parts.push(`${outcomes.length ? '❓ Falta un dato: ' : ''}${questions.join(' ')}`)

  const card: AssistantMutationCard | undefined = outcomes[0]?.card
  const message: AssistantMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sender: 'assistant',
    text: parts.join('\n\n'),
    timestamp: ctx.now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    action: outcomes[0]?.link,
    mutationCard: card,
  }

  return {
    message,
    updater: (prev) => outcomes.reduce((acc, o) => o.apply(acc), prev),
  }
}

/** Vía 1: reglas locales (sin LLM). */
export function planLocalActions(text: string, data: AppData, lastAssistantText = ''): AssistantMutationResult | null {
  const ctx = makeContext(data, lastAssistantText)
  const raws: RawAction[] = []
  for (const def of ALL_ACTIONS) {
    const found = def.local?.(text, ctx)
    if (found) raws.push(...found)
  }
  return raws.length ? buildResult(raws, ctx) : null
}

// ---------------------------------------------------------------------------
// Vía 2: interpretación con el LLM local
// ---------------------------------------------------------------------------
const buildExtractionPrompt = (now: Date, defs: typeof ALL_ACTIONS) => {
  const today = toLocalDateKey(now)
  const weekday = now.toLocaleDateString('es-AR', { weekday: 'long' })
  return `Sos un extractor de acciones para una app personal. Leé la conversación y devolvé SOLO un JSON válido, sin texto extra.

Hoy es ${weekday} ${today}, son las ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} (hora de Argentina).

Formato exacto: {"actions":[ ... ]}

Acciones posibles:
${defs.map((d) => `- ${d.schema}\n  Ej: ${d.example}`).join('\n')}
- {"type":"clarify","question":"pregunta corta"}  → usalo SOLO si falta un dato imprescindible (por ejemplo la fecha de un vencimiento) y no se puede deducir.

Reglas:
- Incluí solo lo que el usuario cuenta o pide en su ÚLTIMO mensaje. Si responde "sí"/"dale"/"cargalo" o contesta una pregunta, usá el contexto.
- No repitas acciones que el asistente ya confirmó antes ("quedó guardado").
- Las fechas van en formato YYYY-MM-DD calculadas desde la fecha de hoy ("mañana", "el viernes", "en 10 días"...).
- Montos: "una luca"=1000, "20 lucas"=20000, "un palo"=1000000. Sin moneda es ARS.
- Ergometría, prueba de esfuerzo, electrocardiograma, ecografía, resonancia, análisis, radiografía son ESTUDIOS MÉDICOS, nunca entrenamientos.
- No inventes datos. Si el usuario solo conversa o pregunta, devolvé {"actions":[]}.`
}

function parseActions(content: string): RawAction[] {
  try {
    const parsed = JSON.parse(content) as { actions?: unknown }
    return Array.isArray(parsed.actions) ? (parsed.actions.filter((a) => a && typeof a === 'object') as RawAction[]) : []
  } catch {
    return []
  }
}

/** Pide al LLM que traduzca el pedido a acciones y las ejecuta con el catálogo. */
export async function planLlmActions(
  userText: string,
  history: ChatHistoryItem[],
  modelName: string,
  data: AppData,
  lastAssistantText = '',
): Promise<AssistantMutationResult | null> {
  const defs = relevantActions(userText, lastAssistantText).slice(0, 7)
  if (defs.length === 0) return null

  const ctx = makeContext(data, lastAssistantText)
  const recent = history.slice(-4).map((h) => ({ role: h.role, content: h.content.slice(0, 600) }))

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      stream: false,
      format: 'json',
      messages: [{ role: 'system', content: buildExtractionPrompt(ctx.now, defs) }, ...recent, { role: 'user', content: userText }],
      options: { temperature: 0, num_predict: 500 },
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`Extractor Ollama ${res.status}`)

  const body = (await res.json()) as { message?: { content?: string } }
  return buildResult(parseActions(body.message?.content ?? '{}'), ctx)
}
