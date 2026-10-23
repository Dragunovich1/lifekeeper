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

export interface Medication {
  id: string
  name: string
  dosage: string
  frequency: string
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

export interface FinanceTransaction {
  id: string
  type: TransactionType
  amount: number
  category: string
  date: string
  description?: string
  recurring?: boolean
  recurrence?: 'weekly' | 'monthly' | 'yearly'
}

export interface ProjectTask {
  id: string
  description: string
  completed: boolean
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

export interface UserProfile {
  fullName: string
  nickName?: string
  bio?: string
  birthDate?: string
  country?: string
  avatar?: string
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

export interface HealthData {
  vaccines: VaccineRecord[]
  consultations: MedicalConsultation[]
  medications: Medication[]
  clinicalNotes: ClinicalNote[]
  emergencyProfile: EmergencyProfile
  hydrationLogs?: HydrationLogEntry[]
  hydrationTargetMl?: number
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
  | 'funcional'
  | 'ciclismo'
  | 'natacion'
  | 'flexibilidad'
  | 'otro'

export interface WorkoutExerciseSet {
  reps: number
  weight?: number
  rpe?: number
  done?: boolean
}

export interface WorkoutExercise {
  id: string
  name: string
  sets: WorkoutExerciseSet[]
  notes?: string
}

export interface WorkoutSession {
  id: string
  date: string
  title: string
  type: WorkoutType
  durationMinutes?: number
  distanceKm?: number
  calories?: number
  exercises: WorkoutExercise[]
  notes?: string
}

export interface PersonalData {
  finances: FinanceTransaction[]
  budgets?: Record<string, number>
  projects: Project[]
  vehicles: VehicleService[]
  workouts?: WorkoutSession[]
}

export interface UtilitiesData {
  reminders: Reminder[]
  calendarPreferences: CalendarPreferences
  backups: BackupMeta
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
