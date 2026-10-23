import { THEME_PRESETS } from './themes'

export type ThemeId = (typeof THEME_PRESETS)[number]['id']
export type ColorMode = 'dark' | 'light'
export type LogoVariant = 'full' | 'mark' | 'wordmark'
export type StartSection = 'dashboard' | 'last'

export type BackgroundId =
  | 'none'
  | 'aurora'
  | 'constellation'
  | 'silk'
  | 'ecg'
  | 'matrix'
  | 'terminal'
  | 'hex'
  | 'radar'
  | 'network'
  | 'binary'
  | 'glitch'
  | 'biometric'
  | 'grid'
  | 'vhs'

export interface BackgroundPreset {
  id: BackgroundId
  label: string
  description: string
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'none', label: 'Sin fondo', description: 'Fondo sólido del tema' },
  { id: 'aurora', label: 'Aurora Dots', description: 'Ondas suaves de luz' },
  { id: 'constellation', label: 'Constellation', description: 'Estrellas y líneas' },
  { id: 'silk', label: 'Silk Flow', description: 'Cintas fluidas' },
  { id: 'ecg', label: 'ECG Draw Pulse', description: 'Señal cardíaca animada' },
  { id: 'matrix', label: 'Digital Rain', description: 'Lluvia de caracteres' },
  { id: 'terminal', label: 'Terminal Ghost', description: 'Consola fantasma' },
  { id: 'hex', label: 'Hex Stream', description: 'Flujo hexadecimal' },
  { id: 'radar', label: 'Cyber Radar', description: 'Barrido radar' },
  { id: 'network', label: 'Network Pulse', description: 'Nodos y conexiones' },
  { id: 'binary', label: 'Binary Ocean', description: 'Olas de bits' },
  { id: 'glitch', label: 'Glitch Protocol', description: 'Interferencia digital' },
  { id: 'biometric', label: 'Biometric Scan', description: 'Escaneo biométrico' },
  { id: 'grid', label: 'Cyber Grid', description: 'Grilla en perspectiva' },
  { id: 'vhs', label: 'VHS Glitch', description: 'Cinta analógica retro' },
]

export interface LogoPreset {
  id: LogoVariant
  label: string
  description: string
}

export const LOGO_PRESETS: LogoPreset[] = [
  { id: 'full', label: 'Completo', description: 'Isotipo + logotipo' },
  { id: 'mark', label: 'Isotipo', description: 'Solo el perrito' },
  { id: 'wordmark', label: 'Logotipo', description: 'Solo LifeKeeper' },
]

export type CurrencyCode = 'ARS' | 'USD' | 'EUR' | 'BRL' | 'CLP' | 'MXN' | 'COP' | 'UYU'

export interface CurrencyOption {
  value: CurrencyCode
  label: string
  symbol: string
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { value: 'ARS', label: 'Peso argentino ($ - ARS)', symbol: '$' },
  { value: 'USD', label: 'Dólar estadounidense (US$ - USD)', symbol: 'US$' },
  { value: 'EUR', label: 'Euro (€ - EUR)', symbol: '€' },
  { value: 'BRL', label: 'Real brasileño (R$ - BRL)', symbol: 'R$' },
  { value: 'CLP', label: 'Peso chileno (CLP$ - CLP)', symbol: 'CLP$' },
  { value: 'MXN', label: 'Peso mexicano (Mex$ - MXN)', symbol: 'Mex$' },
  { value: 'COP', label: 'Peso colombiano (COL$ - COP)', symbol: 'COL$' },
  { value: 'UYU', label: 'Peso uruguayo ($U - UYU)', symbol: '$U' },
]

export type UnitSystem = 'metric' | 'imperial'

export interface UnitSystemOption {
  value: UnitSystem
  label: string
  description: string
}

export const UNIT_SYSTEM_OPTIONS: UnitSystemOption[] = [
  { value: 'metric', label: 'Métrico (kg, cm, km)', description: 'Kilogramos, centímetros y kilómetros' },
  { value: 'imperial', label: 'Imperial (lb, in, mi)', description: 'Libras, pulgadas y millas' },
]

export interface Preferences {
  theme: ThemeId
  mode: ColorMode
  background: BackgroundId
  backgroundOpacity: number
  backgroundSettings: Partial<Record<BackgroundId, Record<string, number>>>
  /** Multiplicador de puntos/partículas (densidad del efecto) */
  dotDensity: number
  logo: LogoVariant
  autoLockMinutes: number
  startSection: StartSection
  currency: CurrencyCode
  unitSystem: UnitSystem
  privacyCurtain: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'medianoche',
  mode: 'dark',
  background: 'none',
  backgroundOpacity: 0.4,
  backgroundSettings: {},
  dotDensity: 1,
  logo: 'full',
  autoLockMinutes: 0,
  startSection: 'dashboard',
  currency: 'ARS',
  unitSystem: 'metric',
  privacyCurtain: false,
}

export const AUTO_LOCK_OPTIONS = [
  { value: 0, label: 'Nunca' },
  { value: 5, label: '5 minutos' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
]
