/**
 * Evaluador aritmético seguro (sin eval) para la calculadora.
 * Soporta + - × ÷ ^ paréntesis, decimales y porcentajes con el comportamiento de calculadora de bolsillo:
 *   200 + 10%  → 220      200 - 10% → 180      200 × 10% → 20      50% → 0.5
 */

export type EvalResult = { ok: true; value: number } | { ok: false; error: string }

interface Term {
  value: number
  /** Valor sin dividir por 100 si terminó en %, para resolver "a + b%" sobre a. */
  percentRaw?: number
}

class Parser {
  private pos = 0
  private readonly src: string

  constructor(src: string) {
    this.src = src
  }

  parse(): number {
    const result = this.expression()
    this.skipSpaces()
    if (this.pos < this.src.length) throw new Error('Expresión inválida')
    return result
  }

  private skipSpaces() {
    while (this.src[this.pos] === ' ') this.pos++
  }

  private peek(): string {
    this.skipSpaces()
    return this.src[this.pos] ?? ''
  }

  private expression(): number {
    let left = this.term().value
    for (;;) {
      const op = this.peek()
      if (op !== '+' && op !== '-') return left
      this.pos++
      const right = this.term()
      const amount = right.percentRaw !== undefined ? (left * right.percentRaw) / 100 : right.value
      left = op === '+' ? left + amount : left - amount
    }
  }

  private term(): Term {
    let left = this.factor()
    for (;;) {
      const op = this.peek()
      if (op !== '*' && op !== '/') return left
      this.pos++
      const right = this.factor()
      if (op === '/' && right.value === 0) throw new Error('No se puede dividir por cero')
      left = { value: op === '*' ? left.value * right.value : left.value / right.value }
    }
  }

  private factor(): Term {
    const base = this.unary()
    if (this.peek() === '^') {
      this.pos++
      const exponent = this.factor()
      return { value: Math.pow(base.value, exponent.value) }
    }
    return base
  }

  private unary(): Term {
    const c = this.peek()
    if (c === '-') {
      this.pos++
      const inner = this.unary()
      return { value: -inner.value, percentRaw: inner.percentRaw !== undefined ? -inner.percentRaw : undefined }
    }
    if (c === '+') {
      this.pos++
      return this.unary()
    }
    return this.postfix()
  }

  private postfix(): Term {
    const raw = this.primary()
    let term: Term = { value: raw }
    while (this.peek() === '%') {
      this.pos++
      term = { value: term.value / 100, percentRaw: term.percentRaw ?? term.value }
    }
    return term
  }

  private primary(): number {
    const c = this.peek()
    if (c === '(') {
      this.pos++
      const inner = this.expression()
      if (this.peek() !== ')') throw new Error('Falta cerrar un paréntesis')
      this.pos++
      return inner
    }
    const match = /^\d*\.?\d+(?:e[+-]?\d+)?|^\d+\.?/i.exec(this.src.slice(this.pos))
    if (!match) throw new Error('Expresión inválida')
    this.pos += match[0].length
    return parseFloat(match[0])
  }
}

/** Acepta × ÷ − y la coma decimal tipeada por el usuario. */
export const normalizeExpression = (input: string): string =>
  input
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/,/g, '.')

export function evaluateExpression(input: string): EvalResult {
  const src = normalizeExpression(input).trim()
  if (!src) return { ok: false, error: 'Escribí una cuenta' }
  try {
    // Cierra paréntesis abiertos para permitir resultados parciales mientras se tipea
    const open = (src.match(/\(/g) ?? []).length - (src.match(/\)/g) ?? []).length
    const value = new Parser(src + ')'.repeat(Math.max(0, open))).parse()
    if (!Number.isFinite(value)) return { ok: false, error: 'Resultado fuera de rango' }
    return { ok: true, value }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Expresión inválida' }
  }
}

/** 1234.5 → "1.234,5" (hasta 10 dígitos significativos, sin ruido de coma flotante). */
export function formatNumber(value: number, maxDecimals = 8): string {
  if (!Number.isFinite(value)) return '—'
  const cleaned = parseFloat(value.toPrecision(12))
  return cleaned.toLocaleString('es-AR', { maximumFractionDigits: maxDecimals })
}

export const formatMoney = (value: number, currency = 'ARS'): string =>
  value.toLocaleString('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 })
