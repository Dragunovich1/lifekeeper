/**
 * Servicio de Calidad del Aire e Índice UV vía Open-Meteo Air Quality API.
 * Provee datos ambientales para complementar el clima y sugerir precauciones de salud y entrenamiento.
 */

export interface AirQualityData {
  aqi: number
  aqiCategory: 'Bueno' | 'Moderado' | 'Regular' | 'Malo' | 'Muy malo' | 'Peligroso'
  aqiColorClass: string
  uvIndex: number
  uvCategory: 'Bajo' | 'Moderado' | 'Alto' | 'Muy alto' | 'Extremo'
  uvColorClass: string
  uvRecommendation: string
  pm25: number
  outdoorAdvice: string
}

export async function fetchAirQuality(
  latitude: number,
  longitude: number,
): Promise<AirQualityData | null> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi,uv_index,pm2_5`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = (await res.json()) as {
      current?: {
        european_aqi?: number
        uv_index?: number
        pm2_5?: number
      }
    }

    if (!data.current) return null

    const aqi = Math.round(data.current.european_aqi ?? 20)
    const uvIndex = Number((data.current.uv_index ?? 0).toFixed(1))
    const pm25 = Math.round(data.current.pm2_5 ?? 10)

    let aqiCategory: AirQualityData['aqiCategory'] = 'Bueno'
    let aqiColorClass = 'badge badge-success'
    let outdoorAdvice = 'Condiciones excelentes para entrenar o pasear al aire libre.'

    if (aqi <= 20) {
      aqiCategory = 'Bueno'
      aqiColorClass = 'badge badge-success'
      outdoorAdvice = 'Aire puro. Ideal para ejercicio al aire libre.'
    } else if (aqi <= 40) {
      aqiCategory = 'Moderado'
      aqiColorClass = 'badge badge-info'
      outdoorAdvice = 'Calidad de aire aceptable para la mayoría de las personas.'
    } else if (aqi <= 60) {
      aqiCategory = 'Regular'
      aqiColorClass = 'badge badge-warning'
      outdoorAdvice = 'Personas sensibles pueden notar leves molestias al entrenar.'
    } else if (aqi <= 80) {
      aqiCategory = 'Malo'
      aqiColorClass = 'badge badge-warning'
      outdoorAdvice = 'Reducí la intensidad o duración de actividad física al exterior.'
    } else {
      aqiCategory = 'Muy malo'
      aqiColorClass = 'badge badge-error'
      outdoorAdvice = 'Evitá esfuerzos físicos al aire libre; preferí espacios cerrados.'
    }

    let uvCategory: AirQualityData['uvCategory'] = 'Bajo'
    let uvColorClass = 'badge badge-success'
    let uvRecommendation = 'No se requiere protección especial.'

    if (uvIndex < 3) {
      uvCategory = 'Bajo'
      uvColorClass = 'badge badge-success'
      uvRecommendation = 'Riesgo bajo. Podés permanecer al sol sin riesgo significativo.'
    } else if (uvIndex < 6) {
      uvCategory = 'Moderado'
      uvColorClass = 'badge badge-warning'
      uvRecommendation = 'Usá protector solar FPS 30+ y anteojos en horas pico (11 a 16 hs).'
    } else if (uvIndex < 8) {
      uvCategory = 'Alto'
      uvColorClass = 'badge badge-warning'
      uvRecommendation = 'Protección obligatoria: sombrero, sombra y protector solar FPS 50+.'
    } else if (uvIndex < 11) {
      uvCategory = 'Muy alto'
      uvColorClass = 'badge badge-error'
      uvRecommendation = 'Peligro de quemaduras rápidas. Evitá el sol directo del mediodía.'
    } else {
      uvCategory = 'Extremo'
      uvColorClass = 'badge badge-error'
      uvRecommendation = 'Riesgo extremo. Permanecé en sombra y con protección completa.'
    }

    return {
      aqi,
      aqiCategory,
      aqiColorClass,
      uvIndex,
      uvCategory,
      uvColorClass,
      uvRecommendation,
      pm25,
      outdoorAdvice,
    }
  } catch (err) {
    console.warn('[AirQuality] Error al consultar calidad del aire:', err)
    return null
  }
}
