import type { ShoppingList } from '../types'

export const SHOPPING_CATEGORIES = [
  'Frutas y verduras',
  'Carnes y pescados',
  'Lácteos y fiambres',
  'Panadería',
  'Almacén',
  'Bebidas',
  'Limpieza',
  'Higiene personal',
  'Mascotas',
  'Otros',
] as const

export const SHOPPING_UNITS = ['u', 'kg', 'g', 'l', 'ml', 'paq'] as const

const CATEGORY_WORDS: Record<(typeof SHOPPING_CATEGORIES)[number], string[]> = {
  'Frutas y verduras': ['manzana', 'banana', 'tomate', 'papa', 'cebolla', 'lechuga', 'zanahoria', 'limon', 'naranja', 'verdura', 'fruta', 'palta', 'zapallo', 'morron', 'ajo', 'pera', 'uva', 'frutilla', 'mandarina', 'espinaca', 'acelga', 'batata', 'choclo', 'pepino', 'brocoli', 'calabaza', 'durazno', 'sandia', 'melon', 'perejil', 'rucula'],
  'Carnes y pescados': ['carne', 'pollo', 'milanesa', 'asado', 'bife', 'pescado', 'salchicha', 'chorizo', 'cerdo', 'hamburguesa', 'milas', 'nalga', 'vacio', 'lomo', 'merluza', 'atun', 'salmon', 'matambre', 'pechuga', 'pata muslo', 'carne picada', 'peceto'],
  'Lácteos y fiambres': ['leche', 'queso', 'yogur', 'yogurt', 'manteca', 'crema', 'huevo', 'jamon', 'fiambre', 'dulce de leche', 'muzzarella', 'mozzarella', 'ricota', 'salame', 'mortadela', 'panceta', 'queso crema'],
  'Panadería': ['pan', 'facturas', 'medialuna', 'tostada', 'galleta de agua', 'prepizza', 'tapas', 'bizcocho', 'budin', 'torta'],
  'Almacén': ['arroz', 'fideo', 'harina', 'aceite', 'azucar', 'sal', 'yerba', 'cafe', 'te', 'galletita', 'salsa', 'lenteja', 'conserva', 'mermelada', 'cereal', 'avena', 'polenta', 'vinagre', 'mayonesa', 'ketchup', 'mostaza', 'snack', 'chocolate', 'alfajor', 'caldo', 'sopa', 'atun en lata', 'garbanzo', 'pure de tomate', 'tomate triturado', 'edulcorante', 'miel', 'mani', 'papas fritas', 'cacao', 'gelatina', 'levadura'],
  'Bebidas': ['agua', 'gaseosa', 'cerveza', 'vino', 'jugo', 'soda', 'fernet', 'cola', 'sprite', 'energizante', 'aperitivo', 'gin', 'whisky', 'vodka', 'licor', 'tonica'],
  'Limpieza': ['lavandina', 'detergente', 'esponja', 'limpiador', 'bolsa', 'desinfectante', 'trapo', 'jabon en polvo', 'suavizante', 'lavaropas', 'rejilla', 'escoba', 'papel de cocina', 'servilleta', 'insecticida', 'limpia'],
  'Higiene personal': ['shampoo', 'jabon', 'pasta dental', 'dentifrico', 'desodorante', 'papel higienico', 'toalla', 'cepillo', 'algodon', 'acondicionador', 'crema de enjuague', 'afeitar', 'protector solar', 'toallitas', 'hilo dental', 'enjuague bucal', 'tampon', 'apositos'],
  Mascotas: ['alimento balanceado', 'perro', 'gato', 'arena', 'mascota', 'hueso', 'balanceado'],
  Otros: [],
}

export const normalizeProductKey = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const escapeRegex = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const CATEGORY_MATCHERS = SHOPPING_CATEGORIES.map((category) => ({
  category,
  // Palabra completa, con plural simple ("tomate" → "tomates", "limón" → "limones")
  patterns: CATEGORY_WORDS[category].map((w) => new RegExp(`(^|\\s)${escapeRegex(w.trim())}(s|es)?(\\s|$)`)),
}))

export function guessCategory(name: string): string {
  const key = normalizeProductKey(name)
  const match = CATEGORY_MATCHERS.find((m) => m.patterns.some((p) => p.test(key)))
  return match?.category ?? 'Otros'
}

export const lineTotal = (item: { price?: number; quantity: number }): number =>
  item.price ? item.price * item.quantity : 0

export const sumItems = (items: ShoppingList['items']): number => items.reduce((acc, i) => acc + lineTotal(i), 0)

/** Texto listo para pegar en WhatsApp. */
export function listToText(list: ShoppingList): string {
  const pending = list.items.filter((i) => !i.checked)
  const done = list.items.filter((i) => i.checked)
  const fmt = (i: ShoppingList['items'][number]) => `${i.quantity !== 1 || (i.unit && i.unit !== 'u') ? `${i.quantity}${i.unit && i.unit !== 'u' ? ` ${i.unit}` : ''} × ` : ''}${i.name}`
  const lines = [`🛒 *${list.name}*`, '', ...pending.map((i) => `⬜ ${fmt(i)}`)]
  if (done.length) lines.push('', ...done.map((i) => `✅ ${fmt(i)}`))
  return lines.join('\n')
}
