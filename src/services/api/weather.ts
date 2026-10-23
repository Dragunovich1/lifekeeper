/**
 * Servicio unificado de Clima y Pronóstico meteorológico vía Open-Meteo.
 * Sin API keys requeridas, seguro, con caché en sessionStorage y geolocalización inteligente.
 */

export interface DailyForecastItem {
  date: string
  code: number
  tempMax: number
  tempMin: number
  precipProb: number
}

export interface WeatherData {
  city: string
  temp: number
  apparentTemp: number
  humidity: number
  windSpeed: number
  code: number
  isDay: boolean
  description: string
  source: 'gps' | 'ip' | 'fallback'
  daily: DailyForecastItem[]
}

export const WEATHER_STORAGE_KEY = 'lifekeeper:weather-geo-v2'

const FALLBACK_COORDS = {
  city: 'Quilmes',
  latitude: -34.7206,
  longitude: -58.2546,
}

export const describeWeatherCode = (code: number): string => {
  if (code === 0) return 'Despejado'
  if (code === 1) return 'Mayormente despejado'
  if (code === 2) return 'Parcialmente nublado'
  if (code === 3) return 'Nublado'
  if (code === 45 || code === 48) return 'Niebla'
  if (code >= 51 && code <= 57) return 'Llovizna'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Lluvia'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Nieve'
  if (code >= 95) return 'Tormenta'
  return 'Templado'
}

const requestBrowserPosition = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Geolocation not available'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 7000,
      maximumAge: 600000,
    })
  })

const reverseGeocodeCity = async (lat: number, lon: number): Promise<string | null> => {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=es`,
    )
    if (res.ok) {
      const json = (await res.json()) as {
        locality?: string
        city?: string
        principalSubdivision?: string
      }
      const name = (json.locality || json.city || json.principalSubdivision || '').trim()
      if (name) return name
    }
  } catch {
    // fallback
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&accept-language=es`,
    )
    if (res.ok) {
      const json = (await res.json()) as {
        address?: {
          city?: string
          town?: string
          suburb?: string
          municipality?: string
          state_district?: string
        }
      }
      const addr = json.address
      const name = (
        addr?.city ||
        addr?.town ||
        addr?.suburb ||
        addr?.municipality ||
        addr?.state_district ||
        ''
      ).trim()
      if (name) return name
    }
  } catch {
    // ignore
  }

  return null
}

export async function fetchWeatherData(forceFresh = false): Promise<WeatherData | null> {
  if (!forceFresh && typeof sessionStorage !== 'undefined') {
    try {
      const cachedRaw = sessionStorage.getItem(WEATHER_STORAGE_KEY)
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as WeatherData
        if (parsed && parsed.city && Array.isArray(parsed.daily)) {
          return parsed
        }
      }
    } catch {
      // ignore parse error
    }
  }

  let city = FALLBACK_COORDS.city
  let latitude = FALLBACK_COORDS.latitude
  let longitude = FALLBACK_COORDS.longitude
  let source: WeatherData['source'] = 'fallback'

  // 1. Geolocalización por navegador
  try {
    const pos = await requestBrowserPosition()
    latitude = pos.coords.latitude
    longitude = pos.coords.longitude
    source = 'gps'
    const exactLocality = await reverseGeocodeCity(latitude, longitude)
    city = exactLocality || 'Tu ubicación'
  } catch {
    // 2. IP Geolocation
    try {
      const ipWhoRes = await fetch('https://ipwho.is/')
      if (ipWhoRes.ok) {
        const ipWhoJson = (await ipWhoRes.json()) as {
          success?: boolean
          city?: string
          latitude?: number
          longitude?: number
        }
        if (ipWhoJson.success && ipWhoJson.latitude && ipWhoJson.longitude) {
          latitude = ipWhoJson.latitude
          longitude = ipWhoJson.longitude
          city = ipWhoJson.city || 'Tu localidad'
          source = 'ip'
        }
      }
    } catch {
      // use fallback
    }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`
    const res = await fetch(url)
    if (!res.ok) return null

    const json = (await res.json()) as {
      current?: {
        temperature_2m?: number
        apparent_temperature?: number
        relative_humidity_2m?: number
        wind_speed_10m?: number
        weather_code?: number
        is_day?: number
      }
      daily?: {
        time?: string[]
        weather_code?: number[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        precipitation_probability_max?: number[]
      }
    }

    if (!json.current) return null

    const dailyItems: DailyForecastItem[] = []
    if (json.daily?.time) {
      const count = Math.min(json.daily.time.length, 7)
      for (let i = 0; i < count; i++) {
        dailyItems.push({
          date: json.daily.time[i],
          code: json.daily.weather_code?.[i] ?? 0,
          tempMax: Math.round(json.daily.temperature_2m_max?.[i] ?? 20),
          tempMin: Math.round(json.daily.temperature_2m_min?.[i] ?? 12),
          precipProb: Math.round(json.daily.precipitation_probability_max?.[i] ?? 0),
        })
      }
    }

    const weatherData: WeatherData = {
      city,
      temp: Math.round(json.current.temperature_2m ?? 20),
      apparentTemp: Math.round(json.current.apparent_temperature ?? json.current.temperature_2m ?? 20),
      humidity: Math.round(json.current.relative_humidity_2m ?? 50),
      windSpeed: Math.round(json.current.wind_speed_10m ?? 10),
      code: json.current.weather_code ?? 0,
      isDay: json.current.is_day === 1,
      description: describeWeatherCode(json.current.weather_code ?? 0),
      source,
      daily: dailyItems,
    }

    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(weatherData))
      } catch {
        // ignore storage error
      }
    }

    return weatherData
  } catch {
    return null
  }
}
