import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ArrowLeft, Check, FileText, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { TrendChart } from '../../../components/TrendChart'
import { usePreferences } from '../../../preferences/context'
import type { Pet, PetAppointment, PetExpense, PetHealthKind, PetHealthRecord, PetMedication, PetWeightEntry } from '../../../types'
import { formatCurrency, formatDate } from '../../../utils/dates'
import {
  EXPENSE_CATEGORIES,
  HEALTH_KINDS,
  activeMedications,
  daysUntil,
  dueStatus,
  expenseInfo,
  expenseTotals,
  kindInfo,
  latestByName,
  petAge,
  petAlerts,
  sortedWeights,
  speciesInfo,
  weightSummary,
} from '../../../utils/pets'
import { AppointmentModal, ExpenseModal, HealthRecordModal, MedicationModal, WeightModal } from './RecordModals'
import { PetAvatar } from './PetAvatar'

type Tab = 'resumen' | 'salud' | 'peso' | 'medicacion' | 'turnos' | 'gastos'

interface Props {
  pet: Pet
  onChange: (pet: Pet) => void
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onPdf: () => void
}

const Row = ({ label, value }: { label: string; value?: string | number | null }) => (value ? <div className="pet-row"><span>{label}</span><strong>{value}</strong></div> : null)

/** Ficha de una mascota: resumen y seis solapas. Cada "agregar" abre su modal. */
export function PetDetail({ pet, onChange, onBack, onEdit, onDelete, onPdf }: Props) {
  const { preferences } = usePreferences()
  const money = (n: number) => formatCurrency(n, preferences.currency)
  const [tab, setTab] = useState<Tab>('resumen')
  const [healthFilter, setHealthFilter] = useState<PetHealthKind | 'all'>('all')

  const [health, setHealth] = useState<{ open: boolean; item: PetHealthRecord | null; kind: PetHealthKind }>({ open: false, item: null, kind: 'vacuna' })
  const [weight, setWeight] = useState<{ open: boolean; item: PetWeightEntry | null }>({ open: false, item: null })
  const [med, setMed] = useState<{ open: boolean; item: PetMedication | null }>({ open: false, item: null })
  const [appt, setAppt] = useState<{ open: boolean; item: PetAppointment | null }>({ open: false, item: null })
  const [exp, setExp] = useState<{ open: boolean; item: PetExpense | null }>({ open: false, item: null })
  const [removing, setRemoving] = useState<{ label: string; run: () => void } | null>(null)
  const [confirmPet, setConfirmPet] = useState(false)

  const touch = (patch: Partial<Pet>) => onChange({ ...pet, ...patch, updatedAt: new Date().toISOString() })
  const upsert = <T extends { id: string }>(list: T[], item: T) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item])

  const alerts = useMemo(() => petAlerts(pet), [pet])
  const weights = useMemo(() => sortedWeights(pet.weights), [pet.weights])
  const wSum = weightSummary(pet.weights)
  const totals = expenseTotals(pet.expenses)
  const meds = activeMedications(pet)
  const age = petAge(pet)
  const sp = speciesInfo(pet.species)
  const deceased = Boolean(pet.deceasedDate)

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'salud', label: 'Salud', count: pet.health.length },
    { key: 'peso', label: 'Peso', count: pet.weights.length },
    { key: 'medicacion', label: 'Medicación', count: meds.length },
    { key: 'turnos', label: 'Turnos', count: pet.appointments.filter((a) => !a.done).length },
    { key: 'gastos', label: 'Gastos', count: pet.expenses.length },
  ]

  const healthList = [...pet.health].filter((h) => healthFilter === 'all' || h.kind === healthFilter).sort((a, b) => b.date.localeCompare(a.date))
  const latestIds = new Set(latestByName(pet.health).map((r) => r.id))

  return (
    <div className="pet-detail">
      <div className="pet-detail-top">
        <button type="button" className="secondary-button wk-small" onClick={onBack}><ArrowLeft size={14} aria-hidden /> Mis mascotas</button>
      </div>

      <header className={`pet-hero${deceased ? ' is-deceased' : ''}`}>
        <PetAvatar pet={pet} size={96} />
        <div className="pet-hero-main">
          <h3>{pet.name}{deceased ? <span className="wk-chip">🕊️ En el recuerdo</span> : null}</h3>
          <p>{[pet.speciesDetail || sp.label, pet.breed, pet.sex && pet.sex !== 'desconocido' ? (pet.sex === 'macho' ? 'Macho' : 'Hembra') : '', pet.neutered ? 'castrado/a' : '', age ? (deceased ? `vivió ${age}` : age) : ''].filter(Boolean).join(' · ')}</p>
          <div className="pet-hero-actions">
            <button type="button" className="secondary-button wk-small" onClick={onEdit}><Pencil size={13} aria-hidden /> Editar</button>
            <button type="button" className="secondary-button wk-small" onClick={onPdf}><FileText size={13} aria-hidden /> Ficha PDF</button>
            <button type="button" className="secondary-button wk-small wk-danger" onClick={() => setConfirmPet(true)}><Trash2 size={13} aria-hidden /> Eliminar</button>
          </div>
        </div>
      </header>

      <div className="wk-tabs" role="tablist" aria-label="Secciones de la ficha">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`wk-tab${tab === t.key ? ' is-active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}{t.count ? <span className="wk-tab-count">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {/* ---------- Resumen ---------- */}
      {tab === 'resumen' ? (
        <div className="pet-summary">
          {alerts.length > 0 ? (
            <section className="panel pet-alerts" aria-label="Avisos">
              <h4 className="panel-title">Para atender</h4>
              <ul>
                {alerts.map((a, i) => (
                  <li key={`${a.recordId ?? a.kind}-${i}`} className={`is-${a.status}`}>
                    <div><strong>{a.title}</strong><small>{formatDate(a.date)}</small></div>
                    <span className={`pet-pill is-${a.status}`}>{a.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            !deceased && <p className="pet-ok">✅ Todo al día: no hay vencimientos próximos.</p>
          )}

          <div className="pet-cards">
            <section className="panel">
              <h4 className="panel-title">Datos</h4>
              <Row label="Nacimiento" value={pet.birthDate ? formatDate(pet.birthDate) : ''} />
              <Row label="Adopción" value={pet.adoptionDate ? formatDate(pet.adoptionDate) : ''} />
              <Row label="Color / señas" value={pet.color} />
              <Row label="Microchip" value={pet.microchip} />
              <Row label="Registro" value={pet.registration} />
              <Row label="Carácter" value={pet.temperament} />
              {pet.deceasedDate ? <Row label="Falleció" value={formatDate(pet.deceasedDate)} /> : null}
              {!pet.birthDate && !pet.color && !pet.microchip && !pet.registration && !pet.temperament ? <p className="wk-items-empty">Sin datos cargados. Usá “Editar” para completar la ficha.</p> : null}
            </section>

            <section className="panel">
              <h4 className="panel-title">Salud</h4>
              <Row label="Alergias" value={pet.allergies} />
              <Row label="Condiciones" value={pet.conditions} />
              <Row label="Último peso" value={wSum ? `${wSum.last.kg} kg (${formatDate(wSum.last.date)})` : ''} />
              <Row label="Medicación en curso" value={meds.length ? meds.map((m) => m.name).join(', ') : ''} />
              {!pet.allergies && !pet.conditions && !wSum && meds.length === 0 ? <p className="wk-items-empty">Sin datos de salud todavía.</p> : null}
            </section>

            <section className="panel">
              <h4 className="panel-title">Veterinario</h4>
              <Row label="Profesional" value={pet.vet?.name} />
              <Row label="Clínica" value={pet.vet?.clinic} />
              <Row label="Dirección" value={pet.vet?.address} />
              {pet.vet?.phone ? <a className="secondary-button wk-small pet-call" href={`tel:${pet.vet.phone.replace(/[^\d+]/g, '')}`}><Phone size={13} aria-hidden /> {pet.vet.phone}</a> : null}
              {!pet.vet ? <p className="wk-items-empty">Sin veterinario cargado.</p> : null}
              {pet.insurance ? (
                <>
                  <h4 className="panel-title pet-sub">Seguro o plan</h4>
                  <Row label="Compañía" value={pet.insurance.company} />
                  <Row label="Póliza" value={pet.insurance.policy} />
                  <Row label="Vigencia" value={pet.insurance.validUntil ? formatDate(pet.insurance.validUntil) : ''} />
                  <Row label="Teléfono" value={pet.insurance.phone} />
                </>
              ) : null}
            </section>

            <section className="panel">
              <h4 className="panel-title">Alimentación</h4>
              <Row label="Alimento" value={pet.diet?.food} />
              <Row label="Marca" value={pet.diet?.brand} />
              <Row label="Porción" value={pet.diet?.portion} />
              <Row label="Comidas por día" value={pet.diet?.mealsPerDay} />
              <Row label="Notas" value={pet.diet?.notes} />
              {!pet.diet ? <p className="wk-items-empty">Sin datos de alimentación.</p> : null}
            </section>
          </div>
          {pet.notes ? <section className="panel"><h4 className="panel-title">Notas</h4><p className="pet-notes">{pet.notes}</p></section> : null}
        </div>
      ) : null}

      {/* ---------- Salud ---------- */}
      {tab === 'salud' ? (
        <div className="pet-tab">
          <div className="wk-toolbar">
            <div className="fm-chips" role="group" aria-label="Filtrar por tipo">
              <button type="button" className={`fm-chip${healthFilter === 'all' ? ' is-on' : ''}`} onClick={() => setHealthFilter('all')}>Todo</button>
              {HEALTH_KINDS.filter((k) => pet.health.some((h) => h.kind === k.value)).map((k) => (
                <button key={k.value} type="button" className={`fm-chip${healthFilter === k.value ? ' is-on' : ''}`} onClick={() => setHealthFilter(k.value)}>{k.emoji} {k.label}</button>
              ))}
            </div>
            <button type="button" className="primary-button" onClick={() => setHealth({ open: true, item: null, kind: healthFilter === 'all' ? 'vacuna' : healthFilter })}><Plus size={16} aria-hidden /> Nuevo registro</button>
          </div>
          {healthList.length === 0 ? (
            <div className="empty-state wk-empty"><span className="pet-empty-emoji" aria-hidden>💉</span><h4>Sin registros de salud</h4><p>Cargá vacunas, desparasitaciones, controles o cirugías. Te avisamos cuando se acerca un vencimiento.</p></div>
          ) : (
            <ul className="pet-list">
              {healthList.map((h) => {
                const due = h.nextDate && latestIds.has(h.id) ? dueStatus(h.nextDate) : null
                return (
                  <li key={h.id}>
                    <div className="pet-list-main">
                      <strong>{kindInfo(h.kind).emoji} {h.name}</strong>
                      <small>{formatDate(h.date)}{h.vet ? ` · ${h.vet}` : ''}{h.lot ? ` · Lote ${h.lot}` : ''}{h.cost ? ` · ${money(h.cost)}` : ''}</small>
                      {h.nextDate ? <small>Próxima: {formatDate(h.nextDate)}</small> : null}
                      {h.notes ? <small className="pet-note">“{h.notes}”</small> : null}
                    </div>
                    <div className="pet-list-side">
                      {due ? <span className={`pet-pill is-${due.status}`}>{due.label}</span> : null}
                      <button type="button" className="secondary-button wk-icon-btn" aria-label={`Editar ${h.name}`} onClick={() => setHealth({ open: true, item: h, kind: h.kind })}><Pencil size={14} aria-hidden /></button>
                      <button type="button" className="secondary-button wk-icon-btn wk-danger" aria-label={`Eliminar ${h.name}`} onClick={() => setRemoving({ label: h.name, run: () => touch({ health: pet.health.filter((x) => x.id !== h.id) }) })}><Trash2 size={14} aria-hidden /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      {/* ---------- Peso ---------- */}
      {tab === 'peso' ? (
        <div className="pet-tab">
          <div className="wk-toolbar">
            <p className="wk-toolbar-text">{wSum ? <>Último peso: <strong>{wSum.last.kg} kg</strong>{wSum.count > 1 ? ` (${wSum.change > 0 ? '+' : ''}${wSum.change} kg desde la anterior)` : ''}</> : 'Registrá el peso para ver cómo evoluciona.'}</p>
            <button type="button" className="primary-button" onClick={() => setWeight({ open: true, item: null })}><Plus size={16} aria-hidden /> Registrar peso</button>
          </div>
          <section className="panel"><TrendChart points={weights.map((w) => ({ date: w.date, value: w.kg }))} unit="kg" /></section>
          {weights.length > 0 ? (
            <ul className="pet-list">
              {[...weights].reverse().map((w) => (
                <li key={w.id}>
                  <div className="pet-list-main"><strong>{w.kg} kg</strong><small>{formatDate(w.date)}{w.notes ? ` · ${w.notes}` : ''}</small></div>
                  <div className="pet-list-side">
                    <button type="button" className="secondary-button wk-icon-btn" aria-label="Editar pesada" onClick={() => setWeight({ open: true, item: w })}><Pencil size={14} aria-hidden /></button>
                    <button type="button" className="secondary-button wk-icon-btn wk-danger" aria-label="Eliminar pesada" onClick={() => setRemoving({ label: `${w.kg} kg del ${formatDate(w.date)}`, run: () => touch({ weights: pet.weights.filter((x) => x.id !== w.id) }) })}><Trash2 size={14} aria-hidden /></button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* ---------- Medicación ---------- */}
      {tab === 'medicacion' ? (
        <div className="pet-tab">
          <div className="wk-toolbar"><p className="wk-toolbar-text">{meds.length ? `${meds.length} en curso` : 'No hay medicación en curso.'}</p><button type="button" className="primary-button" onClick={() => setMed({ open: true, item: null })}><Plus size={16} aria-hidden /> Nueva medicación</button></div>
          {pet.medications.length === 0 ? (
            <div className="empty-state wk-empty"><span className="pet-empty-emoji" aria-hidden>💊</span><h4>Sin medicación</h4><p>Anotá tratamientos con su dosis, frecuencia y duración.</p></div>
          ) : (
            <ul className="pet-list">
              {[...pet.medications].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((m) => {
                const active = !m.endDate || daysUntil(m.endDate) >= 0
                return (
                  <li key={m.id} className={active ? '' : 'is-past'}>
                    <div className="pet-list-main">
                      <strong>💊 {m.name}</strong>
                      <small>{[m.dose, m.frequency].filter(Boolean).join(' · ') || 'Sin dosis cargada'}</small>
                      <small>Desde {formatDate(m.startDate)}{m.endDate ? ` hasta ${formatDate(m.endDate)}` : ' · sin fecha de fin'}</small>
                      {m.notes ? <small className="pet-note">“{m.notes}”</small> : null}
                    </div>
                    <div className="pet-list-side">
                      <span className={`pet-pill ${active ? 'is-ok' : ''}`}>{active ? 'En curso' : 'Terminada'}</span>
                      <button type="button" className="secondary-button wk-icon-btn" aria-label={`Editar ${m.name}`} onClick={() => setMed({ open: true, item: m })}><Pencil size={14} aria-hidden /></button>
                      <button type="button" className="secondary-button wk-icon-btn wk-danger" aria-label={`Eliminar ${m.name}`} onClick={() => setRemoving({ label: m.name, run: () => touch({ medications: pet.medications.filter((x) => x.id !== m.id) }) })}><Trash2 size={14} aria-hidden /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      {/* ---------- Turnos ---------- */}
      {tab === 'turnos' ? (
        <div className="pet-tab">
          <div className="wk-toolbar"><p className="wk-toolbar-text">{pet.appointments.filter((a) => !a.done).length} pendiente(s)</p><button type="button" className="primary-button" onClick={() => setAppt({ open: true, item: null })}><Plus size={16} aria-hidden /> Nuevo turno</button></div>
          {pet.appointments.length === 0 ? (
            <div className="empty-state wk-empty"><span className="pet-empty-emoji" aria-hidden>📅</span><h4>Sin turnos</h4><p>Agendá controles, peluquería o estudios y marcá cuando se hicieron.</p></div>
          ) : (
            <ul className="pet-list">
              {[...pet.appointments].sort((a, b) => (a.done === b.done ? (a.done ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) : a.done ? 1 : -1)).map((a) => {
                const d = daysUntil(a.date)
                return (
                  <li key={a.id} className={a.done ? 'is-past' : ''}>
                    <div className="pet-list-main">
                      <strong>📅 {a.reason}</strong>
                      <small>{formatDate(a.date)}{a.time ? ` · ${a.time}` : ''}{a.vet ? ` · ${a.vet}` : ''}{a.place ? ` · ${a.place}` : ''}</small>
                      {a.cost ? <small>Costo estimado: {money(a.cost)}</small> : null}
                      {a.notes ? <small className="pet-note">“{a.notes}”</small> : null}
                    </div>
                    <div className="pet-list-side">
                      {a.done ? <span className="pet-pill is-ok">Hecho</span> : <span className={`pet-pill ${d < 0 ? 'is-overdue' : d <= 7 ? 'is-soon' : ''}`}>{d < 0 ? `Hace ${-d} d` : d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d} días`}</span>}
                      <button type="button" className="secondary-button wk-icon-btn" aria-label={a.done ? 'Marcar como pendiente' : 'Marcar como hecho'} title={a.done ? 'Marcar como pendiente' : 'Marcar como hecho'} onClick={() => touch({ appointments: pet.appointments.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)) })}><Check size={14} aria-hidden /></button>
                      <button type="button" className="secondary-button wk-icon-btn" aria-label={`Editar ${a.reason}`} onClick={() => setAppt({ open: true, item: a })}><Pencil size={14} aria-hidden /></button>
                      <button type="button" className="secondary-button wk-icon-btn wk-danger" aria-label={`Eliminar ${a.reason}`} onClick={() => setRemoving({ label: a.reason, run: () => touch({ appointments: pet.appointments.filter((x) => x.id !== a.id) }) })}><Trash2 size={14} aria-hidden /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      {/* ---------- Gastos ---------- */}
      {tab === 'gastos' ? (
        <div className="pet-tab">
          <div className="stats-grid">
            <div className="stat-card"><span className="stat-title">Este mes</span><span className="stat-value">{money(totals.thisMonth)}</span></div>
            <div className="stat-card"><span className="stat-title">Este año</span><span className="stat-value">{money(totals.thisYear)}</span></div>
            <div className="stat-card"><span className="stat-title">Total histórico</span><span className="stat-value">{money(totals.all)}</span></div>
          </div>
          {Object.keys(totals.byCategory).length > 0 ? (
            <section className="panel">
              <h4 className="panel-title">Este año por categoría</h4>
              <ul className="pet-bars">
                {EXPENSE_CATEGORIES.filter((c) => totals.byCategory[c.value]).sort((a, b) => (totals.byCategory[b.value] ?? 0) - (totals.byCategory[a.value] ?? 0)).map((c) => {
                  const v = totals.byCategory[c.value] ?? 0
                  return (
                    <li key={c.value}>
                      <span>{c.emoji} {c.label}</span>
                      <div className="pet-bar"><div style={{ width: `${Math.max(4, Math.round((v / Math.max(1, totals.thisYear)) * 100))}%` }} /></div>
                      <strong>{money(v)}</strong>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
          <div className="wk-toolbar"><span /><button type="button" className="primary-button" onClick={() => setExp({ open: true, item: null })}><Plus size={16} aria-hidden /> Nuevo gasto</button></div>
          {pet.expenses.length === 0 ? (
            <div className="empty-state wk-empty"><span className="pet-empty-emoji" aria-hidden>🧾</span><h4>Sin gastos</h4><p>Registrá alimento, veterinario y demás para saber cuánto cuesta cuidar a {pet.name}.</p></div>
          ) : (
            <ul className="pet-list">
              {[...pet.expenses].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                <li key={e.id}>
                  <div className="pet-list-main"><strong>{expenseInfo(e.category).emoji} {money(e.amount)}</strong><small>{expenseInfo(e.category).label} · {formatDate(e.date)}{e.description ? ` · ${e.description}` : ''}</small></div>
                  <div className="pet-list-side">
                    <button type="button" className="secondary-button wk-icon-btn" aria-label="Editar gasto" onClick={() => setExp({ open: true, item: e })}><Pencil size={14} aria-hidden /></button>
                    <button type="button" className="secondary-button wk-icon-btn wk-danger" aria-label="Eliminar gasto" onClick={() => setRemoving({ label: `gasto de ${money(e.amount)}`, run: () => touch({ expenses: pet.expenses.filter((x) => x.id !== e.id) }) })}><Trash2 size={14} aria-hidden /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* ---------- Modales ---------- */}
      <HealthRecordModal open={health.open} item={health.item} pet={pet} defaultKind={health.kind} newId={uuid} onClose={() => setHealth({ open: false, item: null, kind: 'vacuna' })} onSave={(r) => { touch({ health: upsert(pet.health, r) }); setHealth({ open: false, item: null, kind: 'vacuna' }); setTab('salud') }} />
      <WeightModal open={weight.open} item={weight.item} petName={pet.name} newId={uuid} onClose={() => setWeight({ open: false, item: null })} onSave={(w) => { touch({ weights: upsert(pet.weights, w) }); setWeight({ open: false, item: null }) }} />
      <MedicationModal open={med.open} item={med.item} petName={pet.name} newId={uuid} onClose={() => setMed({ open: false, item: null })} onSave={(m) => { touch({ medications: upsert(pet.medications, m) }); setMed({ open: false, item: null }) }} />
      <AppointmentModal open={appt.open} item={appt.item} pet={pet} newId={uuid} onClose={() => setAppt({ open: false, item: null })} onSave={(a) => { touch({ appointments: upsert(pet.appointments, a) }); setAppt({ open: false, item: null }) }} />
      <ExpenseModal open={exp.open} item={exp.item} petName={pet.name} newId={uuid} onClose={() => setExp({ open: false, item: null })} onSave={(x) => { touch({ expenses: upsert(pet.expenses, x) }); setExp({ open: false, item: null }) }} />

      <ConfirmModal open={Boolean(removing)} title="Eliminar" message={removing ? `¿Eliminar ${removing.label}? No se puede deshacer.` : ''} confirmLabel="Eliminar" onConfirm={() => { removing?.run(); setRemoving(null) }} onClose={() => setRemoving(null)} />
      <ConfirmModal open={confirmPet} title={`Eliminar a ${pet.name}`} message={`Se borra la ficha completa de ${pet.name} (salud, peso, medicación, turnos y gastos). No se puede deshacer.`} confirmLabel="Eliminar mascota" onConfirm={() => { setConfirmPet(false); onDelete() }} onClose={() => setConfirmPet(false)} />
    </div>
  )
}
