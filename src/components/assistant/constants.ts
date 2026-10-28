import type { AssistantMessage } from '../../services/assistant/localAssistant'

export const INITIAL_WELCOME_TEXT =
  '¡Qué hacés, che! 👋 Soy tu **Asistente de LifeKeeper**. Contame las cosas como te salgan y yo las dejo guardadas en la sección que corresponda:\n\n' +
  '• *"tomé 3 vasos de agua"*\n' +
  '• *"hoy me siento medio bajón"*\n' +
  '• *"se me vence la VTV el 15 de noviembre"*\n' +
  '• *"gasté 20 lucas en el súper"*\n\n' +
  'O tocá una de las opciones de abajo.'

export const CREATE_INITIAL_MESSAGES = (): AssistantMessage[] => [
  {
    id: 'welcome',
    sender: 'assistant',
    text: INITIAL_WELCOME_TEXT,
    timestamp: 'Ahora',
  },
]

export interface QuickPrompt {
  label: string
  query: string
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  { label: '☀️ ¿Cómo viene mi día?', query: '¿Cómo viene mi día?' },
  { label: '🤝 ¿Quién me debe plata?', query: '¿Quién me debe plata?' },
  { label: '🏋️ Armame rutina hipertrofia', query: 'Armame una rutina de 4 días hipertrofia' },
  { label: '🥗 Armame una dieta 2200 kcal', query: 'Armame una dieta de 2200 calorias' },
  { label: '💧 Anotá 500ml de agua', query: 'Anotá que tomé 500ml de agua' },
  { label: '💳 Gasté $5000 en comida', query: 'Gasté $5000 en comida' },
  { label: '🌦️ ¿Va a llover hoy?', query: '¿Va a llover hoy?' },
  { label: '💊 Medicación de hoy', query: '¿Qué pastillas tomo hoy?' },
  { label: '⚖️ Anotá mi peso 75 kg', query: 'Anotá mi peso 75 kg' },
  { label: '📋 Resumen de mi bóveda', query: 'Haceme un resumen general de mi bóveda' },
]

export interface WelcomeCardData {
  icon: string
  title: string
  hint: string
  query: string
}

export const WELCOME_CARDS: WelcomeCardData[] = [
  { icon: '☀️', title: 'Mi día', hint: 'Clima, remedios y tareas', query: '¿Cómo viene mi día?' },
  { icon: '🤝', title: 'Deudas', hint: '¿Quién me debe plata?', query: '¿Quién me debe plata?' },
  { icon: '🏋️', title: 'Rutina', hint: 'Armame 4 días de hipertrofia', query: 'Armame una rutina de 4 días hipertrofia' },
  { icon: '🥗', title: 'Dieta', hint: 'Plan de 2200 kcal', query: 'Armame una dieta de 2200 calorias' },
  { icon: '💧', title: 'Agua', hint: 'Anotá 500 ml', query: 'Anotá que tomé 500ml de agua' },
  { icon: '💳', title: 'Gastos', hint: 'Anotá un gasto en comida', query: 'Gasté $5000 en comida' },
]
