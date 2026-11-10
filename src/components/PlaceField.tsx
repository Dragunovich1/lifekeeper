import { useEffect, useMemo, useState } from 'react'
import { Clock, Hospital, MapPin } from 'lucide-react'
import { SuggestInput, type SuggestItem } from './SuggestInput'
import { searchVenues, venueLabel, type VenueSuggestion } from '../services/api'
import { matchPlaceHistory, type HistoryPlace } from '../utils/placeHistory'

interface Props {
  id: string
  value: string
  onChange: (text: string) => void
  /** Lugares ya usados, del más al menos relevante (ver rankPlaceHistory) */
  history: HistoryPlace[]
  countryCode?: string
  /** Ciudad del perfil: se prefieren los lugares cercanos */
  near?: { latitude: number; longitude: number }
  placeholder?: string
}

type Kind = 'all' | 'hospital' | 'clinic' | 'pharmacy'
const KINDS: { key: Kind; label: string; types: string[] }[] = [
  { key: 'all', label: 'Todos', types: [] },
  { key: 'hospital', label: 'Hospital', types: ['hospital'] },
  { key: 'clinic', label: 'Clínica / consultorio', types: ['clinic', 'doctors', 'healthcare', 'centre', 'vaccination_centre', 'health_post'] },
  { key: 'pharmacy', label: 'Farmacia', types: ['pharmacy'] },
]

/**
 * "Ubicación": primero los lugares que ya usaste (funciona sin conexión) y, escribiendo, la búsqueda en OpenStreetMap
 * a través del servidor propio, priorizando establecimientos de salud de tu país y ciudad.
 */
export function PlaceField({ id, value, onChange, history, countryCode, near, placeholder = 'Hospital, clínica, vacunatorio' }: Props) {
  const [venues, setVenues] = useState<VenueSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [kind, setKind] = useState<Kind>('all')
  const [searched, setSearched] = useState('')

  useEffect(() => {
    const q = value.trim()
    if (q.length < 3) {
      setVenues([])
      setLoading(false)
      setSearched('')
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const found = await searchVenues(q, { countryCode, near, signal: controller.signal })
        setVenues(found)
        setSearched(q)
        setLoading(false)
      } catch {
        /* búsqueda cancelada por una más nueva */
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, countryCode, near?.latitude, near?.longitude]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo<SuggestItem[]>(() => {
    const mine = matchPlaceHistory(history, value, 5)
    const own = new Set(mine.map((m) => m.place.toLowerCase()))
    const types = KINDS.find((k) => k.key === kind)!.types
    const remote = venues.filter((v) => (types.length ? types.includes(v.type) : true)).filter((v) => !own.has(venueLabel(v).toLowerCase()))
    return [
      ...mine.map<SuggestItem>((h) => ({
        key: `h-${h.place}`,
        title: h.place,
        hint: h.count > 1 ? `${h.count} veces` : undefined,
        icon: <Clock size={15} />,
        group: 'Usados antes',
      })),
      ...remote.map<SuggestItem>((v) => ({
        key: `v-${v.latitude}-${v.longitude}-${v.name}`,
        title: v.name,
        detail: v.detail,
        icon: v.health ? <Hospital size={15} /> : <MapPin size={15} />,
        group: 'Lugares encontrados',
      })),
    ]
  }, [history, value, venues, kind])

  const pickVenue = (key: string) => venues.find((v) => key === `v-${v.latitude}-${v.longitude}-${v.name}`)

  return (
    <div className="place-field">
      <SuggestInput
        id={id}
        value={value}
        onChange={onChange}
        items={items}
        loading={loading}
        placeholder={placeholder}
        ariaLabel="Ubicación"
        onPick={(item) => {
          const venue = pickVenue(item.key)
          onChange(venue ? venueLabel(venue) : item.title)
        }}
        footer={
          value.trim().length < 3 ? (
            'Escribí 3 letras para buscar hospitales y vacunatorios cerca tuyo.'
          ) : !loading && searched === value.trim() && venues.length === 0 ? (
            'No encontré nada: podés dejar el nombre como lo escribiste.'
          ) : venues.length > 0 ? (
            <span className="place-kinds" role="group" aria-label="Tipo de lugar">
              {KINDS.map((k) => (
                <button key={k.key} type="button" className={`place-kind${kind === k.key ? ' is-on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setKind(k.key)}>
                  {k.label}
                </button>
              ))}
            </span>
          ) : null
        }
      />
    </div>
  )
}
