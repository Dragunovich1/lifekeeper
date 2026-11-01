import type { AppData } from '../types'
import { MEASUREMENT_META, formatMeasurement, measurementTimestamp } from './measurements'

const fmtDate = (d?: string) => (d ? d.split('T')[0].split('-').reverse().join('/') : '')

export const mapMeasurements = (data: AppData) =>
  [...(data.health.measurements ?? [])]
    .sort((a, b) => measurementTimestamp(a) - measurementTimestamp(b))
    .map((m) => ({
      fecha: fmtDate(m.date),
      hora: m.time,
      tipo: MEASUREMENT_META[m.type]?.label ?? m.type,
      valor: formatMeasurement(m),
      unidad: MEASUREMENT_META[m.type]?.unit ?? '',
      pulso: m.pulse ?? '',
      momento: m.context ?? '',
      comoMeSentia: m.feeling ?? '',
      sintomas: (m.symptoms ?? []).join(', '),
      notas: m.notes ?? '',
    }))

export const mapShopping = (data: AppData) =>
  (data.personal.shopping?.lists ?? []).flatMap((list) =>
    list.items.map((item) => ({
      lista: list.name,
      producto: item.name,
      cantidad: item.quantity,
      unidad: item.unit ?? '',
      precioUnitario: item.price ?? '',
      categoria: item.category,
      comprado: item.checked ? 'Sí' : 'No',
      moneda: list.currency,
    })),
  )

export const mapQuickNotes = (data: AppData) =>
  (data.utilities.quickNotes ?? []).map((n) => ({
    nota: n.text,
    fijada: n.pinned ? 'Sí' : 'No',
    creada: fmtDate(n.createdAt),
    modificada: fmtDate(n.updatedAt),
  }))

export const mapFinanceCategories = (data: AppData) =>
  (data.personal.financeCategories ?? []).map((c) => ({
    nombre: c.name,
    tipo: c.kind === 'income' ? 'Ingreso' : 'Gasto',
  }))
