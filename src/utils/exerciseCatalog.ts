/**
 * Catálogo base de ejercicios (siempre disponible, sin conexión) y traducción de los nombres
 * de músculos, equipo y categorías que devuelve wger (que vienen en inglés o en latín).
 */

export interface ExerciseSuggestion {
  name: string
  nameEn?: string
  category?: string
  muscles: string[]
  equipment: string[]
  source: 'wger' | 'local'
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

const MUSCLES: Record<string, string> = {
  'biceps brachii': 'Bíceps', biceps: 'Bíceps', 'triceps brachii': 'Tríceps', triceps: 'Tríceps',
  'anterior deltoid': 'Deltoides anterior', 'posterior deltoid': 'Deltoides posterior', deltoid: 'Hombros', shoulders: 'Hombros',
  'pectoralis major': 'Pectoral', chest: 'Pecho', 'latissimus dorsi': 'Dorsales', lats: 'Dorsales', back: 'Espalda',
  trapezius: 'Trapecio', traps: 'Trapecio', 'rectus abdominis': 'Abdominales', abs: 'Abdominales', 'obliquus externus abdominis': 'Oblicuos',
  'serratus anterior': 'Serrato', 'quadriceps femoris': 'Cuádriceps', quads: 'Cuádriceps', 'biceps femoris': 'Isquiotibiales',
  hamstrings: 'Isquiotibiales', 'gluteus maximus': 'Glúteos', glutes: 'Glúteos', gastrocnemius: 'Gemelos', calves: 'Gemelos',
  soleus: 'Sóleo', brachialis: 'Braquial', forearms: 'Antebrazos', legs: 'Piernas', arms: 'Brazos', 'lower back': 'Zona lumbar',
  'erector spinae': 'Zona lumbar', abductors: 'Abductores', adductors: 'Aductores',
}

const EQUIPMENT: Record<string, string> = {
  barbell: 'Barra', 'sz-bar': 'Barra Z', dumbbell: 'Mancuernas', 'gym mat': 'Colchoneta', 'swiss ball': 'Pelota suiza',
  'pull-up bar': 'Barra de dominadas', 'none (bodyweight exercise)': 'Peso corporal', bench: 'Banco', 'incline bench': 'Banco inclinado',
  kettlebell: 'Pesa rusa', machine: 'Máquina', cable: 'Polea', 'resistance band': 'Banda elástica', 'body weight': 'Peso corporal',
}

const CATEGORIES: Record<string, string> = {
  abs: 'Abdominales', arms: 'Brazos', back: 'Espalda', calves: 'Gemelos', cardio: 'Cardio', chest: 'Pecho', legs: 'Piernas', shoulders: 'Hombros',
}

export const translateMuscle = (n: string) => MUSCLES[fold(n)] ?? n
export const translateEquipment = (n: string) => EQUIPMENT[fold(n)] ?? n
export const translateCategory = (n: string) => CATEGORIES[fold(n)] ?? n

type Entry = [name: string, category: string, muscles: string, equipment: string]

const BASE: Entry[] = [
  ['Press de banca plano', 'Pecho', 'Pectoral, Tríceps, Deltoides anterior', 'Barra, Banco'],
  ['Press de banca inclinado', 'Pecho', 'Pectoral superior, Deltoides anterior', 'Barra, Banco inclinado'],
  ['Press con mancuernas', 'Pecho', 'Pectoral, Tríceps', 'Mancuernas, Banco'],
  ['Aperturas con mancuernas', 'Pecho', 'Pectoral', 'Mancuernas, Banco'],
  ['Flexiones de brazos', 'Pecho', 'Pectoral, Tríceps', 'Peso corporal'],
  ['Fondos en paralelas', 'Pecho', 'Pectoral, Tríceps', 'Peso corporal'],
  ['Cruces en polea', 'Pecho', 'Pectoral', 'Polea'],
  ['Dominadas', 'Espalda', 'Dorsales, Bíceps', 'Barra de dominadas'],
  ['Jalón al pecho', 'Espalda', 'Dorsales, Bíceps', 'Polea'],
  ['Remo con barra', 'Espalda', 'Dorsales, Trapecio, Bíceps', 'Barra'],
  ['Remo con mancuerna', 'Espalda', 'Dorsales, Bíceps', 'Mancuernas, Banco'],
  ['Remo en polea baja', 'Espalda', 'Dorsales, Trapecio', 'Polea'],
  ['Peso muerto', 'Espalda', 'Zona lumbar, Glúteos, Isquiotibiales', 'Barra'],
  ['Peso muerto rumano', 'Piernas', 'Isquiotibiales, Glúteos', 'Barra'],
  ['Hiperextensiones', 'Espalda', 'Zona lumbar, Glúteos', 'Banco'],
  ['Encogimientos de hombros', 'Hombros', 'Trapecio', 'Mancuernas'],
  ['Press militar', 'Hombros', 'Deltoides, Tríceps', 'Barra'],
  ['Press de hombros con mancuernas', 'Hombros', 'Deltoides, Tríceps', 'Mancuernas'],
  ['Elevaciones laterales', 'Hombros', 'Deltoides lateral', 'Mancuernas'],
  ['Elevaciones frontales', 'Hombros', 'Deltoides anterior', 'Mancuernas'],
  ['Pájaros (vuelos posteriores)', 'Hombros', 'Deltoides posterior', 'Mancuernas'],
  ['Face pull', 'Hombros', 'Deltoides posterior, Trapecio', 'Polea'],
  ['Curl de bíceps con barra', 'Brazos', 'Bíceps', 'Barra'],
  ['Curl de bíceps con mancuernas', 'Brazos', 'Bíceps', 'Mancuernas'],
  ['Curl martillo', 'Brazos', 'Bíceps, Braquial', 'Mancuernas'],
  ['Curl predicador', 'Brazos', 'Bíceps', 'Barra Z, Banco'],
  ['Extensión de tríceps en polea', 'Brazos', 'Tríceps', 'Polea'],
  ['Press francés', 'Brazos', 'Tríceps', 'Barra Z, Banco'],
  ['Patada de tríceps', 'Brazos', 'Tríceps', 'Mancuernas'],
  ['Sentadilla', 'Piernas', 'Cuádriceps, Glúteos', 'Barra'],
  ['Sentadilla frontal', 'Piernas', 'Cuádriceps, Abdominales', 'Barra'],
  ['Sentadilla búlgara', 'Piernas', 'Cuádriceps, Glúteos', 'Mancuernas, Banco'],
  ['Sentadilla goblet', 'Piernas', 'Cuádriceps, Glúteos', 'Pesa rusa'],
  ['Prensa de piernas', 'Piernas', 'Cuádriceps, Glúteos', 'Máquina'],
  ['Extensión de cuádriceps', 'Piernas', 'Cuádriceps', 'Máquina'],
  ['Curl femoral', 'Piernas', 'Isquiotibiales', 'Máquina'],
  ['Zancadas', 'Piernas', 'Cuádriceps, Glúteos', 'Mancuernas'],
  ['Hip thrust', 'Piernas', 'Glúteos', 'Barra, Banco'],
  ['Puente de glúteos', 'Piernas', 'Glúteos', 'Peso corporal'],
  ['Elevación de talones de pie', 'Piernas', 'Gemelos', 'Máquina'],
  ['Elevación de talones sentado', 'Piernas', 'Sóleo', 'Máquina'],
  ['Abducción de cadera en máquina', 'Piernas', 'Abductores, Glúteos', 'Máquina'],
  ['Plancha', 'Abdominales', 'Abdominales, Zona lumbar', 'Peso corporal'],
  ['Plancha lateral', 'Abdominales', 'Oblicuos', 'Peso corporal'],
  ['Crunch abdominal', 'Abdominales', 'Abdominales', 'Peso corporal'],
  ['Elevación de piernas colgado', 'Abdominales', 'Abdominales', 'Barra de dominadas'],
  ['Russian twist', 'Abdominales', 'Oblicuos', 'Peso corporal'],
  ['Rueda abdominal', 'Abdominales', 'Abdominales', 'Rueda'],
  ['Mountain climbers', 'Abdominales', 'Abdominales, Hombros', 'Peso corporal'],
  ['Burpees', 'Cardio', 'Cuerpo completo', 'Peso corporal'],
  ['Saltar la soga', 'Cardio', 'Gemelos, Hombros', 'Soga'],
  ['Jumping jacks', 'Cardio', 'Cuerpo completo', 'Peso corporal'],
  ['Remo en máquina (ergómetro)', 'Cardio', 'Espalda, Piernas', 'Máquina'],
  ['Bicicleta fija', 'Cardio', 'Cuádriceps, Gemelos', 'Máquina'],
  ['Cinta de correr', 'Cardio', 'Piernas', 'Máquina'],
  ['Swing con pesa rusa', 'Cardio', 'Glúteos, Isquiotibiales, Hombros', 'Pesa rusa'],
  ['Estiramiento de isquiotibiales', 'Flexibilidad', 'Isquiotibiales', 'Peso corporal'],
  ['Estiramiento de cuádriceps', 'Flexibilidad', 'Cuádriceps', 'Peso corporal'],
  ['Postura del niño (yoga)', 'Flexibilidad', 'Espalda, Glúteos', 'Colchoneta'],
]

export const LOCAL_EXERCISES: ExerciseSuggestion[] = BASE.map(([name, category, muscles, equipment]) => ({
  name,
  category,
  muscles: muscles.split(', '),
  equipment: equipment.split(', '),
  source: 'local' as const,
}))

/** Búsqueda en el catálogo base: sin tildes ni mayúsculas, primero los que empiezan igual. */
export function searchLocalExercises(query: string, limit = 8): ExerciseSuggestion[] {
  const q = fold(query)
  if (!q) return []
  const scored: { s: number; e: ExerciseSuggestion }[] = []
  for (const e of LOCAL_EXERCISES) {
    const n = fold(e.name)
    const s = n.startsWith(q) ? 0 : n.split(' ').some((w) => w.startsWith(q)) ? 1 : n.includes(q) || e.muscles.some((m) => fold(m).includes(q)) ? 2 : -1
    if (s >= 0) scored.push({ s, e })
  }
  return scored.sort((a, b) => a.s - b.s).slice(0, limit).map((x) => x.e)
}
