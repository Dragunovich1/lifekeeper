import { useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, FileJson, Table2 } from 'lucide-react'
import { DatePicker } from '../../../components/DatePicker'
import { Modal } from '../../../components/Modal'
import { Select } from '../../../components/Select'
import type { WorkoutRoutine, WorkoutSession } from '../../../types'
import { saveFile } from '../../../utils/saveFile'
import { exportWorkoutsToPDF } from '../../../utils/workoutPdfExport'
import {
  PERIOD_OPTIONS,
  buildTables,
  exercisesTable,
  filterWorkouts,
  resolvePeriod,
  sessionsTable,
  setsTable,
  summarizePeriod,
  tableToCsv,
  tablesToXlsx,
  workoutsToJson,
  type PeriodKind,
} from '../../../utils/workoutExport'
import { WORKOUT_TYPES } from './constants'

type Format = 'pdf' | 'xlsx' | 'csv' | 'json'
type CsvTable = 'sets' | 'sessions' | 'exercises'

const FORMATS: { value: Format; label: string; hint: string; icon: typeof FileText }[] = [
  { value: 'pdf', label: 'PDF', hint: 'Informe para leer o enviar a tu profe', icon: FileText },
  { value: 'xlsx', label: 'Excel', hint: '4 hojas: resumen, sesiones, series y ejercicios', icon: FileSpreadsheet },
  { value: 'csv', label: 'CSV', hint: 'Una tabla para abrir en cualquier planilla', icon: Table2 },
  { value: 'json', label: 'JSON', hint: 'Copia completa de los datos', icon: FileJson },
]

interface Props {
  open: boolean
  onClose: () => void
  workouts: WorkoutSession[]
  routines: WorkoutRoutine[]
  userName: string
  isImperial: boolean
  /** Filtros con los que se abrió (los de la solapa Historial). */
  initial?: { period?: PeriodKind; type?: string; search?: string }
}

/** Exportar entrenamientos por período y en el formato que se necesite. */
export function ExportModal({ open, onClose, workouts, routines, userName, isImperial, initial }: Props) {
  const [kind, setKind] = useState<PeriodKind>('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState('all')
  const [format, setFormat] = useState<Format>('pdf')
  const [csvTable, setCsvTable] = useState<CsvTable>('sets')
  const [incSummary, setIncSummary] = useState(true)
  const [incSets, setIncSets] = useState(true)
  const [incProgress, setIncProgress] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setKind(initial?.period ?? 'month')
    setType(initial?.type ?? 'all')
    setFrom('')
    setTo('')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const period = useMemo(() => resolvePeriod(kind, new Date(), { from, to }), [kind, from, to])
  const selected = useMemo(() => filterWorkouts(workouts, { period, type, search: initial?.search }), [workouts, period, type, initial?.search])
  const summary = useMemo(() => summarizePeriod(selected, period), [selected, period])
  const ctx = useMemo(() => ({ imperial: isImperial, routines }), [isImperial, routines])
  const invalidRange = kind === 'custom' && from && to && from > to

  const run = async () => {
    if (selected.length === 0 || invalidRange) return
    setBusy(true)
    setError(null)
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      const base = `LifeKeeper-Entrenamientos-${stamp}`
      if (format === 'pdf') {
        await exportWorkoutsToPDF({ workouts: selected, userName, period, unitSystem: isImperial ? 'imperial' : 'metric', routines, includeSummary: incSummary, includeSets: incSets, includeProgress: incProgress, fileName: `${base}.pdf` })
      } else if (format === 'xlsx') {
        await saveFile(await tablesToXlsx(buildTables(selected, period, ctx, userName)), `${base}.xlsx`)
      } else if (format === 'csv') {
        const t = csvTable === 'sets' ? setsTable(selected, ctx) : csvTable === 'sessions' ? sessionsTable(selected, ctx) : exercisesTable(selected, ctx)
        await saveFile(new Blob([tableToCsv(t)], { type: 'text/csv;charset=utf-8' }), `${base}-${csvTable}.csv`)
      } else {
        await saveFile(new Blob([workoutsToJson(selected, period, ctx, userName)], { type: 'application/json' }), `${base}.json`)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el archivo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exportar entrenamientos"
      subtitle="Elegí el período y el formato"
      maxWidth={600}
      confirmDiscard={false}
      footer={
        <>
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button type="button" className="primary-button" disabled={busy || selected.length === 0 || Boolean(invalidRange)} onClick={() => void run()}>
            <Download size={16} aria-hidden /> {busy ? 'Generando…' : 'Exportar'}
          </button>
        </>
      }
    >
      <div className="wk-export">
        <div className="wk-form-grid">
          <div className="field">
            <label htmlFor="ex-period">Período</label>
            <Select id="ex-period" value={kind} onChange={(v) => setKind(v as PeriodKind)} options={PERIOD_OPTIONS} ariaLabel="Período" />
          </div>
          <div className="field">
            <label htmlFor="ex-type">Disciplina</label>
            <Select id="ex-type" value={type} onChange={setType} options={[{ value: 'all', label: 'Todas' }, ...WORKOUT_TYPES]} ariaLabel="Disciplina" />
          </div>
          {kind === 'custom' ? (
            <>
              <div className="field"><label htmlFor="ex-from">Desde</label><DatePicker id="ex-from" value={from} onChange={setFrom} ariaLabel="Desde" /></div>
              <div className="field"><label htmlFor="ex-to">Hasta</label><DatePicker id="ex-to" value={to} onChange={setTo} ariaLabel="Hasta" /></div>
            </>
          ) : null}
        </div>
        {invalidRange ? <p className="auth-error" role="alert">La fecha “Desde” es posterior a “Hasta”.</p> : null}

        <div className={`wk-export-count${selected.length === 0 ? ' is-empty' : ''}`} role="status">
          {selected.length === 0 ? (
            'No hay entrenamientos en este período.'
          ) : (
            <>
              <span><strong>{selected.length}</strong> sesión{selected.length === 1 ? '' : 'es'} · {period.label}</span>
              <small>{summary.effectiveSets} series efectivas · {(summary.minutes / 60).toFixed(1)} h</small>
            </>
          )}
        </div>

        <div className="wk-formats" role="radiogroup" aria-label="Formato">
          {FORMATS.map((f) => (
            <label key={f.value} className={`wk-format${format === f.value ? ' is-on' : ''}`}>
              <input type="radio" name="wk-format" value={f.value} checked={format === f.value} onChange={() => setFormat(f.value)} />
              <f.icon size={20} aria-hidden />
              <span><strong>{f.label}</strong><small>{f.hint}</small></span>
            </label>
          ))}
        </div>

        {format === 'pdf' ? (
          <fieldset className="wk-export-opts">
            <legend>Qué incluir en el PDF</legend>
            <label className="wk-check"><input type="checkbox" checked={incSummary} onChange={(e) => setIncSummary(e.target.checked)} /> Resumen del período</label>
            <label className="wk-check"><input type="checkbox" checked={incSets} onChange={(e) => setIncSets(e.target.checked)} /> Detalle de series de cada sesión</label>
            <label className="wk-check"><input type="checkbox" checked={incProgress} onChange={(e) => setIncProgress(e.target.checked)} /> Progreso y récords por ejercicio</label>
          </fieldset>
        ) : null}
        {format === 'csv' ? (
          <fieldset className="wk-export-opts">
            <legend>Tabla del CSV</legend>
            {([['sets', 'Series (una fila por serie y por caída)'], ['sessions', 'Sesiones (una fila por entrenamiento)'], ['exercises', 'Ejercicios (récords y progreso)']] as [CsvTable, string][]).map(([v, l]) => (
              <label key={v} className="wk-check"><input type="radio" name="wk-csv" checked={csvTable === v} onChange={() => setCsvTable(v)} /> {l}</label>
            ))}
          </fieldset>
        ) : null}
        {format === 'xlsx' ? <p className="wk-hint-last">Incluye las hojas Resumen, Sesiones, Series y Ejercicios, con filtros y títulos fijos.</p> : null}
        {format === 'json' ? <p className="wk-hint-last">Los pesos van en kg, tal como se guardan. Sirve como respaldo o para pasar los datos a otra herramienta.</p> : null}

        {error ? <p className="auth-error" role="alert">{error}</p> : null}
      </div>
    </Modal>
  )
}
