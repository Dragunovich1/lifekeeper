import { v4 as uuid } from 'uuid'
import { Copy, Dumbbell, Pencil, Play, Plus, Sparkles, Star, Trash2 } from 'lucide-react'
import type { WorkoutRoutine, WorkoutSession, WorkoutTemplate } from '../../../types'
import { dayOverview, nextRoutineDay, prepareDayForLive } from '../../../utils/workoutRoutines'
import type { StartOptions } from './TodayTab'

interface Props {
  routines: WorkoutRoutine[]
  templates: WorkoutTemplate[]
  activeId?: string
  workouts: WorkoutSession[]
  onNew: () => void
  onEdit: (r: WorkoutRoutine) => void
  onDuplicate: (r: WorkoutRoutine) => void
  onDelete: (r: WorkoutRoutine) => void
  onSetActive: (id: string | undefined) => void
  onStart: (o: StartOptions) => void
  onImportTemplate: (t: WorkoutTemplate) => void
}

/** Solapa "Rutinas": programas con días. Se activa una y de ahí sale lo que toca hoy. */
export function RoutinesTab({ routines, templates, activeId, workouts, onNew, onEdit, onDuplicate, onDelete, onSetActive, onStart, onImportTemplate }: Props) {
  return (
    <div className="wk-routines">
      <div className="wk-toolbar">
        <p className="wk-toolbar-text">Una rutina es un programa con varios días. Activá una y la solapa <strong>Hoy</strong> te muestra el día que sigue.</p>
        <button type="button" className="primary-button" onClick={onNew}><Plus size={16} aria-hidden /> Nueva rutina</button>
      </div>

      {routines.length === 0 ? (
        <div className="empty-state wk-empty">
          <Dumbbell size={40} aria-hidden />
          <h4>Todavía no tenés rutinas</h4>
          <p>Armá una (por ejemplo “Rutina Septiembre” con sus 5 días) o traé una sesión de tu historial como día.</p>
          <button type="button" className="primary-button" onClick={onNew}><Plus size={16} aria-hidden /> Crear mi primera rutina</button>
        </div>
      ) : (
        <div className="wk-routine-list">
          {routines.map((r) => {
            const active = r.id === activeId
            const next = nextRoutineDay(r, workouts)
            return (
              <section key={r.id} className={`panel wk-routine${active ? ' is-active' : ''}`}>
                <div className="wk-routine-head">
                  <div>
                    <h3>{r.name}{active ? <span className="wk-chip is-on"><Star size={12} aria-hidden /> Activa</span> : null}</h3>
                    <p>{r.days.length} día{r.days.length === 1 ? '' : 's'}{r.notes ? ` · ${r.notes}` : ''}</p>
                  </div>
                  <div className="wk-routine-actions">
                    <button type="button" className={active ? 'secondary-button' : 'primary-button'} onClick={() => onSetActive(active ? undefined : r.id)}>
                      {active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button type="button" className="secondary-button wk-icon-btn" onClick={() => onEdit(r)} aria-label={`Editar ${r.name}`} title="Editar"><Pencil size={15} aria-hidden /></button>
                    <button type="button" className="secondary-button wk-icon-btn" onClick={() => onDuplicate(r)} aria-label={`Duplicar ${r.name}`} title="Duplicar"><Copy size={15} aria-hidden /></button>
                    <button type="button" className="secondary-button wk-icon-btn wk-danger" onClick={() => onDelete(r)} aria-label={`Eliminar ${r.name}`} title="Eliminar"><Trash2 size={15} aria-hidden /></button>
                  </div>
                </div>
                <ol className="wk-day-list">
                  {r.days.map((d, i) => {
                    const o = dayOverview(d)
                    return (
                      <li key={d.id} className={next && next.index === i ? 'is-next' : ''}>
                        <div>
                          <strong>{d.name}</strong>
                          {next && next.index === i ? <span className="wk-chip">Sigue</span> : null}
                          <small>{o.exerciseCount === 0 ? 'Sin ejercicios' : `${o.preview} · ${o.sets} series`}</small>
                        </div>
                        <button type="button" className="secondary-button wk-small" disabled={o.exerciseCount === 0} onClick={() => onStart({ title: d.name, type: d.type ?? 'fuerza', exercises: prepareDayForLive(d, workouts, uuid), routineId: r.id, routineDayId: d.id })}>
                          <Play size={13} aria-hidden /> Empezar
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )
          })}
        </div>
      )}

      {templates.length > 0 ? (
        <section className="panel">
          <div className="panel-header"><h3 className="panel-title"><Sparkles size={16} aria-hidden /> Plantillas del asistente</h3></div>
          <p className="wk-toolbar-text">Rutinas que te armó el asistente. Convertilas en rutina para usarlas con “Hoy” y el modo en vivo.</p>
          <ul className="wk-recent">
            {templates.map((t) => (
              <li key={t.id}>
                <div><strong>{t.name}</strong><small>{t.exercises.length} ejercicios</small></div>
                <button type="button" className="secondary-button wk-small" onClick={() => onImportTemplate(t)}>Convertir en rutina</button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
