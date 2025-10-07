import type { EmergencyContact, EmergencyProfile } from '../../types'
import { SectionHeader } from '../../components/SectionHeader'
import { TagInput } from '../../components/TagInput'
import { useAppData } from '../../hooks/useAppData'
import { useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'

const emptyContact: EmergencyContact = {
  id: '',
  name: '',
  relationship: '',
  phone: '',
}

type ProfileWithoutArrays = Pick<EmergencyProfile, 'fullName' | 'bloodType' | 'notes' | 'birthDate'>

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

  const profileAge = useMemo(() => {
    if (!profile.birthDate) {
      return null
    }
    const birth = new Date(profile.birthDate)
    const diff = new Date(Date.now() - birth.getTime())
    return Math.abs(diff.getUTCFullYear() - 1970)
  }, [profile.birthDate])

  const handleSave = () => {
    const updatedProfile: EmergencyProfile = {
      ...profile,
      ...editState,
      birthDate: editState.birthDate || undefined,
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
  }

  const handleAddContact = () => {
    if (!contactDraft.name || !contactDraft.phone) {
      return
    }

    const entry: EmergencyContact = {
      ...contactDraft,
      id: uuid(),
    }

    setContacts((prev) => [entry, ...prev])
    setContactDraft({ ...emptyContact })
  }

  const handleRemoveContact = (id: string) => {
    setContacts((prev) => prev.filter((contact) => contact.id !== id))
  }

  return (
    <div>
      <SectionHeader
        title="Emergencia"
        subtitle="Tarjeta rapida con datos criticos y contactos a un toque"
        actions={
          <button className="primary-button" type="button" onClick={() => setSosVisible(true)}>
            Mostrar SOS
          </button>
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
          <div className="form-grid two-columns">
            <div className="field">
              <label htmlFor="profile-name">Nombre completo</label>
              <input
                id="profile-name"
                value={editState.fullName}
                onChange={(event) => setEditState({ ...editState, fullName: event.target.value })}
                placeholder="Nombre para mostrar"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-blood">Grupo sanguineo</label>
              <input
                id="profile-blood"
                value={editState.bloodType}
                onChange={(event) => setEditState({ ...editState, bloodType: event.target.value })}
                placeholder="Ej. O+, A-, AB"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-birth">Fecha de nacimiento</label>
              <input
                id="profile-birth"
                type="date"
                value={editState.birthDate ? editState.birthDate.slice(0, 10) : ''}
                onChange={(event) =>
                  setEditState({ ...editState, birthDate: event.target.value || '' })
                }
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="profile-notes">Notas generales</label>
              <textarea
                id="profile-notes"
                value={editState.notes ?? ''}
                onChange={(event) => setEditState({ ...editState, notes: event.target.value })}
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
                onChange={setAllergies}
                placeholder="Ingresa alergias y presiona Enter"
              />
            </div>
            <div className="field">
              <label>Medicaciones habituales</label>
              <TagInput
                values={medications}
                onChange={setMedications}
                placeholder="Medicamentos permanentes"
              />
            </div>
            <div className="field">
              <label>Condiciones medicas</label>
              <TagInput
                values={conditions}
                onChange={setConditions}
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
              <label htmlFor="contact-relation">Relacion</label>
              <input
                id="contact-relation"
                value={contactDraft.relationship}
                onChange={(event) =>
                  setContactDraft({ ...contactDraft, relationship: event.target.value })
                }
                placeholder="Familiar, amigo, medico"
              />
            </div>
            <div className="field">
              <label htmlFor="contact-phone">Telefono</label>
              <input
                id="contact-phone"
                value={contactDraft.phone}
                onChange={(event) => setContactDraft({ ...contactDraft, phone: event.target.value })}
                placeholder="Numero directo"
              />
            </div>
            <button className="secondary-button" type="button" onClick={handleAddContact}>
              Agregar contacto
            </button>
          </div>

          {contacts.length === 0 ? (
            <div className="empty-state">Carga al menos un contacto para emergencias.</div>
          ) : (
            <div className="section-body">
              {contacts.map((contact) => (
                <div key={contact.id} className="panel">
                  <div className="panel-header">
                    <div>
                      <h4 className="panel-title">{contact.name}</h4>
                      <span className="panel-subtitle">{contact.relationship || 'Relacion no indicada'}</span>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => handleRemoveContact(contact.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                  <p>{contact.phone}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {sosVisible ? (
        <div className="sos-overlay" onClick={() => setSosVisible(false)}>
          <div className="sos-card">
            <h2>SOS</h2>
            <h3>{profile.fullName || 'Nombre no cargado'}</h3>
            <p>Grupo sanguineo: {profile.bloodType || 'N/D'}</p>
            {profileAge !== null ? <p>Edad estimada: {profileAge} anos</p> : null}
            {profile.allergies.length > 0 ? (
              <p>Alergias: {profile.allergies.join(', ')}</p>
            ) : (
              <p>Alergias: ninguna registrada</p>
            )}
            <div>
              <h4>Contactos</h4>
              {profile.emergencyContacts.length === 0 ? (
                <p>Sin contactos</p>
              ) : (
                <ul>
                  {profile.emergencyContacts.map((contact) => (
                    <li key={contact.id}>
                      {contact.name} ({contact.relationship || 'sin relacion'}) - {contact.phone}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
