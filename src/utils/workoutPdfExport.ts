import { jsPDF } from 'jspdf'
import type { WorkoutSession } from '../types'
import { formatDate } from './dates'

interface WorkoutPdfExportOptions {
  workouts: WorkoutSession[]
  userName?: string
  filterPeriodLabel?: string
  unitSystem?: 'metric' | 'imperial'
}

export function exportWorkoutsToPDF({
  workouts,
  userName = 'Usuario',
  filterPeriodLabel = 'Historial Completo',
  unitSystem = 'metric',
}: WorkoutPdfExportOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  const contentWidth = pageWidth - margin * 2

  const weightUnit = unitSystem === 'imperial' ? 'lb' : 'kg'
  const distUnit = unitSystem === 'imperial' ? 'mi' : 'km'

  let y = 18

  // Helper para nueva página
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage()
      y = 20
      drawHeader()
    }
  }

  // Encabezado decorativo superior
  const drawHeader = () => {
    doc.setFillColor(30, 58, 138) // Navy blue
    doc.rect(margin, y - 5, contentWidth, 2, 'F')
  }

  drawHeader()

  // 1. TÍTULO Y METADATOS
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(15, 23, 42) // Slate 900
  doc.text('LIFEKEEPER', margin, y)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139) // Slate 500
  doc.text('INFORME TÉCNICO DE ENTRENAMIENTO', margin + 45, y)

  y += 7
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  const nowStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  doc.text(`Atleta: ${userName}  |  Período: ${filterPeriodLabel}  |  Fecha de emisión: ${nowStr}`, margin, y)

  y += 6

  // 2. MÉTRICAS CONSOLIDADAS
  const totalSessions = workouts.length
  let totalMinutes = 0
  let totalDistanceKm = 0
  let totalVolumeKg = 0
  let totalSets = 0

  workouts.forEach((w) => {
    totalMinutes += w.durationMinutes || 0
    totalDistanceKm += w.distanceKm || 0
    w.exercises.forEach((ex) => {
      ex.sets.forEach((s) => {
        totalSets += 1
        totalVolumeKg += (s.weight || 0) * (s.reps || 0)
      })
    })
  })

  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const timeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  doc.setFillColor(248, 250, 252) // Slate 50
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD')

  const colW = contentWidth / 4
  const metricY = y + 7

  // Columna 1
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('SESIONES REGISTRADAS', margin + 4, metricY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text(String(totalSessions), margin + 4, metricY + 6)

  // Columna 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('TIEMPO TOTAL', margin + colW + 4, metricY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text(timeFormatted, margin + colW + 4, metricY + 6)

  // Columna 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`DISTANCIA (${distUnit.toUpperCase()})`, margin + colW * 2 + 4, metricY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text(`${totalDistanceKm.toFixed(1)} ${distUnit}`, margin + colW * 2 + 4, metricY + 6)

  // Columna 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`VOLUMEN CARGA (${weightUnit.toUpperCase()})`, margin + colW * 3 + 4, metricY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text(
    totalVolumeKg > 0 ? `${Math.round(totalVolumeKg).toLocaleString('es-AR')} ${weightUnit}` : '—',
    margin + colW * 3 + 4,
    metricY + 6,
  )

  y += 24

  // 3. DETALLE DE SESIONES
  if (workouts.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text('No hay entrenamientos registrados para el período seleccionado.', margin, y + 10)
  } else {
    // Ordenar de más reciente a más antiguo
    const sortedWorkouts = [...workouts].sort((a, b) => b.date.localeCompare(a.date))

    sortedWorkouts.forEach((w) => {
      // Calcular altura requerida para la sesión
      let estimatedH = 14
      if (w.notes) estimatedH += 6
      w.exercises.forEach((ex) => {
        estimatedH += 6 + ex.sets.length * 4.5
      })

      checkPageBreak(Math.min(estimatedH, 60))

      // Barra de título de la sesión
      doc.setFillColor(241, 245, 249) // Slate 100
      doc.setDrawColor(203, 213, 225) // Slate 300
      doc.rect(margin, y, contentWidth, 7, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(30, 41, 59) // Slate 800
      doc.text(`${formatDate(w.date)} — ${w.title}`, margin + 3, y + 4.8)

      // Detalles a la derecha: Tipo, Duración, Distancia
      const typeStr = w.type.toUpperCase()
      const durStr = w.durationMinutes ? `${w.durationMinutes} min` : ''
      const distStr = w.distanceKm ? `${w.distanceKm} ${distUnit}` : ''
      const paceStr = w.pace ? `(${w.pace})` : ''
      const rightMeta = [typeStr, durStr, distStr, paceStr].filter(Boolean).join(' · ')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(rightMeta, margin + contentWidth - 3, y + 4.8, { align: 'right' })

      y += 9

      // Notas generales de la sesión si existen
      if (w.notes) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text(`Observaciones generales: "${w.notes}"`, margin + 3, y)
        y += 4.5
      }

      // Ejercicios y series
      if (w.exercises.length === 0) {
        if (!w.distanceKm) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(148, 163, 184)
          doc.text('Sin desglose de ejercicios cargado.', margin + 4, y)
          y += 4
        }
      } else {
        w.exercises.forEach((ex) => {
          checkPageBreak(12)

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8.5)
          doc.setTextColor(15, 23, 42)
          doc.text(`• ${ex.name}`, margin + 4, y)
          y += 4

          ex.sets.forEach((set, sIdx) => {
            checkPageBreak(6)

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8)
            doc.setTextColor(51, 65, 85)

            let badgeText = ''
            if (set.setType && set.setType !== 'normal') {
              badgeText =
                set.setType === 'dropset'
                  ? '[Drop Set]'
                  : set.setType === 'biserie'
                  ? '[Biserie]'
                  : set.setType === 'warmup'
                  ? '[Calentamiento]'
                  : set.setType === 'failure'
                  ? '[Al Fallo]'
                  : `[${set.setType}]`
            }

            const weightText = set.weight ? `${set.weight} ${weightUnit}` : 'Peso corporal'
            const repsText = `${set.reps} reps`
            const rpeText = set.rpe ? `(RPE ${set.rpe})` : ''
            const noteText = set.notes ? `— "${set.notes}"` : ''

            const setLine = `    Serie ${sIdx + 1}: ${weightText} × ${repsText} ${badgeText} ${rpeText} ${noteText}`.trim()
            doc.text(setLine, margin + 6, y)
            y += 4
          })
          y += 1
        })
      }

      y += 4 // Espacio entre sesiones
    })
  }

  // 4. PIE DE PÁGINA EN TODAS LAS HOJAS
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184) // Slate 400
    doc.text(
      `LifeKeeper · Registro personal cifrado Zero-Knowledge · Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    )
  }

  // Descarga del archivo
  const dateStr = new Date().toISOString().slice(0, 10)
  doc.save(`LifeKeeper-Entrenamientos-${dateStr}.pdf`)
}
