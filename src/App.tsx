import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
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

import { DashboardSection } from './sections'

const DefaultSection = () => <DashboardSection />

const VaultApp = () => {
  const { data, lock } = useAppData()
  const [activeSection, setActiveSection] = useState<MainSectionKey | null>(null)
  const [activeSubSection, setActiveSubSection] = useState<SubSectionKey>('settings')
  const [isSidebarVisible, setIsSidebarVisible] = useState(false)

  const navigateTo = (section: MainSectionKey | null, sub?: SubSectionKey) => {
    setActiveSection(section)
    if (section && sub) {
      setActiveSubSection(sub)
      window.location.hash = `#${section}:${sub}`
    } else if (section) {
      const first = navigation.find(n => n.key === section)?.subSections[0].key as SubSectionKey
      setActiveSubSection(first)
      window.location.hash = `#${section}:${first}`
    } else {
      window.location.hash = ''
    }
  }

  // Deep-link via hash: #section:sub
  useEffect(() => {
    const syncFromHash = () => {
      const raw = window.location.hash.replace(/^#/, '')
      if (!raw) {
        setActiveSection(null)
        return
      }
      const [sec, sub] = raw.split(':') as [MainSectionKey, SubSectionKey]
      const valid = navigation.find(n => n.key === sec)
      if (valid) {
        setActiveSection(sec)
        const hasSub = valid.subSections.some(s => s.key === sub)
        setActiveSubSection(hasSub ? sub : valid.subSections[0].key as SubSectionKey)
      }
    }
    window.addEventListener('hashchange', syncFromHash)
    syncFromHash()
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

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
          const next = activeSection === key ? null : key
          if (next) {
            const first = navigation.find((item) => item.key === next)!.subSections[0].key as SubSectionKey
            navigateTo(next, first)
          } else {
            navigateTo(null)
          }
        }}
        onSubSectionChange={(sectionKey, subKey) => {
          navigateTo(sectionKey, subKey)
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
          <div className="container">
            {/* Default renders Dashboard */}
            <Component />
          </div>
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
