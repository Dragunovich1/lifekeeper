/**
 * Servicio de cotizaciones y tipos de cambio en vivo.
 * - Cotizaciones de Argentina (Oficial, Blue, MEP, Tarjeta, Cripto) vía DolarAPI.
 * - Cotizaciones globales (USD, EUR, BRL, GBP, etc.) vía Frankfurter API.
 * - Incluye caché en memoria / sessionStorage (15 minutos).
 */

export interface DolarRate {
  moneda: string
  casa: string
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

export interface GlobalRates {
  base: string
  date: string
  rates: Record<string, number>
}

export interface CurrencySnapshot {
  dolares: DolarRate[]
  global: GlobalRates | null
  updatedAt: string
}

const CACHE_KEY = 'lifekeeper_currency_rates_v1'
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutos

export async function fetchCurrencySnapshot(force = false): Promise<CurrencySnapshot | null> {
  if (!force) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CurrencySnapshot & { _timestamp?: number }
        if (parsed._timestamp && Date.now() - parsed._timestamp < CACHE_TTL_MS) {
          return parsed
        }
      }
    } catch {
      // Ignorar errores de parseo de caché
    }
  }

  try {
    const [dolarRes, globalRes] = await Promise.allSettled([
      fetch('https://dolarapi.com/v1/dolares'),
      fetch('https://api.frankfurter.app/latest?from=USD'),
    ])

    let dolares: DolarRate[] = []
    if (dolarRes.status === 'fulfilled' && dolarRes.value.ok) {
      dolares = (await dolarRes.value.json()) as DolarRate[]
    }

    let global: GlobalRates | null = null
    if (globalRes.status === 'fulfilled' && globalRes.value.ok) {
      global = (await globalRes.value.json()) as GlobalRates
    }

    if (dolares.length === 0 && !global) {
      return null
    }

    const snapshot: CurrencySnapshot & { _timestamp: number } = {
      dolares,
      global,
      updatedAt: new Date().toISOString(),
      _timestamp: Date.now(),
    }

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(snapshot))
    } catch {
      // Ignorar quota errors
    }

    return snapshot
  } catch (err) {
    console.warn('[Currency] Error al obtener tipos de cambio:', err)
    return null
  }
}
