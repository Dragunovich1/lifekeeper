import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { PawPrint, Plus } from 'lucide-react'
import { SectionHeader } from '../../../components/SectionHeader'
import { useAppData } from '../../../hooks/useAppData'
import { usePreferences } from '../../../preferences/context'
import type { Pet } from '../../../types'
import { exportPetPdf } from '../../../utils/petPdfExport'
import { allPetAlerts, expenseTotals, newPet, petAge, petAlerts, speciesInfo, weightSummary } from '../../../utils/pets'
import { PetAvatar } from './PetAvatar'
import { PetDetail } from './PetDetail'
import { PetFormModal } from './PetFormModal'
import '../../../styles/pets.css'

/** Mascotas: una ficha detallada por cada una (datos, foto, salud, peso, medicación, turnos y gastos). */
export const PetsSection = () => {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const pets = useMemo(() => data.personal.pets ?? [], [data.personal.pets])
  const ownerName = data.profile.fullName || data.profile.nickName
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; pet: Pet | null }>({ open: false, pet: null })
  const selected = pets.find((p) => p.id === selectedId) ?? null
  const alerts = useMemo(() => allPetAlerts(pets), [pets])

  const setPets = (fn: (list: Pet[]) => Pet[]) => updateData((prev) => ({ ...prev, personal: { ...prev.personal, pets: fn(prev.personal.pets ?? []) } }))
  const replace = (p: Pet) => setPets((list) => list.map((x) => (x.id === p.id ? p : x)))

  const save = (fields: Parameters<React.ComponentProps<typeof PetFormModal>['onSave']>[0]) => {
    const now = new Date().toISOString()
    if (form.pet) {
      replace({ ...form.pet, ...fields, updatedAt: now })
    } else {
      const created: Pet = { ...newPet(fields.name, fields.species, uuid), ...fields, updatedAt: now }
      setPets((list) => [...list, created])
      setSelectedId(created.id) // al crearla se abre su ficha
    }
    setForm({ open: false, pet: null })
  }

  if (selected) {
    return (
      <div>
        <SectionHeader title={selected.name} subtitle="Ficha de tu mascota" />
        <div className="section-body">
          <PetDetail
            pet={selected}
            onChange={replace}
            onBack={() => setSelectedId(null)}
            onEdit={() => setForm({ open: true, pet: selected })}
            onDelete={() => { setPets((list) => list.filter((p) => p.id !== selected.id)); setSelectedId(null) }}
            onPdf={() => void exportPetPdf(selected, { ownerName, currency: preferences.currency })}
          />
        </div>
        <PetFormModal open={form.open} pet={form.pet} onClose={() => setForm({ open: false, pet: null })} onSave={save} />
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title="Mascotas" subtitle="Una ficha completa por cada mascota: foto, salud, vacunas, peso, medicación, turnos y gastos" />
      <div className="section-body">
        <div className="wk-toolbar">
          <p className="wk-toolbar-text">
            {pets.length === 0 ? 'Todavía no cargaste mascotas.' : `${pets.length} mascota${pets.length === 1 ? '' : 's'}${alerts.length ? ` · ${alerts.length} aviso${alerts.length === 1 ? '' : 's'} pendiente${alerts.length === 1 ? '' : 's'}` : ' · todo al día'}`}
          </p>
          <button type="button" className="primary-button" onClick={() => setForm({ open: true, pet: null })}><Plus size={16} aria-hidden /> Nueva mascota</button>
        </div>

        {pets.length === 0 ? (
          <div className="empty-state wk-empty">
            <PawPrint size={44} aria-hidden />
            <h4>Sumá a tu primera mascota</h4>
            <p>Cargá su foto y sus datos, y llevá el control de vacunas, peso, medicación, turnos y gastos. Te avisamos cuando se acerca un vencimiento.</p>
            <button type="button" className="primary-button" onClick={() => setForm({ open: true, pet: null })}><Plus size={16} aria-hidden /> Agregar mascota</button>
          </div>
        ) : (
          <div className="pet-grid">
            {pets.map((p) => {
              const a = petAlerts(p)
              const w = weightSummary(p.weights)
              const age = petAge(p)
              const worst = a[0]
              const totals = expenseTotals(p.expenses)
              return (
                <button key={p.id} type="button" className={`pet-card${p.deceasedDate ? ' is-deceased' : ''}`} onClick={() => setSelectedId(p.id)} aria-label={`Abrir la ficha de ${p.name}`}>
                  <PetAvatar pet={p} size={72} />
                  <div className="pet-card-main">
                    <strong>{p.name}</strong>
                    <small>{[p.speciesDetail || speciesInfo(p.species).label, p.breed].filter(Boolean).join(' · ')}</small>
                    <small>{p.deceasedDate ? '🕊️ En el recuerdo' : [age, w ? `${w.last.kg} kg` : ''].filter(Boolean).join(' · ')}</small>
                    {worst ? <span className={`pet-pill is-${worst.status}`}>{worst.title} · {worst.label}</span> : p.deceasedDate ? null : <span className="pet-pill is-ok">Al día</span>}
                    {totals.thisYear > 0 ? <small>Gastos {new Date().getFullYear()}: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: preferences.currency, maximumFractionDigits: 0 }).format(totals.thisYear)}</small> : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <PetFormModal open={form.open} pet={form.pet} onClose={() => setForm({ open: false, pet: null })} onSave={save} />
    </div>
  )
}
