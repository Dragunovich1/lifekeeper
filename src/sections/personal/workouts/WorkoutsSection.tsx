import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { SectionHeader } from '../../../components/SectionHeader'
import { useAppData } from '../../../hooks/useAppData'
import { usePreferences } from '../../../preferences/context'
import type { LiveWorkoutDraft, WorkoutRoutine, WorkoutSession, WorkoutTemplate } from '../../../types'
import { formatDate } from '../../../utils/dates'
import { exportWorkoutsToPDF } from '../../../utils/workoutPdfExport'
import { duplicateRoutine, prepareDayForLive, templateToRoutine } from '../../../utils/workoutRoutines'
import { exerciseRecords, formatSeconds, kgToDisplay, type newRecords } from '../../../utils/workoutSets'
import type { PeriodKind } from '../../../utils/workoutExport'
import { QUICK_EXERCISES } from './constants'
import { ExercisesTab } from './ExercisesTab'
import { ExportModal } from './ExportModal'
import { HistoryTab } from './HistoryTab'
import { LiveSession } from './LiveSession'
import { RoutineEditorModal } from './RoutineEditorModal'
import { RoutinesTab } from './RoutinesTab'
import { SessionEditorModal } from './SessionEditorModal'
import { TodayTab, type StartOptions } from './TodayTab'
import '../../../styles/workouts.css'

type Tab = 'today' | 'routines' | 'history' | 'exercises'

export const WorkoutsSection = () => {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const isImperial = preferences.unitSystem === 'imperial'
  const userName = data.profile.nickName || data.profile.fullName || 'Atleta'

  const workouts = useMemo(() => data.personal.workouts ?? [], [data.personal.workouts])
  const routines = useMemo(() => data.personal.workoutRoutines ?? [], [data.personal.workoutRoutines])
  const templates = useMemo(() => data.personal.workoutTemplates ?? [], [data.personal.workoutTemplates])
  const activeRoutine = routines.find((r) => r.id === data.personal.activeRoutineId) ?? null
  const liveDraft = data.personal.liveWorkout ?? null

  const [tab, setTab] = useState<Tab>('today')
  const [liveOpen, setLiveOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [filters, setFilters] = useState<{ period: PeriodKind; type: string; search: string }>({ period: 'all', type: 'all', search: '' })

  const [sessionModal, setSessionModal] = useState<{ open: boolean; session: WorkoutSession | null }>({ open: false, session: null })
  const [routineModal, setRoutineModal] = useState<{ open: boolean; routine: WorkoutRoutine | null }>({ open: false, routine: null })
  const [exportOpen, setExportOpen] = useState(false)
  const [deletingSession, setDeletingSession] = useState<WorkoutSession | null>(null)
  const [deletingRoutine, setDeletingRoutine] = useState<WorkoutRoutine | null>(null)

  // Ejercicios para elegir con un toque: los que más hacés + los comunes
  const suggestions = useMemo(() => {
    const mine = exerciseRecords(workouts).map((r) => r.name)
    const seen = new Set(mine.map((n) => n.toLowerCase()))
    return [...mine, ...QUICK_EXERCISES.filter((n) => !seen.has(n.toLowerCase()))]
  }, [workouts])

  const patchPersonal = useCallback(
    (fn: (p: typeof data.personal) => typeof data.personal) => updateData((prev) => ({ ...prev, personal: fn(prev.personal) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateData],
  )

  /* ---------- Sesión en vivo (guardada cifrada, con un pequeño retraso) ---------- */
  const pending = useRef<LiveWorkoutDraft | null | undefined>(undefined)
  const timer = useRef<number | undefined>(undefined)
  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (pending.current === undefined) return
    const value = pending.current
    pending.current = undefined
    patchPersonal((p) => ({ ...p, liveWorkout: value }))
  }, [patchPersonal])
  const persistLive = useCallback(
    (d: LiveWorkoutDraft | null) => {
      pending.current = d
      window.clearTimeout(timer.current)
      if (d === null) flush()
      else timer.current = window.setTimeout(flush, 700)
    },
    [flush],
  )
  useEffect(() => flush, [flush]) // al salir de la sección se guarda lo pendiente

  const startLive = (o: StartOptions) => {
    const draft: LiveWorkoutDraft = {
      title: o.title,
      type: o.type,
      notes: '',
      exercises: o.exercises,
      startedAt: new Date().toISOString(),
      accumulatedSeconds: 0,
      runningSince: new Date().toISOString(),
      routineId: o.routineId,
      routineDayId: o.routineDayId,
    }
    patchPersonal((p) => ({ ...p, liveWorkout: draft }))
    setMessage(null)
    setLiveOpen(true)
  }

  const onFinish = (session: WorkoutSession, records: ReturnType<typeof newRecords>) => {
    patchPersonal((p) => ({ ...p, workouts: [session, ...(p.workouts ?? [])], liveWorkout: null }))
    const unit = isImperial ? 'lb' : 'kg'
    const rec = records.length
      ? ` 🏆 ${records.length === 1 ? 'Nuevo récord' : 'Nuevos récords'}: ${records.map((r) => `${r.name} ${r.kind === 'tiempo' ? formatSeconds(r.value) : `${kgToDisplay(r.value, isImperial)} ${unit}${r.kind === 'e1rm' ? ' (1RM est.)' : ''}`}`).join(', ')}.`
      : ''
    setMessage(`¡Buen entrenamiento! “${session.title}” quedó guardado (${session.durationMinutes ?? 0} min).${rec}`)
    setLiveOpen(false)
    setTab('today')
  }

  const repeatSession = (w: WorkoutSession) => {
    startLive({ title: w.title, type: w.type, exercises: prepareDayForLive({ id: 'x', name: w.title, exercises: w.exercises }, workouts, uuid), routineId: w.routineId, routineDayId: w.routineDayId })
  }

  /* ---------- Sesiones ---------- */
  const saveSession = (s: WorkoutSession) => {
    patchPersonal((p) => {
      const list = p.workouts ?? []
      const exists = list.some((w) => w.id === s.id)
      return { ...p, workouts: exists ? list.map((w) => (w.id === s.id ? s : w)) : [s, ...list] }
    })
    setSessionModal({ open: false, session: null })
    setMessage(null)
    setTab('history')
  }
  const removeSession = (id: string) => patchPersonal((p) => ({ ...p, workouts: (p.workouts ?? []).filter((w) => w.id !== id) }))

  /* ---------- Rutinas ---------- */
  const saveRoutine = (r: WorkoutRoutine) => {
    patchPersonal((p) => {
      const list = p.workoutRoutines ?? []
      const exists = list.some((x) => x.id === r.id)
      return {
        ...p,
        workoutRoutines: exists ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r],
        activeRoutineId: p.activeRoutineId ?? r.id, // la primera rutina queda activa
      }
    })
    setRoutineModal({ open: false, routine: null })
  }
  const removeRoutine = (id: string) =>
    patchPersonal((p) => ({ ...p, workoutRoutines: (p.workoutRoutines ?? []).filter((r) => r.id !== id), activeRoutineId: p.activeRoutineId === id ? undefined : p.activeRoutineId }))
  const setActive = (id: string | undefined) => patchPersonal((p) => ({ ...p, activeRoutineId: id }))
  const importTemplate = (t: WorkoutTemplate) => {
    const r = templateToRoutine(t, uuid)
    patchPersonal((p) => ({ ...p, workoutRoutines: [...(p.workoutRoutines ?? []), r], activeRoutineId: p.activeRoutineId ?? r.id }))
  }

  const exportSinglePdf = (s: WorkoutSession) =>
    void exportWorkoutsToPDF({ workouts: [s], userName, filterPeriodLabel: `Sesión del ${formatDate(s.date)}`, unitSystem: isImperial ? 'imperial' : 'metric', routines, fileName: `LifeKeeper-${s.title.replace(/[^\p{L}\p{N}]+/gu, '-')}-${s.date.slice(0, 10)}.pdf` })

  /* ---------- Vista en vivo ---------- */
  if (liveDraft && liveOpen) {
    return (
      <div>
        <SectionHeader title="Entrenando" subtitle="Tu sesión se guarda sola: si cerrás la app la retomás desde “Hoy”" />
        <div className="section-body">
          <div className="wk-live-back">
            <button type="button" className="secondary-button wk-small" onClick={() => { flush(); setLiveOpen(false) }}>← Salir sin terminar (queda guardada)</button>
          </div>
          <LiveSession key={liveDraft.startedAt} draft={liveDraft} onChange={persistLive} onFinish={onFinish} workouts={workouts} isImperial={isImperial} suggestions={suggestions} />
        </div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'routines', label: 'Rutinas', count: routines.length },
    { key: 'history', label: 'Historial', count: workouts.length },
    { key: 'exercises', label: 'Ejercicios' },
  ]

  return (
    <div>
      <SectionHeader title="Entrenamientos" subtitle="Rutinas con días, gym en vivo, progreso por ejercicio y exportación por período" />

      <div className="wk-tabs" role="tablist" aria-label="Secciones de entrenamiento">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`wk-tab${tab === t.key ? ' is-active' : ''}`} onClick={() => { setTab(t.key); if (t.key !== 'today') setMessage(null) }}>
            {t.label}{t.count ? <span className="wk-tab-count">{t.count}</span> : null}
          </button>
        ))}
      </div>

      <div className="section-body">
        {tab === 'today' ? (
          <TodayTab
            workouts={workouts}
            routines={routines}
            activeRoutine={activeRoutine}
            liveDraft={liveDraft}
            isImperial={isImperial}
            onStart={startLive}
            onResume={() => setLiveOpen(true)}
            onOpenRoutines={() => setTab('routines')}
            onOpenHistory={() => setTab('history')}
            onRegister={() => setSessionModal({ open: true, session: null })}
            message={message}
          />
        ) : null}
        {tab === 'routines' ? (
          <RoutinesTab
            routines={routines}
            templates={templates}
            activeId={data.personal.activeRoutineId}
            workouts={workouts}
            onNew={() => setRoutineModal({ open: true, routine: null })}
            onEdit={(r) => setRoutineModal({ open: true, routine: r })}
            onDuplicate={(r) => patchPersonal((p) => ({ ...p, workoutRoutines: [...(p.workoutRoutines ?? []), duplicateRoutine(r, uuid)] }))}
            onDelete={setDeletingRoutine}
            onSetActive={setActive}
            onStart={startLive}
            onImportTemplate={importTemplate}
          />
        ) : null}
        {tab === 'history' ? (
          <HistoryTab
            workouts={workouts}
            routines={routines}
            isImperial={isImperial}
            filters={filters}
            onFilters={setFilters}
            onRegister={() => setSessionModal({ open: true, session: null })}
            onExport={() => setExportOpen(true)}
            onEdit={(w) => setSessionModal({ open: true, session: w })}
            onRepeat={repeatSession}
            onDelete={setDeletingSession}
            onPdf={exportSinglePdf}
          />
        ) : null}
        {tab === 'exercises' ? <ExercisesTab workouts={workouts} isImperial={isImperial} /> : null}
      </div>

      <SessionEditorModal open={sessionModal.open} session={sessionModal.session} onClose={() => setSessionModal({ open: false, session: null })} onSave={saveSession} isImperial={isImperial} suggestions={suggestions} />
      <RoutineEditorModal open={routineModal.open} routine={routineModal.routine} onClose={() => setRoutineModal({ open: false, routine: null })} onSave={saveRoutine} workouts={workouts} isImperial={isImperial} suggestions={suggestions} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} workouts={workouts} routines={routines} userName={userName} isImperial={isImperial} initial={{ period: filters.period === 'all' ? 'month' : filters.period, type: filters.type, search: filters.search }} />

      <ConfirmModal
        open={Boolean(deletingSession)}
        title="Eliminar entrenamiento"
        message={deletingSession ? `¿Eliminar “${deletingSession.title}” del ${formatDate(deletingSession.date)}? No se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        onConfirm={() => { if (deletingSession) removeSession(deletingSession.id); setDeletingSession(null) }}
        onClose={() => setDeletingSession(null)}
      />
      <ConfirmModal
        open={Boolean(deletingRoutine)}
        title="Eliminar rutina"
        message={deletingRoutine ? `¿Eliminar la rutina “${deletingRoutine.name}”? Tus entrenamientos ya hechos no se borran.` : ''}
        confirmLabel="Eliminar"
        onConfirm={() => { if (deletingRoutine) removeRoutine(deletingRoutine.id); setDeletingRoutine(null) }}
        onClose={() => setDeletingRoutine(null)}
      />
    </div>
  )
}
