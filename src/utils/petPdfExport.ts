import type { Pet } from '../types'
import { formatCurrency, formatDate } from './dates'
import { activeMedications, expenseInfo, expenseTotals, kindInfo, petAge, sortedWeights, speciesInfo } from './pets'
import { savePdf } from './saveFile'

/** Ficha de la mascota en PDF (útil para llevar al veterinario, la guardería o un viaje): datos, vacunas y salud, peso, medicación y gastos. */
export async function exportPetPdf(pet: Pet, opts: { ownerName?: string; currency?: string } = {}): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const H = 297
  const M = 15
  const CW = W - M * 2
  const currency = opts.currency ?? 'ARS'
  let y = 18

  const bar = () => {
    doc.setFillColor(30, 58, 138)
    doc.rect(M, y - 5, CW, 2, 'F')
  }
  const need = (h: number) => {
    if (y + h > H - 18) {
      doc.addPage()
      y = 20
      bar()
    }
  }
  const text = (t: string, x: number, o: { size?: number; bold?: boolean; italic?: boolean; color?: [number, number, number]; width?: number } = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : o.italic ? 'italic' : 'normal')
    doc.setFontSize(o.size ?? 9)
    const c = o.color ?? [51, 65, 85]
    doc.setTextColor(c[0], c[1], c[2])
    const lines = o.width ? (doc.splitTextToSize(t, o.width) as string[]) : [t]
    lines.forEach((ln, i) => {
      if (i > 0) need(4.5)
      doc.text(ln, x, y)
      if (i < lines.length - 1) y += 4.2
    })
  }
  const section = (title: string) => {
    need(14)
    y += 3
    text(title.toUpperCase(), M, { size: 10.5, bold: true, color: [15, 23, 42] })
    y += 1.5
    doc.setDrawColor(226, 232, 240)
    doc.line(M, y, W - M, y)
    y += 5
  }
  const line = (label: string, value?: string | number | null) => {
    if (!value && value !== 0) return
    need(5)
    text(label, M, { size: 8.5, color: [100, 116, 139] })
    text(String(value), M + 42, { size: 9, bold: true, width: CW - 42 })
    y += 5
  }

  bar()
  text('LIFEKEEPER', M, { size: 16, bold: true, color: [15, 23, 42] })
  text('FICHA DE MASCOTA', M + 40, { size: 11, color: [100, 116, 139] })
  y += 10

  // Foto + nombre
  const sp = speciesInfo(pet.species)
  let textX = M
  if (pet.photo) {
    try {
      doc.addImage(pet.photo, 'JPEG', M, y - 4, 32, 32)
      textX = M + 38
    } catch {
      /* foto ilegible: se omite */
    }
  }
  const nameY = y + 4
  y = nameY
  text(pet.name, textX, { size: 20, bold: true, color: [15, 23, 42] })
  y += 7
  text([pet.speciesDetail || sp.label, pet.breed, pet.sex && pet.sex !== 'desconocido' ? (pet.sex === 'macho' ? 'Macho' : 'Hembra') : '', pet.neutered ? 'Castrado/a' : ''].filter(Boolean).join(' · '), textX, { size: 10, color: [71, 85, 105], width: CW - (textX - M) })
  y += 6
  const age = petAge(pet)
  if (age) {
    text(pet.deceasedDate ? `Vivió ${age}` : `Edad: ${age}`, textX, { size: 9.5, color: [71, 85, 105] })
    y += 5
  }
  if (opts.ownerName) {
    text(`Responsable: ${opts.ownerName}`, textX, { size: 9, color: [100, 116, 139] })
    y += 5
  }
  y = Math.max(y, nameY + 30) + 2

  section('Datos')
  line('Nacimiento', pet.birthDate ? formatDate(pet.birthDate) : '')
  line('Adopción', pet.adoptionDate ? formatDate(pet.adoptionDate) : '')
  line('Color / señas', pet.color)
  line('Microchip', pet.microchip)
  line('Registro', pet.registration)
  line('Carácter', pet.temperament)
  line('Alergias', pet.allergies)
  line('Condiciones', pet.conditions)
  if (pet.diet) {
    line('Alimentación', [pet.diet.food, pet.diet.brand, pet.diet.portion, pet.diet.mealsPerDay ? `${pet.diet.mealsPerDay} comidas/día` : ''].filter(Boolean).join(' · '))
  }
  if (pet.vet) {
    section('Veterinario')
    line('Profesional', pet.vet.name)
    line('Clínica', pet.vet.clinic)
    line('Teléfono', pet.vet.phone)
    line('Dirección', pet.vet.address)
  }
  if (pet.insurance) {
    section('Seguro o plan')
    line('Compañía', pet.insurance.company)
    line('Póliza', pet.insurance.policy)
    line('Teléfono', pet.insurance.phone)
    line('Vigencia', pet.insurance.validUntil ? formatDate(pet.insurance.validUntil) : '')
  }

  // Tabla de salud (vacunas primero)
  const health = [...pet.health].sort((a, b) => (a.kind === 'vacuna' ? 0 : 1) - (b.kind === 'vacuna' ? 0 : 1) || b.date.localeCompare(a.date))
  if (health.length > 0) {
    section('Vacunas y salud')
    const cols = [M, M + 28, M + 92, M + 122, M + 152]
    ;['Tipo', 'Nombre', 'Fecha', 'Próxima', 'Veterinario'].forEach((h, i) => text(h, cols[i], { size: 8, bold: true, color: [100, 116, 139] }))
    y += 5
    health.forEach((h) => {
      need(6)
      text(kindInfo(h.kind).label, cols[0], { size: 8.5, width: 26 })
      text(h.name, cols[1], { size: 8.5, bold: true, width: 60 })
      text(formatDate(h.date), cols[2], { size: 8.5 })
      text(h.nextDate ? formatDate(h.nextDate) : '–', cols[3], { size: 8.5 })
      text(h.vet ?? '', cols[4], { size: 8.5, width: 30 })
      y += 5
    })
  }

  const meds = activeMedications(pet)
  if (meds.length > 0) {
    section('Medicación en curso')
    meds.forEach((m) => {
      need(6)
      text(`• ${m.name}${m.dose ? ` — ${m.dose}` : ''}${m.frequency ? ` — ${m.frequency}` : ''}${m.endDate ? ` (hasta ${formatDate(m.endDate)})` : ''}`, M, { size: 9, width: CW })
      y += 5
    })
  }

  const weights = sortedWeights(pet.weights).slice(-12)
  if (weights.length > 0) {
    section('Peso (últimos registros)')
    text(weights.map((w) => `${formatDate(w.date)}: ${w.kg} kg`).join('   ·   '), M, { size: 8.5, width: CW })
    y += 6
  }

  const totals = expenseTotals(pet.expenses)
  if (pet.expenses.length > 0) {
    section('Gastos')
    line('Este año', formatCurrency(totals.thisYear, currency))
    line('Total histórico', formatCurrency(totals.all, currency))
    Object.entries(totals.byCategory).forEach(([c, v]) => line(expenseInfo(c as Parameters<typeof expenseInfo>[0]).label, formatCurrency(v ?? 0, currency)))
  }
  if (pet.notes) {
    section('Notas')
    text(pet.notes, M, { size: 9, width: CW })
    y += 5
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text(`LifeKeeper · Ficha de ${pet.name} · Página ${i} de ${pages}`, W / 2, H - 8, { align: 'center' })
  }
  await savePdf(doc, `LifeKeeper-Ficha-${pet.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.pdf`)
}
