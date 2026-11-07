export type MoodLevel = 'Excelente' | 'Bien' | 'Neutral' | 'Regular' | 'Mal'

export interface Attachment {
  id: string
  fileName: string
  mimeType: string
  dataUrl: string
  uploadedAt: string
}

export interface VaccineRecord {
  id: string
  vaccine: string
  dose: string
  date: string
  location: string
  lot: string
  notes?: string
  nextDoseDate?: string
  reminderEnabled: boolean
}

export interface MedicalConsultation {
  id: string
  date: string
  doctor: string
  reason: string
  diagnosis?: string
  treatment?: string
  notes?: string
  nextVisitDate?: string
  attachments?: Attachment[]
}

export interface MedicationSchedule {
  time: string
  note?: string
}

/**
 * Qué días se toma una medicación. Si falta, se deduce del texto de `frequency`
 * ("una vez por semana", "cada 15 días", "lunes y jueves"…); sin pistas se asume diaria.
 */
export interface MedicationRecurrence {
  kind: 'daily' | 'weekly' | 'weekdays' | 'interval' | 'monthly' | 'asNeeded'
  /** weekly / weekdays: 0 = domingo … 6 = sábado. En 'weekly' vacío = el día de la semana del inicio. */
  weekdays?: number[]
  /** interval: cada cuántos días (a partir del inicio). */
  everyDays?: number
  /** monthly: cada cuántos meses (el mismo día del mes que el inicio). */
  everyMonths?: number
}

export interface Medication {
  id: string
  name: string
  dosage: string
  frequency: string
  recurrence?: MedicationRecurrence
  schedules: MedicationSchedule[]
  startDate: string
  endDate?: string
  instructions?: string
  active: boolean
  intakeLog?: string[]
}

export interface ClinicalNote {
  id: string
  title: string
  description: string
  date: string
  tags?: string[]
}

export interface EmergencyContact {
  id: string
  name: string
  relationship: string
  phone: string
}

export interface EmergencyProfile {
  firstName?: string
  lastName?: string
  fullName: string
  birthDate?: string
  bloodType: string
  allergies: string[]
  medications: string[]
  conditions: string[]
  emergencyContacts: EmergencyContact[]
  notes?: string
}

export interface DiaryEntry {
  id: string
  date: string
  title: string
  content: string
  mood: MoodLevel
  tags: string[]
}

export interface PasswordEntry {
  id: string
  service: string
  username: string
  password: string
  notes?: string
  tags?: string[]
  updatedAt: string
}

export interface SensitiveDocument {
  id: string
  name: string
  description?: string
  category?: string
  expiresAt?: string
  fileName: string
  mimeType: string
  dataUrl: string
  addedAt: string
}

export interface PrivateNote {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export type TransactionType = 'income' | 'expense'

export interface FinanceCategoryDef {
  id: string
  name: string
  kind: TransactionType
  /** Clave de ícono (ver `financeIcons`). */
  icon: string
  /** Color en hex. */
  color: string
}

export interface FinanceImportLog {
  id: string
  fileName: string
  at: string
  count: number
}

export interface FinanceTransaction {
  id: string
  type: TransactionType
  amount: number
  currency?: string // e.g. 'ARS', 'USD', 'EUR', 'USDT', etc.
  category: string
  date: string
  description?: string
  recurring?: boolean
  recurrence?: 'weekly' | 'monthly' | 'yearly'
  /** Si vino de una importación de archivo, id de esa importación (para poder deshacerla). */
  importId?: string
}

export type DebtDebtorType = 'entidad' | 'persona'
export type DebtDirection = 'por_pagar' | 'por_cobrar' // 'por_pagar' = pasivo (debo), 'por_cobrar' = activo (me deben)
export type DebtStatus = 'pendiente' | 'parcial' | 'cancelada'

export interface DebtPayment {
  id: string
  date: string
  amount: number
  notes?: string
}

export interface DebtEntry {
  id: string
  title: string
  counterparty: string // e.g. "Banco Galicia", "Tarjeta Visa", "Juan Pérez", "Tía Marta"
  debtorType: DebtDebtorType // 'entidad' | 'persona'
  direction: DebtDirection // 'por_pagar' | 'por_cobrar'
  totalAmount: number
  currency: string // 'ARS', 'USD', 'EUR', etc.
  installments?: number // cuotas totales si aplica
  paidInstallments?: number // cuotas pagadas
  dueDate?: string // YYYY-MM-DD
  status: DebtStatus
  payments: DebtPayment[]
  notes?: string
  createdAt: string
}

export type ProjectTaskStatus = 'todo' | 'in_progress' | 'done'

export interface ProjectTask {
  id: string
  description: string
  completed: boolean
  status?: ProjectTaskStatus
  priority?: 'alta' | 'media' | 'baja'
  dueDate?: string
}

export interface Project {
  id: string
  name: string
  description?: string
  dueDate?: string
  tasks: ProjectTask[]
  createdAt: string
}

export interface VehicleFuelLog {
  id: string
  date: string
  mileage: number
  liters: number
  cost: number
  fuelType?: 'nafta' | 'gasoil' | 'gnc' | 'electrico'
  notes?: string
}

export interface VehicleProfile {
  id: string
  name: string
  brand: string
  model: string
  year?: number
  licensePlate?: string
  vehicleType: 'auto' | 'moto' | 'camioneta' | 'otro'
  currentMileage?: number
  insuranceCompany?: string
  insurancePolicyNumber?: string
  insuranceExpiryDate?: string
  insurancePhoneEmergency?: string
  vtvExpiryDate?: string
  licenseExpiryDate?: string
  fuelLogs?: VehicleFuelLog[]
  notes?: string
}

export interface SavingsContribution {
  id: string
  date: string
  amount: number
  notes?: string
}

export interface SavingsGoal {
  id: string
  title: string
  targetAmount: number
  currentAmount: number
  currency: string
  targetDate?: string
  category?: string
  icon?: string
  contributions: SavingsContribution[]
  completed: boolean
  notes?: string
  createdAt: string
}

export interface VehicleService {
  id: string
  vehicleName: string
  serviceType: string
  date: string
  cost: number
  mileage?: number
  nextServiceDate?: string
  nextServiceMileage?: number
  notes?: string
}

export type ReminderSourceType =
  | 'vaccine'
  | 'medication'
  | 'consultation'
  | 'vehicle'
  | 'document'
  | 'project'

export interface Reminder {
  id: string
  title: string
  details?: string
  dateTime: string
  category: 'salud' | 'diario' | 'seguridad' | 'personal' | 'general'
  done: boolean
  snoozedUntil?: string
  sourceId?: string
  sourceType?: ReminderSourceType
}

export interface CalendarPreferences {
  monthsAhead: number
  includeCompleted: boolean
}

export interface BackupMeta {
  lastAutomaticBackup?: string
  lastManualBackup?: string
}

export interface UserAuthInfo {
  username: string
  email: string
  phone?: string
  twoFactorEnabled: boolean
  recoveryEmail?: string
  securityQuestion?: string
  securityAnswerHint?: string
}

export type Gender = 'Masculino' | 'Femenino'

export interface UserProfile {
  firstName?: string
  lastName?: string
  fullName: string
  nickName?: string
  bio?: string
  birthDate?: string
  country?: string
  /** Código ISO del país (AR, UY…), cuando se eligió de la lista. */
  countryCode?: string
  province?: string
  city?: string
  /** Coordenadas de la ciudad elegida (sirven, por ejemplo, para el clima de tu zona). */
  latitude?: number
  longitude?: number
  avatar?: string
  gender?: Gender
  heightCm?: number
  weightKg?: number
  auth: UserAuthInfo
  updatedAt?: string
}

export interface HydrationLogEntry {
  date: string
  amountMl: number
  targetMl?: number
}

export type MenstrualFlow = 'ligero' | 'moderado' | 'abundante' | 'manchado'

export interface MenstrualCycleEntry {
  id: string
  startDate: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  flow?: MenstrualFlow
  symptoms?: string[] // e.g. 'Cólicos', 'Dolor de cabeza', 'Cambios de humor', 'Hinchazón', 'Fatiga'
  notes?: string
}

export type ContraceptiveType =
  | 'pastilla'
  | 'parche'
  | 'anillo'
  | 'inyeccion'
  | 'diu_cobre'
  | 'diu_hormonal'
  | 'implante'
  | 'preservativo'
  | 'otro'

/** Método anticonceptivo en uso (o que se usó). */
export interface ContraceptiveMethod {
  id: string
  type: ContraceptiveType
  /** Nombre comercial o aclaración (ej. "Yasmin", "DIU Mirena"). */
  name?: string
  /** Inicio del método o del blíster/parche/anillo actual (YYYY-MM-DD). */
  startDate: string
  active: boolean
  /** Hora del recordatorio diario o del día de cambio (HH:mm). */
  reminderTime?: string
  /** Pastillas: cantidad de pastillas activas del blíster (21, 28, 24…). */
  packDays?: number
  /** Pastillas: días de pausa o placebo (0 si es continua). */
  pauseDays?: number
  /** Inyección: días entre dosis (28 = mensual, 84 = trimestral). */
  intervalDays?: number
  /** Inyección/parche/anillo: fecha de la última aplicación o cambio (YYYY-MM-DD). */
  lastDoseDate?: string
  /** DIU/implante: hasta cuándo es efectivo (YYYY-MM-DD). */
  validUntil?: string
  /** Pastillas: días en que se tomó (YYYY-MM-DD). */
  takenLog?: string[]
  notes?: string
}

export type IntimacyProtection = 'preservativo' | 'anticonceptivo' | 'ambos' | 'ninguna' | 'otra'

/** Registro privado de una relación sexual (para contexto del ciclo y avisos de salud). */
export interface IntimacyEntry {
  id: string
  date: string // YYYY-MM-DD
  protection: IntimacyProtection
  /** Se tomó anticoncepción de emergencia. */
  emergencyPill?: boolean
  notes?: string
}

export interface MenstrualCycleData {
  enabled: boolean
  averageCycleDays: number // e.g. 28
  averagePeriodDays: number // e.g. 5
  lastPeriodStart?: string
  entries: MenstrualCycleEntry[]
  contraceptives?: ContraceptiveMethod[]
  intimacy?: IntimacyEntry[]
}

export type MeasurementType = 'glucosa' | 'presion' | 'pulso' | 'saturacion' | 'temperatura' | 'colesterol'

export interface HealthMeasurement {
  id: string
  type: MeasurementType
  date: string // YYYY-MM-DD
  time: string // HH:mm
  /** Valor principal. En presión arterial es la sistólica. */
  value: number
  /** Presión arterial: diastólica. */
  value2?: number
  /** Presión arterial: pulso medido junto con la presión. */
  pulse?: number
  /** Cuándo se midió (en ayunas, 2 h después de comer, en reposo...). */
  context?: string
  /** Cómo se sentía la persona al medirse. */
  feeling?: MoodLevel
  symptoms?: string[]
  notes?: string
  createdAt: string
}

export interface HealthData {
  vaccines: VaccineRecord[]
  consultations: MedicalConsultation[]
  medications: Medication[]
  clinicalNotes: ClinicalNote[]
  emergencyProfile: EmergencyProfile
  hydrationLogs?: HydrationLogEntry[]
  hydrationTargetMl?: number
  menstrualCycle?: MenstrualCycleData
  measurements?: HealthMeasurement[]
}

export interface DiaryData {
  entries: DiaryEntry[]
}

export interface SecurityData {
  passwordEntries: PasswordEntry[]
  documents: SensitiveDocument[]
  privateNotes: PrivateNote[]
}

export type WorkoutType =
  | 'fuerza'
  | 'cardio'
  | 'running'
  | 'caminata'
  | 'ciclismo'
  | 'natacion'
  | 'trekking'
  | 'funcional'
  | 'flexibilidad'
  | 'otro'

export type WorkoutSetType = 'normal' | 'warmup' | 'dropset' | 'biserie' | 'failure'

/** Caída de un drop set: se baja el peso sin descansar y se sigue. */
export interface WorkoutDrop {
  reps: number
  weight?: number
}

export interface WorkoutExerciseSet {
  reps: number
  weight?: number
  /** Ejercicios medidos por tiempo (plancha, cinta): duración en segundos. */
  seconds?: number
  /** Serie de calentamiento: no cuenta como serie efectiva ni suma al volumen. */
  warmup?: boolean
  /** Serie llevada al fallo. */
  failure?: boolean
  /** Caídas del drop set (cada una con sus reps y peso). */
  drops?: WorkoutDrop[]
  rpe?: number
  done?: boolean
  setType?: WorkoutSetType
  notes?: string
}

export interface WorkoutExercise {
  id: string
  name: string
  sets: WorkoutExerciseSet[]
  notes?: string
  /** Músculos y equipo (del catálogo de ejercicios), solo informativo. */
  muscles?: string[]
  equipment?: string[]
  /**
   * Ítem combinado: los ejercicios con el mismo `groupId` (consecutivos) se hacen juntos, ronda por ronda
   * (biserie = 2, triserie = 3, circuito = 4 o más). Cada uno conserva sus propias series.
   */
  groupId?: string
  groupKind?: WorkoutGroupKind
  /** Descanso del ítem en segundos (en un grupo se guarda igual en todos sus ejercicios). */
  restSeconds?: number
  /** Cómo se mide el ejercicio: repeticiones (por defecto) o tiempo. */
  measure?: WorkoutMeasure
  /** Se hace de a un lado por vez (por pierna, por brazo). */
  perSide?: boolean
}

export type WorkoutMeasure = 'reps' | 'time'

export type WorkoutGroupKind = 'biserie' | 'triserie' | 'circuito'

export interface WorkoutSession {
  id: string
  date: string
  title: string
  type: WorkoutType
  durationMinutes?: number
  distanceKm?: number
  pace?: string // e.g. "5:30 min/km" o "24.5 km/h"
  elevationGainMeters?: number
  calories?: number
  exercises: WorkoutExercise[]
  notes?: string
  /** Si se hizo desde una rutina: cuál y qué día. */
  routineId?: string
  routineDayId?: string
}

/** Un día de una rutina (ej. "Día 2 · Tren superior") con sus ítems. */
export interface WorkoutRoutineDay {
  id: string
  name: string
  type?: WorkoutType
  notes?: string
  exercises: WorkoutExercise[]
}

/** Programa de entrenamiento con varios días (ej. "Rutina Septiembre"). */
export interface WorkoutRoutine {
  id: string
  name: string
  notes?: string
  days: WorkoutRoutineDay[]
  createdAt: string
  updatedAt: string
}

/** Sesión en vivo en curso: se guarda cifrada para no perderla si se cierra la app. */
export interface LiveWorkoutDraft {
  title: string
  type: WorkoutType
  notes: string
  exercises: WorkoutExercise[]
  startedAt: string
  /** Segundos acumulados antes de la última pausa. */
  accumulatedSeconds: number
  /** Si está corriendo: desde cuándo (ISO). null = en pausa. */
  runningSince: string | null
  routineId?: string
  routineDayId?: string
}

export interface WorkoutTemplate {
  id: string
  name: string
  type: WorkoutType
  exercises: WorkoutExercise[]
  notes?: string
}

export interface MealFoodItem {
  id: string
  name: string
  calories: number
  protein?: number // grams
  carbs?: number // grams
  fats?: number // grams
  portion?: string // e.g. "150g", "1 plato", "1 scoop"
}

export type MealType = 'desayuno' | 'almuerzo' | 'merienda' | 'cena' | 'snack' | 'suplemento'

export interface MealEntry {
  id: string
  type: MealType
  time?: string // HH:mm
  foods: MealFoodItem[]
  notes?: string
}

export interface DailyNutritionLog {
  id: string
  date: string // YYYY-MM-DD
  meals: MealEntry[]
  waterMl?: number
  targetCalories?: number
  notes?: string
}

export interface NutritionData {
  dailyLogs: DailyNutritionLog[]
  dailyGoals?: {
    calories: number
    proteinGrams: number
    carbsGrams: number
    fatsGrams: number
  }
}

export interface ShoppingItem {
  id: string
  name: string
  quantity: number
  unit?: string // 'kg', 'l', 'u', etc.
  /** Precio unitario estimado o pagado. */
  price?: number
  category: string
  checked: boolean
  addedAt: string
  checkedAt?: string
}

export interface ShoppingList {
  id: string
  name: string
  items: ShoppingItem[]
  budget?: number
  currency: string
  createdAt: string
}

export interface ShoppingPriceMemory {
  price: number
  date: string
}

export interface ShoppingData {
  lists: ShoppingList[]
  activeListId?: string
  /** Último precio conocido por producto (clave: nombre normalizado). */
  priceMemory: Record<string, ShoppingPriceMemory>
}

/* ---------- Mascotas ---------- */
export type PetSpecies = 'perro' | 'gato' | 'ave' | 'conejo' | 'roedor' | 'reptil' | 'pez' | 'caballo' | 'otro'
export type PetSex = 'macho' | 'hembra' | 'desconocido'

/** Registro de salud: vacunas, desparasitaciones, controles, cirugías, estudios… */
export type PetHealthKind = 'vacuna' | 'desparasitacion' | 'antipulgas' | 'control' | 'cirugia' | 'estudio' | 'tratamiento' | 'otro'

export interface PetHealthRecord {
  id: string
  kind: PetHealthKind
  name: string
  date: string
  /** Próxima dosis o control (dispara el aviso de vencimiento). */
  nextDate?: string
  vet?: string
  lot?: string
  cost?: number
  notes?: string
}

export interface PetWeightEntry {
  id: string
  date: string
  kg: number
  notes?: string
}

export interface PetMedication {
  id: string
  name: string
  dose?: string
  frequency?: string
  startDate: string
  endDate?: string
  notes?: string
}

export interface PetAppointment {
  id: string
  date: string
  time?: string
  reason: string
  vet?: string
  place?: string
  done?: boolean
  cost?: number
  notes?: string
}

export type PetExpenseCategory = 'alimento' | 'veterinario' | 'medicacion' | 'higiene' | 'accesorios' | 'seguro' | 'guarderia' | 'otro'

export interface PetExpense {
  id: string
  date: string
  category: PetExpenseCategory
  amount: number
  description?: string
}

export interface Pet {
  id: string
  name: string
  species: PetSpecies
  /** Si la especie es 'otro' o se quiere precisar (ej. "Cobayo"). */
  speciesDetail?: string
  breed?: string
  sex?: PetSex
  neutered?: boolean
  birthDate?: string
  adoptionDate?: string
  color?: string
  /** Foto de la mascota (JPEG reducido, data URL). */
  photo?: string
  microchip?: string
  registration?: string
  temperament?: string
  allergies?: string
  conditions?: string
  vet?: { name?: string; clinic?: string; phone?: string; address?: string }
  insurance?: { company?: string; policy?: string; phone?: string; validUntil?: string }
  diet?: { food?: string; brand?: string; portion?: string; mealsPerDay?: number; notes?: string }
  notes?: string
  /** Fecha en que falleció (la mascota queda como recuerdo, sin avisos). */
  deceasedDate?: string
  health: PetHealthRecord[]
  weights: PetWeightEntry[]
  medications: PetMedication[]
  appointments: PetAppointment[]
  expenses: PetExpense[]
  createdAt: string
  updatedAt: string
}

export interface PersonalData {
  pets?: Pet[]
  finances: FinanceTransaction[]
  budgets?: Record<string, number>
  /** Categorías propias (las predefinidas viven en el código). */
  financeCategories?: FinanceCategoryDef[]
  financeImports?: FinanceImportLog[]
  debts?: DebtEntry[]
  savingsGoals?: SavingsGoal[]
  projects: Project[]
  vehicles: VehicleService[]
  vehicleProfiles?: VehicleProfile[]
  workouts?: WorkoutSession[]
  workoutTemplates?: WorkoutTemplate[]
  workoutRoutines?: WorkoutRoutine[]
  /** Rutina activa: de ahí sale "el día que toca". */
  activeRoutineId?: string
  liveWorkout?: LiveWorkoutDraft | null
  nutrition?: NutritionData
  shopping?: ShoppingData
}

export interface AssistantMutationCard {
  category: 'agua' | 'finanzas' | 'deudas' | 'nutricion' | 'biometria' | 'entrenamiento' | 'diario' | 'recordatorio' | 'salud'
  title: string
  details: string
  badge?: string
  entityId?: string
}

export interface AssistantProposalCard {
  type: 'workout_template' | 'nutrition_plan'
  title: string
  summary: string
  payload: any
}

export interface AssistantChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
  action?: {
    label: string
    hash: string
  }
  mutationCard?: AssistantMutationCard
  proposalCard?: AssistantProposalCard
}

export interface AssistantChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: AssistantChatMessage[]
}

export type QuickNoteColor = 'amarillo' | 'verde' | 'azul' | 'rosa' | 'violeta' | 'gris'

export interface QuickNote {
  id: string
  text: string
  color: QuickNoteColor
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface CalculatorHistoryEntry {
  id: string
  expression: string
  result: string
  at: string
}

export interface UtilitiesData {
  reminders: Reminder[]
  calendarPreferences: CalendarPreferences
  backups: BackupMeta
  assistantChats?: AssistantChatSession[]
  quickNotes?: QuickNote[]
  calculatorHistory?: CalculatorHistoryEntry[]
  activeAssistantChatId?: string
}

export interface AppData {
  profile: UserProfile
  health: HealthData
  diary: DiaryData
  security: SecurityData
  personal: PersonalData
  utilities: UtilitiesData
}

export interface AppState {
  data: AppData
  masterPassword: string
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'pdf' | 'txt'
  sections: Array<keyof AppData>
}
