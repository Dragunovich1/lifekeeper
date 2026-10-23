export const THEME_PRESETS = [
  {
    id: 'medianoche',
    label: 'Medianoche',
    description: 'Azul y cian clásico',
    colors: ['#5b8cff', '#2ee6c0', '#b388ff'],
  },
  {
    id: 'oceano',
    label: 'Océano',
    description: 'Azules profundos',
    colors: ['#38bdf8', '#22d3ee', '#818cf8'],
  },
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Verdes y turquesa',
    colors: ['#34d399', '#2ee6c0', '#a3e635'],
  },
  {
    id: 'violeta',
    label: 'Violeta',
    description: 'Malva y cian',
    colors: ['#8b5cf6', '#22d3ee', '#c084fc'],
  },
  {
    id: 'coral',
    label: 'Coral',
    description: 'Coral y ámbar',
    colors: ['#fb7185', '#fb923c', '#f472b6'],
  },
  {
    id: 'hielo',
    label: 'Hielo',
    description: 'Celeste y lavanda',
    colors: ['#7dd3fc', '#bae6fd', '#c4b5fd'],
  },
  {
    id: 'menta',
    label: 'Menta',
    description: 'Verde fresco',
    colors: ['#2dd4bf', '#6ee7b7', '#5eead4'],
  },
  {
    id: 'ambar',
    label: 'Ámbar',
    description: 'Dorado y naranja',
    colors: ['#f59e0b', '#fbbf24', '#fb923c'],
  },
] as const

export type ThemePreset = (typeof THEME_PRESETS)[number]
