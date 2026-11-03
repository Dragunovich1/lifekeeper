import { apiFetch } from './apiConfig'
import { timeoutSignal } from '../../utils/abort'
import { norm, searchOfflinePlaces, type PlaceHit } from '../../data/places'

const cache = new Map<string, PlaceHit[]>()

/**
 * Ciudades que coinciden con lo escrito. Pasa por el servidor propio (caché + sin filtrar la IP ni problemas de CORS en la APK)
 * y se completa con la lista local, así sigue funcionando sin conexión.
 */
export async function searchPlaces(text: string, opts: { countryCode?: string; admin1?: string; signal?: AbortSignal } = {}): Promise<PlaceHit[]> {
  const q = text.trim()
  if (q.length < 2) return []
  const key = `${opts.countryCode ?? ''}|${norm(q)}`
  let remote = cache.get(key)
  if (!remote) {
    try {
      const res = await apiFetch(`/api/public/geocode?q=${encodeURIComponent(q)}${opts.countryCode ? `&country=${encodeURIComponent(opts.countryCode)}` : ''}&count=8`, {
        headers: { Accept: 'application/json' },
        signal: opts.signal ?? timeoutSignal(6000),
      })
      const body = res.ok ? ((await res.json()) as { places?: PlaceHit[] }) : null
      remote = Array.isArray(body?.places) ? body.places : []
      cache.set(key, remote)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' && opts.signal?.aborted) throw err
      remote = [] // sin conexión o servidor caído: solo la lista local
    }
  }
  const adm = opts.admin1 ? norm(opts.admin1) : ''
  const local = searchOfflinePlaces(q, { countryCode: opts.countryCode, admin1: opts.admin1 })
  const seen = new Set<string>()
  const merged: PlaceHit[] = []
  for (const p of [...remote, ...local]) {
    const k = `${norm(p.name)}|${norm(p.admin1 ?? '')}|${p.countryCode}`
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(p)
  }
  // La provincia/estado elegida va primero
  if (adm) merged.sort((a, b) => (norm(b.admin1 ?? '') === adm ? 1 : 0) - (norm(a.admin1 ?? '') === adm ? 1 : 0))
  return merged.slice(0, 8)
}
