/**
 * Carga por conversación: convierte lo que dice el usuario, con sus propias palabras, en cambios reales sobre la bóveda.
 *
 * Con el LLM local disponible, es el LLM quien entiende el mensaje (sin frases ni palabras clave obligatorias):
 *  1. Un clasificador corto decide qué áreas de la suite involucra el mensaje.
 *  2. Un extractor completa los datos de esas áreas (con las entidades existentes como contexto).
 * Sin LLM, o si falla, se usan parsers locales determinísticos como respaldo.
 *
 * El LLM nunca guarda ni confirma nada: eso lo hace esta capa con el catálogo (`./actions`),
 * así el asistente no afirma haber guardado algo que no se guardó.
 */

import type { AppData, AssistantMutationCard } from '../../types'
import { toLocalDateKey } from '../../utils/dates'
import type { AssistantMessage, AssistantMutationResult } from './localAssistant'
import type { ChatHistoryItem } from './ollamaClient'
import { ALL_ACTIONS, isClarify, type ActionContext, type ActionOutcome, type RawAction } from './actions'
import { normalizeText } from './actions/helpers'

const MAX_ACTIONS = 4

/** Respaldo cuando el clasificador no responde: acciones cuyas pistas aparecen en el texto. */
const relevantActions = (userText: string, lastAssistantText: string) => {
  const hay = `${normalizeText(userText)} ${normalizeText(lastAssistantText).slice(-300)}`
  return ALL_ACTIONS.filter((a) => a.hints.test(hay))
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
// Interpretación con el LLM local
// ---------------------------------------------------------------------------
const recentContext = (history: ChatHistoryItem[]) =>
  history.slice(-4).map((h) => ({ role: h.role, content: h.content.slice(0, 500) }))

async function askJson(system: string, history: ChatHistoryItem[], userText: string, model: string, maxTokens: number, timeoutMs: number): Promise<unknown> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      messages: [{ role: 'system', content: system }, ...recentContext(history), { role: 'user', content: userText }],
      options: { temperature: 0, num_predict: maxTokens },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  const body = (await res.json()) as { message?: { content?: string } }
  return JSON.parse(body.message?.content ?? '{}')
}

const buildRouterPrompt = () => `Sos el clasificador de un asistente personal que guarda datos en una bóveda. Leé la conversación y decidí qué cosas quiere guardar o dejar registradas el usuario en su ÚLTIMO mensaje.

Devolvé SOLO JSON: {"types":["..."]} con los nombres que correspondan, o {"types":[]} si solo conversa, saluda, pregunta o consulta información que ya tiene.

Entendé cualquier forma de decirlo: lunfardo, errores de ortografía, mensajes cortos, relatos largos, varias cosas juntas, o respuestas como "sí" / "dale" / "el 15" a algo que el asistente acaba de preguntar u ofrecer. Contar un hecho ("se me vence la VTV", "hoy me siento bajón", "tomé agua") cuenta como pedido de registrarlo.

Nombres posibles:
${ALL_ACTIONS.map((a) => `- ${a.type}: ${a.about}`).join('\n')}`

const buildEntitiesContext = (data: AppData): string => {
  const lines: string[] = []
  const v = (data.personal.vehicleProfiles ?? []).map((x) => x.name || `${x.brand} ${x.model}`).filter(Boolean)
  if (v.length) lines.push(`Vehículos cargados: ${v.join(', ')}`)
  const d = (data.personal.debts ?? []).filter((x) => x.status !== 'cancelada').map((x) => `${x.counterparty} (${x.direction === 'por_cobrar' ? 'te debe' : 'le debés'})`)
  if (d.length) lines.push(`Deudas abiertas: ${d.join(', ')}`)
  const g = (data.personal.savingsGoals ?? []).filter((x) => !x.completed).map((x) => x.title)
  if (g.length) lines.push(`Metas de ahorro: ${g.join(', ')}`)
  const p = (data.personal.projects ?? []).map((x) => x.name)
  if (p.length) lines.push(`Proyectos: ${p.join(', ')}`)
  const m = data.health.medications.filter((x) => x.active).map((x) => `${x.name} ${x.dosage}`)
  if (m.length) lines.push(`Medicación activa: ${m.join(', ')}`)
  return lines.length ? `\nLo que el usuario ya tiene cargado (usá estos nombres exactos cuando se refiera a ellos):\n- ${lines.join('\n- ')}\n` : ''
}

const buildExtractionPrompt = (ctx: ActionContext, defs: typeof ALL_ACTIONS) => {
  const { now, data, todayKey } = ctx
  const weekday = now.toLocaleDateString('es-AR', { weekday: 'long' })
  return `Sos un extractor de datos para una app personal. Leé la conversación y devolvé SOLO un JSON válido, sin texto extra.

Hoy es ${weekday} ${todayKey}, son las ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} (hora de Argentina). El usuario es ${data.profile.gender ?? 'Masculino'}.
${buildEntitiesContext(data)}
Formato exacto: {"actions":[ ... ]}

Acciones disponibles (los ejemplos son solo orientativos: el usuario puede decirlo con cualquier palabra):
${defs.map((d) => `- ${d.schema}\n  Ej: ${d.example}`).join('\n')}
- {"type":"clarify","question":"pregunta corta"}  → usalo SOLO si falta un dato imprescindible (por ejemplo la fecha de un vencimiento) y no se puede deducir de la conversación.

Reglas:
- Registrá lo que cuenta o pide en su ÚLTIMO mensaje; si responde "sí"/"dale" o contesta una pregunta, usá el contexto para saber a qué se refiere.
- No repitas acciones que el asistente ya confirmó antes ("quedó guardado").
- Las fechas van en YYYY-MM-DD, calculadas desde la fecha de hoy ("mañana", "el viernes", "en 10 días", "a fin de mes"...).
- Montos: "una luca"=1000, "20 lucas"=20000, "un palo"=1000000. Sin moneda es ARS.
- Ergometría, prueba de esfuerzo, electrocardiograma, ecografía, resonancia, análisis, radiografía son ESTUDIOS MÉDICOS, nunca entrenamientos.
- Un malestar físico (dolor, fiebre) no es estado de ánimo.
- No inventes datos que el usuario no dijo.`
}

/**
 * El LLM entiende el mensaje y la app lo ejecuta.
 * Devuelve `null` si el mensaje no pide guardar nada (conversación normal) y lanza error si el LLM falla.
 */
export async function planLlmActions(
  userText: string,
  history: ChatHistoryItem[],
  modelName: string,
  data: AppData,
  lastAssistantText = '',
): Promise<AssistantMutationResult | null> {
  // 1. ¿De qué áreas se trata?
  let types: string[]
  try {
    const routed = (await askJson(buildRouterPrompt(), history, userText, modelName, 80, 30_000)) as { types?: unknown }
    types = Array.isArray(routed.types) ? routed.types.map(String) : []
  } catch (err) {
    // Si el clasificador falla, se prueba con las pistas de palabras antes de rendirse
    const fallback = relevantActions(userText, lastAssistantText)
    if (fallback.length === 0) throw err
    types = fallback.map((a) => a.type)
  }

  const defs = ALL_ACTIONS.filter((a) => types.includes(a.type)).slice(0, 6)
  if (defs.length === 0) return null

  // 2. Completar los datos de esas áreas
  const ctx = makeContext(data, lastAssistantText)
  const extracted = (await askJson(buildExtractionPrompt(ctx, defs), history, userText, modelName, 600, 60_000)) as { actions?: unknown }
  const raws = Array.isArray(extracted.actions) ? (extracted.actions.filter((a) => a && typeof a === 'object') as RawAction[]) : []
  return buildResult(raws, ctx)
}
