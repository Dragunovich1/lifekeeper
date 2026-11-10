import '../styles/vaccine-form.css'
import { useMemo, useState } from 'react'
import { Paperclip, Syringe, X } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { DatePicker } from './DatePicker'
import { PlaceField } from './PlaceField'
import { Select } from './Select'
import { SuggestInput, type SuggestItem } from './SuggestInput'
import type { VaccineSchedule } from '../data/vaccineSchedules'
import type { Attachment } from '../types'
import type { ScheduleReport } from '../utils/vaccineSchedule'
import { nextPendingDoseIndex, suggestNextDose } from '../utils/vaccineSchedule'
import { ACCEPTED_ATTACHMENTS, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, applyScheduleChoice, clearScheduleChoice, type VaccineFormState } from '../utils/vaccineForm'
import type { HistoryPlace } from '../utils/placeHistory'
import { fromLocalDateOrDateTime, toLocalDateKey } from '../utils/dates'

interface Props {
  value: VaccineFormState
  onChange: (next: VaccineFormState) => void
  schedule: VaccineSchedule
  report: ScheduleReport | null
  birthDate?: string
  history: HistoryPlace[]
  countryCode?: string
  near?: { latitude: number; longitude: number }
  /** En edición, las fechas ya cargadas no se recalculan solas */
  editing?: boolean
  idPrefix: string
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const dayKey = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString()
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

/**
 * Campos de "vacuna": lo habitual (vacuna, dosis, fecha) siempre a la vista; lo demás, plegado.
 * La vacuna se elige del calendario de tu país (o se escribe otra) y la dosis y la próxima fecha salen solas.
 */
export function VaccineFormFields({ value, onChange, schedule, report, birthDate, history, countryCode, near, editing = false, idPrefix }: Props) {
  // Si la persona edita la próxima fecha a mano, dejamos de pisarla
  const [nextTouched, setNextTouched] = useState(editing && Boolean(value.nextDoseDate))
  const [fileError, setFileError] = useState('')
  const [moreOpen, setMoreOpen] = useState(editing && Boolean(value.location || value.lot || value.notes || value.attachments?.length))

  const selected = schedule.vaccines.find((v) => v.id === value.scheduleVaccineId)

  const items = useMemo<SuggestItem[]>(() => {
    const q = fold(value.vaccine)
    // También reconoce los nombres alternativos ("triple viral" = SRP/MMR) con el mismo patrón que usa el calendario
    const list = schedule.vaccines.filter((v) => !q || fold(v.name).includes(q) || fold(v.prevents).includes(q) || v.match.test(q))
    // Las del calendario que corresponden primero, las condicionales (zona de riesgo, etc.) después
    return [...list.filter((v) => !v.condition), ...list.filter((v) => v.condition)].slice(0, 12).map((v) => ({
      key: v.id,
      title: v.name,
      detail: v.prevents,
      icon: <Syringe size={15} />,
      group: v.condition ? 'Según tu situación' : 'Calendario',
    }))
  }, [schedule, value.vaccine])

  const setDate = (iso: string) => {
    const next = { ...value, date: iso }
    if (selected && !nextTouched) next.nextDoseDate = suggestNextDose(selected, value.doseIndex ?? 0, toLocalDateKey(iso), birthDate)
    onChange(next)
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setFileError('')
    const current = value.attachments ?? []
    const added: Attachment[] = []
    for (const file of Array.from(files)) {
      if (current.length + added.length >= MAX_ATTACHMENTS) {
        setFileError(`Podés adjuntar hasta ${MAX_ATTACHMENTS} archivos.`)
        break
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setFileError(`"${file.name}" pesa más de ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`)
        continue
      }
      try {
        added.push({ id: uuid(), fileName: file.name, mimeType: file.type || 'application/octet-stream', dataUrl: await readAsDataUrl(file), uploadedAt: new Date().toISOString() })
      } catch {
        setFileError(`No pude leer "${file.name}".`)
      }
    }
    if (added.length) onChange({ ...value, attachments: [...current, ...added] })
  }

  return (
    <div className="vf">
      <div className="vf-grid">
        <div className="field vf-full">
          <label htmlFor={`${idPrefix}-name`}>Vacuna</label>
          <SuggestInput
            id={`${idPrefix}-name`}
            value={value.vaccine}
            required
            autoFocus={!editing}
            placeholder="Buscá en el calendario o escribí otra"
            items={items}
            onChange={(text) => {
              const base = { ...value, vaccine: text }
              onChange(selected && fold(selected.name) !== fold(text) ? clearScheduleChoice(base) : base)
            }}
            onPick={(item) => {
              const sv = schedule.vaccines.find((v) => v.id === item.key)
              if (!sv) return
              onChange(applyScheduleChoice(value, sv, nextPendingDoseIndex(report, sv.id), birthDate, nextTouched))
            }}
          />
          {selected ? <p className="vf-hint">Previene: {selected.prevents}.{selected.condition ? ` ${selected.condition}` : ''}</p> : null}
        </div>

        <div className="field">
          <label htmlFor={`${idPrefix}-dose`}>Dosis</label>
          {selected ? (
            <Select
              id={`${idPrefix}-dose`}
              value={String(value.doseIndex ?? 0)}
              onChange={(v) => onChange(applyScheduleChoice(value, selected, Number(v), birthDate, nextTouched))}
              options={selected.doses.map((d, i) => {
                const done = report?.results.find((r) => r.vaccine.id === selected.id)?.items[i]?.status === 'done' && i !== value.doseIndex
                return { value: String(i), label: `${d.label}${done ? ' · ya registrada' : ''}` }
              })}
              ariaLabel="Dosis"
            />
          ) : (
            <input id={`${idPrefix}-dose`} value={value.dose} onChange={(e) => onChange({ ...value, dose: e.target.value })} placeholder="1ra, 2da, refuerzo" />
          )}
        </div>

        <div className="field">
          <label htmlFor={`${idPrefix}-date`}>Fecha de aplicación</label>
          <DatePicker id={`${idPrefix}-date`} value={toLocalDateKey(value.date)} onChange={(v) => setDate(fromLocalDateOrDateTime(v, true))} ariaLabel="Fecha de la vacuna" />
          <div className="vf-quick">
            <button type="button" className="fm-chip" onClick={() => setDate(dayKey(0))}>Hoy</button>
            <button type="button" className="fm-chip" onClick={() => setDate(dayKey(-1))}>Ayer</button>
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${idPrefix}-next`}>Próxima dosis</label>
          <DatePicker
            id={`${idPrefix}-next`}
            value={toLocalDateKey(value.nextDoseDate)}
            onChange={(v) => {
              setNextTouched(true)
              onChange({ ...value, nextDoseDate: fromLocalDateOrDateTime(v) })
            }}
            placeholder={selected ? 'No hay más dosis' : 'Sin recordatorio'}
            ariaLabel="Próxima dosis"
            allowClear
          />
          {selected && !nextTouched && value.nextDoseDate ? <p className="vf-hint">Calculada según el calendario. Podés cambiarla.</p> : null}
        </div>

        <label className="vf-check vf-full">
          <input type="checkbox" checked={value.reminderEnabled} onChange={(e) => onChange({ ...value, reminderEnabled: e.target.checked })} />
          <span>Recordarme la próxima dosis</span>
        </label>
      </div>

      <details className="vf-more" open={moreOpen} onToggle={(e) => setMoreOpen((e.target as HTMLDetailsElement).open)}>
        <summary>Más datos (opcional): lugar, lote, notas y comprobante</summary>
        <div className="vf-grid">
          <div className="field vf-full">
            <label htmlFor={`${idPrefix}-location`}>Ubicación / Centro de aplicación</label>
            <PlaceField id={`${idPrefix}-location`} value={value.location} onChange={(location) => onChange({ ...value, location })} history={history} countryCode={countryCode} near={near} />
          </div>
          <div className="field">
            <label htmlFor={`${idPrefix}-lot`}>Lote</label>
            <input id={`${idPrefix}-lot`} value={value.lot} onChange={(e) => onChange({ ...value, lot: e.target.value })} placeholder="Código de lote" />
          </div>
          <div className="field vf-full">
            <label htmlFor={`${idPrefix}-notes`}>Notas</label>
            <textarea id={`${idPrefix}-notes`} value={value.notes ?? ''} onChange={(e) => onChange({ ...value, notes: e.target.value })} placeholder="Observaciones, reacciones, indicaciones" />
          </div>
          <div className="field vf-full">
            <span className="vf-label">Comprobante (foto del carnet o PDF)</span>
            {(value.attachments ?? []).length ? (
              <ul className="vf-files">
                {(value.attachments ?? []).map((a) => (
                  <li key={a.id}>
                    <Paperclip size={14} aria-hidden />
                    <span>{a.fileName}</span>
                    <button type="button" aria-label={`Quitar ${a.fileName}`} onClick={() => onChange({ ...value, attachments: (value.attachments ?? []).filter((x) => x.id !== a.id) })}>
                      <X size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {(value.attachments ?? []).length < MAX_ATTACHMENTS ? (
              <label className="secondary-button vf-attach">
                <Paperclip size={14} aria-hidden /> Adjuntar archivo
                <input
                  type="file"
                  accept={ACCEPTED_ATTACHMENTS}
                  multiple
                  hidden
                  onChange={(e) => {
                    void onFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            ) : null}
            {fileError ? <p className="vf-error" role="alert">{fileError}</p> : <p className="vf-hint">Hasta {MAX_ATTACHMENTS} archivos de {MAX_ATTACHMENT_BYTES / 1024 / 1024} MB. Se guardan cifrados con tu bóveda.</p>}
          </div>
        </div>
      </details>
    </div>
  )
}
