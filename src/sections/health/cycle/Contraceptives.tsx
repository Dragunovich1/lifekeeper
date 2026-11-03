import { useMemo, useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { DatePicker } from '../../../components/DatePicker'
import { Modal } from '../../../components/Modal'
import { Select } from '../../../components/Select'
import { TimePicker } from '../../../components/TimePicker'
import type { ContraceptiveMethod, ContraceptiveType } from '../../../types'
import {
  EMERGENCY_INFO,
  METHODS,
  MISSED_PILL_TIP,
  hasActiveHormonal,
  methodStatus,
  pillAdherence,
} from '../../../utils/contraceptives'
import { dayKey } from '../../../utils/cycle'
import { AdherenceStrip } from './CycleCharts'
import { useCycleData } from './useCycleData'

const TYPES = Object.keys(METHODS) as ContraceptiveType[]

interface Form {
  id?: string
  type: ContraceptiveType
  name: string
  startDate: string
  active: boolean
  reminderTime: string
  packDays: string
  pauseDays: string
  intervalDays: string
  lastDoseDate: string
  validUntil: string
  notes: string
}

const emptyForm = (todayKey: string): Form => ({
  type: 'pastilla',
  name: '',
  startDate: todayKey,
  active: true,
  reminderTime: '21:00',
  packDays: '21',
  pauseDays: '7',
  intervalDays: '84',
  lastDoseDate: '',
  validUntil: '',
  notes: '',
})

const toMethod = (f: Form): Omit<ContraceptiveMethod, 'id'> & { id?: string } => ({
  id: f.id,
  type: f.type,
  name: f.name.trim() || undefined,
  startDate: dayKey(f.startDate),
  active: f.active,
  reminderTime: ['pastilla', 'parche', 'anillo'].includes(f.type) && f.reminderTime ? f.reminderTime : undefined,
  packDays: f.type === 'pastilla' ? Math.max(1, Number(f.packDays) || 21) : undefined,
  pauseDays: f.type === 'pastilla' ? Math.max(0, Number(f.pauseDays) || 0) : undefined,
  intervalDays: f.type === 'inyeccion' ? Math.max(7, Number(f.intervalDays) || 84) : undefined,
  lastDoseDate: ['inyeccion', 'parche', 'anillo'].includes(f.type) && f.lastDoseDate ? dayKey(f.lastDoseDate) : undefined,
  validUntil: ['diu_cobre', 'diu_hormonal', 'implante'].includes(f.type) && f.validUntil ? dayKey(f.validUntil) : undefined,
  notes: f.notes.trim() || undefined,
})

const fromMethod = (m: ContraceptiveMethod): Form => ({
  id: m.id,
  type: m.type,
  name: m.name ?? '',
  startDate: m.startDate,
  active: m.active,
  reminderTime: m.reminderTime ?? '21:00',
  packDays: String(m.packDays ?? 21),
  pauseDays: String(m.pauseDays ?? 7),
  intervalDays: String(m.intervalDays ?? 84),
  lastDoseDate: m.lastDoseDate ?? '',
  validUntil: m.validUntil ?? '',
  notes: m.notes ?? '',
})

const nowHM = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function Contraceptives() {
  const { cycle, saveMethod, removeMethod, setPillTaken, markApplied } = useCycleData()
  const todayKey = dayKey(new Date())
  const methods = useMemo(() => cycle.contraceptives ?? [], [cycle.contraceptives])
  const [form, setForm] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<ContraceptiveMethod | null>(null)

  const hormonal = hasActiveHormonal(methods)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    saveMethod(toMethod(form))
    setForm(null)
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  return (
    <div className="cy-stack">
      <div className="cy-card cy-intro">
        <div>
          <h3 className="cy-h">Métodos anticonceptivos</h3>
          <p className="cy-muted">Cargá lo que usás y recibí recordatorios (pastilla diaria, cambio de parche o anillo, próxima inyección, vencimiento del DIU o implante).</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setForm(emptyForm(todayKey))}>
          <Plus size={16} /> Agregar método
        </button>
      </div>

      {hormonal ? (
        <div className="cy-note">
          💡 Con un método hormonal bien usado la ovulación está suprimida: la <b>ventana fértil natural</b> del calendario no aplica y el sangrado mensual suele ser de pausa, no un ciclo natural.
        </div>
      ) : null}

      {methods.length === 0 ? (
        <div className="cy-card cy-empty-big">Todavía no cargaste ningún método. Podés sumar pastillas, parche, anillo, inyección, DIU, implante o preservativo.</div>
      ) : (
        methods.map((m) => {
          const meta = METHODS[m.type]
          const st = methodStatus(m, todayKey, nowHM())
          return (
            <div key={m.id} className={`cy-card cy-method is-${st.severity}`}>
              <div className="cy-method-head">
                <span className="cy-method-emoji" aria-hidden>
                  {meta.emoji}
                </span>
                <div className="cy-method-title">
                  <strong>{m.name ? `${m.name} · ` : ''}{meta.label}</strong>
                  <small>{meta.hormonal ? 'Hormonal' : 'No hormonal'}{m.active ? '' : ' · pausado'}</small>
                </div>
                <div className="cy-method-actions">
                  <button type="button" className="secondary-button cy-icon" onClick={() => setForm(fromMethod(m))} aria-label={`Editar ${meta.label}`}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="secondary-button cy-icon cy-danger" onClick={() => setDeleting(m)} aria-label={`Eliminar ${meta.label}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="cy-method-status">
                <b>{st.headline}</b>
                {st.detail ? <span>{st.detail}</span> : null}
              </div>

              {m.active && m.type === 'pastilla' && !st.inPause ? (
                <div className="cy-method-cta">
                  {st.takenToday ? (
                    <button type="button" className="secondary-button" onClick={() => setPillTaken(m.id, todayKey, false)}>
                      <Undo2 size={15} /> Deshacer la de hoy
                    </button>
                  ) : (
                    <button type="button" className="primary-button" onClick={() => setPillTaken(m.id, todayKey, true)}>
                      <Check size={16} /> Tomé la pastilla de hoy
                    </button>
                  )}
                </div>
              ) : null}

              {m.active && ['parche', 'anillo', 'inyeccion'].includes(m.type) && st.severity !== 'ok' && st.severity !== 'info' ? (
                <div className="cy-method-cta">
                  <button type="button" className="primary-button" onClick={() => markApplied(m.id, todayKey)}>
                    <Check size={16} /> {m.type === 'inyeccion' ? 'Registrar inyección aplicada hoy' : m.type === 'parche' ? 'Registrar cambio de parche' : 'Registrar cambio de anillo'}
                  </button>
                </div>
              ) : null}

              {m.type === 'pastilla' && m.active ? (
                <div className="cy-method-chart">
                  <h4 className="cy-h4">Cumplimiento (últimas 4 semanas)</h4>
                  <AdherenceStrip days={pillAdherence(m, todayKey, 28)} />
                </div>
              ) : null}

              <div className="cy-eff">
                {meta.perfect > 0 ? (
                  <>
                    Eficacia: <b>{meta.perfect}%</b> con uso perfecto · <b>{meta.typical}%</b> con uso típico <em>(cifras aproximadas)</em>
                  </>
                ) : null}
                {meta.protectsSti ? ' · Protege de ITS' : ' · No protege de ITS'}
              </div>
            </div>
          )
        })
      )}

      <div className="cy-card cy-tips">
        <h4 className="cy-h4">Buenas prácticas</h4>
        <ul>
          <li><b>Pastilla olvidada:</b> {MISSED_PILL_TIP}</li>
          <li><b>Anticoncepción de emergencia:</b> {EMERGENCY_INFO.window} {EMERGENCY_INFO.access}</li>
          <li><b>ITS:</b> {EMERGENCY_INFO.sti}</li>
        </ul>
        <p className="cy-muted">Información general: no reemplaza la consulta con tu ginecólogo/a o profesional de la salud.</p>
      </div>

      <Modal open={form !== null} onClose={() => setForm(null)} title={form?.id ? 'Editar método' : 'Agregar método'} subtitle="Elegí qué usás y completá solo lo que aplique." maxWidth={560}>
        {form ? (
          <form onSubmit={submit} className="cy-form">
            <div className="cy-types" role="radiogroup" aria-label="Tipo de método">
              {TYPES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={form.type === t} className={`cy-type${form.type === t ? ' is-active' : ''}`} onClick={() => set('type', t)}>
                  <span aria-hidden>{METHODS[t].emoji}</span> {METHODS[t].label}
                </button>
              ))}
            </div>
            <p className="cy-muted">{METHODS[form.type].blurb}</p>

            <div className="field">
              <label htmlFor="cm-name">Nombre o marca (opcional)</label>
              <input id="cm-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Yasmin, DIU Mirena, Implanon…" />
            </div>

            <div className="field">
              <label htmlFor="cm-start">{form.type === 'pastilla' ? 'Primer día del blíster actual' : form.type === 'parche' || form.type === 'anillo' ? 'Día en que empezaste este ciclo' : 'Fecha de inicio / colocación'}</label>
              <DatePicker id="cm-start" value={form.startDate} onChange={(v) => set('startDate', v)} ariaLabel="Fecha de inicio" />
            </div>

            {form.type === 'pastilla' ? (
              <div className="cy-grid2">
                <div className="field">
                  <label htmlFor="cm-pack">Pastillas activas</label>
                  <input id="cm-pack" type="number" min="1" max="28" value={form.packDays} onChange={(e) => set('packDays', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="cm-pause">Días de pausa o placebo</label>
                  <input id="cm-pause" type="number" min="0" max="10" value={form.pauseDays} onChange={(e) => set('pauseDays', e.target.value)} />
                </div>
              </div>
            ) : null}

            {['pastilla', 'parche', 'anillo'].includes(form.type) ? (
              <div className="field">
                <label htmlFor="cm-time">Hora del recordatorio</label>
                <TimePicker id="cm-time" value={form.reminderTime} onChange={(v) => set('reminderTime', v)} ariaLabel="Hora del recordatorio" />
              </div>
            ) : null}

            {form.type === 'inyeccion' ? (
              <div className="cy-grid2">
                <div className="field">
                  <label htmlFor="cm-int">Frecuencia</label>
                  <Select id="cm-int" value={form.intervalDays} onChange={(v) => set('intervalDays', v)} ariaLabel="Frecuencia" options={[{ value: '28', label: 'Mensual (cada 28 días)' }, { value: '84', label: 'Trimestral (cada 12 semanas)' }]} />
                </div>
                <div className="field">
                  <label htmlFor="cm-last">Última aplicación</label>
                  <DatePicker id="cm-last" value={form.lastDoseDate} onChange={(v) => set('lastDoseDate', v)} ariaLabel="Última aplicación" allowClear />
                </div>
              </div>
            ) : null}

            {['diu_cobre', 'diu_hormonal', 'implante'].includes(form.type) ? (
              <div className="field">
                <label htmlFor="cm-valid">Efectivo hasta</label>
                <DatePicker id="cm-valid" value={form.validUntil} onChange={(v) => set('validUntil', v)} ariaLabel="Vigencia" allowClear />
                <span className="cy-muted">Te aviso 60 días antes para pedir turno de recambio.</span>
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="cm-notes">Notas (opcional)</label>
              <input id="cm-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ej. Indicado por la Dra. González" />
            </div>

            <label className="cy-check">
              <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> Método activo (recibir recordatorios)
            </label>

            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button type="submit" className="primary-button">
                Guardar método
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        title="Eliminar método"
        message={deleting ? `¿Eliminar "${METHODS[deleting.type].label}${deleting.name ? ` · ${deleting.name}` : ''}"? Se pierde también su historial de tomas.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          if (deleting) removeMethod(deleting.id)
          setDeleting(null)
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
