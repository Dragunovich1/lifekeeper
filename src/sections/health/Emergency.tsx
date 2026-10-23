import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
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
            <button className="danger-button" type="button" onClick={() => setSosVisible(true)}>
              Mostrar SOS
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
