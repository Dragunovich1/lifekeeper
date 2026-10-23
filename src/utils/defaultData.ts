import type { AppData, EmergencyProfile, UserProfile } from '../types'

const createEmptyEmergencyProfile = (): EmergencyProfile => ({
  fullName: '',
  bloodType: '',
  allergies: [],
  medications: [],
  conditions: [],
  emergencyContacts: [],
  notes: '',
})

const createEmptyUserProfile = (): UserProfile => ({
  fullName: '',
  nickName: '',
  bio: '',
  birthDate: undefined,
  country: '',
  avatar: undefined,
  auth: {
    username: '',
    email: '',
    phone: '',
    twoFactorEnabled: false,
    recoveryEmail: '',
    securityQuestion: '',
    securityAnswerHint: '',
  },
  updatedAt: undefined,
})

export const createEmptyAppData = (): AppData => ({
  profile: createEmptyUserProfile(),
  health: {
    vaccines: [],
    consultations: [],
    medications: [],
    clinicalNotes: [],
    emergencyProfile: createEmptyEmergencyProfile(),
    hydrationLogs: [],
    hydrationTargetMl: 2500,
  },
  diary: {
    entries: [],
  },
  security: {
    passwordEntries: [],
    documents: [],
    privateNotes: [],
  },
  personal: {
    finances: [],
    budgets: {},
    projects: [],
    vehicles: [],
    workouts: [],
  },
  utilities: {
    reminders: [],
    calendarPreferences: {
      monthsAhead: 2,
      includeCompleted: false,
    },
    backups: {},
  },
})

const cloneEmergencyProfile = (value?: EmergencyProfile): EmergencyProfile => ({
  ...createEmptyEmergencyProfile(),
  ...(value ?? {}),
  allergies: value?.allergies ? [...value.allergies] : [],
  medications: value?.medications ? [...value.medications] : [],
  conditions: value?.conditions ? [...value.conditions] : [],
  emergencyContacts: value?.emergencyContacts ? [...value.emergencyContacts] : [],
})

const cloneUserProfile = (value?: UserProfile): UserProfile => ({
  ...createEmptyUserProfile(),
  ...(value ?? {}),
  auth: {
    ...createEmptyUserProfile().auth,
    ...(value?.auth ?? {}),
  },
})

export const ensureAppDataShape = (data?: Partial<AppData>): AppData => {
  const defaults = createEmptyAppData()
  if (!data) {
    return defaults
  }

  return {
    ...defaults,
    ...data,
    profile: cloneUserProfile(data.profile),
    health: {
      ...defaults.health,
      ...(data.health ?? {}),
      vaccines: data.health?.vaccines ? [...data.health.vaccines] : [],
      consultations: data.health?.consultations ? [...data.health.consultations] : [],
      medications: data.health?.medications ? [...data.health.medications] : [],
      clinicalNotes: data.health?.clinicalNotes ? [...data.health.clinicalNotes] : [],
      emergencyProfile: cloneEmergencyProfile(data.health?.emergencyProfile),
      hydrationLogs: data.health?.hydrationLogs ? [...data.health.hydrationLogs] : [],
      hydrationTargetMl:
        typeof data.health?.hydrationTargetMl === 'number'
          ? data.health.hydrationTargetMl
          : defaults.health.hydrationTargetMl,
    },
    diary: {
      entries: data.diary?.entries ? [...data.diary.entries] : [],
    },
    security: {
      passwordEntries: data.security?.passwordEntries ? [...data.security.passwordEntries] : [],
      documents: data.security?.documents ? [...data.security.documents] : [],
      privateNotes: data.security?.privateNotes ? [...data.security.privateNotes] : [],
    },
    personal: {
      finances: data.personal?.finances ? [...data.personal.finances] : [],
      budgets: data.personal?.budgets ? { ...data.personal.budgets } : {},
      projects: data.personal?.projects ? [...data.personal.projects] : [],
      vehicles: data.personal?.vehicles ? [...data.personal.vehicles] : [],
      workouts: data.personal?.workouts ? [...data.personal.workouts] : [],
    },
    utilities: {
      reminders: data.utilities?.reminders ? [...data.utilities.reminders] : [],
      calendarPreferences: {
        ...defaults.utilities.calendarPreferences,
        ...(data.utilities?.calendarPreferences ?? {}),
      },
      backups: {
        ...defaults.utilities.backups,
        ...(data.utilities?.backups ?? {}),
      },
    },
  }
}
