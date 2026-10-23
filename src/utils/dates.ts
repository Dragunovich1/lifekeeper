import {
  addDays,
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isToday,
  isValid,
  parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'

const pad = (value: number) => String(value).padStart(2, '0')

export const safeParseDate = (value?: string | Date | null): Date | null => {
  if (!value) return null
  if (value instanceof Date) return isValid(value) ? value : null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Si es solo fecha YYYY-MM-DD, interpretarla en hora local para evitar desfase UTC
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (dateOnlyMatch) {
    const localDate = new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3]),
    )
    return isValid(localDate) ? localDate : null
  }
  // Si es fecha+hora local YYYY-MM-DDTHH:mm (sin Z ni offset)
  const localDateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(trimmed)
  if (localDateTimeMatch) {
    const localDateTime = new Date(
      Number(localDateTimeMatch[1]),
      Number(localDateTimeMatch[2]) - 1,
      Number(localDateTimeMatch[3]),
      Number(localDateTimeMatch[4]),
      Number(localDateTimeMatch[5]),
    )
    return isValid(localDateTime) ? localDateTime : null
  }
  const parsed = parseISO(trimmed)
  if (isValid(parsed)) return parsed
  const fallback = new Date(trimmed)
  return isValid(fallback) ? fallback : null
}

export const toLocalDateKey = (value?: string | Date | null): string => {
  const date = safeParseDate(value)
  if (!date) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const toLocalTimeKey = (value?: string | Date | null, fallback = '09:00'): string => {
  if (typeof value === 'string') {
    const timeOnly = /^(\d{2}):(\d{2})$/.exec(value.trim())
    if (timeOnly) return `${timeOnly[1]}:${timeOnly[2]}`
  }
  const date = safeParseDate(value)
  if (!date) return fallback
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const toLocalDateTimeKey = (value?: string | Date | null, fallbackTime = '09:00'): string => {
  const date = safeParseDate(value)
  if (!date) return ''
  const dateKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const timeKey = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  return `${dateKey}T${timeKey || fallbackTime}`
}

export const fromLocalDateOrDateTime = (value?: string | null, fallbackToNow = false): string => {
  const date = safeParseDate(value)
  if (!date) {
    return fallbackToNow ? new Date().toISOString() : ''
  }
  return date.toISOString()
}

export const formatDate = (value: string) => {
  const date = safeParseDate(value)
  return date ? format(date, 'dd/MM/yyyy', { locale: es }) : '—'
}

export const formatDateTime = (value: string) => {
  const date = safeParseDate(value)
  return date ? format(date, 'dd/MM/yyyy HH:mm', { locale: es }) : '—'
}

export const isUpcoming = (value: string, thresholdDays = 30) => {
  const date = safeParseDate(value)
  if (!date) return false
  const today = new Date()
  return isAfter(date, today) && differenceInCalendarDays(date, today) <= thresholdDays
}

export const isPast = (value: string) => {
  const date = safeParseDate(value)
  if (!date) return false
  return isBefore(date, new Date()) && !isToday(date)
}

export const nextDays = (days: number) => addDays(new Date(), days).toISOString()

export const monthKey = (value: string) => {
  const date = safeParseDate(value)
  return date ? format(date, 'yyyy-MM') : ''
}

export const isSameDayString = (left: string, right: string) => {
  const d1 = safeParseDate(left)
  const d2 = safeParseDate(right)
  if (!d1 || !d2) return false
  return isSameDay(d1, d2)
}

const currencyFormatters = new Map<string, Intl.NumberFormat>()

export const getCurrencyFormatter = (currency: string = 'ARS'): Intl.NumberFormat => {
  const code = (currency || 'ARS').toUpperCase()
  let formatter = currencyFormatters.get(code)
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    } catch {
      formatter = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
    currencyFormatters.set(code, formatter)
  }
  return formatter
}

export const formatCurrency = (value: number, currency: string = 'ARS') => {
  const num = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return getCurrencyFormatter(currency).format(num)
}
