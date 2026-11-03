import { useEffect, useState } from 'react'
import { DatePicker } from '../../../components/DatePicker'
import { FormModal } from '../../../components/FormModal'
import { Select } from '../../../components/Select'
import type { Pet, PetAppointment, PetExpense, PetExpenseCategory, PetHealthKind, PetHealthRecord, PetMedication, PetWeightEntry } from '../../../types'
import { EXPENSE_CATEGORIES, HEALTH_KINDS, healthSuggestions, todayKey } from '../../../utils/pets'

const num = (v: string) => (v === '' ? '' : Number(v))

interface Base<T> {
  open: boolean
  item: T | null
  onClose: () => void
  onSave: (item: T) => void
  newId: () => string
}

/* ---------- Salud: vacunas, desparasitaciones, controles… ---------- */
export function HealthRecordModal({ open, item, onClose, onSave, newId, pet, defaultKind }: Base<PetHealthRecord> & { pet: Pet; defaultKind: PetHealthKind }) {
  const [kind, setKind] = useState<PetHealthKind>(defaultKind)
  const [name, setName] = useState('')
  const [date, setDate] = useState(todayKey())
  const [nextDate, setNextDate] = useState('')
  const [vet, setVet] = useState('')
  const [lot, setLot] = useState('')
  const [cost, setCost] = useState<number | ''>('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setKind(item?.kind ?? defaultKind)
    setName(item?.name ?? '')
    setDate(item?.date.slice(0, 10) ?? todayKey())
    setNextDate(item?.nextDate?.slice(0, 10) ?? '')
    setVet(item?.vet ?? pet.vet?.name ?? '')
    setLot(item?.lot ?? '')
    setCost(item?.cost ?? '')
    setNotes(item?.notes ?? '')
  }, [open, item, defaultKind, pet.vet?.name])

  const suggestions = healthSuggestions(kind, pet.species)
  const showNext = kind === 'vacuna' || kind === 'desparasitacion' || kind === 'antipulgas' || kind === 'control' || kind === 'tratamiento'

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={item ? 'Editar registro de salud' : 'Nuevo registro de salud'}
      subtitle={`Para ${pet.name}`}
      submitLabel={item ? 'Guardar cambios' : 'Guardar'}
      canSubmit={Boolean(name.trim() && date)}
      onSubmit={() =>
        onSave({ id: item?.id ?? newId(), kind, name: name.trim(), date, nextDate: nextDate || undefined, vet: vet.trim() || undefined, lot: lot.trim() || undefined, cost: typeof cost === 'number' ? cost : undefined, notes: notes.trim() || undefined })
      }
    >
      <div className="fm-grid">
        <div className="field">
          <label htmlFor="hr-kind">Tipo</label>
          <Select id="hr-kind" value={kind} onChange={(v) => setKind(v as PetHealthKind)} options={HEALTH_KINDS.map((k) => ({ value: k.value, label: `${k.emoji} ${k.label}` }))} ariaLabel="Tipo de registro" />
        </div>
        <div className="field">
          <label htmlFor="hr-name">Nombre *</label>
          <input id="hr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'vacuna' ? 'Ej. Antirrábica' : 'Ej. Control anual'} autoComplete="off" required />
        </div>
        {suggestions.length > 0 ? (
          <div className="fm-chips fm-span-2" aria-label="Sugerencias">
            {suggestions.map((s) => <button key={s} type="button" className={`fm-chip${name === s ? ' is-on' : ''}`} onClick={() => setName(s)}>{s}</button>)}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="hr-date">Fecha</label>
          <DatePicker id="hr-date" value={date} onChange={setDate} allowClear={false} ariaLabel="Fecha del registro" />
        </div>
        {showNext ? (
          <div className="field">
            <label htmlFor="hr-next">Próxima dosis o control</label>
            <DatePicker id="hr-next" value={nextDate} onChange={setNextDate} ariaLabel="Próxima fecha" />
          </div>
        ) : null}
        <div className="field"><label htmlFor="hr-vet">Veterinario</label><input id="hr-vet" value={vet} onChange={(e) => setVet(e.target.value)} placeholder="Quién lo aplicó" /></div>
        <div className="field"><label htmlFor="hr-lot">Lote / marca</label><input id="hr-lot" value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Opcional" /></div>
        <div className="field"><label htmlFor="hr-cost">Costo</label><input id="hr-cost" type="number" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(e) => setCost(num(e.target.value) as number | '')} placeholder="0" /></div>
        <div className="field fm-span-2"><label htmlFor="hr-notes">Notas</label><textarea id="hr-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reacciones, indicaciones, resultados…" /></div>
      </div>
    </FormModal>
  )
}

/* ---------- Peso ---------- */
export function WeightModal({ open, item, onClose, onSave, newId, petName }: Base<PetWeightEntry> & { petName: string }) {
  const [date, setDate] = useState(todayKey())
  const [kg, setKg] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  useEffect(() => {
    if (!open) return
    setDate(item?.date.slice(0, 10) ?? todayKey())
    setKg(item?.kg ?? '')
    setNotes(item?.notes ?? '')
  }, [open, item])
  return (
    <FormModal open={open} onClose={onClose} title={item ? 'Editar pesada' : 'Registrar peso'} subtitle={`Para ${petName}`} maxWidth={480} canSubmit={typeof kg === 'number' && kg > 0 && Boolean(date)} onSubmit={() => typeof kg === 'number' && onSave({ id: item?.id ?? newId(), date, kg, notes: notes.trim() || undefined })}>
      <div className="fm-grid">
        <div className="field"><label htmlFor="w-date">Fecha</label><DatePicker id="w-date" value={date} onChange={setDate} allowClear={false} ariaLabel="Fecha de la pesada" /></div>
        <div className="field"><label htmlFor="w-kg">Peso (kg) *</label><input id="w-kg" type="number" min="0" step="0.01" inputMode="decimal" value={kg} onChange={(e) => setKg(num(e.target.value) as number | '')} placeholder="Ej. 12.4" autoFocus /></div>
        <div className="field fm-span-2"><label htmlFor="w-notes">Notas</label><input id="w-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Después del control, en ayunas" /></div>
      </div>
    </FormModal>
  )
}

/* ---------- Medicación ---------- */
export function MedicationModal({ open, item, onClose, onSave, newId, petName }: Base<PetMedication> & { petName: string }) {
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [frequency, setFrequency] = useState('')
  const [startDate, setStartDate] = useState(todayKey())
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setDose(item?.dose ?? '')
    setFrequency(item?.frequency ?? '')
    setStartDate(item?.startDate.slice(0, 10) ?? todayKey())
    setEndDate(item?.endDate?.slice(0, 10) ?? '')
    setNotes(item?.notes ?? '')
  }, [open, item])
  return (
    <FormModal open={open} onClose={onClose} title={item ? 'Editar medicación' : 'Nueva medicación'} subtitle={`Para ${petName}`} maxWidth={560} canSubmit={Boolean(name.trim() && startDate)} onSubmit={() => onSave({ id: item?.id ?? newId(), name: name.trim(), dose: dose.trim() || undefined, frequency: frequency.trim() || undefined, startDate, endDate: endDate || undefined, notes: notes.trim() || undefined })}>
      <div className="fm-grid">
        <div className="field fm-span-2"><label htmlFor="m-name">Medicamento *</label><input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Meloxicam" autoComplete="off" required /></div>
        <div className="field"><label htmlFor="m-dose">Dosis</label><input id="m-dose" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Ej. 1 comprimido, 2 ml" /></div>
        <div className="field"><label htmlFor="m-freq">Frecuencia</label><input id="m-freq" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Ej. Cada 12 horas" /></div>
        <div className="field"><label htmlFor="m-start">Desde</label><DatePicker id="m-start" value={startDate} onChange={setStartDate} allowClear={false} ariaLabel="Inicio" /></div>
        <div className="field"><label htmlFor="m-end">Hasta (si es por tiempo limitado)</label><DatePicker id="m-end" value={endDate} onChange={setEndDate} ariaLabel="Fin" /></div>
        <div className="field fm-span-2"><label htmlFor="m-notes">Notas</label><input id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Con comida, indicación del veterinario…" /></div>
      </div>
    </FormModal>
  )
}

/* ---------- Turnos ---------- */
export function AppointmentModal({ open, item, onClose, onSave, newId, pet }: Base<PetAppointment> & { pet: Pet }) {
  const [date, setDate] = useState(todayKey())
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [vet, setVet] = useState('')
  const [place, setPlace] = useState('')
  const [cost, setCost] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  useEffect(() => {
    if (!open) return
    setDate(item?.date.slice(0, 10) ?? todayKey())
    setTime(item?.time ?? '')
    setReason(item?.reason ?? '')
    setVet(item?.vet ?? pet.vet?.name ?? '')
    setPlace(item?.place ?? pet.vet?.clinic ?? '')
    setCost(item?.cost ?? '')
    setNotes(item?.notes ?? '')
  }, [open, item, pet.vet?.name, pet.vet?.clinic])
  return (
    <FormModal open={open} onClose={onClose} title={item ? 'Editar turno' : 'Nuevo turno'} subtitle={`Para ${pet.name}`} maxWidth={560} canSubmit={Boolean(reason.trim() && date)} onSubmit={() => onSave({ id: item?.id ?? newId(), date, time: time || undefined, reason: reason.trim(), vet: vet.trim() || undefined, place: place.trim() || undefined, done: item?.done, cost: typeof cost === 'number' ? cost : undefined, notes: notes.trim() || undefined })}>
      <div className="fm-grid">
        <div className="field fm-span-2"><label htmlFor="a-reason">Motivo *</label><input id="a-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Control anual, castración, peluquería" autoComplete="off" required /></div>
        <div className="field"><label htmlFor="a-date">Fecha</label><DatePicker id="a-date" value={date} onChange={setDate} allowClear={false} ariaLabel="Fecha del turno" /></div>
        <div className="field"><label htmlFor="a-time">Hora</label><input id="a-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div className="field"><label htmlFor="a-vet">Profesional</label><input id="a-vet" value={vet} onChange={(e) => setVet(e.target.value)} placeholder="Veterinario" /></div>
        <div className="field"><label htmlFor="a-place">Lugar</label><input id="a-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Clínica o dirección" /></div>
        <div className="field"><label htmlFor="a-cost">Costo estimado</label><input id="a-cost" type="number" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(e) => setCost(num(e.target.value) as number | '')} placeholder="0" /></div>
        <div className="field fm-span-2"><label htmlFor="a-notes">Notas</label><input id="a-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ayuno, qué llevar…" /></div>
      </div>
    </FormModal>
  )
}

/* ---------- Gastos ---------- */
export function ExpenseModal({ open, item, onClose, onSave, newId, petName }: Base<PetExpense> & { petName: string }) {
  const [date, setDate] = useState(todayKey())
  const [category, setCategory] = useState<PetExpenseCategory>('alimento')
  const [amount, setAmount] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  useEffect(() => {
    if (!open) return
    setDate(item?.date.slice(0, 10) ?? todayKey())
    setCategory(item?.category ?? 'alimento')
    setAmount(item?.amount ?? '')
    setDescription(item?.description ?? '')
  }, [open, item])
  return (
    <FormModal open={open} onClose={onClose} title={item ? 'Editar gasto' : 'Nuevo gasto'} subtitle={`Para ${petName}`} maxWidth={480} canSubmit={typeof amount === 'number' && amount > 0 && Boolean(date)} onSubmit={() => typeof amount === 'number' && onSave({ id: item?.id ?? newId(), date, category, amount, description: description.trim() || undefined })}>
      <div className="fm-grid">
        <div className="field"><label htmlFor="e-date">Fecha</label><DatePicker id="e-date" value={date} onChange={setDate} allowClear={false} ariaLabel="Fecha del gasto" /></div>
        <div className="field"><label htmlFor="e-cat">Categoría</label><Select id="e-cat" value={category} onChange={(v) => setCategory(v as PetExpenseCategory)} options={EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: `${c.emoji} ${c.label}` }))} ariaLabel="Categoría" /></div>
        <div className="field"><label htmlFor="e-amount">Monto *</label><input id="e-amount" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(num(e.target.value) as number | '')} placeholder="0" autoFocus /></div>
        <div className="field"><label htmlFor="e-desc">Detalle</label><input id="e-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Bolsa de 15 kg" /></div>
      </div>
    </FormModal>
  )
}
