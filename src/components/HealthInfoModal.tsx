import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ExternalLink, Search, ShieldCheck } from 'lucide-react'
import { Modal } from './Modal'
import { getDrugInfo, getHealthTopics, type HealthInfoResult } from '../services/api/publicData'
import '../styles/health-info.css'

const CONSENT_KEY = 'lk_medlineplus_consent_v1'
const readConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

interface Props {
  open: boolean
  onClose: () => void
  /** `drug`: ficha de un medicamento · `topic`: tema de salud (diagnóstico, estudio, enfermedad…). */
  mode: 'drug' | 'topic'
  initialQuery: string
}

/** Información de salud en español de MedlinePlus (NIH), solo cuando la persona la pide. */
export function HealthInfoModal({ open, onClose, mode, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<HealthInfoResult | null>(null)
  const [consent, setConsent] = useState(readConsent)
  const seq = useRef(0)

  const run = useCallback(
    async (q: string) => {
      const term = q.trim()
      if (term.length < 2) return
      const mine = ++seq.current
      setStatus('loading')
      try {
        const r = mode === 'drug' ? await getDrugInfo(term) : await getHealthTopics(term)
        if (mine !== seq.current) return
        setResult(r)
        setStatus('done')
      } catch {
        if (mine !== seq.current) return
        setStatus('error')
      }
    },
    [mode],
  )

  // Al abrir: se reinicia y, si ya aceptó el aviso de privacidad, busca solo
  useEffect(() => {
    if (!open) return
    setQuery(initialQuery)
    setResult(null)
    setStatus('idle')
    if (readConsent()) void run(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery, mode])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      localStorage.setItem(CONSENT_KEY, '1')
    } catch {
      /* sin almacenamiento */
    }
    setConsent(true)
    void run(query)
  }

  const title = mode === 'drug' ? 'Información del medicamento' : 'Información de salud'

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle="MedlinePlus · Biblioteca Nacional de Medicina de EE.UU." className="hinfo-modal">
      <div className="hinfo">
        <form className="hinfo-search" onSubmit={submit}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mode === 'drug' ? 'Nombre del medicamento (ej. ibuprofeno)' : 'Tema de salud (ej. diabetes, hipertensión)'} aria-label="Término a buscar" />
          <button type="submit" className="primary-button" disabled={query.trim().length < 2 || status === 'loading'}>
            <Search size={16} /> Buscar
          </button>
        </form>

        {!consent && status === 'idle' && (
          <p className="hinfo-privacy">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              Para mostrarte esta información se consulta <b>MedlinePlus</b> (NIH), a través de tu propio servidor, <b>solo con el término que ves arriba</b>. No se envía nada más de tu bóveda. Tocá “Buscar” para continuar.
            </span>
          </p>
        )}

        {status === 'loading' && <p className="hinfo-state" role="status">Buscando en MedlinePlus…</p>}

        {status === 'error' && (
          <p className="hinfo-state is-error" role="alert">
            No pude conectar con MedlinePlus ahora. Revisá tu conexión o el servidor y volvé a intentar.
          </p>
        )}

        {status === 'done' && result && (
          <>
            {result.stale && <p className="hinfo-note">Mostrando una copia guardada (no se pudo actualizar).</p>}
            {result.ingredient && <p className="hinfo-note">Consultado como: <b>{result.ingredient}</b></p>}
            {result.topics.length === 0 ? (
              <p className="hinfo-state">
                No encontré resultados en español para “{result.query}”.{' '}
                {mode === 'drug' ? 'Probá con el principio activo (por ejemplo “ibuprofeno” en lugar de la marca).' : 'Probá con otra palabra o un nombre más general.'}
              </p>
            ) : (
              <ul className="hinfo-list">
                {result.topics.map((t) => (
                  <li key={`${t.url}-${t.title}`}>
                    <h4>{t.title}</h4>
                    {t.summary && <p>{t.summary}</p>}
                    {t.url && (
                      <a href={t.url} target="_blank" rel="noopener noreferrer">
                        Leer más en MedlinePlus <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <p className="hinfo-disclaimer">
          Información general con fines educativos. No reemplaza la consulta con tu médico ni indica dosis personales.{' '}
          <a href="https://medlineplus.gov/spanish/" target="_blank" rel="noopener noreferrer">Abrir MedlinePlus</a>
        </p>
      </div>
    </Modal>
  )
}
