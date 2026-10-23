import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import * as ExcelJS from 'exceljs'
import { useState } from 'react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import { encryptObject, decryptObject } from '../../utils/encryption'
import { formatDate, formatDateTime, toLocalDateKey } from '../../utils/dates'
import { downloadEmergencyKitPdf } from '../../services/crypto/emergencyKit'
import type { AppData } from '../../types'

const timestamp = () => new Date().toISOString().replace(/[:T]/g, '-').split('.')[0]

const isValidAppData = (candidate: unknown): candidate is AppData => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return false
  }
  const obj = candidate as Record<string, unknown>
  return (
    typeof obj.profile === 'object' &&
    obj.profile !== null &&
    typeof obj.health === 'object' &&
    obj.health !== null &&
    typeof obj.diary === 'object' &&
    obj.diary !== null &&
    typeof obj.security === 'object' &&
    obj.security !== null &&
    typeof obj.personal === 'object' &&
    obj.personal !== null &&
    typeof obj.utilities === 'object' &&
    obj.utilities !== null
  )
}

export const BackupsSection = () => {
  const { data, masterPassword, updateData, replaceData } = useAppData()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<AppData | null>(null)

  const lastAuto = data.utilities.backups.lastAutomaticBackup
  const lastManual = data.utilities.backups.lastManualBackup

  const stampManualBackup = () => {
    updateData((previous) => ({
      ...previous,
      utilities: {
        ...previous.utilities,
        backups: {
          ...previous.utilities.backups,
          lastManualBackup: new Date().toISOString(),
        },
      },
    }))
  }

  const handleEncryptedBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      cipher: encryptObject(data, masterPassword),
    }
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    saveAs(blob, `lifekeeper-encrypted-${timestamp()}.json`)
    stampManualBackup()
    setStatusMessage('Backup cifrado generado correctamente.')
    setErrorMessage(null)
  }

  const handlePlainBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    saveAs(blob, `lifekeeper-data-${timestamp()}.json`)
    stampManualBackup()
    setStatusMessage('Backup JSON generado.')
    setErrorMessage(null)
  }

  const handleEmergencyKitPdf = async () => {
    try {
      await downloadEmergencyKitPdf({
        userEmail: data.profile.auth.email || 'usuario@lifekeeper.local',
        userName: data.profile.fullName || data.profile.nickName,
      })
      setStatusMessage('Kit de Emergencia oficial descargado correctamente.')
      setErrorMessage(null)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al generar el Kit de Emergencia')
    }
  }

  const handleExcelExport = async () => {
    const workbook = new ExcelJS.Workbook()

    const createSheet = (name: string, rows: Record<string, unknown>[]) => {
      const sheet = workbook.addWorksheet(name)
      if (rows.length > 0) {
        const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
        sheet.columns = keys.map((key) => ({
          header: key.charAt(0).toUpperCase() + key.slice(1),
          key,
          width: 20,
        }))
        sheet.addRows(rows)
      }
    }

    createSheet('Perfil', mapProfile(data))
    createSheet('Vacunas', mapVaccines(data))
    createSheet('Consultas', mapConsultations(data))
    createSheet('Medicaciones', mapMedications(data))
    createSheet('Diario', mapDiary(data))
    createSheet('Contraseñas', mapPasswords(data))
    createSheet('Finanzas', mapFinances(data))
    createSheet('Vehículos', mapVehicles(data))
    createSheet('Recordatorios', mapReminders(data))

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, `lifekeeper-${timestamp()}.xlsx`)
    setStatusMessage('Archivo Excel creado con todas las secciones.')
    setErrorMessage(null)
  }

  const handleCsvExport = async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('data')
    const rows: Record<string, unknown>[] = [
      ...mapProfile(data).map((row) => ({ seccion: 'Perfil', ...row })),
      ...mapVaccines(data).map((row) => ({ seccion: 'Vacunas', ...row })),
      ...mapConsultations(data).map((row) => ({ seccion: 'Consultas', ...row })),
      ...mapFinances(data).map((row) => ({ seccion: 'Finanzas', ...row })),
      ...mapReminders(data).map((row) => ({ seccion: 'Recordatorios', ...row })),
    ]

    if (rows.length > 0) {
      const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
      sheet.columns = keys.map((key) => ({
        header: key.charAt(0).toUpperCase() + key.slice(1),
        key,
        width: 20,
      }))
      sheet.addRows(rows)
    }

    const buffer = await workbook.csv.writeBuffer()
    const blob = new Blob([buffer], { type: 'text/csv;charset=utf-8' })
    saveAs(blob, `lifekeeper-${timestamp()}.csv`)
    setStatusMessage('Archivo CSV combinado generado.')
    setErrorMessage(null)
  }

  const handleEmergencyPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a6' })
    const profile = data.health.emergencyProfile
    let cursorY = 40
    doc.setFontSize(18)
    doc.text('Tarjeta SOS', 40, cursorY)
    cursorY += 24
    doc.setFontSize(12)
    doc.text(`Nombre: ${profile.fullName || 'No cargado'}`, 40, cursorY)
    cursorY += 16
    doc.text(`Grupo sanguíneo: ${profile.bloodType || 'ND'}`, 40, cursorY)
    cursorY += 16
    doc.text(`Alergias: ${profile.allergies.join(', ') || 'Ninguna'}`, 40, cursorY)
    cursorY += 16
    doc.text(`Medicaciones: ${profile.medications.join(', ') || 'Ninguna'}`, 40, cursorY)
    cursorY += 16
    doc.text(`Condiciones: ${profile.conditions.join(', ') || 'Ninguna'}`, 40, cursorY)
    cursorY += 24
    doc.text('Contactos:', 40, cursorY)
    cursorY += 16
    profile.emergencyContacts.slice(0, 3).forEach((contact) => {
      doc.text(
        `${contact.name} (${contact.relationship || 'Sin dato'}): ${contact.phone}`,
        40,
        cursorY,
      )
      cursorY += 14
    })
    doc.save(`lifekeeper-sos-${timestamp()}.pdf`)
    setStatusMessage('Tarjeta SOS generada.')
    setErrorMessage(null)
  }

  const handleHealthAndFitnessPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 40
    let cursorY = 45

    const checkPageBreak = (neededHeight: number) => {
      if (cursorY + neededHeight > pageHeight - 50) {
        doc.addPage()
        cursorY = 45
        renderHeader()
      }
    }

    const renderHeader = () => {
      doc.setFontSize(8)
      doc.setTextColor(140, 150, 165)
      doc.text('LIFEKEEPER VAULT — REPORTE MÉDICO & FITNESS INTEGRAL', margin, cursorY)
      doc.text(
        `Emitido: ${formatDateTime(new Date().toISOString())}`,
        pageWidth - margin,
        cursorY,
        { align: 'right' },
      )
      cursorY += 12
      doc.setDrawColor(200, 215, 230)
      doc.setLineWidth(0.75)
      doc.line(margin, cursorY, pageWidth - margin, cursorY)
      cursorY += 18
      doc.setTextColor(15, 23, 42)
    }

    // Encabezado inicial
    renderHeader()

    // Título Principal
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 35, 75)
    doc.text('Reporte de Salud, Nutrición y Rendimiento Físico', margin, cursorY)
    cursorY += 22

    // Sección 1: Perfil y Biometría (IMC)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(29, 99, 220)
    doc.text('1. Perfil del Titular y Biometría', margin, cursorY)
    cursorY += 14

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)

    const profileName = data.profile.fullName || 'No especificado'
    const alias = data.profile.nickName ? ` ("${data.profile.nickName}")` : ''
    const height = data.profile.heightCm
    const weight = data.profile.weightKg

    let imcText = 'No calculado (cargue altura y peso en Perfil)'
    if (height && weight && height > 0) {
      const imc = weight / Math.pow(height / 100, 2)
      let imcCategory = 'Normal'
      if (imc < 18.5) imcCategory = 'Bajo peso'
      else if (imc < 25) imcCategory = 'Peso normal'
      else if (imc < 30) imcCategory = 'Sobrepeso'
      else imcCategory = 'Obesidad'
      imcText = `${imc.toFixed(1)} kg/m² (${imcCategory})`
    }

    doc.text(`Nombre completo: ${profileName}${alias}`, margin, cursorY)
    cursorY += 14
    doc.text(
      `Altura: ${height ? `${height} cm` : 'Sin dato'}  |  Peso: ${weight ? `${weight} kg` : 'Sin dato'}  |  Índice de Masa Corporal (IMC): ${imcText}`,
      margin,
      cursorY,
    )
    cursorY += 20

    // Sección 2: Ficha SOS y Alertas Críticas
    checkPageBreak(90)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38)
    doc.text('2. Ficha de Emergencia SOS', margin, cursorY)
    cursorY += 14

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    const em = data.health.emergencyProfile
    doc.text(`Grupo sanguíneo: ${em.bloodType || 'Sin especificar'}`, margin, cursorY)
    cursorY += 13
    doc.text(
      `Alergias conocidas: ${em.allergies.length ? em.allergies.join(', ') : 'Ninguna informada'}`,
      margin,
      cursorY,
    )
    cursorY += 13
    doc.text(
      `Condiciones / Patologías crónicas: ${em.conditions.length ? em.conditions.join(', ') : 'Ninguna informada'}`,
      margin,
      cursorY,
    )
    cursorY += 13

    if (em.emergencyContacts.length > 0) {
      doc.text('Contactos de emergencia prioritarios:', margin, cursorY)
      cursorY += 12
      em.emergencyContacts.forEach((contact) => {
        doc.text(
          `  • ${contact.name} (${contact.relationship || 'Vínculo no aclarado'}): Tel. ${contact.phone}`,
          margin,
          cursorY,
        )
        cursorY += 12
      })
    }
    cursorY += 8

    // Sección 3: Hidratación Diaria
    checkPageBreak(70)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(13, 148, 136)
    doc.text('3. Monitoreo de Hidratación', margin, cursorY)
    cursorY += 14

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    const targetMl =
      data.health.hydrationTargetMl ?? (weight ? Math.round(weight * 35) : 2500)
    const todayKey = toLocalDateKey(new Date())
    const todayHydration = (data.health.hydrationLogs ?? []).find(
      (entry) => entry.date === todayKey,
    )
    const todayAmount = todayHydration ? todayHydration.amountMl : 0
    const hydrationPct = Math.round((todayAmount / (targetMl || 1)) * 100)

    doc.text(`Meta diaria de hidratación recomendada: ${targetMl} ml`, margin, cursorY)
    cursorY += 13
    doc.text(
      `Ingesta registrada hoy (${todayKey}): ${todayAmount} ml (${hydrationPct}% de la meta cumplida)`,
      margin,
      cursorY,
    )
    cursorY += 20

    // Sección 4: Tratamientos y Medicación
    checkPageBreak(80)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(29, 99, 220)
    doc.text('4. Tratamientos y Medicación Activa', margin, cursorY)
    cursorY += 14

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)

    const activeMeds = data.health.medications.filter((m) => m.active)
    if (activeMeds.length === 0) {
      doc.text('No hay tratamientos médicos activos registrados.', margin, cursorY)
      cursorY += 16
    } else {
      activeMeds.forEach((med) => {
        checkPageBreak(30)
        const schedules = med.schedules.map((s) => s.time).join(', ')
        doc.setFont('helvetica', 'bold')
        doc.text(`• ${med.name} — ${med.dosage} (${med.frequency})`, margin, cursorY)
        cursorY += 12
        doc.setFont('helvetica', 'normal')
        doc.text(
          `   Horarios programados: ${schedules || 'A demanda'} | Inicio: ${formatDate(med.startDate)}`,
          margin,
          cursorY,
        )
        cursorY += 14
      })
    }
    cursorY += 8

    // Sección 5: Vacunación e Inmunización
    checkPageBreak(80)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(29, 99, 220)
    doc.text('5. Vacunación e Inmunizaciones', margin, cursorY)
    cursorY += 14

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)

    if (data.health.vaccines.length === 0) {
      doc.text('No hay vacunas registradas en el historial.', margin, cursorY)
      cursorY += 16
    } else {
      data.health.vaccines.slice(0, 10).forEach((v) => {
        checkPageBreak(25)
        const proxima = v.nextDoseDate ? ` | Próximo refuerzo: ${formatDate(v.nextDoseDate)}` : ''
        doc.text(
          `• ${v.vaccine} (Dosis: ${v.dose}) — Aplicada: ${formatDate(v.date)}${proxima}`,
          margin,
          cursorY,
        )
        cursorY += 13
      })
    }
    cursorY += 8

    // Sección 6: Historial de Entrenamientos y Actividad Física
    checkPageBreak(80)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(168, 85, 247)
    doc.text('6. Registro de Entrenamientos y Actividad Física', margin, cursorY)
    cursorY += 14

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)

    const workouts = data.personal.workouts ?? []
    if (workouts.length === 0) {
      doc.text(
        'No se han registrado sesiones de entrenamiento en la sección de Rendimiento.',
        margin,
        cursorY,
      )
      cursorY += 16
    } else {
      workouts.slice(0, 10).forEach((w) => {
        checkPageBreak(25)
        const dur = w.durationMinutes ? `${w.durationMinutes} min` : 'Duración no reg.'
        const cal = w.calories ? ` | ${w.calories} kcal` : ''
        const dist = w.distanceKm ? ` | ${w.distanceKm} km` : ''
        const exerCount = w.exercises?.length ? ` | ${w.exercises.length} ejercicios` : ''
        doc.text(
          `• ${formatDate(w.date)} — ${w.title} (${w.type.toUpperCase()}): ${dur}${dist}${cal}${exerCount}`,
          margin,
          cursorY,
        )
        cursorY += 13
      })
    }

    // Pie de página de confidencialidad
    doc.setFontSize(8)
    doc.setTextColor(140, 150, 165)
    doc.text(
      'Documento de uso estrictamente personal y confidencial. Generado localmente en LifeKeeper Vault.',
      margin,
      pageHeight - 25,
    )

    doc.save(`lifekeeper-salud-fitness-${timestamp()}.pdf`)
    setStatusMessage('Reporte médico y de fitness generado con éxito.')
    setErrorMessage(null)
  }

  const handleImport = async (file: File) => {
    setIsImporting(true)
    setErrorMessage(null)
    setStatusMessage(null)
    try {
      const content = await file.text()
      const parsed: unknown = JSON.parse(content)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Formato inválido')
      }

      const record = parsed as Record<string, unknown>
      let restored: unknown
      if (typeof record.cipher === 'string') {
        restored = decryptObject<AppData>(record.cipher, masterPassword)
      } else {
        restored = parsed
      }

      if (!isValidAppData(restored)) {
        throw new Error('Estructura de bóveda inválida')
      }

      setPendingRestore(restored)
    } catch {
      setErrorMessage(
        'No se pudo importar el archivo, verificá que corresponda a un backup válido y que la contraseña maestra coincida.',
      )
    } finally {
      setIsImporting(false)
    }
  }

  const confirmRestore = () => {
    if (!pendingRestore) return
    replaceData(pendingRestore)
    setPendingRestore(null)
    setStatusMessage('Datos importados correctamente. Revisalos antes de continuar.')
    setErrorMessage(null)
  }

  return (
    <div>
      <SectionHeader
        title="Respaldos y exportación"
        subtitle="Generá respaldos cifrados, exportá a Excel/CSV y restaurá información"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Estado de respaldos</h3>
          </div>
          <p className="panel-subtitle">
            Último backup automático: {lastAuto ? formatDateTime(lastAuto) : 'Aún no se generó'}
          </p>
          <p className="panel-subtitle">
            Último backup manual: {lastManual ? formatDateTime(lastManual) : 'Aún no se generó'}
          </p>
          {statusMessage ? <p className="panel-subtitle">{statusMessage}</p> : null}
          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Respaldos rápidos</h3>
          </div>
          <div className="section-actions">
            <button className="primary-button" type="button" onClick={handleEncryptedBackup}>
              Backup cifrado (JSON)
            </button>
            <button className="secondary-button" type="button" onClick={handlePlainBackup}>
              Backup plano (JSON)
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Kit de Emergencia &amp; Rescate (Zero-Knowledge)</h3>
          </div>
          <p className="panel-subtitle">
            Generá una copia impresa o digital de alta seguridad con las 24 palabras mnemónicas de rescate.
            Este documento te permite recuperar el acceso completo a tu bóveda si olvidás tu contraseña maestra.
          </p>
          <div className="section-actions">
            <button
              className="primary-button"
              type="button"
              onClick={handleEmergencyKitPdf}
            >
              Descargar Kit de Emergencia (PDF)
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Exportaciones avanzadas</h3>
          </div>
          <div className="section-actions">
            <button className="secondary-button" type="button" onClick={handleExcelExport}>
              Exportar Excel completo
            </button>
            <button className="secondary-button" type="button" onClick={handleCsvExport}>
              Exportar CSV consolidado
            </button>
            <button className="secondary-button" type="button" onClick={handleEmergencyPdf}>
              Exportar tarjeta SOS (PDF)
            </button>
            <button className="primary-button" type="button" onClick={handleHealthAndFitnessPdf}>
              Reporte Salud &amp; Fitness (PDF)
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Importar respaldo</h3>
          </div>
          <input
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleImport(file)
                event.target.value = ''
              }
            }}
            disabled={isImporting}
          />
          <p className="panel-subtitle">
            Seleccioná un backup cifrado creado con esta app o un JSON plano de exportación completa.
          </p>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(pendingRestore)}
        variant="danger"
        title="Restaurar bóveda desde backup"
        message="Esta acción reemplazará todos los datos actuales de tu bóveda por los del archivo seleccionado. ¿Querés continuar?"
        confirmLabel="Sí, restaurar datos"
        onConfirm={confirmRestore}
        onClose={() => setPendingRestore(null)}
      />
    </div>
  )
}

const mapProfile = (data: AppData) => [
  {
    nombreCompleto: data.profile.fullName,
    alias: data.profile.nickName ?? '',
    email: data.profile.auth.email,
    usuario: data.profile.auth.username,
    telefono: data.profile.auth.phone ?? '',
    pais: data.profile.country ?? '',
    dobleFactor: data.profile.auth.twoFactorEnabled ? 'Sí' : 'No',
    correoRecuperacion: data.profile.auth.recoveryEmail ?? '',
    preguntaSeguridad: data.profile.auth.securityQuestion ?? '',
    pistaRespuesta: data.profile.auth.securityAnswerHint ?? '',
    actualizado: data.profile.updatedAt ?? '',
  },
]

const mapVaccines = (data: AppData) =>
  data.health.vaccines.map((record) => ({
    vacuna: record.vaccine,
    dosis: record.dose,
    fecha: record.date,
    proxima: record.nextDoseDate ?? '',
    lugar: record.location,
    lote: record.lot,
  }))

const mapConsultations = (data: AppData) =>
  data.health.consultations.map((record) => ({
    fecha: record.date,
    profesional: record.doctor,
    motivo: record.reason,
    diagnostico: record.diagnosis ?? '',
    tratamiento: record.treatment ?? '',
  }))

const mapMedications = (data: AppData) =>
  data.health.medications.map((record) => ({
    nombre: record.name,
    dosis: record.dosage,
    frecuencia: record.frequency,
    horarios: record.schedules
      .map((item) => `${item.time}${item.note ? ` (${item.note})` : ''}`)
      .join(' | '),
    activo: record.active ? 'Sí' : 'No',
  }))

const mapDiary = (data: AppData) =>
  data.diary.entries.map((entry) => ({
    fecha: entry.date,
    titulo: entry.title,
    estado: entry.mood,
    contenido: entry.content,
    tags: entry.tags.join(', '),
  }))

const mapPasswords = (data: AppData) =>
  data.security.passwordEntries.map((entry) => ({
    servicio: entry.service,
    usuario: entry.username,
    notas: entry.notes ?? '',
    actualizado: entry.updatedAt,
  }))

const mapFinances = (data: AppData) =>
  data.personal.finances.map((transaction) => ({
    tipo: transaction.type,
    monto: transaction.amount,
    categoria: transaction.category,
    fecha: transaction.date,
    descripcion: transaction.description ?? '',
  }))

const mapVehicles = (data: AppData) =>
  data.personal.vehicles.map((service) => ({
    vehiculo: service.vehicleName,
    servicio: service.serviceType,
    fecha: service.date,
    costo: service.cost,
    kilometros: service.mileage ?? '',
  }))

const mapReminders = (data: AppData) =>
  data.utilities.reminders.map((reminder) => ({
    titulo: reminder.title,
    vence: reminder.dateTime,
    categoria: reminder.category,
    completado: reminder.done ? 'Sí' : 'No',
  }))
