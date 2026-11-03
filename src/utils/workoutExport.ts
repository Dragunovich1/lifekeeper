/**
 * Exportar entrenamientos por período (PDF, Excel, CSV y JSON): resolución del período, filtrado y armado de las
 * tablas (sesiones, series, ejercicios y resumen). La parte pura se prueba aparte; los escritores de archivos
 * (`writeXlsx`, `writeCsv`, `writeJson`) cargan `exceljs` solo cuando se usan.
 */
import type { WorkoutRoutine, WorkoutSession } from '../types'
import { GROUP_LABELS, buildBlocks, groupRest } from './workoutGroups'
import { exerciseRecords, formatSeconds, isFailure, isWarmup, kgToDisplay, dropsOf, measureOf, setVolumeKg, summarizeSession } from './workoutSets'
import { toLocalDateKey } from './dates'

export type PeriodKind = 'week' | 'month' | 'quarter' | 'half' | 'year' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'all' | 'custom'

export const PERIOD_OPTIONS: { value: PeriodKind; label: string }[] = [
  { value: 'week', label: 'Últimos 7 días' },
  { value: 'month', label: 'Últimos 30 días' },
  { value: 'thisMonth', label: 'Este mes' },
  { value: 'lastMonth', label: 'Mes pasado' },
  { value: 'quarter', label: 'Últimos 3 meses' },
  { value: 'half', label: 'Últimos 6 meses' },
  { value: 'year', label: 'Último año' },
  { value: 'thisYear', label: 'Este año' },
  { value: 'all', label: 'Todo el historial' },
  { value: 'custom', label: 'Fechas a elegir…' },
]

export interface ResolvedPeriod {
  /** Fechas locales AAAA-MM-DD, inclusive. null = sin límite. */
  from: string | null
  to: string | null
  label: string
}

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const shift = (d: Date, days: number) => {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  c.setDate(c.getDate() + days)
  return c
}
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const shortDate = (k: string) => {
  const [y, m, d] = k.split('-')
  return `${d}/${m}/${y}`
}

export function resolvePeriod(kind: PeriodKind, now: Date = new Date(), custom?: { from?: string; to?: string }): ResolvedPeriod {
  const today = key(now)
  switch (kind) {
    case 'week':
      return { from: key(shift(now, -6)), to: today, label: 'Últimos 7 días' }
    case 'month':
      return { from: key(shift(now, -29)), to: today, label: 'Últimos 30 días' }
    case 'quarter':
      return { from: key(shift(now, -89)), to: today, label: 'Últimos 3 meses' }
    case 'half':
      return { from: key(shift(now, -182)), to: today, label: 'Últimos 6 meses' }
    case 'year':
      return { from: key(shift(now, -364)), to: today, label: 'Último año' }
    case 'thisMonth': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: key(from), to: today, label: `${MONTHS[now.getMonth()]} ${now.getFullYear()}` }
    }
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: key(from), to: key(to), label: `${MONTHS[from.getMonth()]} ${from.getFullYear()}` }
    }
    case 'thisYear':
      return { from: `${now.getFullYear()}-01-01`, to: today, label: `Año ${now.getFullYear()}` }
    case 'custom': {
      const from = custom?.from || null
      const to = custom?.to || null
      const label = from && to ? `Del ${shortDate(from)} al ${shortDate(to)}` : from ? `Desde el ${shortDate(from)}` : to ? `Hasta el ${shortDate(to)}` : 'Fechas a elegir'
      return { from, to, label }
    }
    default:
      return { from: null, to: null, label: 'Historial completo' }
  }
}

export interface ExportFilters {
  period: ResolvedPeriod
  /** 'all' o un WorkoutType. */
  type?: string
  /** Texto a buscar en título, notas o ejercicios. */
  search?: string
}

export function filterWorkouts(workouts: WorkoutSession[], f: ExportFilters): WorkoutSession[] {
  const q = f.search?.toLowerCase().trim()
  return workouts
    .filter((w) => {
      const day = toLocalDateKey(w.date)
      if (f.period.from && day < f.period.from) return false
      if (f.period.to && day > f.period.to) return false
      if (f.type && f.type !== 'all' && w.type !== f.type) return false
      if (q) {
        const hit = w.title.toLowerCase().includes(q) || (w.notes ?? '').toLowerCase().includes(q) || w.exercises.some((e) => e.name.toLowerCase().includes(q))
        if (!hit) return false
      }
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface ExportContext {
  imperial: boolean
  routines?: WorkoutRoutine[]
}

const unitOf = (c: ExportContext) => (c.imperial ? 'lb' : 'kg')
const distOf = (c: ExportContext) => (c.imperial ? 'mi' : 'km')
const dispDist = (km: number | undefined, c: ExportContext) => (km ? Number((c.imperial ? km / 1.60934 : km).toFixed(2)) : '')

type Cell = string | number | boolean | ''
export interface Table {
  name: string
  headers: string[]
  rows: Cell[][]
}

function routineLabel(w: WorkoutSession, c: ExportContext): string {
  if (!w.routineId) return ''
  const r = c.routines?.find((x) => x.id === w.routineId)
  const d = r?.days.find((x) => x.id === w.routineDayId)
  return r ? `${r.name}${d ? ` · ${d.name}` : ''}` : ''
}

export function sessionsTable(workouts: WorkoutSession[], c: ExportContext): Table {
  const u = unitOf(c)
  return {
    name: 'Sesiones',
    headers: ['Fecha', 'Sesión', 'Disciplina', 'Rutina', 'Duración (min)', `Distancia (${distOf(c)})`, 'Ritmo', 'Calorías', 'Ejercicios', 'Series efectivas', 'Calentamientos', 'Drop sets', 'Al fallo', `Volumen (${u})`, `Mayor peso (${u})`, 'Notas'],
    rows: workouts.map((w) => {
      const s = summarizeSession(w)
      return [
        toLocalDateKey(w.date),
        w.title,
        w.type,
        routineLabel(w, c),
        w.durationMinutes ?? '',
        dispDist(w.distanceKm, c),
        w.pace ?? '',
        w.calories ?? '',
        s.exercises,
        s.effectiveSets,
        s.warmupSets,
        s.dropSets,
        s.failureSets,
        Math.round(kgToDisplay(s.volumeKg, c.imperial)),
        kgToDisplay(s.topWeightKg, c.imperial) || '',
        w.notes ?? '',
      ]
    }),
  }
}

/** Una fila por serie (y una más por cada caída), con el ítem al que pertenece. */
export function setsTable(workouts: WorkoutSession[], c: ExportContext): Table {
  const u = unitOf(c)
  const rows: Cell[][] = []
  for (const w of workouts) {
    const blocks = buildBlocks(w.exercises)
    blocks.forEach((block, bi) => {
      const indices = block.kind === 'group' ? block.indices : [block.index]
      const kind = block.kind === 'group' ? GROUP_LABELS[block.groupKind] : 'Simple'
      const members = indices.map((i) => w.exercises[i])
      const rest = block.kind === 'group' ? groupRest(members) : members[0].restSeconds
      for (const ex of members) {
        const measure = measureOf(ex)
        ex.sets.forEach((s, si) => {
          const base = [toLocalDateKey(w.date), w.title, bi + 1, kind, ex.name + (ex.perSide ? ' (c/lado)' : ''), si + 1]
          const vol = setVolumeKg(s, measure)
          rows.push([
            ...base,
            isWarmup(s) ? 'Calentamiento' : 'Efectiva',
            measure === 'time' ? '' : s.reps || 0,
            measure === 'time' ? s.seconds || 0 : '',
            s.weight ? kgToDisplay(s.weight, c.imperial) : '',
            s.rpe ?? '',
            isFailure(s) ? 'Sí' : '',
            '',
            rest ?? '',
            Math.round(kgToDisplay(vol, c.imperial) * 10) / 10 || '',
            s.notes ?? '',
          ])
          dropsOf(s).forEach((d, di) => {
            rows.push([
              ...base,
              'Caída',
              d.reps || '',
              '',
              d.weight ? kgToDisplay(d.weight, c.imperial) : '',
              '',
              '',
              `Caída ${di + 1}`,
              '',
              '',
              '',
            ])
          })
        })
      }
    })
  }
  return {
    name: 'Series',
    headers: ['Fecha', 'Sesión', 'Ítem nº', 'Tipo de ítem', 'Ejercicio', 'Serie nº', 'Tipo de serie', 'Repeticiones', 'Tiempo (seg)', `Peso (${u})`, 'RPE', 'Al fallo', 'Detalle', 'Descanso (seg)', `Volumen (${u})`, 'Notas'],
    rows,
  }
}

export function exercisesTable(workouts: WorkoutSession[], c: ExportContext): Table {
  const u = unitOf(c)
  const recs = exerciseRecords(workouts)
  return {
    name: 'Ejercicios',
    headers: ['Ejercicio', 'Veces', 'Última vez', `Mayor peso (${u})`, 'Reps con ese peso', 'Fecha del mejor peso', `1RM estimada (${u})`, 'Mejor tiempo', `Mayor volumen en una sesión (${u})`],
    rows: recs.map((r) => [
      r.name,
      r.sessions,
      toLocalDateKey(r.lastDate),
      r.maxWeightKg ? kgToDisplay(r.maxWeightKg, c.imperial) : '',
      r.maxWeightKg ? r.maxWeightReps : '',
      r.maxWeightKg ? toLocalDateKey(r.maxWeightDate) : '',
      r.bestE1rm ? kgToDisplay(r.bestE1rm, c.imperial) : '',
      r.bestSeconds ? formatSeconds(r.bestSeconds) : '',
      Math.round(kgToDisplay(r.maxSessionVolumeKg, c.imperial)),
    ]),
  }
}

export interface PeriodSummary {
  sessions: number
  minutes: number
  volumeKg: number
  effectiveSets: number
  warmupSets: number
  dropSets: number
  distanceKm: number
  /** Sesiones por semana en el período (según los días reales que abarca). */
  perWeek: number
  byType: Record<string, number>
  topExercises: { name: string; sessions: number }[]
}

export function summarizePeriod(workouts: WorkoutSession[], period: ResolvedPeriod): PeriodSummary {
  const sum: PeriodSummary = { sessions: workouts.length, minutes: 0, volumeKg: 0, effectiveSets: 0, warmupSets: 0, dropSets: 0, distanceKm: 0, perWeek: 0, byType: {}, topExercises: [] }
  for (const w of workouts) {
    const s = summarizeSession(w)
    sum.minutes += w.durationMinutes || 0
    sum.volumeKg += s.volumeKg
    sum.effectiveSets += s.effectiveSets
    sum.warmupSets += s.warmupSets
    sum.dropSets += s.dropSets
    sum.distanceKm += w.distanceKm || 0
    sum.byType[w.type] = (sum.byType[w.type] ?? 0) + 1
  }
  sum.volumeKg = Math.round(sum.volumeKg)
  sum.distanceKm = Number(sum.distanceKm.toFixed(2))
  const first = period.from ?? (workouts[0] ? toLocalDateKey(workouts[0].date) : null)
  const last = period.to ?? (workouts.length ? toLocalDateKey(workouts[workouts.length - 1].date) : null)
  if (first && last && workouts.length) {
    const days = Math.max(1, Math.round((new Date(last).getTime() - new Date(first).getTime()) / 86_400_000) + 1)
    sum.perWeek = Number(((workouts.length / days) * 7).toFixed(1))
  }
  sum.topExercises = exerciseRecords(workouts)
    .slice(0, 8)
    .map((r) => ({ name: r.name, sessions: r.sessions }))
  return sum
}

export function summaryTable(workouts: WorkoutSession[], period: ResolvedPeriod, c: ExportContext, userName: string): Table {
  const s = summarizePeriod(workouts, period)
  const u = unitOf(c)
  const rows: Cell[][] = [
    ['Persona', userName],
    ['Período', period.label],
    ['Sesiones', s.sessions],
    ['Sesiones por semana', s.perWeek],
    ['Tiempo entrenado (horas)', Number((s.minutes / 60).toFixed(1))],
    [`Volumen total (${u})`, Math.round(kgToDisplay(s.volumeKg, c.imperial))],
    ['Series efectivas', s.effectiveSets],
    ['Series de calentamiento', s.warmupSets],
    ['Series con drop set', s.dropSets],
    [`Distancia (${distOf(c)})`, c.imperial ? Number((s.distanceKm / 1.60934).toFixed(2)) : s.distanceKm],
  ]
  for (const [type, n] of Object.entries(s.byType)) rows.push([`Sesiones de ${type}`, n])
  return { name: 'Resumen', headers: ['Dato', 'Valor'], rows }
}

export function buildTables(workouts: WorkoutSession[], period: ResolvedPeriod, c: ExportContext, userName: string): Table[] {
  return [summaryTable(workouts, period, c, userName), sessionsTable(workouts, c), setsTable(workouts, c), exercisesTable(workouts, c)]
}

/* ---------- Escritores de archivos ---------- */

const csvCell = (v: Cell) => {
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV con ';' y BOM: así Excel en español lo abre con las columnas bien separadas y las tildes. */
export function tableToCsv(t: Table): string {
  return '﻿' + [t.headers, ...t.rows].map((r) => r.map(csvCell).join(';')).join('\r\n')
}

export function workoutsToJson(workouts: WorkoutSession[], period: ResolvedPeriod, c: ExportContext, userName: string): string {
  return JSON.stringify(
    {
      app: 'LifeKeeper',
      tipo: 'entrenamientos',
      exportadoEl: new Date().toISOString(),
      persona: userName,
      periodo: period.label,
      desde: period.from,
      hasta: period.to,
      unidades: { peso: 'kg (como se guarda; los valores no se convierten)', distancia: 'km' },
      resumen: summarizePeriod(workouts, period),
      rutinas: c.routines?.filter((r) => workouts.some((w) => w.routineId === r.id)).map((r) => ({ id: r.id, nombre: r.name })) ?? [],
      sesiones: workouts,
    },
    null,
    2,
  )
}

export async function tablesToXlsx(tables: Table[]): Promise<Blob> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'LifeKeeper'
  wb.created = new Date()
  for (const t of tables) {
    const ws = wb.addWorksheet(t.name, { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.addRow(t.headers)
    t.rows.forEach((r) => ws.addRow(r))
    const head = ws.getRow(1)
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
    ws.columns.forEach((col, i) => {
      const longest = Math.max(t.headers[i]?.length ?? 8, ...t.rows.slice(0, 200).map((r) => String(r[i] ?? '').length))
      col.width = Math.min(46, Math.max(10, longest + 2))
    })
    if (t.name !== 'Resumen') ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.headers.length } }
  }
  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
