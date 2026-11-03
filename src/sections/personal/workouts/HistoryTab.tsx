import { useMemo, useState } from 'react'
import { ChevronDown, Download, Dumbbell, FileText, Pencil, Plus, Repeat, Search, Trash2 } from 'lucide-react'
import { Select } from '../../../components/Select'
import type { WorkoutRoutine, WorkoutSession } from '../../../types'
import { formatDate } from '../../../utils/dates'
import { GROUP_LABELS, buildBlocks, groupRest, roundCount } from '../../../utils/workoutGroups'
import { PERIOD_OPTIONS, filterWorkouts, resolvePeriod, type PeriodKind } from '../../../utils/workoutExport'
import { describeSet, kgToDisplay, measureOf, summarizeSession } from '../../../utils/workoutSets'
import { WORKOUT_TYPES, typeLabel } from './constants'

interface Props {
  workouts: WorkoutSession[]
  routines: WorkoutRoutine[]
  isImperial: boolean
  filters: { period: PeriodKind; type: string; search: string }
  onFilters: (f: { period: PeriodKind; type: string; search: string }) => void
  onRegister: () => void
  onExport: () => void
  onEdit: (w: WorkoutSession) => void
  onRepeat: (w: WorkoutSession) => void
  onDelete: (w: WorkoutSession) => void
  onPdf: (w: WorkoutSession) => void
}

const restText = (s: number) => (s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`)

/** Solapa "Historial": todo lo que hiciste, con filtros. Registrar y exportar se abren en modales. */
export function HistoryTab({ workouts, routines, isImperial, filters, onFilters, onRegister, onExport, onEdit, onRepeat, onDelete, onPdf }: Props) {
  const weightUnit = isImperial ? 'lb' : 'kg'
  const distUnit = isImperial ? 'mi' : 'km'
  const toDisp = (kg: number) => kgToDisplay(kg, isImperial)
  const [visible, setVisible] = useState(10)

  const list = useMemo(
    () => filterWorkouts(workouts, { period: resolvePeriod(filters.period), type: filters.type, search: filters.search }).reverse(),
    [workouts, filters],
  )

  const lines = (w: WorkoutSession) =>
    buildBlocks(w.exercises).map((block) => {
      if (block.kind === 'group') {
        const members = block.indices.map((i) => w.exercises[i])
        const rest = groupRest(members)
        const rounds = roundCount(members)
        return {
          key: block.groupId,
          title: `${members.map((m) => m.name).join(' + ')}`,
          badge: GROUP_LABELS[block.groupKind],
          kind: block.groupKind,
          meta: rest ? `Desc. ${restText(rest)}` : '',
          rows: Array.from({ length: rounds }, (_, r) => `Ronda ${r + 1}: ${members.map((m) => (m.sets[r] ? describeSet(m.sets[r], m, weightUnit, toDisp) : '–')).join('  +  ')}`),
        }
      }
      const ex = w.exercises[block.index]
      const sets = ex.sets.map((s, i) => `${i + 1}) ${describeSet(s, ex, weightUnit, toDisp)}`)
      return {
        key: ex.id,
        title: ex.name,
        badge: '',
        kind: '',
        meta: [ex.perSide ? 'por lado' : '', measureOf(ex) === 'time' ? 'tiempo' : '', ex.restSeconds ? `desc. ${restText(ex.restSeconds)}` : ''].filter(Boolean).join(' · '),
        rows: [sets.join('   ')],
      }
    })

  return (
    <div className="wk-history">
      <div className="wk-toolbar">
        <div className="wk-filters">
          <div className="wk-search">
            <Search size={15} aria-hidden />
            <input value={filters.search} onChange={(e) => onFilters({ ...filters, search: e.target.value })} placeholder="Buscar por ejercicio, sesión o notas…" aria-label="Buscar entrenamientos" data-no-dirty />
          </div>
          <Select value={filters.period} onChange={(v) => onFilters({ ...filters, period: v as PeriodKind })} options={PERIOD_OPTIONS.filter((p) => p.value !== 'custom')} ariaLabel="Período" />
          <Select value={filters.type} onChange={(v) => onFilters({ ...filters, type: v })} options={[{ value: 'all', label: 'Todas las disciplinas' }, ...WORKOUT_TYPES]} ariaLabel="Disciplina" />
        </div>
        <div className="wk-toolbar-actions">
          <button type="button" className="secondary-button" onClick={onExport} disabled={workouts.length === 0}><Download size={15} aria-hidden /> Exportar</button>
          <button type="button" className="primary-button" onClick={onRegister}><Plus size={16} aria-hidden /> Registrar entrenamiento</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty-state wk-empty">
          <Dumbbell size={40} aria-hidden />
          <h4>No se encontraron entrenamientos</h4>
          <p>{filters.search || filters.type !== 'all' || filters.period !== 'all' ? 'Probá ajustando los filtros.' : 'Todavía no registraste ninguna sesión.'}</p>
          <button type="button" className="primary-button" onClick={onRegister}><Plus size={16} aria-hidden /> Registrar entrenamiento</button>
        </div>
      ) : (
        <>
          <p className="wk-count">{list.length} entrenamiento{list.length === 1 ? '' : 's'}</p>
          <div className="wk-session-list">
            {list.slice(0, visible).map((w) => {
              const s = summarizeSession(w)
              const routine = w.routineId ? routines.find((r) => r.id === w.routineId) : undefined
              return (
                <article key={w.id} className="subpanel wk-session">
                  <header className="wk-session-head">
                    <div>
                      <div className="wk-session-title">
                        <span className="badge badge-info">{typeLabel(w.type)}</span>
                        <strong>{w.title}</strong>
                      </div>
                      <div className="wk-session-meta">
                        <span>📅 {formatDate(w.date)}</span>
                        {w.durationMinutes ? <span>⏱️ {w.durationMinutes} min</span> : null}
                        {w.distanceKm ? <span>📍 {isImperial ? (w.distanceKm / 1.60934).toFixed(1) : w.distanceKm} {distUnit}</span> : null}
                        {w.pace ? <span className="wk-accent">⚡ {w.pace}</span> : null}
                        {w.calories ? <span>🔥 {w.calories} kcal</span> : null}
                        {s.volumeKg > 0 ? <span>🏋️ {Math.round(toDisp(s.volumeKg)).toLocaleString('es-AR')} {weightUnit}</span> : null}
                        {s.effectiveSets > 0 ? <span>{s.effectiveSets} series{s.warmupSets ? ` (+${s.warmupSets} calent.)` : ''}</span> : null}
                        {routine ? <span className="wk-accent">📋 {routine.name}</span> : null}
                      </div>
                    </div>
                    <div className="wk-session-actions">
                      {w.exercises.length > 0 ? <button type="button" className="secondary-button wk-icon-btn" onClick={() => onRepeat(w)} aria-label={`Repetir ${w.title}`} title="Repetir este entrenamiento (con las cargas de ahora)"><Repeat size={15} aria-hidden /></button> : null}
                      <button type="button" className="secondary-button wk-icon-btn" onClick={() => onPdf(w)} aria-label={`Descargar PDF de ${w.title}`} title="PDF de esta sesión"><FileText size={15} aria-hidden /></button>
                      <button type="button" className="secondary-button wk-icon-btn" onClick={() => onEdit(w)} aria-label={`Editar ${w.title}`} title="Editar"><Pencil size={15} aria-hidden /></button>
                      <button type="button" className="secondary-button wk-icon-btn wk-danger" onClick={() => onDelete(w)} aria-label={`Eliminar ${w.title}`} title="Eliminar"><Trash2 size={15} aria-hidden /></button>
                    </div>
                  </header>
                  {w.notes ? <p className="wk-session-notes">“{w.notes}”</p> : null}
                  {w.exercises.length > 0 ? (
                    <ul className="wk-session-items">
                      {lines(w).map((l) => (
                        <li key={l.key}>
                          <div className="wk-item-line">
                            {l.badge ? <span className={`wg-badge wg-badge-${l.kind}`}>{l.badge}</span> : null}
                            <strong>{l.title}</strong>
                            {l.meta ? <small>{l.meta}</small> : null}
                          </div>
                          {l.rows.map((r, i) => <div key={i} className="wk-item-sets">{r}</div>)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              )
            })}
          </div>
          {list.length > visible ? (
            <div className="wk-more-wrap"><button type="button" className="secondary-button" onClick={() => setVisible((v) => v + 10)}><ChevronDown size={16} aria-hidden /> Mostrar más ({list.length - visible} restantes)</button></div>
          ) : null}
        </>
      )}
    </div>
  )
}
