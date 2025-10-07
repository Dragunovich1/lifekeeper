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
      { key: 'medications', label: 'Medicaciones' },
      { key: 'history', label: 'Historial clinico' },
      { key: 'emergency', label: 'Emergencia' },
    ],
  },
  {
    key: 'diary',
    label: 'Diario personal',
    icon: 'Book',
    subSections: [
      { key: 'notes', label: 'Notas diarias' },
      { key: 'mood', label: 'Estado de animo' },
      { key: 'search', label: 'Busqueda y exportacion' },
    ],
  },
  {
    key: 'security',
    label: 'Seguridad',
    icon: 'Shield',
    subSections: [
      { key: 'passwords', label: 'Gestor de contrasenas' },
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
      { key: 'vehicles', label: 'Vehiculos' },
    ],
  },
  {
    key: 'utilities',
    label: 'Utilidades',
    icon: 'Wrench',
    subSections: [
      { key: 'reminders', label: 'Recordatorios' },
      { key: 'calendar', label: 'Calendario' },
      { key: 'backups', label: 'Respaldos y exportacion' },
    ],
  },
]