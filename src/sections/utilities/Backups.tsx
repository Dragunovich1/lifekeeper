import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import * as ExcelJS from 'exceljs'
import { useState } from 'react'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import { encryptObject, decryptObject } from '../../utils/encryption'
import type { AppData } from '../../types'

const timestamp = () => new Date().toISOString().replace(/[:T]/g, '-').split('.')[0]

export const BackupsSection = () => {
  const { data, masterPassword, updateData, replaceData } = useAppData()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

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

  const handleExcelExport = async () => {
    const workbook = new ExcelJS.Workbook();

    const createSheet = (name: string, data: Record<string, unknown>[]) => {
      const sheet = workbook.addWorksheet(name);
      if (data.length > 0) {
        sheet.columns = Object.keys(data[0]).map(key => ({
          header: key.charAt(0).toUpperCase() + key.slice(1),
          key: key,
          width: 20,
        }));
        sheet.addRows(data);
      }
    };

    createSheet('Perfil', mapProfile(data));
    createSheet('Vacunas', mapVaccines(data));
    createSheet('Consultas', mapConsultations(data));
    createSheet('Medicaciones', mapMedications(data));
    createSheet('Diario', mapDiary(data));
    createSheet('Contrasenas', mapPasswords(data));
    createSheet('Finanzas', mapFinances(data));
    createSheet('Vehiculos', mapVehicles(data));
    createSheet('Recordatorios', mapReminders(data));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `lifekeeper-${timestamp()}.xlsx`);
    setStatusMessage('Archivo Excel creado con todas las secciones.');
    setErrorMessage(null);
  }

  const handleCsvExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('data');
    const rows = [
      ...mapProfile(data).map((row) => ({ seccion: 'Perfil', ...row })),
      ...mapVaccines(data).map((row) => ({ seccion: 'Vacunas', ...row })),
      ...mapConsultations(data).map((row) => ({ seccion: 'Consultas', ...row })),
      ...mapFinances(data).map((row) => ({ seccion: 'Finanzas', ...row })),
      ...mapReminders(data).map((row) => ({ seccion: 'Recordatorios', ...row })),
    ];

    if (rows.length > 0) {
        sheet.columns = Object.keys(rows[0]).map(key => ({
            header: key.charAt(0).toUpperCase() + key.slice(1),
            key: key,
            width: 20,
        }));
        sheet.addRows(rows);
    }

    const buffer = await workbook.csv.writeBuffer();
    const blob = new Blob([buffer], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `lifekeeper-${timestamp()}.csv`);
    setStatusMessage('Archivo CSV combinado generado.');
    setErrorMessage(null);
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
    doc.text(`Grupo sanguineo: ${profile.bloodType || 'ND'}`, 40, cursorY)
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
      doc.text(`${contact.name} (${contact.relationship || 'Sin dato'}): ${contact.phone}`, 40, cursorY)
      cursorY += 14
    })
    doc.save(`lifekeeper-sos-${timestamp()}.pdf`)
    setStatusMessage('Tarjeta SOS generada.')
    setErrorMessage(null)
  }

  const handleImport = async (file: File) => {
    setIsImporting(true)
    setErrorMessage(null)
    setStatusMessage(null)
    try {
      const content = await file.text()
      const parsed = JSON.parse(content)
      let restored: AppData
      if (parsed.cipher) {
        restored = decryptObject<AppData>(parsed.cipher, masterPassword)
      } else {
        restored = parsed as AppData
      }
      replaceData(restored)
      setStatusMessage('Datos importados correctamente. Revisalos antes de continuar.')
    } catch {
      setErrorMessage('No se pudo importar el archivo, verifica que corresponda a un backup valido.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div>
      <SectionHeader
        title="Respaldos y exportacion"
        subtitle="Genera respaldos cifrados, exporta a Excel/CSV y restaura informacion"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Estado de respaldos</h3>
          </div>
          <p className="panel-subtitle">Ultimo backup automatico: {lastAuto ? new Date(lastAuto).toLocaleString() : 'Aun no se genero'}</p>
          <p className="panel-subtitle">Ultimo backup manual: {lastManual ? new Date(lastManual).toLocaleString() : 'Aun no se genero'}</p>
          {statusMessage ? <p className="panel-subtitle">{statusMessage}</p> : null}
          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Respaldos rapidos</h3>
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
              }
            }}
            disabled={isImporting}
          />
          <p className="panel-subtitle">Selecciona un backup cifrado creado con esta app o un JSON plano full export.</p>
        </div>
      </div>
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
    dobleFactor: data.profile.auth.twoFactorEnabled ? 'Si' : 'No',
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
    horarios: record.schedules.map((item) => `${item.time}${item.note ? ` (${item.note})` : ''}`).join(' | '),
    activo: record.active ? 'Si' : 'No',
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
    completado: reminder.done ? 'Si' : 'No',
  }))
