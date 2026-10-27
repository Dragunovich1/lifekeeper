import { saveAs } from 'file-saver'
import { safeParseDate } from './dates'

export interface ICalendarEventData {
  id: string
  title: string
  description?: string
  date: string // ISO string or YYYY-MM-DD
  endDate?: string
  category?: string
  location?: string
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const formatIcsDate = (dateStr: string): string => {
  const d = safeParseDate(dateStr)
  if (!d) {
    const clean = dateStr.replace(/[-:]/g, '').slice(0, 8)
    return `${clean}T090000Z`
  }

  // Format YYYYMMDDTHHmmssZ
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    'T' +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    'Z'
  )
}

const escapeIcsText = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export const exportEventsToICS = (
  events: ICalendarEventData[],
  calendarName = 'LifeKeeper Eventos',
  filename = 'lifekeeper_eventos.ics',
) => {
  const now = new Date()
  const dtStamp = formatIcsDate(now.toISOString())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LifeKeeper//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:UTC',
  ]

  events.forEach((ev) => {
    const startStr = formatIcsDate(ev.date)
    // Default 1 hour duration if no end date
    let endStr = startStr
    const parsedStart = safeParseDate(ev.date)
    if (ev.endDate) {
      endStr = formatIcsDate(ev.endDate)
    } else if (parsedStart) {
      const oneHourLater = new Date(parsedStart.getTime() + 60 * 60 * 1000)
      endStr = formatIcsDate(oneHourLater.toISOString())
    }

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${ev.id}@lifekeeper.local`)
    lines.push(`DTSTAMP:${dtStamp}`)
    lines.push(`DTSTART:${startStr}`)
    lines.push(`DTEND:${endStr}`)
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`)
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`)
    }
    if (ev.category) {
      lines.push(`CATEGORIES:${escapeIcsText(ev.category.toUpperCase())}`)
    }
    if (ev.location) {
      lines.push(`LOCATION:${escapeIcsText(ev.location)}`)
    }
    lines.push('STATUS:CONFIRMED')
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')

  const icsBlob = new Blob([lines.join('\r\n')], {
    type: 'text/calendar;charset=utf-8',
  })
  saveAs(icsBlob, filename)
}
