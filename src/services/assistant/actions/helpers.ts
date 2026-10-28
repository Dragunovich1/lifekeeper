import type { AppData } from '../../../types'
import { toKey } from './dateParser'

export const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:()_"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN
  return Number.isFinite(n) ? n : null
}

export const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  allowed.find((a) => a === v) ?? null

/** Fecha YYYY-MM-DD válida o el valor de respaldo. */
export const isoDate = (v: unknown, fallback: string): string => {
  const s = str(v, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? s : fallback
}

export const optionalIsoDate = (v: unknown): string | undefined => {
  const s = isoDate(v, '')
  return s || undefined
}

export const timeOr = (v: unknown, fallback: string): string => {
  const s = str(v, 5)
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(s) ? s.padStart(5, '0') : fallback
}

export const money = (amount: number, currency = 'ARS') => {
  const symbol = currency === 'ARS' ? '$' : `${currency} `
  return `${symbol}${amount.toLocaleString('es-AR')}`
}

export const fmtDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR')
}

export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** Busca por nombre en una lista: coincidencia exacta o por inclusión, sin tildes. */
export function findByName<T>(items: T[], query: string, getName: (item: T) => string): T | null {
  const q = normalizeText(query)
  if (!q) return null
  return (
    items.find((i) => normalizeText(getName(i)) === q) ??
    items.find((i) => {
      const n = normalizeText(getName(i))
      return n && (n.includes(q) || q.includes(n))
    }) ??
    null
  )
}

export const todayKeyOf = (now: Date) => toKey(now)

export type Updater = (prev: AppData) => AppData
