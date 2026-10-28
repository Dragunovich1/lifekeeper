import type { FinanceCategoryDef, TransactionType } from '../types'

export interface CategoryView {
  /** Nombre canónico con el que se agrupa y se muestra. */
  name: string
  kind: TransactionType
  icon: string
  color: string
  custom: boolean
  id?: string
}

type DefaultCategory = Omit<FinanceCategoryDef, 'id'>

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  { name: 'Hogar', kind: 'expense', icon: 'home', color: '#2563eb' },
  { name: 'Facturas y servicios', kind: 'expense', icon: 'receipt', color: '#ef4444' },
  { name: 'Comida', kind: 'expense', icon: 'food', color: '#16a34a' },
  { name: 'Supermercado', kind: 'expense', icon: 'basket', color: '#f59e0b' },
  { name: 'Transporte', kind: 'expense', icon: 'car', color: '#0ea5e9' },
  { name: 'Combustible', kind: 'expense', icon: 'fuel', color: '#475569' },
  { name: 'Salud', kind: 'expense', icon: 'health', color: '#ec4899' },
  { name: 'Compras', kind: 'expense', icon: 'bag', color: '#a855f7' },
  { name: 'Ropa', kind: 'expense', icon: 'shirt', color: '#f97316' },
  { name: 'Entretenimiento', kind: 'expense', icon: 'game', color: '#84cc16' },
  { name: 'Suscripciones', kind: 'expense', icon: 'tv', color: '#6366f1' },
  { name: 'Educación', kind: 'expense', icon: 'school', color: '#14b8a6' },
  { name: 'Mascotas', kind: 'expense', icon: 'paw', color: '#d97706' },
  { name: 'Regalos', kind: 'expense', icon: 'gift', color: '#f43f5e' },
  { name: 'Viajes', kind: 'expense', icon: 'plane', color: '#06b6d4' },
  { name: 'Deporte', kind: 'expense', icon: 'sport', color: '#22c55e' },
  { name: 'Impuestos y cargos', kind: 'expense', icon: 'bank', color: '#64748b' },
  { name: 'Ahorro e inversión', kind: 'expense', icon: 'piggy', color: '#10b981' },
  { name: 'Otros gastos', kind: 'expense', icon: 'dots', color: '#94a3b8' },
]

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: 'Sueldo', kind: 'income', icon: 'briefcase', color: '#16a34a' },
  { name: 'Honorarios', kind: 'income', icon: 'laptop', color: '#0ea5e9' },
  { name: 'Ventas', kind: 'income', icon: 'store', color: '#f59e0b' },
  { name: 'Alquileres', kind: 'income', icon: 'building', color: '#6366f1' },
  { name: 'Inversiones', kind: 'income', icon: 'trend', color: '#14b8a6' },
  { name: 'Regalos recibidos', kind: 'income', icon: 'gift', color: '#ec4899' },
  { name: 'Reembolsos', kind: 'income', icon: 'refund', color: '#a855f7' },
  { name: 'Otros ingresos', kind: 'income', icon: 'plus', color: '#94a3b8' },
]

export const ICON_KEYS = [
  'home', 'receipt', 'food', 'basket', 'car', 'fuel', 'health', 'bag', 'shirt', 'game', 'tv', 'school',
  'paw', 'gift', 'plane', 'sport', 'bank', 'piggy', 'briefcase', 'laptop', 'store', 'building', 'trend',
  'refund', 'coffee', 'music', 'phone', 'wrench', 'baby', 'heart', 'card', 'coins', 'tag', 'plus', 'dots',
] as const

export const COLOR_SWATCHES = ['#2563eb', '#0ea5e9', '#14b8a6', '#16a34a', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#64748b']

export const normalizeCategoryName = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Nombres que ya se usaban (sobre todo los que carga el asistente) y a qué categoría canónica corresponden. */
const ALIASES: Record<string, string> = {
  'expense:alimentacion': 'Comida',
  'expense:comidas': 'Comida',
  'expense:restaurante': 'Comida',
  'expense:delivery': 'Comida',
  'expense:super': 'Supermercado',
  'expense:servicios': 'Facturas y servicios',
  'expense:facturas': 'Facturas y servicios',
  'expense:luz': 'Facturas y servicios',
  'expense:gas': 'Facturas y servicios',
  'expense:internet': 'Facturas y servicios',
  'expense:expensas': 'Hogar',
  'expense:alquiler': 'Hogar',
  'expense:varios': 'Otros gastos',
  'expense:otros': 'Otros gastos',
  'expense:ocio': 'Entretenimiento',
  'expense:nafta': 'Combustible',
  'expense:gimnasio': 'Deporte',
  'expense:farmacia': 'Salud',
  'expense:ahorro e inversion': 'Ahorro e inversión',
  'expense:impuestos': 'Impuestos y cargos',
  'income:sueldo/honorarios': 'Sueldo',
  'income:salario': 'Sueldo',
  'income:ingreso': 'Otros ingresos',
  'income:ingresos': 'Otros ingresos',
  'income:honorario': 'Honorarios',
  'income:alquiler': 'Alquileres',
  'income:venta': 'Ventas',
}

const hashColor = (name: string): string => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997
  return COLOR_SWATCHES[h % COLOR_SWATCHES.length]
}

export function allCategories(custom: FinanceCategoryDef[], kind: TransactionType): CategoryView[] {
  const defaults = (kind === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES).map(
    (c): CategoryView => ({ name: c.name, kind, icon: c.icon, color: c.color, custom: false }),
  )
  const mine = custom
    .filter((c) => c.kind === kind)
    .map((c): CategoryView => ({ name: c.name, kind, icon: c.icon, color: c.color, custom: true, id: c.id }))
  // Las propias van primero para tenerlas a mano
  return [...mine, ...defaults]
}

/** Resuelve cómo se ve una categoría guardada como texto libre (ícono y color incluidos). */
export function resolveCategory(name: string, kind: TransactionType, custom: FinanceCategoryDef[] = []): CategoryView {
  const raw = name.trim()
  const key = normalizeCategoryName(raw)
  const pool = allCategories(custom, kind)
  const exact = pool.find((c) => normalizeCategoryName(c.name) === key)
  if (exact) return exact
  const aliasTarget = ALIASES[`${kind}:${key}`]
  if (aliasTarget) {
    const target = pool.find((c) => c.name === aliasTarget)
    if (target) return target
  }
  return { name: raw || (kind === 'expense' ? 'Sin categoría' : 'Sin categoría'), kind, icon: 'tag', color: raw ? hashColor(raw) : '#94a3b8', custom: false }
}

// ---------------------------------------------------------------------------
// Categorización automática por descripción (para importaciones)
// ---------------------------------------------------------------------------
const KEYWORD_RULES: { category: string; kind: TransactionType; words: string[] }[] = [
  { category: 'Supermercado', kind: 'expense', words: ['coto', 'carrefour', 'jumbo', 'disco', 'walmart', 'chango mas', 'changomas', 'la anonima', 'dia argentina', 'dia %', 'vea ', 'supermercado', 'hipermercado', 'makro', 'maxiconsumo', 'diarco', 'super '] },
  { category: 'Comida', kind: 'expense', words: ['mcdonald', 'burger', 'starbucks', 'rappi', 'pedidosya', 'pedidos ya', 'restaurant', 'resto', 'cafe', 'cafeteria', 'pizzeria', 'parrilla', 'heladeria', 'panaderia', 'kiosco', 'havanna', 'mostaza', 'subway', 'bar ', 'delivery'] },
  { category: 'Combustible', kind: 'expense', words: ['ypf', 'shell', 'axion', 'puma energy', 'combustible', 'nafta', 'estacion de servicio'] },
  { category: 'Transporte', kind: 'expense', words: ['uber', 'cabify', 'didi', 'sube', 'peaje', 'autopista', 'telepase', 'estacionamiento', 'taxi', 'colectivo', 'trenes argentinos', 'aerolineas', 'flybondi', 'despegar'] },
  { category: 'Suscripciones', kind: 'expense', words: ['netflix', 'spotify', 'disney', 'hbo', 'max.com', 'youtube', 'prime video', 'amazon prime', 'apple.com', 'google *', 'google play', 'icloud', 'microsoft', 'adobe', 'chatgpt', 'openai', 'paramount', 'star+', 'twitch', 'steam', 'playstation', 'xbox'] },
  { category: 'Facturas y servicios', kind: 'expense', words: ['edenor', 'edesur', 'metrogas', 'aysa', 'telecentro', 'fibertel', 'cablevision', 'telecom', 'movistar', 'claro', 'personal ', 'flow', 'directv', 'iplan', 'gas natural', 'camuzzi', 'epec', 'litoral gas', 'absa', 'seguro', 'prepaga', 'osde', 'swiss medical', 'galeno', 'medicus', 'expensas'] },
  { category: 'Salud', kind: 'expense', words: ['farmacity', 'farmacia', 'farmaplus', 'dr ', 'clinica', 'sanatorio', 'laboratorio', 'optica', 'odontolog', 'medic', 'hospital', 'kinesio'] },
  { category: 'Compras', kind: 'expense', words: ['mercadolibre', 'mercado libre', 'mercadopago', 'amazon', 'aliexpress', 'temu', 'shein', 'tienda', 'shopping', 'musimundo', 'fravega', 'garbarino', 'compumundo', 'easy', 'sodimac', 'falabella'] },
  { category: 'Ropa', kind: 'expense', words: ['zara', 'h&m', 'adidas', 'nike', 'rapsodia', 'mimo', 'kosiuko', 'levis', 'cuesta blanca', 'indumentaria'] },
  { category: 'Entretenimiento', kind: 'expense', words: ['cine', 'cinemark', 'hoyts', 'showcase', 'teatro', 'ticketek', 'allaccess', 'entradas', 'bowling', 'club'] },
  { category: 'Educación', kind: 'expense', words: ['colegio', 'universidad', 'instituto', 'curso', 'udemy', 'coursera', 'escuela', 'cuota escolar', 'libreria'] },
  { category: 'Deporte', kind: 'expense', words: ['gimnasio', 'gym', 'megatlon', 'sportclub', 'crossfit', 'decathlon'] },
  { category: 'Impuestos y cargos', kind: 'expense', words: ['impuesto', 'iva ', 'sellos', 'comision', 'mantenimiento de cuenta', 'intereses', 'percepcion', 'afip', 'arba', 'agip', 'monotributo', 'iibb', 'cargo', 'retencion'] },
  { category: 'Mascotas', kind: 'expense', words: ['veterinaria', 'petshop', 'pet shop', 'mascota'] },
  { category: 'Viajes', kind: 'expense', words: ['booking', 'airbnb', 'hotel', 'hostel', 'despegar', 'turismo'] },
  { category: 'Sueldo', kind: 'income', words: ['sueldo', 'haberes', 'remuneracion', 'salario', 'nomina'] },
  { category: 'Honorarios', kind: 'income', words: ['honorarios', 'factura emitida', 'servicios prestados'] },
  { category: 'Inversiones', kind: 'income', words: ['rendimiento', 'dividendo', 'plazo fijo', 'cupon', 'interes ganado', 'intereses ganados', 'fci', 'rescate'] },
  { category: 'Reembolsos', kind: 'income', words: ['reintegro', 'devolucion', 'reembolso', 'cashback'] },
]

/** Sugiere una categoría para una descripción de movimiento. */
export function suggestCategory(description: string, kind: TransactionType): string {
  const text = ` ${normalizeCategoryName(description)} `
  for (const rule of KEYWORD_RULES) {
    if (rule.kind !== kind) continue
    if (rule.words.some((w) => text.includes(` ${w.trim().replace('%', '')}`) || text.includes(w.trim().replace('%', '')))) return rule.category
  }
  return kind === 'expense' ? 'Otros gastos' : 'Otros ingresos'
}
