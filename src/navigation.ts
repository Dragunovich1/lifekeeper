export interface NavSubSection {
  key: string
  label: string
}

export interface NavSection {
  key: string
  label: string
  icon: string
  subSections: NavSubSection[]
}

export const navigation: NavSection[] = [
  {
    key: 'profile',
    label: 'Perfil',
    icon: 'User',
    subSections: [{ key: 'settings', label: 'Datos de usuario' }],
  },
  {
    key: 'health',
    label: 'Salud',
    icon: 'Heart',
    subSections: [
      { key: 'vaccines', label: 'Vacunas' },
      { key: 'consultations', label: 'Consultas' },
      { key: 'medications', label: 'Medicación' },
      { key: 'hydration', label: 'Hidratación' },
      { key: 'history', label: 'Historial clínico' },
      { key: 'emergency', label: 'Emergencia' },
    ],
  },
  {
    key: 'diary',
    label: 'Diario personal',
    icon: 'Book',
    subSections: [
      { key: 'notes', label: 'Notas diarias' },
      { key: 'mood', label: 'Estado de ánimo' },
      { key: 'search', label: 'Búsqueda y exportación' },
    ],
  },
  {
    key: 'security',
    label: 'Seguridad',
    icon: 'Shield',
    subSections: [
      { key: 'passwords', label: 'Gestor de contraseñas' },
      { key: 'documents', label: 'Documentos sensibles' },
      { key: 'private-notes', label: 'Notas privadas' },
    ],
  },
  {
    key: 'personal',
    label: 'Vida personal',
    icon: 'Home',
    subSections: [
      { key: 'finances', label: 'Finanzas' },
      { key: 'projects', label: 'Proyectos e ideas' },
      { key: 'vehicles', label: 'Vehículos' },
      { key: 'workouts', label: 'Entrenamientos' },
    ],
  },
  {
    key: 'utilities',
    label: 'Utilidades',
    icon: 'Wrench',
    subSections: [
      { key: 'reminders', label: 'Recordatorios' },
      { key: 'calendar', label: 'Calendario' },
      { key: 'backups', label: 'Respaldos y exportación' },
    ],
  },
]