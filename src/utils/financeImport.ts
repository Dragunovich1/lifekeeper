/**
 * Importación de movimientos desde archivos (CSV, Excel y PDF de resúmenes).
 * Todo se procesa en el dispositivo; nada se sube a ningún servidor.
 */

import type { FinanceTransaction, TransactionType } from '../types'
import { normalizeCategoryName, suggestCategory } from './financeCategories'

export type FileMode = 'bank' | 'card'
export type Cell = string | number | Date | null | undefined

export interface RawTable {
  name: string
  rows: Cell[][]
}

export interface ColumnMap {
  date: number
  description: number
  amount: number
  debit: number
  credit: number
  type: number
  currency: number
  /** Columna de importe en dólares (resúmenes de tarjeta con dos columnas). */
  usd: number
}

export interface ImportRow {
  id: string
  date: string
  description: string
  /** Siempre positivo; el sentido lo da `type`. */
  amount: number
  type: TransactionType
  currency: string
  category: string
  include: boolean
  duplicate: boolean
  note?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
}

// ---------------------------------------------------------------------------
// Números y fechas
// ---------------------------------------------------------------------------

/** "1.234,56" · "1,234.56" · "-$ 1234.5" · "(500,00)" · "500,00-" → número con signo. */
export function parseAmount(value: Cell): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) return null
  let s = String(value).trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (/-\s*$/.test(s)) {
    negative = true
    s = s.replace(/-\s*$/, '')
  }
  if (/\b(cr|cred)\b\.?$/i.test(s)) s = s.replace(/\b(cr|cred)\b\.?$/i, '')
  if (/\b(db|deb)\b\.?$/i.test(s)) {
    negative = true
    s = s.replace(/\b(db|deb)\b\.?$/i, '')
  }
  s = s.replace(/[^\d.,-]/g, '')
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  }
  if (!/\d/.test(s)) return null
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    // El separador que aparece último es el decimal
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (lastDot >= 0) {
    // "1.234" (3 dígitos tras el punto, un solo punto) es miles en Argentina; "12.5" es decimal
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }
  const n = parseFloat(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

/** Fechas en formatos habituales de homebanking; devuelve YYYY-MM-DD o null. */
export function parseDate(value: Cell, refYear = new Date().getFullYear()): string | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    // exceljs entrega fechas en UTC a medianoche: se leen en UTC para no correr un día
    return keyOf(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
  }
  if (typeof value === 'number') {
    // Número de serie de Excel
    if (value > 20000 && value < 80000) {
      const d = new Date(Math.round((value - 25569) * 86400 * 1000))
      return keyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    }
    return null
  }
  const s = norm(String(value))
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1])
  m = s.match(/(\d{1,2})[ \-/]([a-z]{3})[a-z]*\.?[ \-/,]*(\d{2,4})?/)
  if (m && MONTHS[m[2]]) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : refYear
    return valid(year, MONTHS[m[2]], +m[1])
  }
  m = s.match(/^(\d{1,2})[/\-](\d{1,2})$/)
  if (m) return valid(refYear, +m[2], +m[1])
  return null
}

function valid(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? keyOf(y, mo, d) : null
}

const cellText = (c: Cell): string => (c instanceof Date ? parseDate(c) ?? '' : c === null || c === undefined ? '' : String(c).trim())

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
export function parseCsv(text: string): Cell[][] {
  const clean = text.replace(/^﻿/, '')
  const firstLines = clean.split(/\r?\n/).slice(0, 8).join('\n')
  const counts: [string, number][] = [';', ',', '\t', '|'].map((d) => [d, (firstLines.match(new RegExp(d === '|' ? '\\|' : d, 'g')) ?? []).length])
  const delimiter = counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim())) rows.push(row)
  return rows
}

// ---------------------------------------------------------------------------
// Detección de columnas
// ---------------------------------------------------------------------------
const HEADER_WORDS = {
  date: /^(fecha|date|f\.? ?(oper|valor|mov|compra)|dia|fecha (de )?(operacion|movimiento|compra|valor|consumo))/,
  description: /(descrip|detalle|concepto|movimiento$|comercio|establecimiento|referencia|leyenda|observ|glosa|transaccion)/,
  amount: /^(importe|monto|amount|valor|total|pesos|importe en pesos|monto en pesos|importe \(\$\)|importe ars)$/,
  debit: /(debito|debe\b|egreso|retiro|salida|gasto|cargo)/,
  credit: /(credito|haber|ingreso|deposito|entrada|abono)/,
  type: /^(tipo|d\/c|debito\/credito|naturaleza)/,
  currency: /(moneda|divisa|currency)/,
  usd: /(dolares|usd|u\$s|importe en dolares|monto en dolares)/,
}

export function detectHeaderRow(rows: Cell[][]): number {
  let best = -1
  let bestScore = 1
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = rows[i].map((c) => norm(cellText(c)))
    const score = cells.filter((c) => c && Object.values(HEADER_WORDS).some((rx) => rx.test(c))).length
    if (score > bestScore) {
      best = i
      bestScore = score
    }
  }
  return best
}

export function detectColumns(rows: Cell[][], headerRow: number): ColumnMap {
  const map: ColumnMap = { date: -1, description: -1, amount: -1, debit: -1, credit: -1, type: -1, currency: -1, usd: -1 }
  const width = Math.max(...rows.slice(0, 30).map((r) => r.length), 0)
  if (headerRow >= 0) {
    rows[headerRow].forEach((c, idx) => {
      const h = norm(cellText(c))
      if (!h) return
      if (map.usd < 0 && HEADER_WORDS.usd.test(h)) map.usd = idx
      else if (map.date < 0 && HEADER_WORDS.date.test(h)) map.date = idx
      else if (map.currency < 0 && HEADER_WORDS.currency.test(h)) map.currency = idx
      else if (map.type < 0 && HEADER_WORDS.type.test(h)) map.type = idx
      else if (map.amount < 0 && HEADER_WORDS.amount.test(h)) map.amount = idx
      else if (map.debit < 0 && HEADER_WORDS.debit.test(h)) map.debit = idx
      else if (map.credit < 0 && HEADER_WORDS.credit.test(h)) map.credit = idx
      else if (map.description < 0 && HEADER_WORDS.description.test(h)) map.description = idx
    })
  }
  const body = rows.slice(headerRow + 1, headerRow + 41)
  const colScore = (idx: number, test: (c: Cell) => boolean) => body.filter((r) => test(r[idx])).length
  if (map.date < 0) {
    let bestIdx = -1
    let best = 0
    for (let i = 0; i < width; i++) {
      const sc = colScore(i, (c) => parseDate(c) !== null)
      if (sc > best) {
        best = sc
        bestIdx = i
      }
    }
    map.date = bestIdx
  }
  if (map.amount < 0 && map.debit < 0 && map.credit < 0) {
    let bestIdx = -1
    let best = 0
    for (let i = width - 1; i >= 0; i--) {
      if (i === map.date) continue
      const sc = colScore(i, (c) => parseAmount(c) !== null && parseDate(c) === null)
      if (sc >= best && sc > 0) {
        best = sc
        bestIdx = i
      }
    }
    map.amount = bestIdx
  }
  if (map.description < 0) {
    let bestIdx = -1
    let best = 0
    for (let i = 0; i < width; i++) {
      if ([map.date, map.amount, map.debit, map.credit, map.type, map.currency, map.usd].includes(i)) continue
      const avg = body.reduce((s, r) => s + (typeof r[i] === 'string' ? (r[i] as string).length : 0), 0)
      if (avg > best) {
        best = avg
        bestIdx = i
      }
    }
    map.description = bestIdx
  }
  return map
}

// ---------------------------------------------------------------------------
// Conversión a movimientos
// ---------------------------------------------------------------------------
export interface BuildContext {
  mode: FileMode
  defaultCurrency: string
  existing: FinanceTransaction[]
  now?: Date
}

const CARD_PAYMENT = /(pago (de )?(tarjeta|resumen|minimo|total)|su pago|pago recibido|pago en (pesos|dolares)|debito automatico (visa|master|amex)|pago visa|pago master|saldo anterior|total a pagar|pago minimo|subtotal|saldo actual)/
const SKIP_LINE = /^(total|subtotal|saldo|resumen|consumos|pagina|page|vencimiento|cierre|limite|tasa|tna|cft)/

/** Clave para detectar duplicados contra lo ya cargado. */
const dupKey = (date: string, amount: number, type: string) => `${date}|${amount.toFixed(2)}|${type}`

function learnedCategories(existing: FinanceTransaction[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const t of existing) {
    if (!t.description) continue
    const key = norm(t.description)
    if (key.length >= 3 && !map.has(key)) map.set(key, t.category)
  }
  return map
}

function finalize(rows: Omit<ImportRow, 'id' | 'category' | 'duplicate'>[], ctx: BuildContext): ImportRow[] {
  const known = new Set(ctx.existing.map((t) => dupKey((t.date || '').slice(0, 10), t.amount, t.type)))
  const learned = learnedCategories(ctx.existing)
  const seen = new Map<string, number>()
  return rows.map((r, idx) => {
    const key = dupKey(r.date, r.amount, r.type)
    // Un mismo movimiento repetido dentro del archivo no es duplicado (puede ser legítimo); solo contra lo ya cargado
    seen.set(key, (seen.get(key) ?? 0) + 1)
    const duplicate = known.has(key)
    const memory = learned.get(norm(r.description))
    // En tarjetas, un importe a favor casi siempre es una devolución
    const suggested = suggestCategory(r.description, r.type)
    const fallback = ctx.mode === 'card' && r.type === 'income' && suggested === 'Otros ingresos' ? 'Reembolsos' : suggested
    return {
      ...r,
      id: `row-${idx}`,
      category: memory ?? fallback,
      duplicate,
      include: r.include && !duplicate,
    }
  })
}

export function tableToRows(rows: Cell[][], headerRow: number, map: ColumnMap, ctx: BuildContext): ImportRow[] {
  const refYear = (ctx.now ?? new Date()).getFullYear()
  const out: Omit<ImportRow, 'id' | 'category' | 'duplicate'>[] = []
  for (const r of rows.slice(headerRow + 1)) {
    const date = map.date >= 0 ? parseDate(r[map.date], refYear) : null
    if (!date) continue
    const description = (map.description >= 0 ? cellText(r[map.description]) : '').replace(/\s+/g, ' ')
    if (SKIP_LINE.test(norm(description)) && ctx.mode === 'card') continue

    let signed: number | null = null
    let currency = ctx.defaultCurrency
    if (map.amount >= 0) signed = parseAmount(r[map.amount])
    if ((signed === null || signed === 0) && map.usd >= 0) {
      const usd = parseAmount(r[map.usd])
      if (usd) {
        signed = usd
        currency = 'USD'
      }
    }
    if (map.amount < 0 || signed === null) {
      const debit = map.debit >= 0 ? parseAmount(r[map.debit]) : null
      const credit = map.credit >= 0 ? parseAmount(r[map.credit]) : null
      if (debit && Math.abs(debit) > 0) signed = -Math.abs(debit)
      else if (credit && Math.abs(credit) > 0) signed = Math.abs(credit)
    }
    if (signed === null || signed === 0) continue
    if (map.currency >= 0) {
      const c = norm(cellText(r[map.currency]))
      if (/usd|dolar|u\$s/.test(c)) currency = 'USD'
      else if (/eur/.test(c)) currency = 'EUR'
      else if (/ars|peso|\$/.test(c)) currency = 'ARS'
    }
    // Columna de tipo explícita (D/C, Débito/Crédito, Ingreso/Egreso)
    if (map.type >= 0) {
      const t = norm(cellText(r[map.type]))
      if (/^(d|db|deb|debito|egreso|gasto)/.test(t)) signed = -Math.abs(signed)
      else if (/^(c|cr|cred|credito|ingreso|haber)/.test(t)) signed = Math.abs(signed)
    }

    // En tarjetas todo lo positivo es consumo y lo negativo es pago/devolución
    const type: TransactionType = ctx.mode === 'card' ? (signed < 0 ? 'income' : 'expense') : signed < 0 ? 'expense' : 'income'
    const isCardPayment = ctx.mode === 'card' && CARD_PAYMENT.test(norm(description))
    out.push({
      date,
      description,
      amount: Math.abs(signed),
      type,
      currency,
      include: !isCardPayment,
      note: isCardPayment ? 'Pago del resumen: se omite para no contarlo dos veces' : undefined,
    })
  }
  return finalize(out, ctx)
}

/** Si todo es positivo suele ser una tarjeta; si hay positivos y negativos, una cuenta bancaria. */
export function guessMode(rows: Cell[][], headerRow: number, map: ColumnMap, fileName: string): FileMode {
  if (/(visa|master|amex|tarjeta|resumen|consumos)/.test(norm(fileName))) return 'card'
  if (map.debit >= 0 && map.credit >= 0) return 'bank'
  if (map.amount < 0) return 'bank'
  const values = rows.slice(headerRow + 1).map((r) => parseAmount(r[map.amount])).filter((v): v is number => v !== null && v !== 0)
  if (values.length === 0) return 'bank'
  const negatives = values.filter((v) => v < 0).length
  return negatives === 0 ? 'card' : 'bank'
}

// ---------------------------------------------------------------------------
// PDF (resúmenes de tarjeta y cuenta): se trabaja sobre las líneas de texto
// ---------------------------------------------------------------------------
const AMOUNT_RX = /-?\$?\s?\d{1,3}(?:\.\d{3})*,\d{2}-?|-?\$?\s?\d+,\d{2}-?|-?\d+\.\d{2}(?!\d)/g
const DATE_START = /^\s*(\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?|\d{1,2}[ \-/][A-Za-zÁÉÍÓÚáéíóú]{3,9}\.?(?:[ \-/,]*\d{2,4})?)\s+/

export function referenceYear(lines: string[], fallback = new Date().getFullYear()): number {
  const years = lines
    .slice(0, 60)
    .map((l) => l.match(/\b(20\d{2})\b/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => +m[1])
  return years.length ? Math.max(...years) : fallback
}

export function pdfLinesToRows(lines: string[], ctx: BuildContext): ImportRow[] {
  const refYear = referenceYear(lines, (ctx.now ?? new Date()).getFullYear())
  const now = ctx.now ?? new Date()
  const out: Omit<ImportRow, 'id' | 'category' | 'duplicate'>[] = []
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim()
    const dm = line.match(DATE_START)
    if (!dm) continue
    let date = parseDate(dm[1], refYear)
    if (!date) continue
    // Sin año explícito: si cae en el futuro respecto del resumen, es del año anterior
    if (!/\d{4}|\d{2}$/.test(dm[1].replace(/[^\d]/g, '').slice(-2)) || dm[1].split(/[/\-.]/).length === 2) {
      const d = new Date(date)
      if (d.getTime() > now.getTime() + 40 * 86_400_000) date = keyOf(d.getFullYear() - 1, d.getMonth() + 1, d.getDate())
    }
    const rest = line.slice(dm[0].length)
    const amounts = [...rest.matchAll(AMOUNT_RX)]
    if (amounts.length === 0) continue
    // Con dos importes al final suelen ser pesos y dólares: se toma el primero
    const tail = amounts.slice(-2)
    const first = tail[0]
    const description = rest
      .slice(0, amounts[Math.max(0, amounts.length - tail.length)].index)
      .replace(/\b\d{5,}\b/g, '')
      .replace(/[*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!description || SKIP_LINE.test(norm(description))) continue
    const signed = parseAmount(first[0])
    if (signed === null || signed === 0) continue
    const type: TransactionType = ctx.mode === 'card' ? (signed < 0 ? 'income' : 'expense') : signed < 0 ? 'expense' : 'income'
    const isCardPayment = ctx.mode === 'card' && CARD_PAYMENT.test(norm(description))
    out.push({
      date,
      description,
      amount: Math.abs(signed),
      type,
      currency: ctx.defaultCurrency,
      include: !isCardPayment,
      note: isCardPayment ? 'Pago del resumen: se omite para no contarlo dos veces' : undefined,
    })
  }
  return finalize(out, ctx)
}

export function guessModeFromLines(lines: string[], fileName: string): FileMode {
  const text = norm(`${fileName} ${lines.slice(0, 40).join(' ')}`)
  return /(visa|mastercard|master|amex|american express|tarjeta|resumen de cuenta|pago minimo|limite de compra)/.test(text) ? 'card' : 'bank'
}

export const normalizeForCompare = normalizeCategoryName
