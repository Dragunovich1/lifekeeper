import { isNativePlatform } from '../platform'

const STORAGE_KEY_SERVER_URL = 'lifekeeper_server_url_v1'
const STORAGE_KEY_RESOLVED_BASE = 'lifekeeper_resolved_api_base_v1'

export const DEFAULT_CLOUD_URLS = [
  'https://app.lifekeeper.lat',
  'http://192.168.0.52',
]

/**
 * Obtiene la URL de servidor personalizada si el usuario la configuró manualmente.
 */
export function getCustomServerUrl(): string | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY_SERVER_URL)?.trim()
    return val ? val.replace(/\/+$/, '') : null
  } catch {
    return null
  }
}

/**
 * Guarda o limpia la URL de servidor personalizada.
 */
export function setCustomServerUrl(url: string | null): void {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem(STORAGE_KEY_SERVER_URL)
      sessionStorage.removeItem(STORAGE_KEY_RESOLVED_BASE)
    } else {
      const normalized = url.trim().replace(/\/+$/, '')
      localStorage.setItem(STORAGE_KEY_SERVER_URL, normalized)
      sessionStorage.setItem(STORAGE_KEY_RESOLVED_BASE, normalized)
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Determina si el cliente corre en la APK nativa de Android/iOS o en localhost sin backend propio.
 */
export function NeedsExplicitServerBase(): boolean {
  if (isNativePlatform()) return true
  if (typeof window === 'undefined') return false
  const { protocol, hostname } = window.location
  if (protocol === 'capacitor:' || protocol === 'file:') return true
  // En Android Capacitor con androidScheme: 'https', el origin es https://localhost sin puerto
  if (hostname === 'localhost' && !window.location.port) return true
  return false
}

/**
 * Devuelve la lista ordenada de bases candidatas para comunicarse con la API de LifeKeeper.
 * Base vacía ('') significa usar ruta relativa '/api/...' en el mismo origen (Nginx / Vite proxy).
 */
export function getCandidateBaseUrls(): string[] {
  const custom = getCustomServerUrl()
  if (custom) {
    return [custom, ...DEFAULT_CLOUD_URLS.filter((u) => u !== custom)]
  }

  const cached = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_RESOLVED_BASE) : null

  if (NeedsExplicitServerBase()) {
    const list = [...DEFAULT_CLOUD_URLS]
    if (cached && list.includes(cached)) {
      return [cached, ...list.filter((u) => u !== cached)]
    }
    return list
  }

  // En navegador Web (app.lifekeeper.lat, 192.168.0.52 o localhost:5173 con proxy)
  // Primero intentamos el mismo origen ('') y como respaldo los servidores conocidos
  const webCandidates = ['', ...DEFAULT_CLOUD_URLS]
  if (cached !== null && webCandidates.includes(cached)) {
    return [cached, ...webCandidates.filter((u) => u !== cached)]
  }
  return webCandidates
}

/**
 * Ejecuta un fetch contra la API de LifeKeeper probando automáticamente el origen actual
 * y haciendo fallback a los servidores configurados (Ideal para APK Android, LAN y Dominio).
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const candidates = getCandidateBaseUrls()
  let lastError: unknown = null

  for (const base of candidates) {
    const url = `${base}${normalizedPath}`
    try {
      const response = await fetch(url, init)
      const contentType = response.headers.get('content-type') || ''

      // Si un servidor de desarrollo devuelve HTML (ej. index.html fallback de SPA) en una ruta /api/,
      // pasamos al siguiente candidato real.
      if (normalizedPath.startsWith('/api/') && contentType.includes('text/html')) {
        continue
      }

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY_RESOLVED_BASE, base)
      }
      return response
    } catch (err) {
      lastError = err
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No se pudo conectar con el servidor de LifeKeeper')
}
