import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { DatePicker } from '../../../components/DatePicker'
import { FormModal } from '../../../components/FormModal'
import { Select } from '../../../components/Select'
import type { Pet, PetSex, PetSpecies } from '../../../types'
import { fileToResizedDataUrl } from '../../../utils/image'
import { SPECIES, speciesInfo } from '../../../utils/pets'

interface Props {
  open: boolean
  /** null = mascota nueva. */
  pet: Pet | null
  onClose: () => void
  onSave: (data: Omit<Pet, 'id' | 'health' | 'weights' | 'medications' | 'appointments' | 'expenses' | 'createdAt' | 'updatedAt'>) => void
}

type Form = {
  name: string
  species: PetSpecies
  speciesDetail: string
  breed: string
  sex: PetSex
  neutered: boolean
  birthDate: string
  adoptionDate: string
  color: string
  photo: string
  microchip: string
  registration: string
  temperament: string
  allergies: string
  conditions: string
  vetName: string
  vetClinic: string
  vetPhone: string
  vetAddress: string
  insCompany: string
  insPolicy: string
  insPhone: string
  insValidUntil: string
  dietFood: string
  dietBrand: string
  dietPortion: string
  dietMeals: number | ''
  dietNotes: string
  notes: string
  deceasedDate: string
}

const blank = (): Form => ({
  name: '', species: 'perro', speciesDetail: '', breed: '', sex: 'desconocido', neutered: false, birthDate: '', adoptionDate: '', color: '', photo: '', microchip: '', registration: '',
  temperament: '', allergies: '', conditions: '', vetName: '', vetClinic: '', vetPhone: '', vetAddress: '', insCompany: '', insPolicy: '', insPhone: '', insValidUntil: '',
  dietFood: '', dietBrand: '', dietPortion: '', dietMeals: '', dietNotes: '', notes: '', deceasedDate: '',
})

const fromPet = (p: Pet): Form => ({
  name: p.name, species: p.species, speciesDetail: p.speciesDetail ?? '', breed: p.breed ?? '', sex: p.sex ?? 'desconocido', neutered: Boolean(p.neutered), birthDate: p.birthDate ?? '',
  adoptionDate: p.adoptionDate ?? '', color: p.color ?? '', photo: p.photo ?? '', microchip: p.microchip ?? '', registration: p.registration ?? '', temperament: p.temperament ?? '',
  allergies: p.allergies ?? '', conditions: p.conditions ?? '', vetName: p.vet?.name ?? '', vetClinic: p.vet?.clinic ?? '', vetPhone: p.vet?.phone ?? '', vetAddress: p.vet?.address ?? '',
  insCompany: p.insurance?.company ?? '', insPolicy: p.insurance?.policy ?? '', insPhone: p.insurance?.phone ?? '', insValidUntil: p.insurance?.validUntil ?? '',
  dietFood: p.diet?.food ?? '', dietBrand: p.diet?.brand ?? '', dietPortion: p.diet?.portion ?? '', dietMeals: p.diet?.mealsPerDay ?? '', dietNotes: p.diet?.notes ?? '',
  notes: p.notes ?? '', deceasedDate: p.deceasedDate ?? '',
})

const t = (s: string) => s.trim() || undefined

/** Foto de la mascota: se elige de la galería/cámara y se reduce para no inflar la bóveda. */
export function PhotoPicker({ value, onChange, species, label = 'Foto' }: { value: string; onChange: (v: string) => void; species: PetSpecies; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange(await fileToResizedDataUrl(file, 640, 0.82))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la foto.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="pet-photo-picker">
      <button type="button" className="pet-photo-btn" onClick={() => input.current?.click()} aria-label={value ? 'Cambiar la foto' : 'Elegir una foto'} data-no-dirty>
        {value ? <img src={value} alt="Foto de la mascota" /> : <span className="pet-photo-empty" aria-hidden>{speciesInfo(species).emoji}</span>}
        <span className="pet-photo-cam" aria-hidden><Camera size={15} /></span>
      </button>
      <div className="pet-photo-side">
        <strong>{label}</strong>
        <small>{busy ? 'Procesando…' : value ? 'Tocá la foto para cambiarla' : 'Tocá el círculo para elegir una foto'}</small>
        {value ? (
          <button type="button" className="secondary-button wk-small pet-photo-remove" onClick={() => onChange('')}><Trash2 size={13} aria-hidden /> Quitar</button>
        ) : null}
        {error ? <small className="auth-error" role="alert">{error}</small> : null}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

const SEXES: { value: PetSex; label: string }[] = [
  { value: 'macho', label: 'Macho' },
  { value: 'hembra', label: 'Hembra' },
  { value: 'desconocido', label: 'No sé / no aplica' },
]

/** Alta y edición de una mascota: todo en un modal, ordenado por secciones. */
export function PetFormModal({ open, pet, onClose, onSave }: Props) {
  const [f, setF] = useState<Form>(blank)
  useEffect(() => {
    if (open) setF(pet ? fromPet(pet) : blank())
  }, [open, pet])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }))
  const hasVet = f.vetName || f.vetClinic || f.vetPhone || f.vetAddress
  const hasIns = f.insCompany || f.insPolicy || f.insPhone || f.insValidUntil
  const hasDiet = f.dietFood || f.dietBrand || f.dietPortion || f.dietMeals || f.dietNotes

  const submit = () => {
    onSave({
      name: f.name.trim(),
      species: f.species,
      speciesDetail: t(f.speciesDetail),
      breed: t(f.breed),
      sex: f.sex,
      neutered: f.neutered || undefined,
      birthDate: f.birthDate || undefined,
      adoptionDate: f.adoptionDate || undefined,
      color: t(f.color),
      photo: f.photo || undefined,
      microchip: t(f.microchip),
      registration: t(f.registration),
      temperament: t(f.temperament),
      allergies: t(f.allergies),
      conditions: t(f.conditions),
      vet: hasVet ? { name: t(f.vetName), clinic: t(f.vetClinic), phone: t(f.vetPhone), address: t(f.vetAddress) } : undefined,
      insurance: hasIns ? { company: t(f.insCompany), policy: t(f.insPolicy), phone: t(f.insPhone), validUntil: f.insValidUntil || undefined } : undefined,
      diet: hasDiet ? { food: t(f.dietFood), brand: t(f.dietBrand), portion: t(f.dietPortion), mealsPerDay: typeof f.dietMeals === 'number' ? f.dietMeals : undefined, notes: t(f.dietNotes) } : undefined,
      notes: t(f.notes),
      deceasedDate: f.deceasedDate || undefined,
    })
  }

  return (
    <FormModal open={open} onClose={onClose} title={pet ? `Editar a ${pet.name}` : 'Nueva mascota'} subtitle={pet ? 'Actualizá sus datos' : 'Cargá los datos principales; el resto lo podés completar después'} submitLabel={pet ? 'Guardar cambios' : 'Agregar mascota'} canSubmit={Boolean(f.name.trim())} onSubmit={submit} maxWidth={760}>
      <section className="fm-section">
        <PhotoPicker value={f.photo} onChange={(v) => set('photo', v)} species={f.species} />
        <div className="fm-grid">
          <div className="field">
            <label htmlFor="pf-name">Nombre *</label>
            <input id="pf-name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Luna" autoComplete="off" required />
          </div>
          <div className="field">
            <label htmlFor="pf-species">Especie</label>
            <Select id="pf-species" value={f.species} onChange={(v) => set('species', v as PetSpecies)} options={SPECIES.map((s) => ({ value: s.value, label: `${s.emoji} ${s.label}` }))} ariaLabel="Especie" />
          </div>
          {f.species === 'otro' || f.species === 'roedor' || f.species === 'reptil' || f.species === 'ave' || f.species === 'pez' ? (
            <div className="field">
              <label htmlFor="pf-species-detail">¿Cuál? (opcional)</label>
              <input id="pf-species-detail" value={f.speciesDetail} onChange={(e) => set('speciesDetail', e.target.value)} placeholder="Ej. Cobayo, cotorra, tortuga" />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="pf-breed">Raza</label>
            <input id="pf-breed" value={f.breed} onChange={(e) => set('breed', e.target.value)} placeholder="Ej. Labrador, mestizo, siamés" />
          </div>
          <div className="field">
            <label htmlFor="pf-sex">Sexo</label>
            <Select id="pf-sex" value={f.sex} onChange={(v) => set('sex', v as PetSex)} options={SEXES} ariaLabel="Sexo" />
          </div>
          <div className="field">
            <label htmlFor="pf-color">Color / señas</label>
            <input id="pf-color" value={f.color} onChange={(e) => set('color', e.target.value)} placeholder="Ej. Negro con pecho blanco" />
          </div>
          <div className="field">
            <label htmlFor="pf-birth">Fecha de nacimiento</label>
            <DatePicker id="pf-birth" value={f.birthDate} onChange={(v) => set('birthDate', v)} ariaLabel="Fecha de nacimiento" />
          </div>
          <div className="field">
            <label htmlFor="pf-adopt">Fecha de adopción</label>
            <DatePicker id="pf-adopt" value={f.adoptionDate} onChange={(v) => set('adoptionDate', v)} ariaLabel="Fecha de adopción" />
          </div>
          <label className="wk-check fm-span-2"><input type="checkbox" checked={f.neutered} onChange={(e) => set('neutered', e.target.checked)} /> Castrado / esterilizado</label>
        </div>
      </section>

      <section className="fm-section">
        <h4>Identificación</h4>
        <div className="fm-grid">
          <div className="field"><label htmlFor="pf-chip">Microchip</label><input id="pf-chip" value={f.microchip} onChange={(e) => set('microchip', e.target.value)} placeholder="Número de microchip" inputMode="numeric" /></div>
          <div className="field"><label htmlFor="pf-reg">Registro / patente</label><input id="pf-reg" value={f.registration} onChange={(e) => set('registration', e.target.value)} placeholder="Nº de registro municipal" /></div>
        </div>
      </section>

      <section className="fm-section">
        <h4>Salud y carácter</h4>
        <div className="fm-grid">
          <div className="field fm-span-2"><label htmlFor="pf-allergies">Alergias</label><input id="pf-allergies" value={f.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Alimentos, medicamentos, picaduras…" /></div>
          <div className="field fm-span-2"><label htmlFor="pf-cond">Condiciones o enfermedades crónicas</label><input id="pf-cond" value={f.conditions} onChange={(e) => set('conditions', e.target.value)} placeholder="Ej. Displasia de cadera, soplo cardíaco" /></div>
          <div className="field fm-span-2"><label htmlFor="pf-temp">Carácter</label><input id="pf-temp" value={f.temperament} onChange={(e) => set('temperament', e.target.value)} placeholder="Ej. Tímida con extraños, juguetona, no tolera otros perros" /></div>
        </div>
      </section>

      <section className="fm-section">
        <h4>Veterinario</h4>
        <div className="fm-grid">
          <div className="field"><label htmlFor="pf-vet">Profesional</label><input id="pf-vet" value={f.vetName} onChange={(e) => set('vetName', e.target.value)} placeholder="Nombre del veterinario" /></div>
          <div className="field"><label htmlFor="pf-clinic">Clínica</label><input id="pf-clinic" value={f.vetClinic} onChange={(e) => set('vetClinic', e.target.value)} placeholder="Nombre de la veterinaria" /></div>
          <div className="field"><label htmlFor="pf-vphone">Teléfono</label><input id="pf-vphone" type="tel" value={f.vetPhone} onChange={(e) => set('vetPhone', e.target.value)} placeholder="Teléfono o WhatsApp" /></div>
          <div className="field"><label htmlFor="pf-vaddr">Dirección</label><input id="pf-vaddr" value={f.vetAddress} onChange={(e) => set('vetAddress', e.target.value)} placeholder="Dirección" /></div>
        </div>
      </section>

      <section className="fm-section">
        <h4>Alimentación</h4>
        <div className="fm-grid">
          <div className="field"><label htmlFor="pf-food">Alimento</label><input id="pf-food" value={f.dietFood} onChange={(e) => set('dietFood', e.target.value)} placeholder="Ej. Balanceado adulto razas medianas" /></div>
          <div className="field"><label htmlFor="pf-brand">Marca</label><input id="pf-brand" value={f.dietBrand} onChange={(e) => set('dietBrand', e.target.value)} placeholder="Marca" /></div>
          <div className="field"><label htmlFor="pf-portion">Porción</label><input id="pf-portion" value={f.dietPortion} onChange={(e) => set('dietPortion', e.target.value)} placeholder="Ej. 250 g por comida" /></div>
          <div className="field"><label htmlFor="pf-meals">Comidas por día</label><input id="pf-meals" type="number" min="1" max="12" inputMode="numeric" value={f.dietMeals} onChange={(e) => set('dietMeals', e.target.value === '' ? '' : Number(e.target.value))} placeholder="2" /></div>
          <div className="field fm-span-2"><label htmlFor="pf-dietn">Notas de alimentación</label><input id="pf-dietn" value={f.dietNotes} onChange={(e) => set('dietNotes', e.target.value)} placeholder="Premios, restricciones, suplementos…" /></div>
        </div>
      </section>

      <section className="fm-section">
        <h4>Seguro o plan</h4>
        <div className="fm-grid">
          <div className="field"><label htmlFor="pf-ins">Compañía</label><input id="pf-ins" value={f.insCompany} onChange={(e) => set('insCompany', e.target.value)} placeholder="Nombre del seguro o plan" /></div>
          <div className="field"><label htmlFor="pf-pol">Nº de póliza</label><input id="pf-pol" value={f.insPolicy} onChange={(e) => set('insPolicy', e.target.value)} placeholder="Póliza o afiliado" /></div>
          <div className="field"><label htmlFor="pf-insp">Teléfono</label><input id="pf-insp" type="tel" value={f.insPhone} onChange={(e) => set('insPhone', e.target.value)} placeholder="Teléfono de contacto" /></div>
          <div className="field"><label htmlFor="pf-insv">Vigente hasta</label><DatePicker id="pf-insv" value={f.insValidUntil} onChange={(v) => set('insValidUntil', v)} ariaLabel="Vigencia del seguro" /></div>
        </div>
      </section>

      <section className="fm-section">
        <h4>Otras notas</h4>
        <div className="fm-grid">
          <div className="field fm-span-2"><label htmlFor="pf-notes">Notas</label><textarea id="pf-notes" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Cualquier dato que quieras recordar" /></div>
          {pet ? (
            <div className="field">
              <label htmlFor="pf-dec">Fecha de fallecimiento</label>
              <DatePicker id="pf-dec" value={f.deceasedDate} onChange={(v) => set('deceasedDate', v)} ariaLabel="Fecha de fallecimiento" />
              <small className="fm-hint">Si la cargás, queda como recuerdo y deja de generar avisos.</small>
            </div>
          ) : null}
        </div>
      </section>
    </FormModal>
  )
}
