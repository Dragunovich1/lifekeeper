import type { jsPDF } from 'jspdf'
import type { HealthMeasurement } from '../types'
import { savePdf } from './saveFile'
import {
  MEASUREMENT_TYPES,
  classifyMeasurement,
  formatMeasurement,
  measurementTimestamp,
  statsFor,
} from './measurements'

interface Options {
  measurements: HealthMeasurement[]
  userName?: string
  days?: number
  now?: Date
}

/** Informe en PDF de mediciones de salud para llevar al médico. Devuelve el PDF sin guardarlo. */
export async function buildMeasurementsPdf({ measurements, userName = 'Paciente', days = 30, now = new Date() }: Options): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 15
  const bottom = 282
  let y = 18
  const since = now.getTime() - days * 86_400_000
  const ensure = (h: number) => {
    if (y + h > bottom) {
      doc.addPage()
      y = 18
    }
  }

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(15, 23, 42)
  doc.text('Informe de mediciones de salud', margin, y)
  y += 7
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(71, 85, 105)
  doc.text(`Paciente: ${userName}  |  Últimos ${days} días  |  Emitido: ${now.toLocaleDateString('es-AR')}`, margin, y)
  y += 8

  let any = false
  for (const meta of MEASUREMENT_TYPES) {
    const items = measurements
      .filter((m) => m.type === meta.type && measurementTimestamp(m) >= since)
      .sort((a, b) => measurementTimestamp(a) - measurementTimestamp(b))
    const stats = statsFor(items)
    if (!stats) continue
    any = true
    ensure(26)
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(30, 58, 138)
    doc.text(`${meta.label} (${meta.unit})`, margin, y)
    y += 5
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(51, 65, 85)
    const avg = meta.type === 'presion' ? `${Math.round(stats.avg)}/${Math.round(stats.avg2 ?? 0)}` : stats.avg.toFixed(meta.type === 'temperatura' ? 1 : 0)
    doc.text(`${stats.count} registros · promedio ${avg} · mín ${stats.min} · máx ${stats.max}`, margin, y)
    y += 5
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(100, 116, 139)
    doc.text('Fecha', margin, y)
    doc.text('Valor', margin + 30, y)
    doc.text('Estado', margin + 52, y)
    doc.text('Momento / cómo se sentía', margin + 80, y)
    y += 4
    doc.setFont('helvetica', 'normal').setTextColor(30, 41, 59)
    for (const m of items) {
      ensure(5)
      const status = classifyMeasurement(m)
      const detail = [m.context, m.feeling ? `se sentía ${m.feeling.toLowerCase()}` : '', m.symptoms?.filter((s) => s !== 'Sin síntomas').join(', ')]
        .filter(Boolean)
        .join(' · ')
      doc.text(`${m.date.split('-').reverse().join('/')} ${m.time}`, margin, y)
      doc.text(formatMeasurement(m), margin + 30, y)
      doc.text(status.label, margin + 52, y)
      doc.text(doc.splitTextToSize(detail || '-', 100)[0], margin + 80, y)
      y += 4.5
    }
    y += 4
  }
  if (!any) doc.text('Sin mediciones en el período.', margin, y)

  doc.setFontSize(7.5).setTextColor(100, 116, 139)
  doc.text('Valores cargados por el paciente; los estados son orientativos y no reemplazan una evaluación médica.', margin, 290)
  return doc
}

export const downloadMeasurementsPdf = async (opts: Options, fileName: string) => savePdf(await buildMeasurementsPdf(opts), fileName)
