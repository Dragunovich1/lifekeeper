import { useCallback, useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Calculator as CalcIcon, ChevronDown, Copy, Delete, History, Percent, Receipt, Tag, Trash2, Users } from 'lucide-react'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import { evaluateExpression, formatMoney, formatNumber } from '../../utils/calculator'
import '../../styles/utility-tools.css'

type Tab = 'basic' | 'tools'

const KEYS: { label: string; value: string; kind?: 'op' | 'fn' | 'eq' }[] = [
  { label: 'C', value: 'clear', kind: 'fn' },
  { label: '( )', value: 'paren', kind: 'fn' },
  { label: '%', value: '%', kind: 'fn' },
  { label: '÷', value: '÷', kind: 'op' },
  { label: '7', value: '7' }, { label: '8', value: '8' }, { label: '9', value: '9' }, { label: '×', value: '×', kind: 'op' },
  { label: '4', value: '4' }, { label: '5', value: '5' }, { label: '6', value: '6' }, { label: '−', value: '−', kind: 'op' },
  { label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' }, { label: '+', value: '+', kind: 'op' },
  { label: '±', value: 'neg', kind: 'fn' }, { label: '0', value: '0' }, { label: ',', value: ',' }, { label: '=', value: '=', kind: 'eq' },
]

const MAX_HISTORY = 30

/** Número editable como texto: acepta coma o punto. */
const toNum = (v: string): number => parseFloat(v.replace(',', '.'))

export const CalculatorSection = () => {
  const { data, updateData } = useAppData()
  const history = data.utilities.calculatorHistory ?? []
  const [tab, setTab] = useState<Tab>('basic')
  const [expr, setExpr] = useState('')
  const [justEvaluated, setJustEvaluated] = useState(false)
  const [copied, setCopied] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const live = useMemo(() => (expr ? evaluateExpression(expr) : null), [expr])
  const preview = live?.ok && /[+\-−×÷*/^%(]/.test(expr.slice(1)) ? formatNumber(live.value) : ''

  const saveHistory = useCallback(
    (expression: string, result: string) =>
      updateData((prev) => ({
        ...prev,
        utilities: {
          ...prev.utilities,
          calculatorHistory: [{ id: uuid(), expression, result, at: new Date().toISOString() }, ...(prev.utilities.calculatorHistory ?? [])].slice(0, MAX_HISTORY),
        },
      })),
    [updateData],
  )

  const press = useCallback(
    (key: string) => {
      setCopied(false)
      if (key === 'clear') {
        setExpr('')
        setJustEvaluated(false)
        return
      }
      if (key === 'back') {
        setExpr((e) => (justEvaluated ? '' : e.slice(0, -1)))
        setJustEvaluated(false)
        return
      }
      if (key === '=') {
        const r = evaluateExpression(expr)
        if (r.ok) {
          const result = String(parseFloat(r.value.toPrecision(12)))
          if (expr !== result) saveHistory(expr, formatNumber(r.value))
          setExpr(result.replace('.', ','))
          setJustEvaluated(true)
        }
        return
      }
      if (key === 'neg') {
        setExpr((e) => (e.startsWith('−') ? e.slice(1) : e ? `−${e}` : e))
        return
      }
      if (key === 'paren') {
        setExpr((e) => {
          const open = (e.match(/\(/g) ?? []).length
          const close = (e.match(/\)/g) ?? []).length
          const last = e.slice(-1)
          return open > close && /[\d)%]/.test(last) ? e + ')' : (e && /[\d)%]/.test(last) ? `${e}×(` : `${e}(`)
        })
        setJustEvaluated(false)
        return
      }

      const isOp = /[+−×÷^]/.test(key)
      setExpr((e) => {
        let base = e
        if (justEvaluated && !isOp && key !== '%') base = ''
        if (isOp) {
          if (!base && key !== '−') return base
          if (/[+−×÷^]$/.test(base)) return base.slice(0, -1) + key
          return base + key
        }
        if (key === ',') {
          const lastNumber = base.split(/[+−×÷^()%]/).pop() ?? ''
          if (lastNumber.includes(',')) return base
          return base + (lastNumber === '' ? '0,' : ',')
        }
        if (key === '%') return /[\d)]$/.test(base) ? base + '%' : base
        return base + key
      })
      setJustEvaluated(false)
    },
    [expr, justEvaluated, saveHistory],
  )

  // Teclado físico (solo en la pestaña de la calculadora y fuera de campos de texto)
  useEffect(() => {
    if (tab !== 'basic') return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const map: Record<string, string> = { '*': '×', '/': '÷', '-': '−', '.': ',', ',': ',', Enter: '=', '=': '=', Backspace: 'back', Escape: 'clear', Delete: 'clear', '(': 'paren', ')': 'paren', '%': '%', '+': '+', '^': '^' }
      const key = /^\d$/.test(e.key) ? e.key : map[e.key]
      if (!key) return
      e.preventDefault()
      press(key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, press])

  const copyResult = async () => {
    const value = live?.ok ? formatNumber(live.value) : expr
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* portapapeles bloqueado */
    }
  }

  return (
    <div className="tool-page">
      <SectionHeader title="Calculadora" subtitle="Cuentas rápidas, porcentajes, propinas, IVA y división de gastos." />

      <div className="calc-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'basic'} className={tab === 'basic' ? 'is-active' : ''} onClick={() => setTab('basic')}>
          <CalcIcon size={15} /> Calculadora
        </button>
        <button type="button" role="tab" aria-selected={tab === 'tools'} className={tab === 'tools' ? 'is-active' : ''} onClick={() => setTab('tools')}>
          <Percent size={15} /> Herramientas
        </button>
      </div>

      {tab === 'basic' ? (
        <div className="calc-layout">
          <div className="card calc-main">
            <div className="calc-display" aria-live="polite">
              <div className="calc-expr">{expr || '0'}</div>
              <div className={`calc-result ${live && !live.ok && expr ? 'is-error' : ''}`}>
                {live && !live.ok && !/[+\-−×÷*/^(]$/.test(expr) ? live.error : preview || ' '}
              </div>
            </div>
            <div className="calc-keys">
              {KEYS.map((k) => (
                <button key={k.label} type="button" className={`calc-key ${k.kind ?? ''}`} onClick={() => press(k.value)} aria-label={k.label === '−' ? 'Menos' : k.label === '×' ? 'Por' : k.label === '÷' ? 'Dividido' : k.label === '=' ? 'Igual' : k.label}>
                  {k.label}
                </button>
              ))}
              <button type="button" className="calc-key fn wide" onClick={() => press('back')} aria-label="Borrar último"><Delete size={18} /></button>
              <button type="button" className="calc-key fn wide" onClick={copyResult} aria-label="Copiar resultado"><Copy size={16} /> {copied ? 'Copiado' : 'Copiar'}</button>
            </div>
            <p className="calc-tip">Podés usar el teclado: números, + − * / , Enter, Borrar y Esc. Ej.: <code>200 + 10%</code> suma el 10% a 200.</p>
          </div>

          <aside className={`card calc-history ${historyOpen ? 'is-open' : ''}`} aria-label="Historial">
            <div className="calc-history-head">
              <button type="button" className="calc-history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen((v) => !v)}>
                <History size={16} /> Historial {history.length > 0 && <span className="calc-history-count">{history.length}</span>}
                <ChevronDown size={16} className="calc-history-chevron" aria-hidden="true" />
              </button>
              {history.length > 0 && (
                <button type="button" className="secondary-button" onClick={() => updateData((prev) => ({ ...prev, utilities: { ...prev.utilities, calculatorHistory: [] } }))}>
                  <Trash2 size={14} /> Limpiar
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="calc-history-empty">Tus cuentas van a aparecer acá.</p>
            ) : (
              <ul>
                {history.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => { setExpr(h.result.replace(/\./g, '')); setJustEvaluated(true) }} title="Usar este resultado">
                      <span className="calc-history-expr">{h.expression}</span>
                      <span className="calc-history-res">= {h.result}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : (
        <ToolsGrid />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Herramientas
// ---------------------------------------------------------------------------
function Result({ rows }: { rows: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <dl className="tool-result">
      {rows.map((r) => (
        <div key={r.label} className={r.strong ? 'is-strong' : ''}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function NumField({ id, label, value, onChange, suffix, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; suffix?: string; placeholder?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="tool-input">
        <input id={id} type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? '0'} />
        {suffix && <span>{suffix}</span>}
      </div>
    </div>
  )
}

function ToolsGrid() {
  // Dividir la cuenta
  const [bill, setBill] = useState('')
  const [people, setPeople] = useState('2')
  const [tip, setTip] = useState('10')
  // Descuento
  const [price, setPrice] = useState('')
  const [disc, setDisc] = useState('20')
  // IVA
  const [net, setNet] = useState('')
  const [rate, setRate] = useState('21')
  const [vatMode, setVatMode] = useState<'add' | 'remove'>('add')
  // Porcentaje
  const [pctA, setPctA] = useState('')
  const [pctB, setPctB] = useState('')

  const billN = toNum(bill)
  const peopleN = Math.max(1, Math.round(toNum(people)) || 1)
  const tipN = toNum(tip) || 0
  const tipAmount = Number.isFinite(billN) ? (billN * tipN) / 100 : NaN
  const totalWithTip = billN + tipAmount

  const priceN = toNum(price)
  const discN = toNum(disc) || 0
  const saved = (priceN * discN) / 100

  const netN = toNum(net)
  const rateN = toNum(rate) || 0
  const vatAdd = netN * (rateN / 100)
  const baseFromGross = netN / (1 + rateN / 100)

  const aN = toNum(pctA)
  const bN = toNum(pctB)

  return (
    <div className="tools-grid">
      <section className="card tool-card">
        <h3><Users size={17} /> Dividir la cuenta</h3>
        <div className="form-grid two-columns">
          <NumField id="t-bill" label="Total de la cuenta" value={bill} onChange={setBill} suffix="$" />
          <NumField id="t-people" label="Personas" value={people} onChange={setPeople} />
          <NumField id="t-tip" label="Propina" value={tip} onChange={setTip} suffix="%" />
        </div>
        {Number.isFinite(billN) && billN > 0 && (
          <Result rows={[
            { label: 'Propina', value: formatMoney(tipAmount) },
            { label: 'Total con propina', value: formatMoney(totalWithTip) },
            { label: `Cada uno (${peopleN})`, value: formatMoney(totalWithTip / peopleN), strong: true },
          ]} />
        )}
      </section>

      <section className="card tool-card">
        <h3><Tag size={17} /> Descuento</h3>
        <div className="form-grid two-columns">
          <NumField id="t-price" label="Precio original" value={price} onChange={setPrice} suffix="$" />
          <NumField id="t-disc" label="Descuento" value={disc} onChange={setDisc} suffix="%" />
        </div>
        {Number.isFinite(priceN) && priceN > 0 && (
          <Result rows={[
            { label: 'Te ahorrás', value: formatMoney(saved) },
            { label: 'Precio final', value: formatMoney(priceN - saved), strong: true },
          ]} />
        )}
      </section>

      <section className="card tool-card">
        <h3><Receipt size={17} /> IVA</h3>
        <div className="form-grid two-columns">
          <NumField id="t-net" label={vatMode === 'add' ? 'Monto sin IVA' : 'Monto con IVA'} value={net} onChange={setNet} suffix="$" />
          <div className="field">
            <label htmlFor="t-rate">Alícuota</label>
            <select id="t-rate" value={rate} onChange={(e) => setRate(e.target.value)}>
              <option value="21">21%</option>
              <option value="10.5">10,5%</option>
              <option value="27">27%</option>
              <option value="0">Exento (0%)</option>
            </select>
          </div>
        </div>
        <div className="calc-tabs small" role="radiogroup" aria-label="Modo IVA">
          <button type="button" role="radio" aria-checked={vatMode === 'add'} className={vatMode === 'add' ? 'is-active' : ''} onClick={() => setVatMode('add')}>Sumar IVA</button>
          <button type="button" role="radio" aria-checked={vatMode === 'remove'} className={vatMode === 'remove' ? 'is-active' : ''} onClick={() => setVatMode('remove')}>Quitar IVA</button>
        </div>
        {Number.isFinite(netN) && netN > 0 &&
          (vatMode === 'add' ? (
            <Result rows={[
              { label: `IVA (${formatNumber(rateN)}%)`, value: formatMoney(vatAdd) },
              { label: 'Total con IVA', value: formatMoney(netN + vatAdd), strong: true },
            ]} />
          ) : (
            <Result rows={[
              { label: 'Neto sin IVA', value: formatMoney(baseFromGross), strong: true },
              { label: `IVA (${formatNumber(rateN)}%)`, value: formatMoney(netN - baseFromGross) },
            ]} />
          ))}
      </section>

      <section className="card tool-card">
        <h3><Percent size={17} /> Porcentajes</h3>
        <div className="form-grid two-columns">
          <NumField id="t-a" label="Porcentaje / valor A" value={pctA} onChange={setPctA} />
          <NumField id="t-b" label="Valor B" value={pctB} onChange={setPctB} />
        </div>
        {Number.isFinite(aN) && Number.isFinite(bN) && (
          <Result rows={[
            { label: `${formatNumber(aN)}% de ${formatNumber(bN)}`, value: formatNumber((aN * bN) / 100), strong: true },
            ...(bN !== 0 ? [{ label: `${formatNumber(aN)} es el ... % de ${formatNumber(bN)}`, value: `${formatNumber((aN / bN) * 100)}%` }] : []),
            ...(aN !== 0 ? [{ label: `Variación de ${formatNumber(aN)} a ${formatNumber(bN)}`, value: `${formatNumber(((bN - aN) / aN) * 100)}%` }] : []),
          ]} />
        )}
      </section>
    </div>
  )
}
