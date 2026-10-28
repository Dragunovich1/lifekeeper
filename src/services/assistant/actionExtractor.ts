/**
 * Extracción y ejecución real de acciones pedidas en lenguaje natural cuando responde el LLM local.
 *
 * El LLM solo interpreta el pedido y devuelve un JSON; quien guarda y confirma es esta capa.
 * Así el asistente nunca afirma haber guardado algo que no se guardó.
 */

import type { AppData, ClinicalNote, Reminder } from '../../types'
import { toLocalDateKey } from '../../utils/dates'
import type { AssistantMessage, AssistantMutationResult } from './localAssistant'
import type { ChatHistoryItem } from './ollamaClient'

export type ExtractedAction =
  | {
      type: 'reminder'
      title: string
      date: string
      time: string
      category: Reminder['category']
      details?: string
    }
  | {
      type: 'clinical_note'
      title: string
      description: string
      date: string
      tags: string[]
    }

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:()"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const ACTION_VERBS =
  /\b(carga|cargalo|cargarlo|cargar|guarda|guardalo|guardarlo|guardar|anota|anotalo|anotar|agenda|agendalo|agendame|agendar|recorda|recordame|recordatorio|agrega|agregalo|agregar|registra|registralo|registrar|apunta|apuntalo|crea|crealo|programa|programalo|ponelo|pone)\b/
const EVENT_HINT = /\b(tengo|tenemos|me toca|tengo que|voy a|turno|cita)\b/
const WHEN_HINT = /\b(hoy|manana|pasado manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b|\d{1,2}\s*(:|hs|h\b|am|pm)/
const OFFER_HINT = /(queres que|te lo guardo|te lo cargo|te lo agendo|lo guardo|lo cargo|lo agendo|te envie|te guarde|te agende)/
const AFFIRMATIVE = /^(si|sii+|dale|ok|okey|listo|claro|obvio|porfa|por favor|bueno|de una|metele|hacelo)\b/

/** Filtro barato para no consultar al LLM en cada mensaje (las preguntas puras no lo necesitan). */
export function looksLikeActionRequest(userText: string, lastAssistantText = ''): boolean {
  const n = normalize(userText)
  if (ACTION_VERBS.test(n)) return true
  if (EVENT_HINT.test(n) && WHEN_HINT.test(n)) return true
  if (AFFIRMATIVE.test(n) && OFFER_HINT.test(normalize(lastAssistantText))) return true
  return false
}

const FALSE_SAVE_CLAIM =
  /\b(he|ya|te)\s+(guard|carg|agend|anot|registr|program|agreg)\w+|\b(guard|carg|agend|anot|registr|program|agreg)(e|é|o|ó|amos)\b.{0,40}\b(en tu|en la|en el|en estudios|a tu|en su)\b|\b(qued[oó]|quedaron)\s+(guardad|cargad|agendad|anotad|registrad)\w+/i

/**
 * Si el LLM afirma haber guardado algo (y la app no ejecutó ninguna acción), se aclara.
 */
export function guardFalseSaveClaims(text: string): string {
  if (!FALSE_SAVE_CLAIM.test(text)) return text
  return (
    text.trim() +
    '\n\n⚠️ **Ojo, che:** eso todavía **no quedó guardado**. Decímelo directo y lo hago, por ejemplo: ' +
    '**"agendá ergometría hoy a las 15:00"** o **"cargá la ergometría en estudios médicos"**.'
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

const buildExtractionPrompt = (now: Date) => {
  const today = toLocalDateKey(now)
  const weekday = now.toLocaleDateString('es-AR', { weekday: 'long' })
  return `Sos un extractor de acciones para una app personal. Leé la conversación y devolvé SOLO un JSON válido, sin texto extra.

Hoy es ${weekday} ${today}, son las ${pad(now.getHours())}:${pad(now.getMinutes())} (hora de Argentina).

Formato exacto:
{"actions":[ ... ]}

Tipos de acción permitidos:
1) {"type":"reminder","title":"...","date":"YYYY-MM-DD","time":"HH:MM","category":"salud|personal|general","details":"..."}
   Usalo cuando el usuario quiere que se lo recuerden o te cuenta un evento/turno/estudio futuro con fecha u hora ("hoy a las 15:00 tengo ergometría", "recordame...", "agendá...").
2) {"type":"clinical_note","title":"...","description":"...","date":"YYYY-MM-DD","tags":["Estudio"]}
   Usalo SOLO si el usuario pide cargar/guardar algo en estudios médicos, historial clínico o ficha médica. Tags posibles: Estudio, Laboratorio, Diagnóstico, Cirugía, Odontología, Oftalmología, Cardiología, Traumatología.

Reglas:
- Incluí solo lo pedido en el ÚLTIMO mensaje del usuario. Si el usuario dice "sí", "dale" o "cargalo" respondiendo a algo anterior, usá el contexto para saber qué es.
- No repitas acciones que el asistente ya confirmó antes con una tarjeta.
- Ergometría, prueba de esfuerzo, electrocardiograma, ecografía, resonancia, análisis, radiografía, etc. son ESTUDIOS MÉDICOS (categoría "salud", tag "Estudio"). Nunca son entrenamientos.
- Si falta la hora usá "09:00"; si falta la fecha usá la de hoy; "mañana" = día siguiente.
- title corto y claro (ej: "Ergometría"). description con fecha, hora y todo dato útil.
- Si el usuario solo conversa, pregunta o no pide guardar nada: {"actions":[]}`
}

interface RawAction {
  type?: string
  title?: string
  description?: string
  details?: string
  date?: string
  time?: string
  category?: string
  tags?: unknown
}

const CLINICAL_TAGS = ['Estudio', 'Laboratorio', 'Diagnóstico', 'Cirugía', 'Odontología', 'Oftalmología', 'Cardiología', 'Traumatología']

function sanitize(raw: RawAction[], now: Date): ExtractedAction[] {
  const today = toLocalDateKey(now)
  const out: ExtractedAction[] = []

  for (const a of raw.slice(0, 3)) {
    const title = String(a.title ?? '').trim().slice(0, 80)
    if (!title) continue
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(a.date)) ? String(a.date) : today
    const time = /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(a.time)) ? String(a.time).padStart(5, '0') : '09:00'

    if (a.type === 'reminder') {
      const category = (['salud', 'personal', 'general'] as const).find((c) => c === a.category) ?? 'general'
      out.push({ type: 'reminder', title, date, time, category, details: a.details ? String(a.details).slice(0, 300) : undefined })
    } else if (a.type === 'clinical_note') {
      const tags = Array.isArray(a.tags)
        ? a.tags.map(String).filter((t) => CLINICAL_TAGS.includes(t))
        : []
      out.push({
        type: 'clinical_note',
        title,
        description: String(a.description ?? title).slice(0, 600),
        date,
        tags: tags.length ? tags : ['Estudio'],
      })
    }
  }
  return out
}

/** Pide al LLM local que traduzca el pedido a acciones estructuradas (no streaming). */
export async function extractActions(
  userText: string,
  history: ChatHistoryItem[],
  modelName: string,
): Promise<ExtractedAction[]> {
  const now = new Date()
  const recent = history.slice(-4).map((h) => ({ role: h.role, content: h.content.slice(0, 600) }))

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: buildExtractionPrompt(now) },
        ...recent,
        { role: 'user', content: userText },
      ],
      options: { temperature: 0, num_predict: 400 },
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`Extractor Ollama ${res.status}`)

  const body = (await res.json()) as { message?: { content?: string } }
  const parsed = JSON.parse(body.message?.content ?? '{}') as { actions?: RawAction[] }
  return sanitize(Array.isArray(parsed.actions) ? parsed.actions : [], now)
}

/** Convierte las acciones en un cambio real sobre la bóveda y en el mensaje de confirmación. */
export function buildActionsResult(actions: ExtractedAction[]): AssistantMutationResult | null {
  if (actions.length === 0) return null

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const reminders: Reminder[] = []
  const notes: ClinicalNote[] = []
  const lines: string[] = []
  let primaryCard: AssistantMessage['mutationCard']
  let actionLink: AssistantMessage['action']

  actions.forEach((a, i) => {
    const id = `${a.type === 'reminder' ? 'rem' : 'note'}-${stamp}-${i}`
    const [y, m, d] = a.date.split('-').map(Number)

    if (a.type === 'reminder') {
      const [h, min] = a.time.split(':').map(Number)
      const when = new Date(y, m - 1, d, h, min, 0, 0)
      reminders.push({
        id,
        title: a.title,
        details: a.details,
        dateTime: when.toISOString(),
        category: a.category,
        done: false,
      })
      const label = `${when.toLocaleDateString('es-AR')} a las ${a.time}`
      lines.push(`• ⏰ **Recordatorio:** ${a.title} — ${label}`)
      primaryCard ??= { category: 'recordatorio', title: a.title, details: label, badge: 'Agendado', entityId: id }
      actionLink ??= { label: 'Ver Recordatorios', hash: '#utilities:reminders' }
    } else {
      notes.push({ id, title: a.title, description: a.description, date: a.date, tags: a.tags })
      lines.push(`• 🩺 **Historial clínico (${a.tags.join(', ')}):** ${a.title} — ${new Date(y, m - 1, d).toLocaleDateString('es-AR')}`)
      primaryCard ??= {
        category: 'salud',
        title: a.title,
        details: `Historial clínico · ${a.tags.join(', ')}`,
        badge: 'Guardado',
        entityId: id,
      }
      actionLink = { label: 'Ver Historial Clínico', hash: '#health:history' }
    }
  })

  const updater = (prev: AppData): AppData => ({
    ...prev,
    health: notes.length ? { ...prev.health, clinicalNotes: [...notes, ...prev.health.clinicalNotes] } : prev.health,
    utilities: reminders.length
      ? { ...prev.utilities, reminders: [...reminders, ...(prev.utilities.reminders ?? [])] }
      : prev.utilities,
  })

  const message: AssistantMessage = {
    id: `msg-${stamp}`,
    sender: 'assistant',
    text: `✅ **¡Listo, che! Esto quedó guardado de verdad:**\n\n${lines.join('\n')}\n\nSi no era lo que querías, tocá **Deshacer**.`,
    timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    action: actionLink,
    mutationCard: primaryCard,
  }

  return { message, updater }
}
