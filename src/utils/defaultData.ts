import type { AppData, EmergencyProfile, UserProfile } from '../types'

const createEmptyEmergencyProfile = (): EmergencyProfile => ({
  firstName: '',
  lastName: '',
  fullName: '',
  bloodType: '',
  allergies: [],
  medications: [],
  conditions: [],
  emergencyContacts: [],
  notes: '',
})

const createEmptyUserProfile = (): UserProfile => ({
  firstName: '',
  lastName: '',
  fullName: '',
  nickName: '',
  bio: '',
  birthDate: undefined,
  country: '',
  avatar: undefined,
  gender: 'Masculino',
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
    measurements: [],
    menstrualCycle: {
      enabled: false,
      averageCycleDays: 28,
      averagePeriodDays: 5,
      entries: [],
    },
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
    debts: [],
    savingsGoals: [],
    projects: [],
    vehicles: [],
    vehicleProfiles: [],
    workouts: [],
    workoutTemplates: [],
    nutrition: {
      dailyLogs: [],
      dailyGoals: {
        calories: 2000,
        proteinGrams: 140,
        carbsGrams: 220,
        fatsGrams: 60,
      },
    },
    shopping: {
      lists: [],
      activeListId: undefined,
      priceMemory: {},
    },
  },
  utilities: {
    reminders: [],
    calendarPreferences: {
      monthsAhead: 2,
      includeCompleted: false,
    },
    backups: {},
    assistantChats: [],
    activeAssistantChatId: undefined,
    quickNotes: [],
    calculatorHistory: [],
  },
})

const splitName = (fullName?: string, explicitFirst?: string, explicitLast?: string) => {
  let firstName = (explicitFirst ?? '').trim()
  let lastName = (explicitLast ?? '').trim()
  const rawFull = (fullName ?? '').trim()

  if ((!firstName || !lastName) && rawFull) {
    const parts = rawFull.split(/\s+/)
    if (!firstName) firstName = parts[0] || ''
    if (!lastName && parts.length > 1) lastName = parts.slice(1).join(' ')
  }

  const computedFullName = (firstName && lastName)
    ? `${firstName} ${lastName}`.trim()
    : (firstName || lastName || rawFull)

  return { firstName, lastName, fullName: computedFullName }
}

const cloneEmergencyProfile = (value?: EmergencyProfile): EmergencyProfile => {
  const { firstName, lastName, fullName } = splitName(value?.fullName, value?.firstName, value?.lastName)
  return {
    ...createEmptyEmergencyProfile(),
    ...(value ?? {}),
    firstName,
    lastName,
    fullName,
    allergies: value?.allergies ? [...value.allergies] : [],
    medications: value?.medications ? [...value.medications] : [],
    conditions: value?.conditions ? [...value.conditions] : [],
    emergencyContacts: value?.emergencyContacts ? [...value.emergencyContacts] : [],
  }
}

const cloneUserProfile = (value?: UserProfile): UserProfile => {
  const { firstName, lastName, fullName } = splitName(value?.fullName, value?.firstName, value?.lastName)
  return {
    ...createEmptyUserProfile(),
    ...(value ?? {}),
    firstName,
    lastName,
    fullName,
    auth: {
      ...createEmptyUserProfile().auth,
      ...(value?.auth ?? {}),
    },
  }
}

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
      measurements: Array.isArray(data.health?.measurements) ? [...data.health.measurements] : [],
      hydrationTargetMl:
        typeof data.health?.hydrationTargetMl === 'number'
          ? data.health.hydrationTargetMl
          : defaults.health.hydrationTargetMl,
      menstrualCycle: data.health?.menstrualCycle
        ? {
            enabled: Boolean(data.health.menstrualCycle.enabled),
            averageCycleDays: data.health.menstrualCycle.averageCycleDays || 28,
            averagePeriodDays: data.health.menstrualCycle.averagePeriodDays || 5,
            lastPeriodStart: data.health.menstrualCycle.lastPeriodStart,
            entries: Array.isArray(data.health.menstrualCycle.entries)
              ? [...data.health.menstrualCycle.entries]
              : [],
          }
        : defaults.health.menstrualCycle,
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
      debts: data.personal?.debts ? [...data.personal.debts] : [],
      savingsGoals: Array.isArray(data.personal?.savingsGoals) ? [...data.personal.savingsGoals] : [],
      projects: data.personal?.projects ? [...data.personal.projects] : [],
      vehicles: data.personal?.vehicles ? [...data.personal.vehicles] : [],
      vehicleProfiles: Array.isArray(data.personal?.vehicleProfiles) ? [...data.personal.vehicleProfiles] : [],
      workouts: data.personal?.workouts ? [...data.personal.workouts] : [],
      workoutTemplates: data.personal?.workoutTemplates ? [...data.personal.workoutTemplates] : [],
      nutrition: data.personal?.nutrition
        ? {
            dailyLogs: Array.isArray(data.personal.nutrition.dailyLogs)
              ? [...data.personal.nutrition.dailyLogs]
              : [],
            dailyGoals: data.personal.nutrition.dailyGoals || defaults.personal.nutrition?.dailyGoals,
          }
        : defaults.personal.nutrition,
      shopping: {
        lists: Array.isArray(data.personal?.shopping?.lists) ? [...data.personal.shopping.lists] : [],
        activeListId: data.personal?.shopping?.activeListId,
        priceMemory: { ...(data.personal?.shopping?.priceMemory ?? {}) },
      },
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
      assistantChats: Array.isArray(data.utilities?.assistantChats)
        ? [...data.utilities.assistantChats]
        : [],
      activeAssistantChatId: data.utilities?.activeAssistantChatId ?? undefined,
      quickNotes: Array.isArray(data.utilities?.quickNotes) ? [...data.utilities.quickNotes] : [],
      calculatorHistory: Array.isArray(data.utilities?.calculatorHistory)
        ? [...data.utilities.calculatorHistory]
        : [],
    },
  }
}
