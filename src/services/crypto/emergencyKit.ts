/**
 * Generador del Kit de Emergencia Oficial en PDF (A4 de Alta Seguridad).
 * Genera un documento formal imprimible con las 24 palabras mnemónicas de recuperación.
 */

import { jsPDF } from 'jspdf'
import { generateRecoveryKit } from './zeroKnowledge'

export interface EmergencyKitOptions {
  userEmail: string
  userName?: string
  existingPhrase?: string
}

export async function downloadEmergencyKitPdf(options: EmergencyKitOptions): Promise<string> {
  const kit = options.existingPhrase
    ? { phrase: options.existingPhrase, recoveryHash: 'VERIFIED' }
    : await generateRecoveryKit()

  const words = kit.phrase.split(' ')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40

  let cursorY = 45

  // 1. Encabezado institucional
  doc.setFontSize(8)
  doc.setTextColor(140, 150, 165)
  doc.setFont('helvetica', 'bold')
  doc.text('LIFEKEEPER VAULT — DOCUMENTO CONFIDENCIAL DE SEGURIDAD', margin, cursorY)
  doc.text('MODELO ZERO-KNOWLEDGE E2EE', pageWidth - margin, cursorY, { align: 'right' })
  cursorY += 12

  doc.setDrawColor(200, 215, 230)
  doc.setLineWidth(1)
  doc.line(margin, cursorY, pageWidth - margin, cursorY)
  cursorY += 25

  // 2. Título principal
  doc.setFontSize(22)
  doc.setTextColor(15, 35, 75)
  doc.setFont('helvetica', 'bold')
  doc.text('Kit de Emergencia y Rescate de Bóveda', margin, cursorY)
  cursorY += 18

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(
    'Este documento contiene la llave maestra de recuperación de 24 palabras para tu cuenta.',
    margin,
    cursorY,
  )
  cursorY += 24

  // 3. Ficha del titular
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 60, 6, 6, 'F')

  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold')
  doc.text('Titular de la cuenta:', margin + 16, cursorY + 22)
  doc.setFont('helvetica', 'normal')
  doc.text(options.userName || 'No especificado', margin + 130, cursorY + 22)

  doc.setFont('helvetica', 'bold')
  doc.text('Correo electrónico:', margin + 16, cursorY + 42)
  doc.setFont('helvetica', 'normal')
  doc.text(options.userEmail || 'Sin correo asociado', margin + 130, cursorY + 42)

  cursorY += 80

  // 4. Advertencia de seguridad
  doc.setFillColor(254, 242, 242)
  doc.setDrawColor(254, 202, 202)
  doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 45, 6, 6, 'FD')

  doc.setFontSize(9)
  doc.setTextColor(185, 28, 28)
  doc.setFont('helvetica', 'bold')
  doc.text('IMPORTANTE: GUARDE ESTE DOCUMENTO EN UN LUGAR SEGURO O IMPRÍMALO', margin + 16, cursorY + 18)
  doc.setFont('helvetica', 'normal')
  doc.text(
    'Nadie en el soporte de LifeKeeper conoce tu contraseña maestra. Si la olvidás, estas 24 palabras son el ÚNICO método para recuperar tu información.',
    margin + 16,
    cursorY + 32,
    { maxWidth: pageWidth - margin * 2 - 32 },
  )
  cursorY += 65

  // 5. Grilla de las 24 palabras
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('Tus 24 palabras de rescate (Recovery Phrase):', margin, cursorY)
  cursorY += 15

  const cols = 3
  const colWidth = (pageWidth - margin * 2 - (cols - 1) * 12) / cols
  const rowHeight = 28

  for (let i = 0; i < 24; i += 1) {
    const colIndex = i % cols
    const rowIndex = Math.floor(i / cols)
    const x = margin + colIndex * (colWidth + 12)
    const y = cursorY + rowIndex * (rowHeight + 8)

    // Caja para la palabra
    doc.setFillColor(241, 245, 249)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(x, y, colWidth, rowHeight, 4, 4, 'FD')

    // Número
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(148, 163, 184)
    doc.text(String(i + 1).padStart(2, '0'), x + 8, y + 18)

    // Palabra
    doc.setFontSize(11)
    doc.setFont('courier', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(words[i] || '—', x + 30, y + 18)
  }

  cursorY += 8 * (rowHeight + 8) + 20

  // 6. Recomendaciones de custodia física
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Instrucciones de almacenamiento seguro:', margin, cursorY)
  cursorY += 16

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  const tips = [
    '• Imprimí este documento y guardalo en una caja fuerte o carpeta bajo llave.',
    '• NO le saques fotos con tu celular ni lo envíes por WhatsApp o correo sin cifrar.',
    '• Si considerás que tu frase fue expuesta, regenerá tu Kit inmediatamente desde la app.',
  ]
  tips.forEach((tip) => {
    doc.text(tip, margin, cursorY)
    cursorY += 14
  })

  // Pie de página
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(
    `Generado localmente en tu dispositivo el ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR')}.`,
    margin,
    pageHeight - 30,
  )

  const fileName = `lifekeeper-emergency-kit-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)

  return kit.phrase
}
