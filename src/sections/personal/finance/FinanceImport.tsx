import { useMemo, useRef, useState, type DragEvent } from 'react'
import { v4 as uuid } from 'uuid'
import { AlertTriangle, Check, FileSpreadsheet, FileText, FileUp, Loader2, RotateCcw, Undo2 } from 'lucide-react'
import { CategoryIcon } from '../../../components/CategoryIcon'
import { useAppData } from '../../../hooks/useAppData'
import { usePreferences } from '../../../preferences/context'
import type { FinanceImportLog, FinanceTransaction, TransactionType } from '../../../types'
import { formatCurrency } from '../../../utils/dates'
import { allCategories, resolveCategory } from '../../../utils/financeCategories'
import { readFinanceFile, type ReadResult } from '../../../utils/financeFiles'
import {
  detectColumns,
  detectHeaderRow,
  guessMode,
  guessModeFromLines,
  pdfLinesToRows,
  tableToRows,
  type ColumnMap,
  type FileMode,
  type ImportRow,
} from '../../../utils/financeImport'
import '../../../styles/finance-calendar.css'

const CURRENCIES = ['ARS', 'USD', 'EUR', 'USDT', 'BRL', 'CLP']
const COLUMN_FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: 'date', label: 'Fecha' },
  { key: 'description', label: 'Descripción' },
  { key: 'amount', label: 'Importe' },
  { key: 'debit', label: 'Débito' },
  { key: 'credit', label: 'Crédito' },
]

interface RowEdit {
  category?: string
  type?: TransactionType
  include?: boolean
}

export function FinanceImport({ onDone }: { onDone: () => void }) {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const defaultCurrency = preferences.currency || 'ARS'
  const customCats = useMemo(() => data.personal.financeCategories ?? [], [data.personal.financeCategories])
  const imports = data.personal.financeImports ?? []

  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [source, setSource] = useState<ReadResult | null>(null)
  const [tableIdx, setTableIdx] = useState(0)
  const [mode, setMode] = useState<FileMode>('bank')
  const [currency, setCurrency] = useState<string>(defaultCurrency)
  const [mapOverride, setMapOverride] = useState<Partial<ColumnMap>>({})
  const [edits, setEdits] = useState<Record<string, RowEdit>>({})
  const [onlyOthers, setOnlyOthers] = useState(false)
  const [done, setDone] = useState<{ count: number; id: string } | null>(null)

  // ---- Lectura del archivo -------------------------------------------------
  const handleFile = async (file: File) => {
    setError('')
    setDone(null)
    setBusy(true)
    setEdits({})
    setMapOverride({})
    setTableIdx(0)
    try {
      const result = await readFinanceFile(file)
      setFileName(file.name)
      setSource(result)
      if (result.kind === 'pdf') setMode(guessModeFromLines(result.lines, file.name))
      else {
        const rows = result.tables[0]?.rows ?? []
        const h = detectHeaderRow(rows)
        setMode(guessMode(rows, h, detectColumns(rows, h), file.name))
      }
    } catch (e) {
      setSource(null)
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void handleFile(f)
  }

  // ---- Interpretación ------------------------------------------------------
  const table = source?.kind === 'table' ? source.tables[tableIdx] : undefined
  const headerRow = useMemo(() => (table ? detectHeaderRow(table.rows) : -1), [table])
  const detectedMap = useMemo(() => (table ? detectColumns(table.rows, headerRow) : null), [table, headerRow])
  const map: ColumnMap | null = detectedMap ? { ...detectedMap, ...mapOverride } : null

  const baseRows: ImportRow[] = useMemo(() => {
    if (!source) return []
    const ctx = { mode, defaultCurrency: currency, existing: data.personal.finances }
    if (source.kind === 'pdf') return pdfLinesToRows(source.lines, ctx)
    if (!table || !map) return []
    return tableToRows(table.rows, headerRow, map, ctx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, table, headerRow, mode, currency, mapOverride, data.personal.finances])

  const rows = useMemo(() => baseRows.map((r) => ({ ...r, ...edits[r.id] })), [baseRows, edits])
  const selected = rows.filter((r) => r.include)
  const totals = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const r of selected) r.type === 'income' ? (inc += r.amount) : (exp += r.amount)
    return { inc, exp }
  }, [selected])
  const dupCount = rows.filter((r) => r.duplicate).length
  const shown = onlyOthers ? rows.filter((r) => /^otros/i.test(r.category)) : rows

  const patch = (id: string, change: RowEdit) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...change } }))
  const setAll = (include: boolean) => setEdits((prev) => Object.fromEntries(rows.map((r) => [r.id, { ...prev[r.id], include }])))

  const toggleType = (r: ImportRow & RowEdit) => {
    const next: TransactionType = r.type === 'income' ? 'expense' : 'income'
    const pool = allCategories(customCats, next)
    patch(r.id, { type: next, category: pool[pool.length - 1].name })
  }

  // ---- Importar ------------------------------------------------------------
  const runImport = () => {
    if (selected.length === 0) return
    const importId = uuid()
    const txs: FinanceTransaction[] = selected.map((r) => ({
      id: uuid(),
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      category: r.category,
      date: r.date,
      description: r.description || undefined,
      importId,
    }))
    const log: FinanceImportLog = { id: importId, fileName, at: new Date().toISOString(), count: txs.length }
    updateData((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        finances: [...txs, ...prev.personal.finances],
        financeImports: [log, ...(prev.personal.financeImports ?? [])],
      },
    }))
    setDone({ count: txs.length, id: importId })
    setSource(null)
    setFileName('')
    setEdits({})
  }

  const undoImport = (id: string) => {
    updateData((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        finances: prev.personal.finances.filter((t) => t.importId !== id),
        financeImports: (prev.personal.financeImports ?? []).filter((l) => l.id !== id),
      },
    }))
    if (done?.id === id) setDone(null)
  }

  const reset = () => {
    setSource(null)
    setFileName('')
    setError('')
    setEdits({})
    setDone(null)
  }

  // ---- Render --------------------------------------------------------------
  return (
    <div className="fin-import">
      {!source && (
        <>
          <div
            className={`fin-drop ${dragging ? 'is-drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = '' }} />
            {busy ? <Loader2 size={34} className="spin" aria-hidden="true" /> : <FileUp size={34} aria-hidden="true" />}
            <h3>{busy ? 'Leyendo el archivo…' : 'Importá movimientos desde un archivo'}</h3>
            <p>Resúmenes de tarjeta en PDF, extractos del banco en CSV o Excel. Soltalo acá o elegilo desde tu dispositivo.</p>
            <button type="button" className="primary-button" onClick={() => inputRef.current?.click()} disabled={busy}>
              <FileUp size={16} /> Elegir archivo
            </button>
            <small>🔒 El archivo se lee en tu dispositivo: no se sube a ningún servidor.</small>
          </div>

          {error && <p className="fin-import-error" role="alert"><AlertTriangle size={16} /> {error}</p>}

          {done && (
            <div className="fin-import-done" role="status">
              <Check size={20} />
              <div>
                <strong>Se importaron {done.count} movimientos.</strong>
                <span>Ya los ves en el calendario y en los totales.</span>
              </div>
              <button type="button" className="secondary-button" onClick={() => undoImport(done.id)}><Undo2 size={14} /> Deshacer</button>
              <button type="button" className="primary-button" onClick={onDone}>Ver calendario</button>
            </div>
          )}

          <ul className="fin-import-tips">
            <li><FileText size={16} /> <span><b>Tarjeta:</b> en el home banking, bajá el resumen en PDF. Se leen fecha, comercio e importe.</span></li>
            <li><FileSpreadsheet size={16} /> <span><b>Cuenta:</b> descargá los movimientos en CSV o Excel. Se detectan las columnas solas.</span></li>
            <li><Check size={16} /> <span>Antes de guardar vas a ver todo, con la categoría sugerida, para corregir lo que haga falta.</span></li>
          </ul>

          {imports.length > 0 && (
            <section className="fin-import-history" aria-label="Importaciones anteriores">
              <h3>Importaciones anteriores</h3>
              <ul>
                {imports.map((l) => (
                  <li key={l.id}>
                    <span><strong>{l.fileName}</strong><small>{new Date(l.at).toLocaleDateString('es-AR')} · {l.count} movimientos</small></span>
                    <button type="button" className="secondary-button" onClick={() => undoImport(l.id)}><Undo2 size={14} /> Deshacer</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {source && (
        <>
          <header className="fin-import-head">
            <div>
              <strong>{fileName}</strong>
              <span>{rows.length} movimientos encontrados</span>
            </div>
            <button type="button" className="secondary-button" onClick={reset}><RotateCcw size={14} /> Otro archivo</button>
          </header>

          <div className="fin-import-opts">
            <div className="fin-seg" role="radiogroup" aria-label="Tipo de archivo">
              <button type="button" role="radio" aria-checked={mode === 'bank'} className={mode === 'bank' ? 'is-active' : ''} onClick={() => setMode('bank')}>Cuenta bancaria</button>
              <button type="button" role="radio" aria-checked={mode === 'card'} className={mode === 'card' ? 'is-active' : ''} onClick={() => setMode('card')}>Tarjeta de crédito</button>
            </div>
            <label className="fin-opt">
              <span>Moneda</span>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {source.kind === 'table' && source.tables.length > 1 && (
              <label className="fin-opt">
                <span>Hoja</span>
                <select value={tableIdx} onChange={(e) => { setTableIdx(Number(e.target.value)); setMapOverride({}); setEdits({}) }}>
                  {source.tables.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <p className="fin-import-modehint">
            {mode === 'card' ? 'Tarjeta: los consumos son gastos; los importes a favor (devoluciones) son ingresos y los pagos del resumen se omiten.' : 'Cuenta: lo que sale es gasto y lo que entra es ingreso.'}
          </p>

          {map && table && (
            <details className="fin-import-cols">
              <summary>Columnas detectadas</summary>
              <div className="fin-cols-grid">
                {COLUMN_FIELDS.map((f) => (
                  <label key={f.key} className="fin-opt">
                    <span>{f.label}</span>
                    <select value={map[f.key]} onChange={(e) => { setMapOverride((m) => ({ ...m, [f.key]: Number(e.target.value) })); setEdits({}) }}>
                      <option value={-1}>— ninguna —</option>
                      {Array.from({ length: Math.max(...table.rows.slice(0, 30).map((r) => r.length)) }, (_, i) => {
                        const head = headerRow >= 0 ? String(table.rows[headerRow][i] ?? '').trim() : ''
                        return <option key={i} value={i}>{`Col. ${i + 1}${head ? `: ${head.slice(0, 22)}` : ''}`}</option>
                      })}
                    </select>
                  </label>
                ))}
              </div>
            </details>
          )}

          {rows.length === 0 ? (
            <div className="fin-import-empty" role="alert">
              <AlertTriangle size={22} />
              <p>No encontré movimientos con fecha e importe. Probá cambiando el tipo de archivo o las columnas{source.kind === 'pdf' ? ', o usá el CSV/Excel del banco si lo tenés' : ''}.</p>
            </div>
          ) : (
            <>
              <div className="fin-import-bar">
                <span><b>{selected.length}</b> de {rows.length} seleccionados</span>
                {dupCount > 0 && <span className="dup"><AlertTriangle size={13} /> {dupCount} ya cargados</span>}
                <span className="grow" />
                <button type="button" className="fin-link" onClick={() => setOnlyOthers((v) => !v)} aria-pressed={onlyOthers}>{onlyOthers ? 'Ver todos' : 'Ver solo “Otros”'}</button>
                <button type="button" className="fin-link" onClick={() => setAll(true)}>Todos</button>
                <button type="button" className="fin-link" onClick={() => setAll(false)}>Ninguno</button>
              </div>

              <ul className="fin-import-list">
                {shown.map((r) => {
                  const view = resolveCategory(r.category, r.type, customCats)
                  const options = allCategories(customCats, r.type)
                  return (
                    <li key={r.id} className={`${r.include ? '' : 'is-off'} ${r.duplicate ? 'is-dup' : ''}`}>
                      <label className="fin-import-check">
                        <input type="checkbox" checked={r.include} onChange={(e) => patch(r.id, { include: e.target.checked })} aria-label={`Incluir ${r.description}`} />
                      </label>
                      <span className="fin-import-date">{r.date.split('-').reverse().slice(0, 2).join('/')}</span>
                      <span className="fin-import-desc" title={r.description}>
                        {r.description || '(sin descripción)'}
                        {(r.duplicate || r.note) && <small>{r.duplicate ? 'Parece estar ya cargado' : r.note}</small>}
                      </span>
                      <button type="button" className={`fin-import-amt ${r.type === 'income' ? 'inc' : 'exp'}`} onClick={() => toggleType(r)} title="Tocá para cambiar entre gasto e ingreso">
                        {r.type === 'income' ? '+' : '−'}{formatCurrency(r.amount, r.currency)}
                      </button>
                      <span className="fin-import-cat">
                        <CategoryIcon icon={view.icon} color={view.color} size={14} />
                        <select value={view.name} onChange={(e) => patch(r.id, { category: e.target.value })} aria-label={`Categoría de ${r.description}`}>
                          {!options.some((o) => o.name === view.name) && <option value={view.name}>{view.name}</option>}
                          {options.map((o) => <option key={`${o.custom}-${o.name}`} value={o.name}>{o.name}</option>)}
                        </select>
                      </span>
                    </li>
                  )
                })}
              </ul>

              <footer className="fin-import-foot">
                <div className="fin-import-sum">
                  <span className="inc">+{formatCurrency(totals.inc, currency)}</span>
                  <span className="exp">−{formatCurrency(totals.exp, currency)}</span>
                </div>
                <button type="button" className="primary-button" onClick={runImport} disabled={selected.length === 0}>
                  <Check size={16} /> Importar {selected.length} {selected.length === 1 ? 'movimiento' : 'movimientos'}
                </button>
              </footer>
            </>
          )}
        </>
      )}
    </div>
  )
}
