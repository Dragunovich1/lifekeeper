import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  Dumbbell,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  Info,
  KeyRound,
  LocateFixed,
  MapPin,
  Moon,
  Pill,
  RefreshCw,
  Scale,
  Search,
  Share2,
  Snowflake,
  Sparkles,
  Sun,
  Thermometer,
  UserRound,
  Wallet,
  Wind,
  X,
} from 'lucide-react'
import { Modal } from '../../components/Modal'
import { ShareModal } from '../../components/ShareModal'
import { VaultScoreCard } from '../../components/VaultScoreCard'
import { fetchAirQuality, type AirQualityData } from '../../services/api'
import { useAppData } from '../../hooks/useAppData'
import { useInsights } from '../../hooks/useInsights'
import { usePreferences } from '../../preferences/context'
import { ScrollbarOverlay } from '../../scrollbar/ScrollbarOverlay'
import { computeCrossDomainInsights } from '../../utils/crossDomainInsights'
import type { GlobalSearchResult, InsightSeverity } from '../../utils/insights'
import {
  formatCurrencyNoCents,
  formatDate,
  formatDateTime,
  safeParseDate,
  toLocalDateKey,
} from '../../utils/dates'

type DayPeriod = 'morning' | 'afternoon' | 'night'
type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow'
type WeatherPreviewMode =
  | 'auto'
  | 'clear-day'
  | 'clear-night'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'storm'
  | 'snow'

const WEATHER_PREVIEW_OPTIONS: Array<{ value: WeatherPreviewMode; label: string }> = [
  { value: 'auto', label: 'Automático' },
  { value: 'rain', label: '🌧️ Lluvia en vidrio' },
  { value: 'storm', label: '⛈️ Tormenta' },
  { value: 'clear-day', label: '☀️ Despejado' },
  { value: 'clear-night', label: '🌙 Noche despejada' },
  { value: 'cloudy', label: '☁️ Nublado' },
  { value: 'fog', label: '🌫️ Niebla' },
  { value: 'snow', label: '❄️ Nieve' },
]

interface GlassDropSpec {
  left: string
  top: string
  width: number
  height: number
  runner?: boolean
  duration?: string
  delay?: string
}

const GLASS_DROPS: GlassDropSpec[] = [
  { left: '6%', top: '18%', width: 7, height: 9 },
  { left: '12%', top: '62%', width: 5, height: 6 },
  { left: '17%', top: '12%', width: 8, height: 11, runner: true, duration: '7.5s', delay: '0.4s' },
  { left: '23%', top: '44%', width: 6, height: 8 },
  { left: '29%', top: '76%', width: 9, height: 11 },
  { left: '34%', top: '22%', width: 5, height: 6 },
  { left: '39%', top: '8%', width: 7, height: 10, runner: true, duration: '8.8s', delay: '2.1s' },
  { left: '45%', top: '54%', width: 6, height: 7 },
  { left: '51%', top: '28%', width: 10, height: 12 },
  { left: '56%', top: '70%', width: 5, height: 6 },
  { left: '61%', top: '14%', width: 8, height: 11, runner: true, duration: '6.9s', delay: '1.2s' },
  { left: '66%', top: '38%', width: 6, height: 8 },
  { left: '71%', top: '82%', width: 7, height: 9 },
  { left: '75%', top: '20%', width: 9, height: 12 },
  { left: '80%', top: '50%', width: 5, height: 7 },
  { left: '84%', top: '10%', width: 8, height: 11, runner: true, duration: '8.2s', delay: '3.3s' },
  { left: '88%', top: '66%', width: 7, height: 9 },
  { left: '92%', top: '32%', width: 6, height: 8 },
  { left: '95%', top: '16%', width: 7, height: 10, runner: true, duration: '7.4s', delay: '1.8s' },
  { left: '15%', top: '85%', width: 6, height: 7 },
  { left: '58%', top: '88%', width: 8, height: 10 },
]

const RAIN_STREAKS: Array<{ left: string; top: string; height: number; delay: string }> = [
  { left: '17%', top: '6%', height: 68, delay: '0.4s' },
  { left: '39%', top: '4%', height: 82, delay: '2.1s' },
  { left: '61%', top: '8%', height: 74, delay: '1.2s' },
  { left: '84%', top: '5%', height: 88, delay: '3.3s' },
  { left: '95%', top: '10%', height: 64, delay: '1.8s' },
]

const BOKEH_DOTS: Array<{
  left: string
  top: string
  size: number
  duration: string
  delay: string
}> = [
  { left: '58%', top: '18%', size: 34, duration: '9s', delay: '0s' },
  { left: '68%', top: '48%', size: 22, duration: '11s', delay: '1.5s' },
  { left: '76%', top: '22%', size: 44, duration: '10s', delay: '0.8s' },
  { left: '84%', top: '60%', size: 28, duration: '12s', delay: '2.4s' },
  { left: '91%', top: '30%', size: 38, duration: '9.5s', delay: '1.1s' },
  { left: '48%', top: '68%', size: 24, duration: '13s', delay: '3s' },
  { left: '32%', top: '24%', size: 20, duration: '10.5s', delay: '2s' },
  { left: '95%', top: '72%', size: 30, duration: '11.5s', delay: '0.4s' },
]

const NIGHT_STARS: Array<{
  left: string
  top: string
  size: number
  duration: string
  delay: string
}> = [
  { left: '8%', top: '18%', size: 2, duration: '3.4s', delay: '0.2s' },
  { left: '16%', top: '34%', size: 2.5, duration: '4.2s', delay: '1.1s' },
  { left: '24%', top: '14%', size: 1.8, duration: '3.8s', delay: '0.7s' },
  { left: '33%', top: '28%', size: 2.2, duration: '4.6s', delay: '1.9s' },
  { left: '42%', top: '12%', size: 2.8, duration: '3.2s', delay: '0.4s' },
  { left: '51%', top: '22%', size: 1.8, duration: '5s', delay: '2.3s' },
  { left: '59%', top: '15%', size: 2.4, duration: '3.7s', delay: '1.4s' },
  { left: '65%', top: '36%', size: 2, duration: '4.4s', delay: '0.9s' },
  { left: '72%', top: '19%', size: 2.8, duration: '3.5s', delay: '2.1s' },
  { left: '78%', top: '44%', size: 1.8, duration: '4.8s', delay: '0.5s' },
  { left: '83%', top: '14%', size: 2.5, duration: '3.9s', delay: '1.6s' },
  { left: '89%', top: '32%', size: 2, duration: '4.1s', delay: '2.7s' },
  { left: '94%', top: '20%', size: 2.6, duration: '3.3s', delay: '1.2s' },
  { left: '46%', top: '46%', size: 1.8, duration: '4.5s', delay: '0.3s' },
  { left: '21%', top: '52%', size: 2, duration: '3.6s', delay: '1.8s' },
  { left: '69%', top: '56%', size: 2.2, duration: '4.3s', delay: '2.5s' },
]

const SNOWFLAKES: Array<{
  left: string
  size: number
  duration: string
  delay: string
}> = [
  { left: '7%', size: 5, duration: '9s', delay: '0s' },
  { left: '15%', size: 4, duration: '11s', delay: '1.4s' },
  { left: '23%', size: 6, duration: '8.5s', delay: '2.2s' },
  { left: '31%', size: 3.5, duration: '12s', delay: '0.7s' },
  { left: '39%', size: 5.5, duration: '9.8s', delay: '3.1s' },
  { left: '47%', size: 4, duration: '10.6s', delay: '1.9s' },
  { left: '55%', size: 6, duration: '8.9s', delay: '0.4s' },
  { left: '63%', size: 4.5, duration: '11.4s', delay: '2.6s' },
  { left: '71%', size: 5, duration: '9.3s', delay: '1.1s' },
  { left: '78%', size: 3.5, duration: '12.2s', delay: '3.5s' },
  { left: '84%', size: 6, duration: '8.7s', delay: '0.9s' },
  { left: '90%', size: 4.5, duration: '10.2s', delay: '2.8s' },
  { left: '95%', size: 5, duration: '9.6s', delay: '1.6s' },
  { left: '12%', size: 5.5, duration: '10.8s', delay: '3.8s' },
]

const getDayPeriod = (hour: number): DayPeriod => {
  if (hour >= 6 && hour < 13) return 'morning'
  if (hour >= 13 && hour < 20) return 'afternoon'
  return 'night'
}

const greetingFor = (hour: number) => {
  if (hour < 6) return 'Buenas noches'
  if (hour < 13) return 'Buen día'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

const iconForSeverity = (severity: InsightSeverity) => {
  if (severity === 'critical' || severity === 'warning') {
    return <AlertTriangle aria-hidden />
  }
  return <Info aria-hidden />
}

const badgeClassForSeverity = (severity: InsightSeverity) => {
  if (severity === 'critical') return 'badge badge-error'
  if (severity === 'warning') return 'badge badge-warning'
  if (severity === 'success') return 'badge badge-success'
  return 'badge badge-info'
}

interface DailyForecastItem {
  date: string
  code: number
  tempMax: number
  tempMin: number
  precipProb: number
}

interface WeatherData {
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

const WEATHER_STORAGE_KEY = 'lifekeeper:weather-geo-v2'
const FALLBACK_COORDS = {
  city: 'Quilmes',
  latitude: -34.7206,
  longitude: -58.2546,
}

const getWeatherKind = (code: number): WeatherKind => {
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if (code === 45 || code === 48) return 'fog'
  if (code === 2 || code === 3) return 'cloudy'
  return 'clear'
}

const describeWeatherCode = (code: number): string => {
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

const renderWeatherIcon = (code: number, isDay = true, size = 14) => {
  if (code >= 95) return <CloudLightning size={size} aria-hidden />
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return <Snowflake size={size} aria-hidden />
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return <CloudRain size={size} aria-hidden />
  }
  if (code === 45 || code === 48) return <CloudFog size={size} aria-hidden />
  if (code === 2) return <CloudSun size={size} aria-hidden />
  if (code === 3) return <Cloud size={size} aria-hidden />
  return isDay ? <Sun size={size} aria-hidden /> : <Moon size={size} aria-hidden />
}

const formatForecastDayLabel = (dateStr: string, index: number): string => {
  if (index === 0) return 'Hoy'
  if (index === 1) return 'Mañ'
  const parsed = safeParseDate(dateStr)
  if (!parsed) return dateStr
  const raw = parsed.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')
  return raw.charAt(0).toUpperCase() + raw.slice(1, 3)
}

const requestBrowserPosition = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Geolocation not available'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
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
    // Fallback to Nominatim
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
    // Ignore
  }

  return null
}

const SESSION_TIPS: string[] = [
  'Tomar un vaso de agua al despertar ayuda a activar el metabolismo y la concentración.',
  'Usá una contraseña única de al menos 14 caracteres para tus cuentas bancarias y de correo.',
  'Registrar tus gastos pequeños del día te da claridad real sobre tu balance a fin de mes.',
  'Escribir tres líneas en tu diario antes de dormir reduce la carga mental y mejora el descanso.',
  'Revisá tu carnet de vacunación una vez al año para mantener al día los refuerzos clave.',
  'Hacé una copia de seguridad cifrada externa después de cargar documentos o claves importantes.',
  'Caminar 20 minutos al aire libre mejora el ánimo y regula el ritmo circadiano.',
  'Activá el segundo factor de autenticación (2FA) en todos los servicios que lo permitan.',
  'Mantener tu ficha SOS completa con grupo sanguíneo y alergias facilita la atención ante urgencias.',
  'Dividir un proyecto grande en tareas de 25 minutos evita la procrastinación y sostiene el foco.',
  'Asociar la toma de tu medicación a un hábito fijo del día mejora la adherencia al tratamiento.',
  'Aplicar la regla 20-20-20 frente a pantallas descansa la vista: cada 20 min mirá a 6 metros por 20 seg.',
  'Anotar las dudas antes de una consulta médica te asegura aprovechar cada visita al profesional.',
  'Rotar las contraseñas con más de 6 meses de antigüedad reduce riesgos ante filtraciones.',
  'Separar una pequeña reserva mensual para imprevistos da tranquilidad financiera a largo plazo.',
  'Llevar el historial de mantenimiento de tu vehículo previene fallas costosas y cuida tu seguridad.',
  'Respirar profundo 4 segundos al inhalar y 6 al exhalar baja el estrés en menos de dos minutos.',
  'Guardá el número de lote al aplicarte una vacuna para contar con trazabilidad clínica completa.',
  'Revisar tus suscripciones activas cada trimestre ayuda a detectar gastos hormiga innecesarios.',
  'Etiquetar tus notas clínicas por especialidad agiliza encontrar antecedentes cuando los necesitás.',
  'Evitá reutilizar la misma clave entre redes sociales y servicios críticos de trabajo o finanzas.',
  'Registrar tu estado de ánimo diario te permite identificar patrones de energía durante el mes.',
  'Configurar el bloqueo automático por inactividad protege tu bóveda si te alejás del equipo.',
  'Celebrar las tareas completadas de la semana refuerza la constancia en tus proyectos personales.',
]

let cachedSessionPassword: string | null = null
let cachedSessionTipIndex: number | null = null

const getSessionTipIndex = (masterPassword: string): number => {
  if (cachedSessionPassword !== masterPassword || cachedSessionTipIndex === null) {
    cachedSessionPassword = masterPassword
    cachedSessionTipIndex = Math.floor(Math.random() * SESSION_TIPS.length)
  }
  return cachedSessionTipIndex
}

const SEARCH_DROPDOWN_GAP = 8
const SEARCH_DROPDOWN_MAX_HEIGHT = 360

export const DashboardSection = () => {
  const { data, masterPassword, updateData } = useAppData()
  const { preferences } = usePreferences()
  const currency = preferences.currency
  const {
    insights,
    criticalCount,
    warningCount,
    overdueRemindersCount,
    todayRemindersCount,
    upcomingVaccinesCount,
    todayDoses,
    nextDose,
    currentMonthIncome,
    currentMonthExpense,
    currentMonthBalance,
    expenseDeltaPercent,
    weakOrReusedPasswordsCount,
    oldPasswordsCount,
    emergencyCompletenessPercent,
    diaryStreakDays,
    dominantMood,
    activeProjectsCount,
    pendingTasksCount,
    search,
  } = useInsights()

  const thisMonthWorkoutsCount = useMemo(() => {
    const list = data.personal.workouts ?? []
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    return list.filter((w) => {
      const d = new Date(w.date)
      return d.getFullYear() === y && d.getMonth() === m
    }).length
  }, [data.personal.workouts])

  const todayKey = toLocalDateKey(new Date())
  const isImperial = preferences.unitSystem === 'imperial'

  const todayHydration = useMemo(() => {
    return (data.health.hydrationLogs ?? []).find((l) => l.date === todayKey)
  }, [data.health.hydrationLogs, todayKey])

  const targetWaterMl = data.health.hydrationTargetMl ?? 2500
  const currentWaterMl = todayHydration?.amountMl ?? 0
  const waterPercent = Math.min(100, Math.round((currentWaterMl / targetWaterMl) * 100))

  const displayWaterCurrent = isImperial
    ? `${(currentWaterMl * 0.033814).toFixed(0)} oz`
    : `${currentWaterMl} ml`
  const displayWaterTarget = isImperial
    ? `${(targetWaterMl * 0.033814).toFixed(0)} oz`
    : `${targetWaterMl} ml`

  const quickAddWater = (e: React.MouseEvent, deltaMl: number = 250) => {
    e.preventDefault()
    e.stopPropagation()
    updateData((prev) => {
      const logs = [...(prev.health.hydrationLogs ?? [])]
      const idx = logs.findIndex((l) => l.date === todayKey)
      const prevAmt = idx >= 0 ? logs[idx].amountMl : 0
      const nextAmt = prevAmt + deltaMl
      if (idx >= 0) {
        logs[idx] = { ...logs[idx], amountMl: nextAmt, targetMl: targetWaterMl }
      } else {
        logs.unshift({ date: todayKey, amountMl: nextAmt, targetMl: targetWaterMl })
      }
      return {
        ...prev,
        health: {
          ...prev.health,
          hydrationLogs: logs,
        },
      }
    })
  }

  const quickTakeMedication = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!nextDose) return
    const intakeKey = `${todayKey}_${nextDose.time}`
    updateData((prev) => ({
      ...prev,
      health: {
        ...prev.health,
        medications: prev.health.medications.map((m) => {
          if (m.id !== nextDose.medicationId) return m
          const currentLog = m.intakeLog ?? []
          if (currentLog.includes(intakeKey)) return m
          return { ...m, intakeLog: [...currentLog, intakeKey] }
        }),
      },
    }))
  }

  const heightCm = data.profile.heightCm
  const weightKg = data.profile.weightKg

  const imcInfo = useMemo(() => {
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
      return null
    }
    const heightM = heightCm / 100
    const val = weightKg / (heightM * heightM)
    let category = 'Normal'
    let badgeClass = 'badge badge-success'
    if (val < 18.5) {
      category = 'Bajo peso'
      badgeClass = 'badge badge-warning'
    } else if (val < 25) {
      category = 'Normal'
      badgeClass = 'badge badge-success'
    } else if (val < 30) {
      category = 'Sobrepeso'
      badgeClass = 'badge badge-warning'
    } else {
      category = 'Obesidad'
      badgeClass = 'badge badge-error'
    }
    return {
      value: val.toFixed(1),
      category,
      badgeClass,
    }
  }, [heightCm, weightKg])

  const [weightModalOpen, setWeightModalOpen] = useState(false)
  const [newWeight, setNewWeight] = useState<string>('')
  const [newHeight, setNewHeight] = useState<string>('')
  const [showMonthBalance, setShowMonthBalance] = useState(false)

  const openWeightModal = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setNewWeight(weightKg ? String(weightKg) : '')
    setNewHeight(heightCm ? String(heightCm) : '')
    setWeightModalOpen(true)
  }

  const handleSaveWeight = (e: React.FormEvent) => {
    e.preventDefault()
    const w = parseFloat(newWeight)
    const h = parseFloat(newHeight)
    if (isNaN(w) || w <= 0) return

    updateData((prev) => {
      const currentTarget = prev.health.hydrationTargetMl
      const nextTarget = currentTarget ? currentTarget : Math.round(w * 35)

      return {
        ...prev,
        profile: {
          ...prev.profile,
          weightKg: w,
          ...(h && h > 0 ? { heightCm: h } : {}),
          updatedAt: new Date().toISOString(),
        },
        health: {
          ...prev.health,
          hydrationTargetMl: nextTarget,
        },
      }
    })
    setWeightModalOpen(false)
  }

  const [tipIndex, setTipIndex] = useState<number>(() => getSessionTipIndex(masterPassword))
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null)
  const [weatherExpanded, setWeatherExpanded] = useState(false)
  const [locatingWeather, setLocatingWeather] = useState(false)
  const [weatherPreview, setWeatherPreview] = useState<WeatherPreviewMode>('auto')

  const crossInsights = useMemo(
    () =>
      computeCrossDomainInsights(
        data,
        weather
          ? {
              code: weather.code,
              temp: weather.temp,
              description: weather.description,
            }
          : null,
      ),
    [data, weather],
  )

  useEffect(() => {
    setTipIndex(getSessionTipIndex(masterPassword))
  }, [masterPassword])

  const rotateTip = () => {
    setTipIndex((prev) => {
      if (SESSION_TIPS.length <= 1) return prev
      let next = Math.floor(Math.random() * SESSION_TIPS.length)
      if (next === prev) {
        next = (prev + 1) % SESSION_TIPS.length
      }
      cachedSessionTipIndex = next
      return next
    })
  }

  const fetchWeatherData = useCallback(async (forceFresh = false) => {
    if (!forceFresh) {
      try {
        const cachedRaw = sessionStorage.getItem(WEATHER_STORAGE_KEY)
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw) as WeatherData
          if (parsed && parsed.city && Array.isArray(parsed.daily)) {
            setWeather(parsed)
            return
          }
        }
      } catch {
        // Ignore sessionStorage parse errors
      }
    } else {
      try {
        sessionStorage.removeItem(WEATHER_STORAGE_KEY)
      } catch {
        // Ignore
      }
    }

    setLocatingWeather(true)
    let city = FALLBACK_COORDS.city
    let latitude = FALLBACK_COORDS.latitude
    let longitude = FALLBACK_COORDS.longitude
    let source: WeatherData['source'] = 'fallback'

    // Prioridad 1: Geolocalización exacta del navegador
    try {
      const pos = await requestBrowserPosition()
      latitude = pos.coords.latitude
      longitude = pos.coords.longitude
      source = 'gps'
      const exactLocality = await reverseGeocodeCity(latitude, longitude)
      city = exactLocality || 'Tu ubicación'
    } catch {
      // Prioridad 2: Geolocalización por IP
      let resolvedByIp = false
      try {
        const ipWhoRes = await fetch('https://ipwho.is/')
        if (ipWhoRes.ok) {
          const ipWhoJson = (await ipWhoRes.json()) as {
            success?: boolean
            city?: string
            latitude?: number
            longitude?: number
          }
          if (
            ipWhoJson.success !== false &&
            typeof ipWhoJson.latitude === 'number' &&
            typeof ipWhoJson.longitude === 'number'
          ) {
            latitude = ipWhoJson.latitude
            longitude = ipWhoJson.longitude
            city = (ipWhoJson.city || '').trim() || FALLBACK_COORDS.city
            source = 'ip'
            resolvedByIp = true
          }
        }
      } catch {
        // Try backup IP service
      }

      if (!resolvedByIp) {
        try {
          const ipApiRes = await fetch('https://ipapi.co/json/')
          if (ipApiRes.ok) {
            const ipApiJson = (await ipApiRes.json()) as {
              city?: string
              latitude?: number
              longitude?: number
            }
            if (
              typeof ipApiJson.latitude === 'number' &&
              typeof ipApiJson.longitude === 'number'
            ) {
              latitude = ipApiJson.latitude
              longitude = ipApiJson.longitude
              city = (ipApiJson.city || '').trim() || FALLBACK_COORDS.city
              source = 'ip'
            }
          }
        } catch {
          // Keep Quilmes fallback
        }
      }
    }

    try {
      const forecastRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`,
      )
      if (!forecastRes.ok) return
      const forecastJson = (await forecastRes.json()) as {
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
          precipitation_probability_max?: Array<number | null>
        }
      }

      const current = forecastJson.current
      if (!current || typeof current.temperature_2m !== 'number') return

      const code = typeof current.weather_code === 'number' ? current.weather_code : 0
      const isDay = current.is_day !== 0
      const dailyTimes = forecastJson.daily?.time ?? []
      const dailyCodes = forecastJson.daily?.weather_code ?? []
      const dailyMax = forecastJson.daily?.temperature_2m_max ?? []
      const dailyMin = forecastJson.daily?.temperature_2m_min ?? []
      const dailyPrecip = forecastJson.daily?.precipitation_probability_max ?? []

      const daily: DailyForecastItem[] = dailyTimes.slice(0, 7).map((dateStr, idx) => ({
        date: dateStr,
        code: typeof dailyCodes[idx] === 'number' ? dailyCodes[idx] : code,
        tempMax: Math.round(dailyMax[idx] ?? current.temperature_2m!),
        tempMin: Math.round(dailyMin[idx] ?? current.temperature_2m!),
        precipProb: Math.round(dailyPrecip[idx] ?? 0),
      }))

      const nextWeather: WeatherData = {
        city,
        temp: Math.round(current.temperature_2m),
        apparentTemp: Math.round(current.apparent_temperature ?? current.temperature_2m),
        humidity: Math.round(current.relative_humidity_2m ?? 0),
        windSpeed: Math.round(current.wind_speed_10m ?? 0),
        code,
        isDay,
        description: describeWeatherCode(code),
        source,
        daily,
      }

      setWeather(nextWeather)
      try {
        sessionStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(nextWeather))
      } catch {
        // Ignore storage errors
      }

      void fetchAirQuality(latitude, longitude).then((res) => {
        if (res) setAirQuality(res)
      })
    } catch {
      // Keep silent if offline
    } finally {
      setLocatingWeather(false)
    }
  }, [])

  useEffect(() => {
    void fetchWeatherData(false)
  }, [fetchWeatherData])

  const searchBoxRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownListRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dropdownPos, setDropdownPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const results = useMemo(() => search(query), [search, query])

  const computeDropdownPosition = useCallback(() => {
    const box = searchBoxRef.current
    if (!box) return null
    const rect = box.getBoundingClientRect()
    const width = Math.max(rect.width, 320)
    const spaceBelow = window.innerHeight - rect.bottom - SEARCH_DROPDOWN_GAP
    const top =
      spaceBelow >= 200 || rect.top < SEARCH_DROPDOWN_MAX_HEIGHT
        ? rect.bottom + SEARCH_DROPDOWN_GAP
        : Math.max(8, rect.top - SEARCH_DROPDOWN_GAP - SEARCH_DROPDOWN_MAX_HEIGHT)
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
    return { top, left, width }
  }, [])

  const openSearchDropdown = useCallback(() => {
    setDropdownPos(computeDropdownPosition())
    setSearchOpen(true)
  }, [computeDropdownPosition])

  const closeSearchDropdown = useCallback(() => {
    setSearchOpen(false)
  }, [])

  const selectSearchResult = useCallback((item: GlobalSearchResult) => {
    setSearchOpen(false)
    setQuery('')
    if (item.sectionHash) {
      window.location.hash = item.sectionHash
    } else {
      window.location.hash = ''
    }
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useLayoutEffect(() => {
    if (!searchOpen) return
    setDropdownPos(computeDropdownPosition())
    const onReposition = () => setDropdownPos(computeDropdownPosition())
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [searchOpen, computeDropdownPosition])

  useEffect(() => {
    if (!searchOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (
        target &&
        (searchBoxRef.current?.contains(target) || dropdownRef.current?.contains(target))
      ) {
        return
      }
      setSearchOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [searchOpen])

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        openSearchDropdown()
      }
    }
    const onCustomOpen = () => {
      searchInputRef.current?.focus()
      openSearchDropdown()
    }

    window.addEventListener('keydown', onGlobalKeyDown)
    window.addEventListener('lifekeeper:open-command-palette', onCustomOpen)
    return () => {
      window.removeEventListener('keydown', onGlobalKeyDown)
      window.removeEventListener('lifekeeper:open-command-palette', onCustomOpen)
    }
  }, [openSearchDropdown])

  useEffect(() => {
    if (!searchOpen) return
    const activeEl = dropdownListRef.current?.querySelector<HTMLElement>(
      `[data-search-index="${activeIndex}"]`,
    )
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, searchOpen])

  const upcomingReminders = data.utilities.reminders.filter((r) => !r.done)
  const activeMeds = data.health.medications.filter((m) => m.active)
  const passwords = data.security.passwordEntries.length
  const vehiclesCount = data.personal.vehicles.length

  const fullName = data.profile.fullName || data.profile.nickName || ''
  const firstName = fullName.trim().split(/\s+/)[0]
  const now = new Date()
  const currentHour = now.getHours()
  const dayPeriod = getDayPeriod(currentHour)
  const weatherKind: WeatherKind = weather ? getWeatherKind(weather.code) : 'clear'

  const effectiveDayPeriod: DayPeriod =
    weatherPreview === 'clear-day'
      ? dayPeriod === 'night'
        ? 'morning'
        : dayPeriod
      : weatherPreview === 'clear-night'
        ? 'night'
        : dayPeriod

  const effectiveWeatherKind: WeatherKind =
    weatherPreview === 'auto'
      ? weatherKind
      : weatherPreview === 'clear-day' || weatherPreview === 'clear-night'
        ? 'clear'
        : weatherPreview

  const greeting = greetingFor(currentHour)
  const today = now.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const nextReminders = [...upcomingReminders]
    .sort((left, right) => left.dateTime.localeCompare(right.dateTime))
    .slice(0, 4)

  const latestEntries = [...data.diary.entries]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 4)

  const visibleInsights = insights.slice(0, 4)

  const heroSummary = (() => {
    const parts: string[] = []
    if (overdueRemindersCount > 0) {
      parts.push(
        overdueRemindersCount === 1
          ? '1 recordatorio vencido'
          : `${overdueRemindersCount} recordatorios vencidos`,
      )
    }
    if (todayRemindersCount > 0) {
      parts.push(
        todayRemindersCount === 1
          ? '1 recordatorio para hoy'
          : `${todayRemindersCount} recordatorios para hoy`,
      )
    }
    if (todayDoses.length > 0) {
      parts.push(
        nextDose
          ? `próxima toma a las ${nextDose.time} hs (${nextDose.medicationName})`
          : `${todayDoses.length} tomas completadas hoy`,
      )
    }
    if (parts.length > 0) {
      return `Agenda de hoy: ${parts.join(' · ')}.`
    }
    return null
  })()

  const heroStatusClass =
    criticalCount > 0
      ? 'dashboard-hero-badge has-critical'
      : warningCount > 0
        ? 'dashboard-hero-badge has-warning'
        : 'dashboard-hero-badge'

  const heroStatusText =
    criticalCount > 0
      ? `${criticalCount} ${criticalCount === 1 ? 'alerta crítica' : 'alertas críticas'}`
      : warningCount > 0
        ? `${warningCount} ${warningCount === 1 ? 'aviso activo' : 'avisos activos'}`
        : 'Cifrado local activo'

  const formattedTemp =
    weather !== null ? `${weather.temp > 0 ? `+${weather.temp}` : weather.temp}°C` : null

  return (
    <div className="dashboard">
      <section
        className="dashboard-hero"
        data-day-period={effectiveDayPeriod}
        data-weather={effectiveWeatherKind}
        aria-label="Resumen general"
      >
        <div className="dashboard-hero-fx" aria-hidden="true">
          {(effectiveWeatherKind === 'rain' || effectiveWeatherKind === 'storm') && (
            <div className="fx-glass-drops">
              <div className="fx-glass-condensation" />
              {effectiveWeatherKind === 'storm' ? <div className="fx-lightning-flash" /> : null}
              {RAIN_STREAKS.map((streak, index) => (
                <span
                  key={`streak-${index}`}
                  className="fx-rain-streak"
                  style={
                    {
                      left: streak.left,
                      top: streak.top,
                      height: `${streak.height}px`,
                      animationDelay: streak.delay,
                    } as CSSProperties
                  }
                />
              ))}
              {GLASS_DROPS.map((drop, index) => (
                <span
                  key={`drop-${index}`}
                  className={`fx-glass-drop${drop.runner ? ' fx-drop-runner' : ''}`}
                  style={
                    {
                      left: drop.left,
                      top: drop.top,
                      width: `${drop.width}px`,
                      height: `${drop.height}px`,
                      animationDuration: drop.duration,
                      animationDelay: drop.delay,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}

          {effectiveWeatherKind === 'clear' && effectiveDayPeriod !== 'night' && (
            <div className="fx-sunny-layer">
              <span className="fx-sun-orb" />
              <span className="fx-sunbeam fx-sunbeam-1" />
              <span className="fx-sunbeam fx-sunbeam-2" />
              <span className="fx-sunbeam fx-sunbeam-3" />
              {BOKEH_DOTS.map((dot, index) => (
                <span
                  key={`bokeh-${index}`}
                  className="fx-bokeh-dot"
                  style={
                    {
                      left: dot.left,
                      top: dot.top,
                      width: `${dot.size}px`,
                      height: `${dot.size}px`,
                      animationDuration: dot.duration,
                      animationDelay: dot.delay,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}

          {effectiveWeatherKind === 'clear' && effectiveDayPeriod === 'night' && (
            <div className="fx-night-layer">
              <span className="fx-moon-orb" />
              <span className="fx-shooting-star" />
              {NIGHT_STARS.map((star, index) => (
                <span
                  key={`star-${index}`}
                  className="fx-star"
                  style={
                    {
                      left: star.left,
                      top: star.top,
                      width: `${star.size}px`,
                      height: `${star.size}px`,
                      animationDuration: star.duration,
                      animationDelay: star.delay,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}

          {effectiveWeatherKind === 'cloudy' && (
            <div className="fx-cloudy-layer">
              <span className="fx-cloud-bank fx-cloud-1" />
              <span className="fx-cloud-bank fx-cloud-2" />
              <span className="fx-cloud-bank fx-cloud-3" />
              <span className="fx-cloud-bank fx-cloud-4" />
            </div>
          )}

          {effectiveWeatherKind === 'fog' && (
            <div className="fx-fog-layer">
              <span className="fx-fog-veil" />
              <span className="fx-fog-band fx-fog-band-1" />
              <span className="fx-fog-band fx-fog-band-2" />
              <span className="fx-fog-band fx-fog-band-3" />
            </div>
          )}

          {effectiveWeatherKind === 'snow' && (
            <div className="fx-snow-layer">
              <span className="fx-frost-vignette" />
              {SNOWFLAKES.map((flake, index) => (
                <span
                  key={`flake-${index}`}
                  className="fx-snowflake"
                  style={
                    {
                      left: flake.left,
                      width: `${flake.size}px`,
                      height: `${flake.size}px`,
                      animationDuration: flake.duration,
                      animationDelay: flake.delay,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-hero-meta">
          <span className="page-eyebrow">{today}</span>
          <div className="dashboard-hero-pills">
            {weather ? (
              <button
                type="button"
                className={`dashboard-weather-pill${weatherExpanded ? ' is-expanded' : ''}`}
                onClick={() => setWeatherExpanded((prev) => !prev)}
                aria-expanded={weatherExpanded}
                title="Ver pronóstico extendido de 7 días y efectos de atmósfera"
              >
                <MapPin size={13} className="dashboard-weather-pin" aria-hidden />
                <span className="dashboard-weather-city">{weather.city}</span>
                <span className="dashboard-weather-sep" aria-hidden>
                  ·
                </span>
                <span className="dashboard-weather-icon">
                  {renderWeatherIcon(weather.code, weather.isDay, 14)}
                </span>
                <span className="dashboard-weather-temp">{formattedTemp}</span>
                <span className="dashboard-weather-desc">{weather.description}</span>
                <ChevronDown size={13} className="dashboard-weather-chevron" aria-hidden />
              </button>
            ) : null}

            <span className={heroStatusClass}>
              <span className="status-dot" aria-hidden />
              <span>{heroStatusText}</span>
            </span>

            <button
              type="button"
              className="dashboard-share-pill"
              onClick={() => setShareModalOpen(true)}
              title="Compartir LifeKeeper con conocidos"
            >
              <Share2 size={13} aria-hidden />
              <span>Compartir app</span>
            </button>
          </div>
        </div>

        {weather && weatherExpanded ? (
          <div className="dashboard-weather-forecast" role="region" aria-label="Pronóstico de 7 días">
            <div className="dashboard-weather-forecast-head">
              <div className="dashboard-weather-current-details">
                <span className="dashboard-weather-detail">
                  <Thermometer size={13} aria-hidden />
                  Sensación: <strong>{weather.apparentTemp}°C</strong>
                </span>
                <span className="dashboard-weather-detail">
                  <Droplets size={13} aria-hidden />
                  Humedad: <strong>{weather.humidity}%</strong>
                </span>
                <span className="dashboard-weather-detail">
                  <Wind size={13} aria-hidden />
                  Viento: <strong>{weather.windSpeed} km/h</strong>
                </span>
              </div>
              <button
                type="button"
                className="dashboard-weather-locate-btn"
                onClick={() => void fetchWeatherData(true)}
                disabled={locatingWeather}
              >
                <LocateFixed size={13} aria-hidden />
                <span>
                  {locatingWeather ? 'Localizando...' : 'Actualizar ubicación exacta'}
                </span>
              </button>
            </div>

            {airQuality ? (
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  padding: '0.625rem 1rem',
                  background: 'rgba(15, 23, 42, 0.28)',
                  borderRadius: 'var(--radius-md)',
                  margin: '0.625rem 0',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8125rem' }}>🍃 Calidad del aire:</span>
                  <strong style={{ fontSize: '0.875rem' }}>AQI {airQuality.aqi}</strong>
                  <span className={airQuality.aqiColorClass} style={{ fontSize: '0.75rem' }}>
                    {airQuality.aqiCategory}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8125rem' }}>☀️ Índice UV:</span>
                  <strong style={{ fontSize: '0.875rem' }}>{airQuality.uvIndex}</strong>
                  <span className={airQuality.uvColorClass} style={{ fontSize: '0.75rem' }}>
                    {airQuality.uvCategory}
                  </span>
                </div>

                <div style={{ flex: '1 1 100%', fontSize: '0.75rem', opacity: 0.9 }}>
                  💡 {airQuality.outdoorAdvice} {airQuality.uvRecommendation}
                </div>
              </div>
            ) : null}

            {weather.daily.length > 0 ? (
              <div className="dashboard-weather-days">
                {weather.daily.map((day, idx) => (
                  <div
                    key={day.date}
                    className={`dashboard-weather-day${idx === 0 ? ' is-today' : ''}`}
                  >
                    <span className="dashboard-weather-day-name">
                      {formatForecastDayLabel(day.date, idx)}
                    </span>
                    <span className="dashboard-weather-day-icon">
                      {renderWeatherIcon(day.code, true, 18)}
                    </span>
                    <span className="dashboard-weather-day-desc">
                      {describeWeatherCode(day.code)}
                    </span>
                    <div className="dashboard-weather-day-temps">
                      <span className="dashboard-weather-day-max">{day.tempMax}°</span>
                      <span className="dashboard-weather-day-min">{day.tempMin}°</span>
                    </div>
                    {day.precipProb > 0 ? (
                      <span className="dashboard-weather-day-rain">💧 {day.precipProb}%</span>
                    ) : (
                      <span className="dashboard-weather-day-rain is-dry">—</span>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="dashboard-weather-fx-bar" role="group" aria-label="Vista previa de atmósfera en portada">
              <span className="dashboard-weather-fx-label">Vista previa de atmósfera en portada:</span>
              <div className="dashboard-weather-fx-chips">
                {WEATHER_PREVIEW_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`dashboard-weather-fx-chip${
                      weatherPreview === opt.value ? ' is-active' : ''
                    }`}
                    onClick={() => setWeatherPreview(opt.value)}
                    aria-pressed={weatherPreview === opt.value}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="dashboard-hero-main">
          <div className="dashboard-hero-text">
            <h2 className="dashboard-hero-title">
              {greeting}
              {firstName ? `, ${firstName}` : ''}
            </h2>
            {heroSummary ? <p className="dashboard-hero-subtitle">{heroSummary}</p> : null}
          </div>

          <div className="dashboard-hero-actions">
            <div
              ref={searchBoxRef}
              className={`dashboard-search${searchOpen ? ' is-open' : ''}`}
              role="combobox"
              aria-expanded={searchOpen}
              aria-haspopup="listbox"
            >
              <Search size={15} className="dashboard-search-icon" aria-hidden />
              <input
                ref={searchInputRef}
                type="text"
                className="dashboard-search-input"
                value={query}
                placeholder="Buscar en secciones, notas, salud, finanzas..."
                aria-label="Buscar en toda la bóveda"
                onFocus={openSearchDropdown}
                onChange={(event) => {
                  setQuery(event.target.value)
                  if (!searchOpen) openSearchDropdown()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeSearchDropdown()
                    searchInputRef.current?.blur()
                    return
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    if (!searchOpen) {
                      openSearchDropdown()
                      return
                    }
                    setActiveIndex((prev) =>
                      results.length > 0 ? (prev + 1) % results.length : 0,
                    )
                    return
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    if (!searchOpen) {
                      openSearchDropdown()
                      return
                    }
                    setActiveIndex((prev) =>
                      results.length > 0 ? (prev - 1 + results.length) % results.length : 0,
                    )
                    return
                  }
                  if (event.key === 'Enter' && searchOpen && results[activeIndex]) {
                    event.preventDefault()
                    selectSearchResult(results[activeIndex])
                  }
                }}
              />
              {query ? (
                <button
                  type="button"
                  className="dashboard-search-clear"
                  onClick={() => {
                    setQuery('')
                    searchInputRef.current?.focus()
                  }}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={14} aria-hidden />
                </button>
              ) : (
                <kbd className="dashboard-search-kbd" aria-hidden>
                  Ctrl+K
                </kbd>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-hero-tip" role="note" aria-label="Consejo de la sesión">
          <div className="dashboard-hero-tip-content">
            <span className="dashboard-hero-tip-badge">
              <Sparkles size={13} aria-hidden />
              <span>Consejo de la sesión</span>
            </span>
            <p className="dashboard-hero-tip-text">{SESSION_TIPS[tipIndex]}</p>
          </div>
          <button
            type="button"
            className="dashboard-hero-tip-refresh"
            onClick={rotateTip}
            aria-label="Ver otro consejo"
            title="Otro consejo"
          >
            <RefreshCw size={13} aria-hidden />
            <span>Otro consejo</span>
          </button>
        </div>
      </section>

      {searchOpen && dropdownPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={dropdownRef}
              className="dashboard-search-dropdown"
              role="listbox"
              aria-label="Resultados de búsqueda"
              style={{
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
              }}
            >
              <div className="dashboard-search-dropdown-header">
                <span>
                  {query.trim()
                    ? `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`
                    : 'Accesos rápidos a secciones'}
                </span>
                <span>↑↓ navegar · Enter abrir</span>
              </div>
              <div ref={dropdownListRef} className="dashboard-search-dropdown-list">
                {results.length === 0 ? (
                  <div className="dashboard-search-empty">
                    No se encontraron registros para “{query}”.
                  </div>
                ) : (
                  results.map((item, index) => {
                    const isActive = index === activeIndex
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-search-index={index}
                        className={`dashboard-search-option${isActive ? ' is-active' : ''}`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectSearchResult(item)}
                      >
                        <span className="dashboard-search-option-icon" aria-hidden>
                          {item.kind === 'navigation' ? (
                            <Compass size={15} />
                          ) : (
                            <FileText size={15} />
                          )}
                        </span>
                        <span className="dashboard-search-option-body">
                          <span className="dashboard-search-option-title">{item.title}</span>
                          <span className="dashboard-search-option-sub">
                            {item.categoryLabel} · {item.subtitle}
                          </span>
                        </span>
                        {item.badge ? (
                          <span className="chip dashboard-search-option-badge">{item.badge}</span>
                        ) : null}
                      </button>
                    )
                  })
                )}
              </div>
              <ScrollbarOverlay targetRef={dropdownListRef} zIndex={1110} />
            </div>,
            document.body,
          )
        : null}

      <div className="kpi-grid">
        <a className="kpi-tile" href="#utilities:reminders">
          <div className="kpi-tile-head">
            <span className="kpi-icon">
              <BellRing aria-hidden />
            </span>
            <span className="kpi-label">Recordatorios activos</span>
          </div>
          <span className="kpi-value">{upcomingReminders.length}</span>
          <div className="kpi-sub">
            {overdueRemindersCount > 0 ? (
              <span className="kpi-meta is-critical">{overdueRemindersCount} vencidos</span>
            ) : null}
            {todayRemindersCount > 0 ? (
              <span className="kpi-meta is-warning">{todayRemindersCount} para hoy</span>
            ) : null}
            {overdueRemindersCount === 0 && todayRemindersCount === 0 ? (
              <span>Al día, sin vencimientos hoy</span>
            ) : null}
          </div>
          <span className="kpi-link">
            Ver recordatorios
            <ArrowUpRight aria-hidden />
          </span>
        </a>

        <a className="kpi-tile" href="#health:medications">
          <div className="kpi-tile-head">
            <span className="kpi-icon">
              <Pill aria-hidden />
            </span>
            <span className="kpi-label">Salud y medicación</span>
          </div>
          <span className="kpi-value">{activeMeds.length}</span>
          <div className="kpi-sub">
            {nextDose ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  width: '100%',
                }}
              >
                <span className="kpi-meta">
                  {nextDose.time} hs · {nextDose.medicationName}
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem' }}
                  onClick={quickTakeMedication}
                  title="Marcar toma cumplida ahora"
                >
                  ✓ Tomar
                </button>
              </div>
            ) : (
              <span>Sin tomas pendientes hoy</span>
            )}
          </div>
          <span className="kpi-link">
            Ir a medicaciones
            <ArrowUpRight aria-hidden />
          </span>
        </a>

        <a className="kpi-tile" href="#personal:finances">
          <div className="kpi-tile-head">
            <span className="kpi-icon">
              <Wallet aria-hidden />
            </span>
            <span className="kpi-label">Balance del mes</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowMonthBalance((prev) => !prev)
              }}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                padding: '0.2rem',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title={showMonthBalance ? 'Ocultar monto' : 'Mostrar monto'}
              aria-label={showMonthBalance ? 'Ocultar monto' : 'Mostrar monto'}
            >
              {showMonthBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <span className={`kpi-value${currentMonthBalance < 0 ? ' is-negative' : ''}`}>
            {showMonthBalance ? formatCurrencyNoCents(currentMonthBalance, currency) : '••••••'}
          </span>
          <div className="kpi-sub">
            {expenseDeltaPercent !== null ? (
              <span
                className={`kpi-meta${
                  expenseDeltaPercent > 15
                    ? ' is-warning'
                    : expenseDeltaPercent < 0
                      ? ' is-success'
                      : ''
                }`}
              >
                {expenseDeltaPercent > 0 ? `+${expenseDeltaPercent}%` : `${expenseDeltaPercent}%`} vs.
                mes ant.
              </span>
            ) : (
              <span>
                {showMonthBalance
                  ? `Ingresos ${formatCurrencyNoCents(currentMonthIncome, currency)} · Egresos ${formatCurrencyNoCents(currentMonthExpense, currency)}`
                  : 'Ingresos •••••• · Egresos ••••••'}
              </span>
            )}
          </div>
          <span className="kpi-link">
            Ver finanzas
            <ArrowUpRight aria-hidden />
          </span>
        </a>

        <a className="kpi-tile" href="#security:passwords">
          <div className="kpi-tile-head">
            <span className="kpi-icon">
              <KeyRound aria-hidden />
            </span>
            <span className="kpi-label">Seguridad y bienestar</span>
          </div>
          <span className="kpi-value">{passwords}</span>
          <div className="kpi-sub">
            {weakOrReusedPasswordsCount > 0 ? (
              <span className="kpi-meta is-warning">
                {weakOrReusedPasswordsCount} por fortalecer
              </span>
            ) : oldPasswordsCount > 0 ? (
              <span className="kpi-meta">{oldPasswordsCount} por rotar</span>
            ) : (
              <span className="kpi-meta is-success">Claves saludables</span>
            )}
            {diaryStreakDays > 0 ? (
              <span className="kpi-meta">Racha {diaryStreakDays} d</span>
            ) : dominantMood ? (
              <span>Ánimo: {dominantMood}</span>
            ) : null}
          </div>
          <span className="kpi-link">
            Gestor de contraseñas
            <ArrowUpRight aria-hidden />
          </span>
        </a>

        <a className="kpi-tile" href="#personal:workouts">
          <div className="kpi-tile-head">
            <span className="kpi-icon">
              <Dumbbell aria-hidden />
            </span>
            <span className="kpi-label">Entrenamientos</span>
          </div>
          <span className="kpi-value">{thisMonthWorkoutsCount}</span>
          <div className="kpi-sub">
            {thisMonthWorkoutsCount > 0 ? (
              <span className="kpi-meta is-success">
                {thisMonthWorkoutsCount} {thisMonthWorkoutsCount === 1 ? 'sesión este mes' : 'sesiones este mes'}
              </span>
            ) : (
              <span>Sin entrenamientos este mes</span>
            )}
          </div>
          <span className="kpi-link">
            Ver entrenamientos
            <ArrowUpRight aria-hidden />
          </span>
        </a>

        <a className="kpi-tile" href="#health:hydration">
          <div className="kpi-tile-head">
            <span className="kpi-icon">
              <Droplets aria-hidden />
            </span>
            <span className="kpi-label">Hidratación diaria</span>
          </div>
          <span className="kpi-value">{displayWaterCurrent}</span>
          <div className="kpi-sub">
            <span className={`kpi-meta ${waterPercent >= 100 ? 'is-success' : 'is-warning'}`}>
              {waterPercent}% ({displayWaterTarget})
            </span>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', marginLeft: 'auto' }}
              onClick={(e) => quickAddWater(e, 250)}
              title="Sumar 250 ml (1 vaso) ahora"
            >
              +250 ml
            </button>
          </div>
          <span className="kpi-link">
            Ver hidratación
            <ArrowUpRight aria-hidden />
          </span>
        </a>

        <a className="kpi-tile" href="#profile">
          <div className="kpi-tile-head">
            <span className="kpi-icon">
              <Scale aria-hidden />
            </span>
            <span className="kpi-label">IMC y Biometría</span>
          </div>
          <span className="kpi-value">
            {imcInfo ? imcInfo.value : weightKg ? `${weightKg} kg` : '—'}
          </span>
          <div className="kpi-sub">
            {imcInfo ? (
              <span className={`kpi-meta ${imcInfo.badgeClass}`}>
                {imcInfo.category} ({weightKg} kg)
              </span>
            ) : weightKg ? (
              <span>{weightKg} kg (falta altura)</span>
            ) : (
              <span>Sin peso cargado</span>
            )}
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', marginLeft: 'auto' }}
              onClick={openWeightModal}
              title="Actualizar peso corporal"
            >
              ⚖️ Actualizar
            </button>
          </div>
          <span className="kpi-link">
            Ver perfil y biometría
            <ArrowUpRight aria-hidden />
          </span>
        </a>
      </div>

      <VaultScoreCard />

      <section className="panel dashboard-insights" aria-label="Centro de atención e insights">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Centro de atención e insights inteligentes</h3>
            <p className="panel-subtitle">
              Alertas operativas, correlaciones cruzadas entre salud, finanzas y hábitos
            </p>
          </div>
          <div className="dashboard-insights-badges">
            {criticalCount > 0 ? (
              <span className="badge badge-error">
                {criticalCount} {criticalCount === 1 ? 'crítica' : 'críticas'}
              </span>
            ) : null}
            {warningCount > 0 ? (
              <span className="badge badge-warning">
                {warningCount} {warningCount === 1 ? 'atención' : 'atenciones'}
              </span>
            ) : null}
            {criticalCount === 0 && warningCount === 0 ? (
              <span className="badge badge-success">Todo en orden</span>
            ) : null}
          </div>
        </div>

        {/* Correlaciones cruzadas e inteligencia proactiva */}
        {crossInsights.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            {crossInsights.map((ci) => (
              <div
                key={ci.id}
                className="subpanel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  borderLeft: '3px solid var(--color-accent-blue)',
                  padding: '0.75rem 1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>{ci.title}</h4>
                  <span className={ci.badgeClass} style={{ fontSize: '0.7rem' }}>
                    {ci.badgeLabel}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                  {ci.description}
                </p>
                {ci.actionHash && (
                  <a
                    href={ci.actionHash}
                    className="kpi-link"
                    style={{ fontSize: '0.75rem', alignSelf: 'flex-start', marginTop: '0.2rem' }}
                  >
                    {ci.actionLabel || 'Ver más'}
                    <ArrowUpRight size={12} aria-hidden />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {visibleInsights.length === 0 && crossInsights.length === 0 ? (
          <div className="insight-empty">
            <CheckCircle2 aria-hidden />
            <span>Tu bóveda está al día: sin vencimientos ni alertas críticas.</span>
          </div>
        ) : (
          <div className="insights-list">
            {visibleInsights.map((item) => (
              <a
                key={item.id}
                href={item.targetHash}
                className={`insight-card is-${item.severity}`}
              >
                <div className="insight-card-top">
                  <span className={`insight-icon is-${item.severity}`}>
                    {iconForSeverity(item.severity)}
                  </span>
                  <div className="insight-body">
                    <div className="insight-title-row">
                      <h4 className="insight-title">{item.title}</h4>
                      {item.meta ? (
                        <span className={badgeClassForSeverity(item.severity)}>{item.meta}</span>
                      ) : null}
                    </div>
                    <p className="insight-description">{item.description}</p>
                  </div>
                </div>
                <div className="insight-footer">
                  <span className="chip">{item.category}</span>
                  <span className="kpi-link">
                    {item.actionLabel}
                    <ArrowUpRight aria-hidden />
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      <div className="quick-grid">
        <section className="quick-card">
          <div className="quick-card-head">
            <div className="quick-card-title-group">
              <span className="quick-icon">
                <UserRound aria-hidden />
              </span>
              <div>
                <h3 className="quick-title">Datos personales y diario</h3>
                <p className="quick-subtitle">Perfil, proyectos activos, vehículos y bienestar</p>
              </div>
            </div>
            {dominantMood ? <span className="chip">Ánimo: {dominantMood}</span> : null}
          </div>

          <div className="quick-summary-box">
            <div className="quick-summary-row">
              <span>Proyectos activos: {activeProjectsCount}</span>
              <span className="chip">{pendingTasksCount} tareas pendientes</span>
            </div>
            <div className="quick-summary-row">
              <span>
                Racha en el diario:{' '}
                {diaryStreakDays > 0
                  ? `${diaryStreakDays} ${diaryStreakDays === 1 ? 'día' : 'días'}`
                  : 'sin racha activa'}
              </span>
              <a className="kpi-link" href="#diary:mood">
                <Sparkles size={13} aria-hidden />
                Ver estado de ánimo
              </a>
            </div>
          </div>

          <div className="quick-actions">
            <a className="primary-button" href="#profile:settings">
              Editar perfil
            </a>
            <a className="secondary-button" href="#personal:projects">
              Proyectos ({data.personal.projects.length})
            </a>
            <a className="secondary-button" href="#personal:vehicles">
              Vehículos ({vehiclesCount})
            </a>
          </div>
        </section>

        <section className="quick-card">
          <div className="quick-card-head">
            <div className="quick-card-title-group">
              <span className="quick-icon">
                <HeartPulse aria-hidden />
              </span>
              <div>
                <h3 className="quick-title">Salud y ficha SOS</h3>
                <p className="quick-subtitle">Agenda de tomas de hoy, vacunas e historial clínico</p>
              </div>
            </div>
            <a
              href="#health:emergency"
              className={
                emergencyCompletenessPercent === 100
                  ? 'badge badge-success'
                  : 'badge badge-warning'
              }
            >
              SOS {emergencyCompletenessPercent}%
            </a>
          </div>

          <div className="quick-summary-box">
            <div className="quick-summary-row">
              <span>
                {todayDoses.length > 0
                  ? `Tomas programadas hoy (${todayDoses.length})`
                  : 'Sin tomas programadas para hoy'}
              </span>
              {upcomingVaccinesCount > 0 ? (
                <span className="badge badge-warning">
                  {upcomingVaccinesCount}{' '}
                  {upcomingVaccinesCount === 1 ? 'refuerzo próximo' : 'refuerzos próximos'}
                </span>
              ) : null}
            </div>
            {todayDoses.length > 0 ? (
              <div className="quick-dose-list">
                {todayDoses.slice(0, 4).map((dose, idx) => (
                  <span
                    key={`${dose.medicationId}-${dose.time}-${idx}`}
                    className={
                      dose.isDueNow
                        ? 'badge badge-warning'
                        : dose.isPastToday
                          ? 'chip'
                          : 'badge badge-info'
                    }
                  >
                    {dose.time} · {dose.medicationName}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="quick-actions">
            <a className="secondary-button" href="#health:consultations">
              Consultas
            </a>
            <a className="secondary-button" href="#health:vaccines">
              Vacunas
            </a>
            <a className="secondary-button" href="#health:history">
              Historial
            </a>
            <a className="secondary-button" href="#health:emergency">
              Ficha SOS
            </a>
          </div>
        </section>
      </div>

      <div className="dashboard-lower">
        <section className="panel dashboard-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Próximos recordatorios</h3>
              <p className="panel-subtitle">Lo que se viene en tu agenda</p>
            </div>
            <a className="kpi-link" href="#utilities:reminders">
              Ver todos
              <ArrowUpRight aria-hidden />
            </a>
          </div>
          {nextReminders.length === 0 ? (
            <div className="empty-state">No tenés recordatorios pendientes.</div>
          ) : (
            <ul className="dashboard-list">
              {nextReminders.map((reminder) => {
                const parsed = safeParseDate(reminder.dateTime)
                const remKey = toLocalDateKey(parsed)
                const isReminderToday = remKey === todayKey
                const isReminderOverdue = parsed
                  ? parsed.getTime() < now.getTime() && !isReminderToday
                  : false

                return (
                  <li key={reminder.id} className="dashboard-list-item">
                    <span className="dashboard-list-date">
                      {formatDateTime(reminder.dateTime)}
                    </span>
                    <span className="dashboard-list-title" title={reminder.title}>
                      {reminder.title}
                    </span>
                    {isReminderOverdue ? (
                      <span className="badge badge-error">Vencido</span>
                    ) : isReminderToday ? (
                      <span className="badge badge-warning">Hoy</span>
                    ) : (
                      <span className="chip">{reminder.category}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="panel dashboard-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Últimas notas</h3>
              <p className="panel-subtitle">Tus registros más recientes del diario</p>
            </div>
            <a className="kpi-link" href="#diary:notes">
              Abrir diario
              <ArrowUpRight aria-hidden />
            </a>
          </div>
          {latestEntries.length === 0 ? (
            <div className="empty-state">Todavía no escribiste notas en tu diario.</div>
          ) : (
            <ul className="dashboard-list">
              {latestEntries.map((entry) => (
                <li key={entry.id} className="dashboard-list-item">
                  <span className="dashboard-list-date">{formatDate(entry.date)}</span>
                  <span className="dashboard-list-title" title={entry.title || entry.content}>
                    {entry.title || 'Sin título'}
                  </span>
                  <span className="chip">{entry.mood}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal
        open={weightModalOpen}
        onClose={() => setWeightModalOpen(false)}
        title="Actualizar peso y biometría"
        subtitle="Mantené tu peso al día para un cálculo preciso de IMC y meta de hidratación"
        maxWidth="440px"
      >
        <form onSubmit={handleSaveWeight} className="form-grid">
          <div className="field">
            <label htmlFor="modal-weight">
              Peso actual ({preferences.unitSystem === 'imperial' ? 'lb' : 'kg'})
            </label>
            <input
              id="modal-weight"
              type="number"
              step="0.1"
              min="20"
              max="350"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder={preferences.unitSystem === 'imperial' ? 'Ej. 160' : 'Ej. 74.5'}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="modal-height">
              Altura ({preferences.unitSystem === 'imperial' ? 'in' : 'cm'})
            </label>
            <input
              id="modal-height"
              type="number"
              step="1"
              min="50"
              max="260"
              value={newHeight}
              onChange={(e) => setNewHeight(e.target.value)}
              placeholder={preferences.unitSystem === 'imperial' ? 'Ej. 69' : 'Ej. 175'}
            />
            <span className="panel-subtitle">Necesaria para calcular tu Índice de Masa Corporal</span>
          </div>
          <div
            className="form-actions field-full"
            style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}
          >
            <button
              type="button"
              className="secondary-button"
              onClick={() => setWeightModalOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Guardar cambios
            </button>
          </div>
        </form>
      </Modal>

      <ShareModal open={shareModalOpen} onClose={() => setShareModalOpen(false)} />
    </div>
  )
}
