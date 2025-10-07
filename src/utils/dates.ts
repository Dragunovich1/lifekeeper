import { addDays, differenceInCalendarDays, format, isAfter, isBefore, isSameDay, isToday, parseISO } from 'date-fns'

export const formatDate = (value: string) => format(parseISO(value), 'dd/MM/yyyy')

export const formatDateTime = (value: string) => format(parseISO(value), 'dd/MM/yyyy HH:mm')

export const isUpcoming = (value: string, thresholdDays = 30) => {
  const date = parseISO(value)
  const today = new Date()
  return isAfter(date, today) && differenceInCalendarDays(date, today) <= thresholdDays
}

export const isPast = (value: string) => {
  return isBefore(parseISO(value), new Date()) && !isToday(parseISO(value))
}

export const nextDays = (days: number) => addDays(new Date(), days).toISOString()

export const monthKey = (value: string) => format(parseISO(value), 'yyyy-MM')

export const isSameDayString = (left: string, right: string) =>
  isSameDay(parseISO(left), parseISO(right))
