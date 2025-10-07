import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import './App.css'
import { AuthGate } from './components/AuthGate'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { useAppData } from './hooks/useAppData'
import { navigation } from './navigation'
import {
  BackupsSection,
  CalendarSection,
  ClinicalHistorySection,
  ConsultationsSection,
  DiaryNotesSection,
  DiarySearchExportSection,
  EmergencySection,
  FinancesSection,
  MedicationsSection,
  MoodTrackerSection,
  PasswordManagerSection,
  PrivateNotesSection,
  ProfileSection,
  ProjectsSection,
  RemindersSection,
  SensitiveDocumentsSection,
  VaccinesSection,
  VehiclesSection,
} from './sections'

type MainSectionKey = (typeof navigation)[number]['key']
type SubSectionKey = (typeof navigation)[number]['subSections'][number]['key']

const sectionComponents = {
  'profile:settings': ProfileSection,
  'health:vaccines': VaccinesSection,
  'health:consultations': ConsultationsSection,
  'health:medications': MedicationsSection,
  'health:history': ClinicalHistorySection,
  'health:emergency': EmergencySection,
  'diary:notes': DiaryNotesSection,
  'diary:mood': MoodTrackerSection,
  'diary:search': DiarySearchExportSection,
  'security:passwords': PasswordManagerSection,
  'security:documents': SensitiveDocumentsSection,
  'security:private-notes': PrivateNotesSection,
  'personal:finances': FinancesSection,
  'personal:projects': ProjectsSection,
  'personal:vehicles': VehiclesSection,
  'utilities:reminders': RemindersSection,
  'utilities:calendar': CalendarSection,
  'utilities:backups': BackupsSection,
} satisfies Record<string, () => ReactElement>

type SectionComponentKey = keyof typeof sectionComponents

const DefaultSection = () => <div className="section-placeholder">Selecciona una seccion</div>

const VaultApp = () => {
  const { data, lock } = useAppData()
  const [activeSection, setActiveSection] = useState<MainSectionKey | null>('profile')
  const [activeSubSection, setActiveSubSection] = useState<SubSectionKey>('settings')
  const [isSidebarVisible, setIsSidebarVisible] = useState(false)

  const componentKey = activeSection ? `${activeSection}:${activeSubSection}` as SectionComponentKey : null
  const Component = useMemo(() => (componentKey ? sectionComponents[componentKey] : null) ?? DefaultSection, [componentKey])

  const userName =
    data.profile.fullName || data.profile.nickName || data.health.emergencyProfile.fullName || 'Sin nombre'

  return (
    <div className="app-shell">
      <Sidebar
        sections={navigation}
        activeSection={activeSection}
        activeSubSection={activeSubSection}
        onSectionChange={(key) => {
          setActiveSection(prev => prev === key ? null : key)
          const section = navigation.find((item) => item.key === key)
          if (section && section.subSections.length > 0) {
            setActiveSubSection(section.subSections[0].key as SubSectionKey)
          }
        }}
        onSubSectionChange={(_, subKey) => {
          setActiveSubSection(subKey)
          setIsSidebarVisible(false)
        }}
        visible={isSidebarVisible}
      />
      <div className="app-main">
        <TopBar
          onToggleSidebar={() => setIsSidebarVisible((prev) => !prev)}
          onLock={lock}
          userName={userName}
          avatarSrc={data.profile.avatar}
        />
        <main className="app-content">
          <Component />
        </main>
      </div>
      <div
        className={isSidebarVisible ? 'sidebar-overlay show' : 'sidebar-overlay'}
        onClick={() => setIsSidebarVisible(false)}
      />
    </div>
  )
}

function App() {
  return (
    <AuthGate>
      <VaultApp />
    </AuthGate>
  )
}

export default App
