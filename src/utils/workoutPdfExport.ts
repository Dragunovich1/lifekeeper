import type { WorkoutRoutine, WorkoutSession } from '../types'
import { savePdf } from './saveFile'
import { formatDate } from './dates'
import { GROUP_LABELS, buildBlocks, groupRest, roundCount } from './workoutGroups'
import { describeSet, exerciseRecords, formatSeconds, kgToDisplay, measureOf, summarizeSession } from './workoutSets'
import { summarizePeriod, type ResolvedPeriod } from './workoutExport'

export interface WorkoutPdfExportOptions {
  workouts: WorkoutSession[]
  userName?: string
  /** Texto del período (ej. "septiembre 2026"). Se ignora si se pasa `period`. */
  filterPeriodLabel?: string
  period?: ResolvedPeriod
  unitSystem?: 'metric' | 'imperial'
  routines?: WorkoutRoutine[]
  /** Cuadro de resumen del período (por defecto sí). */
  includeSummary?: boolean
  /** Tabla de récords por ejercicio al final (por defecto sí). */
  includeProgress?: boolean
  /** Detalle de series de cada sesión (por defecto sí). Sin esto queda solo el resumen por sesión. */
  includeSets?: boolean
  fileName?: string
}

const restText = (s: number) => (s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`)

export async function exportWorkoutsToPDF({
  workouts,
  userName = 'Usuario',
  filterPeriodLabel = 'Historial completo',
  period,
  unitSystem = 'metric',
  routines = [],
  includeSummary = true,
  includeProgress = true,
  includeSets = true,
  fileName,
}: WorkoutPdfExportOptions): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  const contentWidth = pageWidth - margin * 2

  const imperial = unitSystem === 'imperial'
  const weightUnit = imperial ? 'lb' : 'kg'
  const distUnit = imperial ? 'mi' : 'km'
  const toDisp = (kg: number) => kgToDisplay(kg, imperial)
  const label = period?.label ?? filterPeriodLabel
  const ordered = [...workouts].sort((a, b) => a.date.localeCompare(b.date))

  let y = 18

  const drawHeader = () => {
    doc.setFillColor(30, 58, 138)
    doc.rect(margin, y - 5, contentWidth, 2, 'F')
  }
  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage()
      y = 20
      drawHeader()
    }
  }
  const text = (t: string, x: number, opts: { size?: number; bold?: boolean; italic?: boolean; color?: [number, number, number]; maxWidth?: number } = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal')
    doc.setFontSize(opts.size ?? 8.5)
    const c = opts.color ?? [51, 65, 85]
    doc.setTextColor(c[0], c[1], c[2])
    const lines = opts.maxWidth ? (doc.splitTextToSize(t, opts.maxWidth) as string[]) : [t]
    lines.forEach((ln, i) => {
      if (i > 0) checkPageBreak(4.2)
      doc.text(ln, x, y)
      if (i < lines.length - 1) y += 4
    })
  }

  drawHeader()

  // 1. Título
  text('LIFEKEEPER', margin, { size: 18, bold: true, color: [15, 23, 42] })
  text('INFORME DE ENTRENAMIENTO', margin + 45, { size: 12, color: [100, 116, 139] })
  y += 7
  text(`Atleta: ${userName}   ·   Período: ${label}   ·   Generado: ${formatDate(new Date().toISOString())}`, margin, { size: 9, color: [71, 85, 105] })
  y += 8

  // 2. Resumen del período
  if (includeSummary && ordered.length > 0) {
    const s = summarizePeriod(ordered, period ?? { from: null, to: null, label })
    const cards: [string, string][] = [
      ['Sesiones', String(s.sessions)],
      ['Por semana', String(s.perWeek)],
      ['Tiempo', `${(s.minutes / 60).toFixed(1)} h`],
      ['Volumen', `${Math.round(toDisp(s.volumeKg)).toLocaleString('es-AR')} ${weightUnit}`],
      ['Series efectivas', String(s.effectiveSets)],
      ...(s.distanceKm > 0 ? [['Distancia', `${(imperial ? s.distanceKm / 1.60934 : s.distanceKm).toFixed(1)} ${distUnit}`] as [string, string]] : []),
    ]
    const cw = contentWidth / cards.length
    checkPageBreak(20)
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(margin, y - 4, contentWidth, 16, 2, 2, 'F')
    cards.forEach(([k, v], i) => {
      const x = margin + i * cw + 4
      const save = y
      text(v, x, { size: 11, bold: true, color: [15, 23, 42] })
      y += 5
      text(k, x, { size: 7.5, color: [100, 116, 139] })
      y = save
    })
    y += 16
    if (s.dropSets > 0 || s.warmupSets > 0) {
      text(`Incluye ${s.dropSets} serie(s) con drop set. Los ${s.warmupSets} calentamiento(s) no suman al volumen ni a las series efectivas.`, margin, { size: 7.5, italic: true, color: [100, 116, 139] })
      y += 5
    }
    y += 2
  }

  // 3. Sesiones
  if (ordered.length === 0) {
    text('No hay entrenamientos en este período.', margin, { size: 10, color: [148, 163, 184] })
    y += 8
  }

  ordered.forEach((w) => {
    checkPageBreak(24)
    const sum = summarizeSession(w)
    const routine = w.routineId ? routines.find((r) => r.id === w.routineId) : undefined
    const day = routine?.days.find((d) => d.id === w.routineDayId)

    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(margin, y - 4.5, contentWidth, 11, 1.5, 1.5, 'FD')
    text(w.title, margin + 3, { size: 10.5, bold: true, color: [15, 23, 42], maxWidth: contentWidth - 60 })
    text(`${formatDate(w.date)}  ·  ${w.type}`, pageWidth - margin - 3 - doc.getTextWidth(`${formatDate(w.date)}  ·  ${w.type}`), { size: 8.5, color: [71, 85, 105] })
    y += 6.5

    const meta: string[] = []
    if (routine) meta.push(`Rutina: ${routine.name}${day ? ` · ${day.name}` : ''}`)
    if (w.durationMinutes) meta.push(`${w.durationMinutes} min`)
    if (w.distanceKm) meta.push(`${(imperial ? w.distanceKm / 1.60934 : w.distanceKm).toFixed(2)} ${distUnit}`)
    if (w.pace) meta.push(w.pace)
    if (w.calories) meta.push(`${w.calories} kcal`)
    if (sum.volumeKg > 0) meta.push(`Volumen ${Math.round(toDisp(sum.volumeKg)).toLocaleString('es-AR')} ${weightUnit}`)
    if (sum.effectiveSets > 0) meta.push(`${sum.effectiveSets} series`)
    if (meta.length) {
      text(meta.join('   ·   '), margin + 3, { size: 8, color: [71, 85, 105], maxWidth: contentWidth - 6 })
      y += 4.5
    }
    if (w.notes) {
      text(`“${w.notes}”`, margin + 3, { size: 8, italic: true, color: [100, 116, 139], maxWidth: contentWidth - 6 })
      y += 4.5
    }

    if (includeSets && w.exercises.length > 0) {
      buildBlocks(w.exercises).forEach((block) => {
        if (block.kind === 'group') {
          const members = block.indices.map((i) => w.exercises[i])
          const rounds = roundCount(members)
          const rest = groupRest(members)
          checkPageBreak(10)
          text(`• [${GROUP_LABELS[block.groupKind]}] ${members.map((m) => m.name).join(' + ')}${rest ? `   ·   Desc. ${restText(rest)}` : ''}`, margin + 3, { size: 8.5, bold: true, color: [15, 23, 42], maxWidth: contentWidth - 6 })
          y += 4
          members.forEach((m) => {
            if (!m.notes) return
            text(`    ${m.name}: ${m.notes}`, margin + 5, { size: 7.5, italic: true, color: [100, 116, 139], maxWidth: contentWidth - 10 })
            y += 3.8
          })
          for (let r = 0; r < rounds; r++) {
            checkPageBreak(5)
            const parts = members.map((m) => (m.sets[r] ? `${m.name.split(' ')[0]} ${describeSet(m.sets[r], m, weightUnit, toDisp)}` : '–'))
            text(`    Ronda ${r + 1}:  ${parts.join('   +   ')}`, margin + 5, { size: 8, maxWidth: contentWidth - 10 })
            y += 4
          }
          y += 1
          return
        }
        const ex = w.exercises[block.index]
        checkPageBreak(10)
        const tags = [ex.perSide ? 'por lado' : '', measureOf(ex) === 'time' ? 'tiempo' : '', ex.restSeconds ? `desc. ${restText(ex.restSeconds)}` : ''].filter(Boolean)
        text(`• ${ex.name}${tags.length ? `  (${tags.join(' · ')})` : ''}`, margin + 3, { size: 8.5, bold: true, color: [15, 23, 42], maxWidth: contentWidth - 6 })
        y += 4
        if (ex.notes) {
          text(`    ${ex.notes}`, margin + 5, { size: 7.5, italic: true, color: [100, 116, 139], maxWidth: contentWidth - 10 })
          y += 3.8
        }
        ex.sets.forEach((set, si) => {
          checkPageBreak(5)
          text(`    Serie ${si + 1}:  ${describeSet(set, ex, weightUnit, toDisp)}${set.rpe ? `   (RPE ${set.rpe})` : ''}${set.notes ? `   — “${set.notes}”` : ''}`, margin + 5, { size: 8, maxWidth: contentWidth - 10 })
          y += 4
        })
        y += 1
      })
    }
    y += 4
  })

  // 4. Récords por ejercicio
  const records = includeProgress ? exerciseRecords(ordered).slice(0, 18) : []
  if (records.length > 0) {
    checkPageBreak(30)
    text('PROGRESO POR EJERCICIO', margin, { size: 11, bold: true, color: [15, 23, 42] })
    y += 6
    const cols = [margin, margin + 70, margin + 90, margin + 125, margin + 152]
    ;['Ejercicio', 'Veces', `Mejor peso (${weightUnit})`, `1RM est. (${weightUnit})`, 'Última vez'].forEach((h, i) => text(h, cols[i], { size: 8, bold: true, color: [100, 116, 139] }))
    y += 5
    records.forEach((r) => {
      checkPageBreak(6)
      text(r.name, cols[0], { size: 8.5, maxWidth: 66 })
      text(String(r.sessions), cols[1], { size: 8.5 })
      text(r.measure === 'time' ? (r.bestSeconds ? formatSeconds(r.bestSeconds) : '–') : r.maxWeightKg ? `${toDisp(r.maxWeightKg)} × ${r.maxWeightReps}` : 'p. corporal', cols[2], { size: 8.5 })
      text(r.bestE1rm ? String(toDisp(r.bestE1rm)) : '–', cols[3], { size: 8.5 })
      text(formatDate(r.lastDate), cols[4], { size: 8.5 })
      y += 4.6
    })
  }

  // 5. Pie de página
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text(`LifeKeeper · Registro personal cifrado Zero-Knowledge · Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
  }

  await savePdf(doc, fileName ?? `LifeKeeper-Entrenamientos-${new Date().toISOString().slice(0, 10)}.pdf`)
}
