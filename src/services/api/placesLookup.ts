/**
 * Búsqueda de lugares (hospitales, clínicas, vacunatorios, farmacias…) para el campo "Ubicación".
 * Pasa por el servidor propio: caché, User-Agent correcto para OpenStreetMap, sin exponer tu IP y sin problemas de CORS en la APK.
 */
import { apiFetch } from './apiConfig'
import { timeoutSignal } from '../../utils/abort'

export interface VenueSuggestion {
  name: string
  /** Calle, barrio y ciudad */
  detail: string
  type: string
  latitude: number
  longitude: number
  /** Establecimiento de salud (hospital, clínica, farmacia…) */
  health: boolean
}

const cache = new Map<string, VenueSuggestion[]>()

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

export async function searchVenues(
  text: string,
  opts: { countryCode?: string; near?: { latitude: number; longitude: number }; signal?: AbortSignal } = {},
): Promise<VenueSuggestion[]> {
  const q = text.trim()
  if (q.length < 2) return []
  const near = opts.near
  const key = `${opts.countryCode ?? ''}|${near ? `${near.latitude.toFixed(1)},${near.longitude.toFixed(1)}` : ''}|${fold(q)}`
  const hit = cache.get(key)
  if (hit) return hit
  try {
    const params = new URLSearchParams({ q })
    if (opts.countryCode) params.set('country', opts.countryCode)
    if (near) {
      params.set('lat', String(near.latitude))
      params.set('lon', String(near.longitude))
    }
    const res = await apiFetch(`/api/public/venues?${params}`, { headers: { Accept: 'application/json' }, signal: opts.signal ?? timeoutSignal(6000) })
    if (!res.ok) return []
    const body = (await res.json()) as { places?: VenueSuggestion[] }
    const places = Array.isArray(body.places) ? body.places : []
    cache.set(key, places)
    return places
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' && opts.signal?.aborted) throw err
    return [] // sin conexión o servidor caído: quedan los lugares usados antes
  }
}

/** Texto que se guarda en el registro: nombre y, para distinguir sucursales, la ciudad. */
export function venueLabel(v: Pick<VenueSuggestion, 'name' | 'detail'>): string {
  const city = v.detail.split(',').map((s) => s.trim()).filter(Boolean).pop()
  return city && fold(city) !== fold(v.name) && !fold(v.name).includes(fold(city)) ? `${v.name} (${city})` : v.name
}
