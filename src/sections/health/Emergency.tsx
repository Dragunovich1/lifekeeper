import { useEffect, useMemo, useState } from 'react'
import { X, QrCode, Printer, ShieldCheck } from 'lucide-react'
import QRCode from 'qrcode'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { TagInput } from '../../components/TagInput'
import { useAppData } from '../../hooks/useAppData'
import type { EmergencyContact, EmergencyProfile } from '../../types'
import { safeParseDate, toLocalDateKey } from '../../utils/dates'

const emptyContact: EmergencyContact = {
  id: '',
  name: '',
  relationship: '',
  phone: '',
}

const BLOOD_TYPE_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
]

const COMMON_ALLERGIES = [
  'Penicilina',
  'Ibuprofeno',
  'Aspirina',
  'Látex',
  'Mariscos',
  'Maní',
  'Sulfamidas',
  'Polen',
]

const COMMON_CONDITIONS = [
  'Hipertensión',
  'Asma',
  'Diabetes',
  'Celiaquía',
  'Hipotiroidismo',
  'Migraña',
  'Arritmia',
]

type ProfileWithoutArrays = Pick<
  EmergencyProfile,
  'fullName' | 'bloodType' | 'notes' | 'birthDate'
>

export const EmergencySection = () => {
  const { data, updateData } = useAppData()
  const profile = data.health.emergencyProfile
  const [editState, setEditState] = useState<ProfileWithoutArrays>({
    fullName: profile.fullName,
    bloodType: profile.bloodType,
    notes: profile.notes ?? '',
    birthDate: profile.birthDate ?? '',
  })
  const [allergies, setAllergies] = useState<string[]>([...profile.allergies])
  const [medications, setMedications] = useState<string[]>([...profile.medications])
  const [conditions, setConditions] = useState<string[]>([...profile.conditions])
  const [contacts, setContacts] = useState<EmergencyContact[]>([...profile.emergencyContacts])
  const [contactDraft, setContactDraft] = useState<EmergencyContact>({ ...emptyContact })
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [pendingDeleteContact, setPendingDeleteContact] = useState<EmergencyContact | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [sosVisible, setSosVisible] = useState(false)
  const [walletCardVisible, setWalletCardVisible] = useState(false)
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    setEditState({
      fullName: profile.fullName,
      bloodType: profile.bloodType,
      birthDate: profile.birthDate ?? '',
      notes: profile.notes ?? '',
    })
    setAllergies([...profile.allergies])
    setMedications([...profile.medications])
    setConditions([...profile.conditions])
    setContacts([...profile.emergencyContacts])
  }, [profile])

  useEffect(() => {
    if (!sosVisible) {
      return
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSosVisible(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [sosVisible])

  const medicationSuggestions = useMemo(() => {
    return data.health.medications
      .filter((m) => m.active)
      .map((m) => (m.dosage ? `${m.name} (${m.dosage})` : m.name))
  }, [data.health.medications])

  const profileAge = useMemo(() => {
    const birth = safeParseDate(profile.birthDate)
    if (!birth) {
      return null
    }
    const diff = new Date(Date.now() - birth.getTime())
    return Math.abs(diff.getUTCFullYear() - 1970)
  }, [profile.birthDate])

  const emergencyQrPayload = useMemo(() => {
    const lines = [
      '🚨 LIFEKEEPER - SOS MEDICO 🚨',
      `PACIENTE: ${profile.fullName || 'No especificado'}`,
      `GRUPO SANGUINEO: ${profile.bloodType || 'Sin especificar'}`,
      profileAge !== null ? `EDAD: ${profileAge} anos` : '',
      `ALERGIAS: ${profile.allergies.length > 0 ? profile.allergies.join(', ') : 'Ninguna registrada'}`,
      `MEDICACION: ${profile.medications.length > 0 ? profile.medications.join(', ') : 'Ninguna'}`,
      `CONDICIONES: ${profile.conditions.length > 0 ? profile.conditions.join(', ') : 'Ninguna'}`,
      profile.notes ? `NOTAS: ${profile.notes}` : '',
      'CONTACTOS SOS:',
      ...profile.emergencyContacts.map((c) => `- ${c.name} (${c.relationship || 'SOS'}): ${c.phone}`),
    ].filter(Boolean)
    return lines.join('\n')
  }, [profile, profileAge])

  useEffect(() => {
    QRCode.toDataURL(emergencyQrPayload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generando QR SOS:', err))
  }, [emergencyQrPayload])

  const handleSave = () => {
    const updatedProfile: EmergencyProfile = {
      ...profile,
      ...editState,
      birthDate: toLocalDateKey(editState.birthDate) || undefined,
      allergies,
      medications,
      conditions,
      emergencyContacts: contacts,
      notes: editState.notes,
    }

    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        emergencyProfile: updatedProfile,
      },
    }))

    setStatusMessage('Ficha de emergencia actualizada correctamente')
  }

  const handleSyncFromProfileAndMedications = () => {
    const nextFullName = editState.fullName.trim() || data.profile.fullName || ''
    const nextBirthDate =
      toLocalDateKey(editState.birthDate) || toLocalDateKey(data.profile.birthDate) || ''

    const activeMedLabels = data.health.medications
      .filter((med) => med.active)
      .map((med) => (med.dosage ? `${med.name} (${med.dosage})` : med.name))

    const mergedMeds = [...medications]
    activeMedLabels.forEach((label) => {
      const exists = mergedMeds.some((existing) => existing.toLowerCase() === label.toLowerCase())
      if (!exists) {
        mergedMeds.push(label)
      }
    })

    const nextEditState = {
      ...editState,
      fullName: nextFullName,
      birthDate: nextBirthDate,
    }

    setEditState(nextEditState)
    setMedications(mergedMeds)

    const updatedProfile: EmergencyProfile = {
      ...profile,
      ...nextEditState,
      birthDate: nextBirthDate || undefined,
      allergies,
      medications: mergedMeds,
      conditions,
      emergencyContacts: contacts,
      notes: nextEditState.notes,
    }

    updateData((previous) => ({
      ...previous,
      health: {
        ...previous.health,
        emergencyProfile: updatedProfile,
      },
    }))

    setStatusMessage('Datos sincronizados desde tu perfil y medicaciones activas')
  }

  const resetContactDraft = () => {
    setContactDraft({ ...emptyContact })
    setEditingContactId(null)
  }

  const handleAddContact = () => {
    if (!contactDraft.name.trim() || !contactDraft.phone.trim()) {
      return
    }

    if (editingContactId) {
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === editingContactId
            ? {
                id: editingContactId,
                name: contactDraft.name.trim(),
                relationship: contactDraft.relationship.trim(),
                phone: contactDraft.phone.trim(),
              }
            : contact,
        ),
      )
    } else {
      const entry: EmergencyContact = {
        id: uuid(),
        name: contactDraft.name.trim(),
        relationship: contactDraft.relationship.trim(),
        phone: contactDraft.phone.trim(),
      }
      setContacts((prev) => [entry, ...prev])
    }

    resetContactDraft()
  }

  const startEditContact = (contact: EmergencyContact) => {
    setEditingContactId(contact.id)
    setContactDraft({ ...contact })
  }

  const handleRemoveContact = (id: string) => {
    if (editingContactId === id) {
      resetContactDraft()
    }
    setContacts((prev) => prev.filter((contact) => contact.id !== id))
  }

  return (
    <div>
      <SectionHeader
        title="Emergencia"
        subtitle="Tarjeta rápida con datos críticos y contactos a un toque"
        actions={
          <div className="section-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={handleSyncFromProfileAndMedications}
            >
              Sincronizar desde Perfil y Medicaciones
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setWalletCardVisible(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Printer size={15} />
              Carnet SOS de Bolsillo
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setQrModalVisible(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <QrCode size={15} />
              QR Médico SOS
            </button>
            <button className="danger-button" type="button" onClick={() => setSosVisible(true)}>
              🚨 Modo SOS
            </button>
          </div>
        }
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Datos principales</h3>
            <button className="primary-button" type="button" onClick={handleSave}>
              Guardar cambios
            </button>
          </div>
          {statusMessage ? <p className="panel-subtitle">{statusMessage}</p> : null}
          <div className="form-grid two-columns">
            <div className="field">
              <label htmlFor="profile-name">Nombre completo</label>
              <input
                id="profile-name"
                value={editState.fullName}
                onChange={(event) => {
                  setEditState({ ...editState, fullName: event.target.value })
                  setStatusMessage(null)
                }}
                placeholder="Nombre para mostrar"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-blood">Grupo sanguíneo</label>
              <Select
                id="profile-blood"
                value={editState.bloodType}
                onChange={(value) => {
                  setEditState({ ...editState, bloodType: value })
                  setStatusMessage(null)
                }}
                options={BLOOD_TYPE_OPTIONS}
                placeholder="Sin especificar"
                ariaLabel="Grupo sanguíneo"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-birth">Fecha de nacimiento</label>
              <DatePicker
                id="profile-birth"
                value={toLocalDateKey(editState.birthDate)}
                onChange={(value) => {
                  setEditState({ ...editState, birthDate: toLocalDateKey(value) })
                  setStatusMessage(null)
                }}
                ariaLabel="Fecha de nacimiento"
              />
            </div>
            <div className="field field-full">
              <label htmlFor="profile-notes">Notas generales</label>
              <textarea
                id="profile-notes"
                value={editState.notes ?? ''}
                onChange={(event) => {
                  setEditState({ ...editState, notes: event.target.value })
                  setStatusMessage(null)
                }}
                placeholder="Consideraciones adicionales"
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 className="panel-title">Condiciones</h3>
          <div className="form-grid">
            <div className="field">
              <label>Alergias</label>
              <TagInput
                values={allergies}
                onChange={(next) => {
                  setAllergies(next)
                  setStatusMessage(null)
                }}
                suggestions={COMMON_ALLERGIES}
                placeholder="Ingresá alergias y presioná Enter"
              />
            </div>
            <div className="field">
              <label>Medicaciones habituales</label>
              <TagInput
                values={medications}
                onChange={(next) => {
                  setMedications(next)
                  setStatusMessage(null)
                }}
                suggestions={medicationSuggestions}
                placeholder="Medicamentos permanentes"
              />
            </div>
            <div className="field">
              <label>Condiciones médicas</label>
              <TagInput
                values={conditions}
                onChange={(next) => {
                  setConditions(next)
                  setStatusMessage(null)
                }}
                suggestions={COMMON_CONDITIONS}
                placeholder="Enfermedades, antecedentes"
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Contactos de emergencia</h3>
          </div>
          <div className="form-grid three-columns">
            <div className="field">
              <label htmlFor="contact-name">Nombre</label>
              <input
                id="contact-name"
                value={contactDraft.name}
                onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })}
                placeholder="Contacto"
              />
            </div>
            <div className="field">
              <label htmlFor="contact-relation">Relación</label>
              <input
                id="contact-relation"
                value={contactDraft.relationship}
                onChange={(event) =>
                  setContactDraft({ ...contactDraft, relationship: event.target.value })
                }
                placeholder="Familiar, amigo, médico"
              />
            </div>
            <div className="field">
              <label htmlFor="contact-phone">Teléfono</label>
              <input
                id="contact-phone"
                value={contactDraft.phone}
                onChange={(event) =>
                  setContactDraft({ ...contactDraft, phone: event.target.value })
                }
                placeholder="Número directo"
              />
            </div>
            <div className="form-actions field-full">
              <button className="secondary-button" type="button" onClick={handleAddContact}>
                {editingContactId ? 'Actualizar contacto' : 'Agregar contacto'}
              </button>
              {editingContactId ? (
                <button className="secondary-button" type="button" onClick={resetContactDraft}>
                  Cancelar edición
                </button>
              ) : null}
            </div>
          </div>

          {contacts.length === 0 ? (
            <div className="empty-state">Cargá al menos un contacto para emergencias.</div>
          ) : (
            <div className="section-body">
              {contacts.map((contact) => (
                <div key={contact.id} className="subpanel">
                  <div className="panel-header">
                    <div>
                      <h4 className="panel-title">{contact.name}</h4>
                      <span className="panel-subtitle">
                        {contact.relationship || 'Relación no indicada'}
                      </span>
                    </div>
                    <div className="section-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => startEditContact(contact)}
                      >
                        Editar
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setPendingDeleteContact(contact)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <p>Teléfono: {contact.phone}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {sosVisible ? (
        <div className="sos-overlay" onClick={() => setSosVisible(false)}>
          <div
            className="sos-card"
            role="dialog"
            aria-modal="true"
            aria-label="Tarjeta SOS"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="sos-close"
              onClick={() => setSosVisible(false)}
              aria-label="Cerrar tarjeta SOS"
            >
              <X size={18} aria-hidden />
            </button>
            <h2>SOS</h2>
            <h3>{profile.fullName || 'Nombre no cargado'}</h3>
            <p>Grupo sanguíneo: {profile.bloodType || 'Sin especificar'}</p>
            {profileAge !== null ? <p>Edad estimada: {profileAge} años</p> : null}
            <p>
              Alergias:{' '}
              {profile.allergies.length > 0
                ? profile.allergies.join(', ')
                : 'ninguna registrada'}
            </p>
            <p>
              Medicaciones habituales:{' '}
              {profile.medications.length > 0
                ? profile.medications.join(', ')
                : 'ninguna registrada'}
            </p>
            <p>
              Condiciones médicas:{' '}
              {profile.conditions.length > 0
                ? profile.conditions.join(', ')
                : 'ninguna registrada'}
            </p>
            {profile.notes ? <p>Notas: {profile.notes}</p> : null}
            <div>
              <h4>Contactos</h4>
              {profile.emergencyContacts.length === 0 ? (
                <p>Sin contactos</p>
              ) : (
                <ul>
                  {profile.emergencyContacts.map((contact) => (
                    <li key={contact.id}>
                      <span>
                        {contact.name} ({contact.relationship || 'sin relación'}) — Teléfono:{' '}
                        {contact.phone}
                      </span>{' '}
                      <a className="secondary-button" href={`tel:${contact.phone}`}>
                        Llamar
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Carnet SOS de Bolsillo / Imprimible */}
      {walletCardVisible && (
        <div className="modal-overlay" onClick={() => setWalletCardVisible(false)}>
          <div
            className="modal-container"
            style={{ maxWidth: '640px', padding: '1.5rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} style={{ color: 'var(--color-error)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  Carnet SOS Médico de Bolsillo
                </h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setWalletCardVisible(false)}
                style={{ padding: '0.3rem 0.6rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
              Podés imprimir este carnet para llevarlo en tu billetera o bolso. Cualquier rescatista, médico o persona de auxilio podrá leer tus datos críticos o escanear el código QR sin necesidad de clave.
            </p>

            {/* Ficha Visual Carnet SOS */}
            <div
              id="printable-sos-card"
              style={{
                borderRadius: '12px',
                border: '2px solid #ef4444',
                background: '#ffffff',
                color: '#0f172a',
                padding: '1.25rem',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                display: 'grid',
                gridTemplateColumns: qrDataUrl ? '1fr 140px' : '1fr',
                gap: '1rem',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    EMERGENCIA MÉDICA / SOS
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>LifeKeeper E2EE</span>
                </div>

                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {profile.fullName || 'NOMBRE NO CARGADO'}
                </h4>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>GRUPO SANGUÍNEO</span>
                    <strong style={{ fontSize: '1.15rem', color: '#ef4444', fontWeight: 900 }}>
                      {profile.bloodType || 'N/E'}
                    </strong>
                  </div>
                  {profileAge !== null && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>EDAD</span>
                      <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>{profileAge} años</strong>
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                  <strong style={{ color: '#dc2626' }}>⚠️ ALERGIAS: </strong>
                  <span>{profile.allergies.length > 0 ? profile.allergies.join(', ') : 'Ninguna declarada'}</span>
                </div>

                <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                  <strong>💊 MEDICACIÓN: </strong>
                  <span>{profile.medications.length > 0 ? profile.medications.join(', ') : 'Ninguna'}</span>
                </div>

                <div style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                  <strong>🩺 PATOLOGÍAS: </strong>
                  <span>{profile.conditions.length > 0 ? profile.conditions.join(', ') : 'Ninguna'}</span>
                </div>

                {profile.emergencyContacts.length > 0 && (
                  <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', fontSize: '0.8125rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.2rem', color: '#0f172a' }}>
                      📞 CONTACTOS SOS:
                    </strong>
                    {profile.emergencyContacts.slice(0, 2).map((c) => (
                      <div key={c.id}>
                        {c.name} ({c.relationship || 'SOS'}): <strong>{c.phone}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* QR escaneable en el carnet */}
              {qrDataUrl && (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={qrDataUrl}
                    alt="Código QR SOS Médico"
                    style={{ width: '130px', height: '130px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block', marginTop: '0.25rem', fontWeight: 600 }}>
                    Escanear para auxilio
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setWalletCardVisible(false)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => window.print()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={16} />
                Imprimir Carnet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Médico de Emergencia Grande */}
      {qrModalVisible && (
        <div className="modal-overlay" onClick={() => setQrModalVisible(false)}>
          <div
            className="modal-container"
            style={{ maxWidth: '420px', textAlign: 'center', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <QrCode size={22} style={{ color: 'var(--color-accent-blue)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>QR Médico de Emergencia</h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setQrModalVisible(false)}
                style={{ padding: '0.3rem 0.6rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
              Presentá este código QR ante personal médico, enfermeros o ambulancistas. Funciona 100% offline sin contraseña maestra.
            </p>

            {qrDataUrl ? (
              <div
                style={{
                  display: 'inline-block',
                  background: '#ffffff',
                  padding: '1rem',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                }}
              >
                <img
                  src={qrDataUrl}
                  alt="QR Médico SOS"
                  style={{ width: '240px', height: '240px', display: 'block' }}
                />
              </div>
            ) : (
              <p>Generando código QR...</p>
            )}

            <div style={{ marginTop: '1.25rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                {profile.fullName} — Grupo: <span style={{ color: 'var(--color-error)' }}>{profile.bloodType || 'N/E'}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                Alergias: {profile.allergies.join(', ') || 'Ninguna'}
              </div>
            </div>

            <button
              type="button"
              className="primary-button"
              style={{ marginTop: '1.25rem', width: '100%' }}
              onClick={() => setQrModalVisible(false)}
            >
              Listo
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(pendingDeleteContact)}
        title="Eliminar contacto de emergencia"
        message={
          pendingDeleteContact
            ? `¿Seguro que querés quitar a "${pendingDeleteContact.name}" de tus contactos de emergencia?`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (pendingDeleteContact) {
            handleRemoveContact(pendingDeleteContact.id)
          }
        }}
        onClose={() => setPendingDeleteContact(null)}
      />
    </div>
  )
}
