/**
 * Servicio de búsqueda y autocompletado de lugares y direcciones vía OpenStreetMap (Nominatim).
 * Respeta las directrices de la API incluyendo User-Agent adecuado y debounce.
 */

export interface PlaceSuggestion {
  displayName: string
  shortName: string
  type: string
  category: string
  lat: number
  lon: number
}

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const clean = query.trim()
  if (!clean || clean.length < 3) return []

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      clean,
    )}&format=json&limit=5&addressdetails=1`

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) return []

    const items = (await res.json()) as Array<{
      display_name: string
      name?: string
      type?: string
      class?: string
      lat: string
      lon: string
    }>

    return items.map((item) => {
      const parts = item.display_name.split(',')
      const shortName = item.name || parts[0]?.trim() || item.display_name
      return {
        displayName: item.display_name,
        shortName,
        type: item.type || 'lugar',
        category: item.class || 'ubicación',
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      }
    })
  } catch {
    return []
  }
}
