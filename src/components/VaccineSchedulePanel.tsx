import '../styles/vaccine-schedule.css'
import { useMemo } from 'react'
import { CheckCircle2, ExternalLink, Plus } from 'lucide-react'
import { scheduleForCountry } from '../data/vaccineSchedules'
import { ageLabel, computeSchedule, type DoseStatus, type ScheduleItem } from '../utils/vaccineSchedule'
import { formatDate } from '../utils/dates'
import type { VaccineRecord } from '../types'

interface Props {
  birthDate?: string
  country?: string
  countryCode?: string
  records: VaccineRecord[]
  /** Precarga el formulario de "Nueva vacuna" con la dosis elegida */
  onRegister: (item: ScheduleItem) => void
}

const STATUS_TEXT: Record<DoseStatus, string> = { done: 'Aplicada', overdue: 'Pendiente', soon: 'Próxima', future: 'Más adelante' }

/**
 * "Calendario sugerido": cruza la fecha de nacimiento del perfil con las vacunas cargadas y muestra qué falta,
 * qué viene y cada vacuna con sus dosis agrupadas (refuerzos en un mismo contenedor).
 */
export function VaccineSchedulePanel({ birthDate, country, countryCode, records, onRegister }: Props) {
  const schedule = useMemo(() => scheduleForCountry(countryCode, country), [countryCode, country])
  const report = useMemo(() => (birthDate ? computeSchedule(schedule, birthDate, records) : null), [schedule, birthDate, records])

  if (!birthDate || !report) {
    return (
      <div className="panel vs-panel">
        <div className="panel-header"><h3 className="panel-title">Calendario sugerido</h3></div>
        <div className="empty-state">Cargá tu fecha de nacimiento en el Perfil para ver qué vacunas te corresponden y cuáles te faltan.</div>
      </div>
    )
  }

  const applicable = report.results.filter((r) => !r.optional)
  const optional = report.results.filter((r) => r.optional)

  return (
    <div className="panel vs-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Calendario sugerido</h3>
          <p className="vs-sub">{schedule.title} · edad actual: {ageLabel(report.ageMonths)}</p>
        </div>
        <span className={`badge ${report.attention.length ? 'badge-warning' : 'badge-success'}`}>
          {report.attention.length ? `${report.attention.length} para revisar` : 'Al día'}
        </span>
      </div>

      {report.attention.length ? (
        <ul className="vs-attention" aria-label="Dosis pendientes y próximas">
          {report.attention.map((item) => (
            <li key={`${item.vaccineId}-${item.doseIndex}`} className={`vs-row is-${item.status}`}>
              <div className="vs-row-main">
                <strong>{item.vaccineName}</strong>
                <span>{item.doseLabel} · {item.status === 'overdue' ? 'correspondía el' : 'corresponde el'} {formatDate(item.dueDate)}</span>
              </div>
              <span className={`badge ${item.status === 'overdue' ? 'badge-error' : 'badge-info'}`}>{STATUS_TEXT[item.status]}</span>
              <button type="button" className="secondary-button vs-register" onClick={() => onRegister(item)}>
                <Plus size={14} aria-hidden /> Registrar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="vs-ok"><CheckCircle2 size={16} aria-hidden /> No tenés dosis pendientes ni próximas según este calendario.</div>
      )}

      <details className="vs-details">
        <summary>Ver el esquema completo por vacuna</summary>
        <div className="vs-grid">
          {applicable.map(({ vaccine, items }) => (
            <article key={vaccine.id} className="vs-card">
              <header>
                <h4>{vaccine.name}</h4>
                <p>{vaccine.prevents}</p>
              </header>
              <ol className="vs-doses">
                {items.map((item) => (
                  <li key={item.doseIndex} className={`vs-dose is-${item.status}`}>
                    <span className="vs-dot" aria-hidden />
                    <div>
                      <span className="vs-dose-label">{item.doseLabel}</span>
                      <span className="vs-dose-date">
                        {item.record ? `Aplicada el ${formatDate(item.record.date)}` : `${STATUS_TEXT[item.status]} · ${formatDate(item.dueDate)}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              {vaccine.note ? <p className="vs-note">{vaccine.note}</p> : null}
            </article>
          ))}
        </div>

        {optional.length ? (
          <>
            <h4 className="vs-sub-title">Según tu situación</h4>
            <ul className="vs-optional">
              {optional.map(({ vaccine }) => (
                <li key={vaccine.id}><strong>{vaccine.name}:</strong> {vaccine.condition}</li>
              ))}
            </ul>
          </>
        ) : null}
      </details>

      <p className="vs-source">
        {schedule.disclaimer} Revisado el {formatDate(schedule.reviewedAt)}. Fuentes:{' '}
        {schedule.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 ? ' · ' : ''}
            <a href={s.url} target="_blank" rel="noreferrer noopener">{s.label}<ExternalLink size={11} aria-hidden /></a>
          </span>
        ))}
      </p>
    </div>
  )
}
