/**
 * Mascotas: edad, vencimientos de vacunas y controles, peso y gastos. Funciones puras (sin React) para poder probarlas.
 */
import type { Pet, PetExpense, PetExpenseCategory, PetHealthKind, PetHealthRecord, PetSpecies, PetWeightEntry } from '../types'

export const SPECIES: { value: PetSpecies; label: string; emoji: string }[] = [
  { value: 'perro', label: 'Perro', emoji: '🐶' },
  { value: 'gato', label: 'Gato', emoji: '🐱' },
  { value: 'conejo', label: 'Conejo', emoji: '🐰' },
  { value: 'ave', label: 'Ave', emoji: '🦜' },
  { value: 'roedor', label: 'Roedor (hámster, cobayo…)', emoji: '🐹' },
  { value: 'reptil', label: 'Reptil', emoji: '🦎' },
  { value: 'pez', label: 'Pez', emoji: '🐠' },
  { value: 'caballo', label: 'Caballo', emoji: '🐴' },
  { value: 'otro', label: 'Otro', emoji: '🐾' },
]

export const speciesInfo = (s: PetSpecies) => SPECIES.find((x) => x.value === s) ?? SPECIES[SPECIES.length - 1]

export const HEALTH_KINDS: { value: PetHealthKind; label: string; emoji: string }[] = [
  { value: 'vacuna', label: 'Vacuna', emoji: '💉' },
  { value: 'desparasitacion', label: 'Desparasitación', emoji: '🪱' },
  { value: 'antipulgas', label: 'Antipulgas / garrapatas', emoji: '🪲' },
  { value: 'control', label: 'Control veterinario', emoji: '🩺' },
  { value: 'cirugia', label: 'Cirugía', emoji: '🏥' },
  { value: 'estudio', label: 'Estudio / análisis', emoji: '🔬' },
  { value: 'tratamiento', label: 'Tratamiento', emoji: '💊' },
  { value: 'otro', label: 'Otro', emoji: '📝' },
]
export const kindInfo = (k: PetHealthKind) => HEALTH_KINDS.find((x) => x.value === k) ?? HEALTH_KINDS[HEALTH_KINDS.length - 1]

export const EXPENSE_CATEGORIES: { value: PetExpenseCategory; label: string; emoji: string }[] = [
  { value: 'alimento', label: 'Alimento', emoji: '🍖' },
  { value: 'veterinario', label: 'Veterinario', emoji: '🩺' },
  { value: 'medicacion', label: 'Medicación', emoji: '💊' },
  { value: 'higiene', label: 'Higiene y peluquería', emoji: '🛁' },
  { value: 'accesorios', label: 'Accesorios y juguetes', emoji: '🧸' },
  { value: 'seguro', label: 'Seguro / plan', emoji: '🛡️' },
  { value: 'guarderia', label: 'Guardería / paseador', emoji: '🏠' },
  { value: 'otro', label: 'Otro', emoji: '🧾' },
]
export const expenseInfo = (c: PetExpenseCategory) => EXPENSE_CATEGORIES.find((x) => x.value === c) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]

/** Sugerencias de nombre según el tipo de registro y la especie. */
export function healthSuggestions(kind: PetHealthKind, species: PetSpecies): string[] {
  if (kind === 'vacuna') {
    if (species === 'perro') return ['Antirrábica', 'Séxtuple / Óctuple', 'Quíntuple', 'Tos de las perreras', 'Leptospirosis', 'Giardia']
    if (species === 'gato') return ['Antirrábica', 'Triple felina', 'Leucemia felina', 'Cuádruple felina']
    if (species === 'conejo') return ['Mixomatosis', 'Enfermedad hemorrágica viral']
    return ['Antirrábica', 'Polivalente']
  }
  if (kind === 'desparasitacion') return ['Desparasitación interna', 'Antiparasitario de amplio espectro']
  if (kind === 'antipulgas') return ['Pipeta antipulgas', 'Collar antipulgas', 'Comprimido antipulgas y garrapatas']
  if (kind === 'control') return ['Control anual', 'Control de cachorro', 'Control geriátrico', 'Control post cirugía']
  if (kind === 'cirugia') return ['Castración', 'Limpieza dental', 'Extracción de tumor']
  if (kind === 'estudio') return ['Hemograma', 'Análisis de orina', 'Radiografía', 'Ecografía']
  return []
}

/* ---------- Fechas ---------- */

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dayOf = (iso: string) => iso.slice(0, 10)
const toDate = (iso: string) => {
  const [y, m, d] = dayOf(iso).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Días desde hoy hasta la fecha (negativo = ya pasó). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((toDate(iso).getTime() - today.getTime()) / 86_400_000)
}

export type DueStatus = 'overdue' | 'soon' | 'ok'
export const SOON_DAYS = 30

export function dueStatus(nextDate: string, now: Date = new Date()): { status: DueStatus; days: number; label: string } {
  const days = daysUntil(nextDate, now)
  if (days < 0) return { status: 'overdue', days, label: days === -1 ? 'Venció ayer' : `Venció hace ${-days} días` }
  if (days === 0) return { status: 'soon', days, label: 'Vence hoy' }
  if (days <= SOON_DAYS) return { status: 'soon', days, label: days === 1 ? 'Vence mañana' : `Vence en ${days} días` }
  return { status: 'ok', days, label: `Vence en ${days} días` }
}

/** "3 años y 2 meses", "5 meses", "12 días". Vacío si no hay fecha. Para una mascota fallecida cuenta hasta esa fecha. */
export function petAge(pet: Pick<Pet, 'birthDate' | 'deceasedDate'>, now: Date = new Date()): string {
  if (!pet.birthDate) return ''
  const birth = toDate(pet.birthDate)
  const end = pet.deceasedDate ? toDate(pet.deceasedDate) : now
  if (end < birth) return ''
  let months = (end.getFullYear() - birth.getFullYear()) * 12 + (end.getMonth() - birth.getMonth())
  if (end.getDate() < birth.getDate()) months -= 1
  if (months < 1) {
    const days = Math.max(0, Math.floor((end.getTime() - birth.getTime()) / 86_400_000))
    return `${days} día${days === 1 ? '' : 's'}`
  }
  const years = Math.floor(months / 12)
  const rest = months % 12
  const y = years ? `${years} año${years === 1 ? '' : 's'}` : ''
  const m = rest ? `${rest} mes${rest === 1 ? '' : 'es'}` : ''
  return [y, m].filter(Boolean).join(' y ')
}

/* ---------- Salud ---------- */

export interface PetAlert {
  petId: string
  petName: string
  recordId?: string
  title: string
  date: string
  status: DueStatus
  days: number
  label: string
  kind: 'salud' | 'turno' | 'medicacion' | 'seguro'
}

/** Para cada vacuna/control se mira el último registro de ese nombre: si tiene próxima fecha, esa vale. */
export function latestByName(records: PetHealthRecord[]): PetHealthRecord[] {
  const latest = new Map<string, PetHealthRecord>()
  for (const r of records) {
    const k = `${r.kind}|${r.name.trim().toLowerCase()}`
    const cur = latest.get(k)
    if (!cur || r.date > cur.date) latest.set(k, r)
  }
  return [...latest.values()]
}

/** Vencimientos próximos o vencidos de una mascota (vacunas, controles, turnos y seguro). */
export function petAlerts(pet: Pet, now: Date = new Date()): PetAlert[] {
  if (pet.deceasedDate) return []
  const out: PetAlert[] = []
  for (const r of latestByName(pet.health)) {
    if (!r.nextDate) continue
    const d = dueStatus(r.nextDate, now)
    if (d.status === 'ok') continue
    out.push({ petId: pet.id, petName: pet.name, recordId: r.id, title: `${kindInfo(r.kind).label}: ${r.name}`, date: r.nextDate, ...d, kind: 'salud' })
  }
  for (const a of pet.appointments) {
    if (a.done) continue
    const days = daysUntil(a.date, now)
    if (days < 0 || days > SOON_DAYS) continue
    out.push({ petId: pet.id, petName: pet.name, recordId: a.id, title: `Turno: ${a.reason}`, date: a.date, status: 'soon', days, label: days === 0 ? 'Es hoy' : days === 1 ? 'Es mañana' : `En ${days} días`, kind: 'turno' })
  }
  if (pet.insurance?.validUntil) {
    const d = dueStatus(pet.insurance.validUntil, now)
    if (d.status !== 'ok') out.push({ petId: pet.id, petName: pet.name, title: `Seguro${pet.insurance.company ? ` (${pet.insurance.company})` : ''}`, date: pet.insurance.validUntil, ...d, kind: 'seguro' })
  }
  return out.sort((a, b) => a.days - b.days)
}

export const allPetAlerts = (pets: Pet[], now: Date = new Date()): PetAlert[] => pets.flatMap((p) => petAlerts(p, now)).sort((a, b) => a.days - b.days)

/** Medicación en curso (sin fecha de fin o con fin hoy o más adelante). */
export const activeMedications = (pet: Pet, now: Date = new Date()) => pet.medications.filter((m) => !m.endDate || daysUntil(m.endDate, now) >= 0)

/* ---------- Peso ---------- */

export const sortedWeights = (w: PetWeightEntry[]) => [...w].sort((a, b) => a.date.localeCompare(b.date))

export function weightSummary(weights: PetWeightEntry[]) {
  const s = sortedWeights(weights)
  if (s.length === 0) return null
  const last = s[s.length - 1]
  const prev = s.length > 1 ? s[s.length - 2] : null
  return {
    last,
    change: prev ? Number((last.kg - prev.kg).toFixed(2)) : 0,
    min: Math.min(...s.map((x) => x.kg)),
    max: Math.max(...s.map((x) => x.kg)),
    count: s.length,
  }
}

/* ---------- Gastos ---------- */

export function expenseTotals(expenses: PetExpense[], now: Date = new Date()) {
  const year = String(now.getFullYear())
  const month = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`
  let thisMonth = 0
  let thisYear = 0
  let all = 0
  const byCategory: Partial<Record<PetExpenseCategory, number>> = {}
  for (const e of expenses) {
    all += e.amount
    if (dayOf(e.date).startsWith(year)) {
      thisYear += e.amount
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
    }
    if (dayOf(e.date).startsWith(month)) thisMonth += e.amount
  }
  const round = (n: number) => Math.round(n * 100) / 100
  return { thisMonth: round(thisMonth), thisYear: round(thisYear), all: round(all), byCategory }
}

/** Una mascota nueva, vacía. */
export function newPet(name: string, species: PetSpecies, newId: () => string, now: Date = new Date()): Pet {
  return { id: newId(), name, species, health: [], weights: [], medications: [], appointments: [], expenses: [], createdAt: now.toISOString(), updatedAt: now.toISOString() }
}

export const todayKey = (now: Date = new Date()) => key(now)
