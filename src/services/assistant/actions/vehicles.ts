import type { Reminder, VehicleFuelLog, VehicleProfile, VehicleService } from '../../../types'
import { parseSpanishDate } from './dateParser'
import { capitalize, fmtDate, findByName, isoDate, normalizeText, num, oneOf, optionalIsoDate, str, uid } from './helpers'
import type { ActionContext, ActionDef } from './types'

const reminderAt = (dateKey: string, hour = 9): string => {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0, 0, 0).toISOString()
}

const addDaysKey = (dateKey: string, days: number): string => {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type Pick = { vehicle: VehicleProfile | null } | { clarify: string }

/** Elige el vehículo: el único cargado, el nombrado, o pregunta cuál. */
function pickVehicle(ctx: ActionContext, name: string): Pick {
  const vehicles = ctx.data.personal.vehicleProfiles ?? []
  if (vehicles.length === 0) return { vehicle: null }
  if (vehicles.length === 1) return { vehicle: vehicles[0] }
  const match = findByName(vehicles, name, (v) => `${v.name} ${v.brand} ${v.model}`.trim())
  if (match) return { vehicle: match }
  return { clarify: `¿De cuál vehículo? Tenés cargados: ${vehicles.map((v) => v.name || `${v.brand} ${v.model}`).join(', ')}.` }
}

const KIND = {
  vtv: { label: 'VTV', field: 'vtvExpiryDate' },
  seguro: { label: 'Seguro', field: 'insuranceExpiryDate' },
  licencia: { label: 'Licencia de conducir', field: 'licenseExpiryDate' },
} as const

function detectKind(n: string): keyof typeof KIND | null {
  if (/\b(vtv|rto|verificacion tecnica)\b/.test(n)) return 'vtv'
  if (/\b(seguro|poliza)\b/.test(n)) return 'seguro'
  if (/\b(licencia|registro de conducir|carnet de conducir|registro)\b/.test(n)) return 'licencia'
  return null
}

export const vehicleExpiryAction: ActionDef = {
  type: 'vehicle_expiry',
  hints: /vtv|rto|seguro|poliza|licencia|registro|vence|vencimiento|venci/,
  schema: '{"type":"vehicle_expiry","kind":"vtv|seguro|licencia","date":"YYYY-MM-DD o vacío si no la dijo","vehicle":"nombre del vehículo o vacío"}',
  example: '"se me vence la VTV el 15 de noviembre" → {"type":"vehicle_expiry","kind":"vtv","date":"2026-11-15"}   (si no dice la fecha dejá "date" vacío)',
  local(text, ctx) {
    const n = normalizeText(text)
    const kindNow = detectKind(n)
    const expiresWord = /\b(vence|vencimiento|venci[oó]|vencio|caduca|vencen)\b/.test(n)
    const date = parseSpanishDate(text, ctx.now)

    if (kindNow && expiresWord) return [{ type: 'vehicle_expiry', kind: kindNow, date: date ?? '' }]

    // Respuesta corta a "¿Para qué fecha vence tu VTV?"
    const asked = normalizeText(ctx.lastAssistantText ?? '')
    if (date && /para que fecha vence/.test(asked)) {
      const kindAsked = detectKind(asked)
      if (kindAsked) return [{ type: 'vehicle_expiry', kind: kindAsked, date }]
    }
    return null
  },
  build(raw, ctx) {
    const kind = oneOf(raw.kind, ['vtv', 'seguro', 'licencia'] as const)
    if (!kind) return null
    const { label, field } = KIND[kind]
    const date = optionalIsoDate(raw.date)
    if (!date) return { clarify: `¿Para qué fecha vence tu ${label}? Decime el día (ej. "el 15 de noviembre") y lo dejo cargado con su recordatorio.` }

    const picked = pickVehicle(ctx, str(raw.vehicle, 60))
    if ('clarify' in picked) return picked
    const vehicle = picked.vehicle

    const sourceId = `${vehicle?.id ?? 'sin-vehiculo'}:${kind}`
    // Recordatorio 7 días antes (o el mismo día si falta menos); si ya venció no se agenda nada
    const warnKey = addDaysKey(date, -7)
    const dueAt = new Date(reminderAt(date))
    const warnAt = new Date(reminderAt(warnKey))
    const when = warnAt > ctx.now ? warnAt : dueAt > ctx.now ? dueAt : null
    const reminder: Reminder | null = when
      ? {
          id: uid('rem'),
          title: `Vence ${label}${vehicle ? `: ${vehicle.name || vehicle.model}` : ''}`,
          details: `Vencimiento: ${fmtDate(date)}`,
          dateTime: when.toISOString(),
          category: 'personal',
          done: false,
          sourceId,
          sourceType: 'vehicle',
        }
      : null

    const expired = dueAt.getTime() < ctx.now.getTime() - 86_400_000
    return {
      apply: (prev) => ({
        ...prev,
        personal: vehicle
          ? { ...prev.personal, vehicleProfiles: (prev.personal.vehicleProfiles ?? []).map((v) => (v.id === vehicle.id ? { ...v, [field]: date } : v)) }
          : prev.personal,
        utilities: {
          ...prev.utilities,
          reminders: reminder
            ? [reminder, ...(prev.utilities.reminders ?? []).filter((r) => !(r.sourceType === 'vehicle' && r.sourceId === sourceId))]
            : prev.utilities.reminders,
        },
      }),
      line: `• 🚗 **${label}${vehicle ? ` de ${vehicle.name || vehicle.model}` : ''}:** vence el ${fmtDate(date)}${reminder ? ` — te aviso el ${when!.toLocaleDateString('es-AR')}` : ''}`,
      card: { category: 'recordatorio', title: `Vencimiento ${label}`, details: fmtDate(date), badge: expired ? 'Vencida' : 'Agendado', entityId: reminder?.id },
      link: { label: vehicle ? 'Ver Vehículos' : 'Ver Recordatorios', hash: vehicle ? '#personal:vehicles' : '#utilities:reminders' },
      note: vehicle ? (expired ? '⚠️ Ojo, esa fecha ya pasó: conviene renovarla cuanto antes.' : undefined) : 'ℹ️ No tenés ningún vehículo cargado, así que dejé solo el recordatorio. Si cargás tu vehículo en Vida personal > Vehículos, el vencimiento queda en su semáforo.',
    }
  },
}

export const vehicleFuelAction: ActionDef = {
  type: 'vehicle_fuel',
  hints: /nafta|combustible|cargue|litros|gnc|gasoil|tanque/,
  schema: '{"type":"vehicle_fuel","liters":número,"cost":número,"mileage":km del odómetro o vacío,"fuelType":"nafta|gasoil|gnc|electrico","vehicle":"..."}',
  example: '"cargué 30 litros de nafta, 45 lucas, tengo 82500 km" → {"type":"vehicle_fuel","liters":30,"cost":45000,"mileage":82500,"fuelType":"nafta"}',
  build(raw, ctx) {
    const liters = num(raw.liters)
    const cost = num(raw.cost)
    if (!liters || liters <= 0 || cost === null || cost < 0) return null
    const picked = pickVehicle(ctx, str(raw.vehicle, 60))
    if ('clarify' in picked) return picked
    if (!picked.vehicle) return { clarify: 'No tenés ningún vehículo cargado. Agregalo en Vida personal > Vehículos y después anoto las cargas.' }
    const vehicle = picked.vehicle
    const mileage = num(raw.mileage)
    const log: VehicleFuelLog = {
      id: uid('fuel'),
      date: ctx.todayKey,
      mileage: mileage ?? vehicle.currentMileage ?? 0,
      liters,
      cost,
      fuelType: oneOf(raw.fuelType, ['nafta', 'gasoil', 'gnc', 'electrico'] as const) ?? 'nafta',
    }
    return {
      apply: (prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          vehicleProfiles: (prev.personal.vehicleProfiles ?? []).map((v) =>
            v.id === vehicle.id ? { ...v, fuelLogs: [log, ...(v.fuelLogs ?? [])], currentMileage: mileage && mileage > (v.currentMileage ?? 0) ? mileage : v.currentMileage } : v,
          ),
        },
      }),
      line: `• ⛽ **Carga de combustible:** ${liters} L por $${cost.toLocaleString('es-AR')}${mileage ? ` a los ${mileage.toLocaleString('es-AR')} km` : ''}`,
      card: { category: 'finanzas', title: 'Carga de combustible', details: `${liters} L · $${cost.toLocaleString('es-AR')}`, badge: 'Combustible', entityId: log.id },
      link: { label: 'Ver Vehículos', hash: '#personal:vehicles' },
    }
  },
}

export const vehicleServiceAction: ActionDef = {
  type: 'vehicle_service',
  hints: /service|aceite|cambio de|neumatic|cubiertas|distribucion|frenos|taller|mecanic|bateria|filtro/,
  schema: '{"type":"vehicle_service","serviceType":"...","cost":número,"mileage":km,"nextServiceDate":"YYYY-MM-DD o vacío","nextServiceMileage":km,"vehicle":"..."}',
  example: '"hice el service, cambio de aceite, 80 lucas, 82000 km, el próximo a los 92000" → {"type":"vehicle_service","serviceType":"Cambio de aceite","cost":80000,"mileage":82000,"nextServiceMileage":92000}',
  build(raw, ctx) {
    const serviceType = capitalize(str(raw.serviceType, 80))
    if (!serviceType) return null
    const picked = pickVehicle(ctx, str(raw.vehicle, 60))
    if ('clarify' in picked) return picked
    const vehicle = picked.vehicle
    const next = optionalIsoDate(raw.nextServiceDate)
    const service: VehicleService = {
      id: uid('svc'),
      vehicleName: vehicle?.name || vehicle?.model || str(raw.vehicle, 60) || 'Mi vehículo',
      serviceType,
      date: isoDate(raw.date, ctx.todayKey),
      cost: num(raw.cost) ?? 0,
      mileage: num(raw.mileage) ?? undefined,
      nextServiceDate: next,
      nextServiceMileage: num(raw.nextServiceMileage) ?? undefined,
    }
    const reminder: Reminder | null = next
      ? { id: uid('rem'), title: `Próximo service: ${service.vehicleName} (${serviceType})`, dateTime: reminderAt(next), category: 'personal', done: false, sourceId: service.id, sourceType: 'vehicle' }
      : null
    return {
      apply: (prev) => ({
        ...prev,
        personal: { ...prev.personal, vehicles: [service, ...(prev.personal.vehicles ?? [])] },
        utilities: reminder ? { ...prev.utilities, reminders: [reminder, ...(prev.utilities.reminders ?? [])] } : prev.utilities,
      }),
      line: `• 🔧 **Service:** ${serviceType} — ${service.vehicleName}${service.cost ? ` ($${service.cost.toLocaleString('es-AR')})` : ''}${next ? ` · próximo ${fmtDate(next)}` : ''}`,
      card: { category: 'recordatorio', title: serviceType, details: service.vehicleName, badge: 'Service', entityId: service.id },
      link: { label: 'Ver Vehículos', hash: '#personal:vehicles' },
    }
  },
}

export const VEHICLE_ACTIONS = [vehicleExpiryAction, vehicleFuelAction, vehicleServiceAction]
