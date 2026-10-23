import type { BackgroundId } from './types'

export type BackgroundSettingKey =
  | 'speed'
  | 'intensity'
  | 'height'
  | 'density'
  | 'detail'
  | 'flow'
  | 'mix'
  | 'palette'

export const BACKGROUND_SETTING_ORDER: BackgroundSettingKey[] = [
  'speed',
  'intensity',
  'height',
  'density',
  'detail',
  'flow',
  'mix',
  'palette',
]

export const BACKGROUND_SETTING_NAMES: Record<BackgroundSettingKey, string> = {
  speed: 'Velocidad',
  intensity: 'Intensidad',
  height: 'Altura del efecto',
  density: 'Densidad',
  detail: 'Definición / brillo',
  flow: 'Fluidez',
  mix: 'Mezcla cromática',
  palette: 'Paleta',
}

export const BACKGROUND_RANGES: Record<BackgroundSettingKey, readonly [number, number, number]> = {
  speed: [0, 3, 0.05],
  intensity: [0, 3.5, 0.05],
  height: [0, 1, 0.01],
  density: [0, 1, 0.01],
  detail: [0, 1, 0.01],
  flow: [0, 2.5, 0.05],
  mix: [0, 2, 0.05],
  palette: [0, 2, 1],
}

export const BACKGROUND_DEFAULTS: Partial<Record<BackgroundId, Record<string, number>>> = {
  aurora: { speed: 0.75, intensity: 1.35, height: 0.64, density: 0.65, detail: 0.48, flow: 1.15, mix: 0.8 },
  constellation: { speed: 0.65, intensity: 1.15, height: 1, density: 0.48, detail: 0.75, flow: 0.8, mix: 0.7 },
  silk: { speed: 0.65, intensity: 1.25, height: 0.88, density: 0.5, detail: 0.65, flow: 1.1, mix: 0.9 },
  ecg: { speed: 1, intensity: 2.1, height: 0.52, density: 0.48, detail: 0.72, flow: 1.9, mix: 1.65 },
  matrix: { speed: 1, intensity: 1.65, height: 1, density: 0.78, detail: 0.6, flow: 1.25, mix: 1.15, palette: 1 },
  terminal: { speed: 1, intensity: 1.3, density: 0.65, detail: 0.6, flow: 1, mix: 0.6, height: 1, palette: 1 },
  hex: { speed: 1, intensity: 1.3, density: 0.7, detail: 0.55, flow: 1, mix: 0.8, height: 1, palette: 1 },
  radar: { speed: 1, intensity: 1.5, density: 0.6, detail: 0.7, flow: 1, mix: 0.8, height: 1, palette: 1 },
  network: { speed: 1, intensity: 1.4, density: 0.6, detail: 0.6, flow: 1, mix: 0.8, height: 1, palette: 1 },
  binary: { speed: 1, intensity: 1.4, density: 0.7, detail: 0.65, flow: 1, mix: 0.8, height: 1, palette: 1 },
  glitch: { speed: 1, intensity: 1.3, density: 0.55, detail: 0.6, flow: 1, mix: 0.8, height: 1, palette: 1 },
  biometric: { speed: 1, intensity: 1.5, density: 0.7, detail: 0.7, flow: 1, mix: 0.8, height: 1, palette: 1 },
  grid: { speed: 1, intensity: 1.5, density: 0.65, detail: 0.65, flow: 1, mix: 0.8, height: 1, palette: 1 },
  vhs: { speed: 1, intensity: 1.4, density: 0.48, detail: 0.7, flow: 1.2, mix: 0.85, height: 1, palette: 1 },
}

/** Etiquetas específicas por efecto (mismas que el HTML original). */
export const BACKGROUND_SETTING_LABELS: Partial<Record<BackgroundId, Partial<Record<BackgroundSettingKey, string>>>> = {
  ecg: {
    density: 'Frecuencia cardíaca',
    flow: 'Amplitud de picos',
    detail: 'Grosor y halo',
    mix: 'Longitud de estela',
    height: 'Posición vertical',
    intensity: 'Brillo / contraste',
  },
  matrix: {
    density: 'Densidad de columnas',
    detail: 'Tamaño de caracteres',
    flow: 'Velocidad de caída',
    mix: 'Longitud de estela',
    height: 'Cobertura vertical',
  },
  terminal: { density: 'Líneas visibles', detail: 'Tamaño de fuente', flow: 'Velocidad de escritura', mix: 'Actividad de consola' },
  hex: { density: 'Densidad de bytes', detail: 'Tamaño de fuente', flow: 'Velocidad de flujo', mix: 'Mutaciones' },
  radar: { density: 'Cantidad de ecos', detail: 'Detalle de cuadrícula', flow: 'Rotación del barrido', mix: 'Persistencia de ecos' },
  network: { density: 'Cantidad de nodos', detail: 'Brillo de conexiones', flow: 'Velocidad de paquetes', mix: 'Actividad de red' },
  binary: { density: 'Densidad de bits', detail: 'Tamaño de caracteres', flow: 'Amplitud de olas', mix: 'Perspectiva' },
  glitch: { density: 'Cantidad de líneas', detail: 'Grosor de interferencias', flow: 'Frecuencia de fallos', mix: 'Desplazamiento RGB' },
  biometric: { density: 'Densidad de surcos', detail: 'Nitidez de huella', flow: 'Velocidad de escaneo', mix: 'Resplandor' },
  grid: { density: 'Densidad de malla', detail: 'Grosor de líneas', flow: 'Velocidad de avance', mix: 'Ondulación' },
  vhs: {
    density: 'Ruido analógico',
    detail: 'Intensidad de scanlines',
    flow: 'Frecuencia de tracking',
    mix: 'Aberración cromática',
    height: 'Cobertura de pantalla',
  },
}

export const BACKGROUND_PALETTES: Partial<Record<BackgroundId, string[]>> = {
  matrix: ['Matrix', 'LifeKeeper', 'Cyber Red'],
  vhs: ['Mono', 'LifeKeeper', 'Retro cálido'],
  terminal: ['Verde', 'LifeKeeper', 'Rojo'],
  hex: ['Verde', 'LifeKeeper', 'Rojo'],
  radar: ['Verde', 'LifeKeeper', 'Rojo'],
  network: ['Verde', 'LifeKeeper', 'Rojo'],
  binary: ['Verde', 'LifeKeeper', 'Rojo'],
  glitch: ['Verde', 'LifeKeeper', 'Rojo'],
  biometric: ['Verde', 'LifeKeeper', 'Rojo'],
  grid: ['Verde', 'LifeKeeper', 'Rojo'],
}

export const getBackgroundKeys = (id: BackgroundId): BackgroundSettingKey[] => {
  const defaults = BACKGROUND_DEFAULTS[id]
  if (!defaults) return []
  return BACKGROUND_SETTING_ORDER.filter((key) => key in defaults)
}

export const getBackgroundSettings = (
  id: BackgroundId,
  overrides?: Partial<Record<BackgroundId, Record<string, number>>>,
): Record<string, number> => ({
  ...(BACKGROUND_DEFAULTS[id] ?? {}),
  ...(overrides?.[id] ?? {}),
})

export const getBackgroundSettingLabel = (id: BackgroundId, key: BackgroundSettingKey): string =>
  BACKGROUND_SETTING_LABELS[id]?.[key] ?? BACKGROUND_SETTING_NAMES[key]

export const formatBackgroundSettingValue = (
  id: BackgroundId,
  key: BackgroundSettingKey,
  value: number,
): string => {
  if (key === 'palette') {
    const palette = BACKGROUND_PALETTES[id]
    if (palette) return palette[Math.round(value)] ?? String(value)
  }
  const step = BACKGROUND_RANGES[key][2]
  return step >= 1 ? String(Math.round(value)) : value.toFixed(2)
}
