import type { ComponentType } from 'react'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import './styles/app.css'
import './styles/themes.css'
import { AuthGate } from './components/AuthGate'
import { BackgroundFX } from './components/BackgroundFX'
import { Header } from './components/Header'
import { PrivacyCurtain } from './components/PrivacyCurtain'
import { wipeSensitiveSessionData } from './services/crypto/memorySanitizer'
import { useAppData } from './hooks/useAppData'
import { Loading } from './components/Loading'
import { Footer } from './components/Footer'
import { navigation } from './navigation'
import { PageScrollbar } from './scrollbar/PageScrollbar'
import { useScrollActivity } from './scrollbar/useScrollActivity'
import { usePreferences } from './preferences/context'
import { PreferencesProvider } from './preferences/PreferencesProvider'

type MainSectionKey = (typeof navigation)[number]['key']
type SubSectionKey = (typeof navigation)[number]['subSections'][number]['key']

// Lazy load sections for better performance
const LazyProfileSettings = lazy(() => import('./sections/profile/index').then(m => ({ default: m.ProfileSection })))
const LazyHealthVaccines = lazy(() => import('./sections/health/index').then(m => ({ default: m.VaccinesSection })))
const LazyHealthConsultations = lazy(() => import('./sections/health/index').then(m => ({ default: m.ConsultationsSection })))
const LazyHealthMedications = lazy(() => import('./sections/health/index').then(m => ({ default: m.MedicationsSection })))
const LazyHealthHydration = lazy(() => import('./sections/health/index').then(m => ({ default: m.HydrationSection })))
const LazyHealthHistory = lazy(() => import('./sections/health/index').then(m => ({ default: m.ClinicalHistorySection })))
const LazyHealthEmergency = lazy(() => import('./sections/health/index').then(m => ({ default: m.EmergencySection })))
const LazyDiaryNotes = lazy(() => import('./sections/diary/index').then(m => ({ default: m.DiaryNotesSection })))
const LazyDiaryMood = lazy(() => import('./sections/diary/index').then(m => ({ default: m.MoodTrackerSection })))
const LazyDiarySearch = lazy(() => import('./sections/diary/index').then(m => ({ default: m.DiarySearchExportSection })))
const LazySecurityPasswords = lazy(() => import('./sections/security/index').then(m => ({ default: m.PasswordManagerSection })))
const LazySecurityDocuments = lazy(() => import('./sections/security/index').then(m => ({ default: m.SensitiveDocumentsSection })))
const LazySecurityPrivateNotes = lazy(() => import('./sections/security/index').then(m => ({ default: m.PrivateNotesSection })))
const LazyPersonalFinances = lazy(() => import('./sections/personal/index').then(m => ({ default: m.FinancesSection })))
const LazyPersonalProjects = lazy(() => import('./sections/personal/index').then(m => ({ default: m.ProjectsSection })))
const LazyPersonalVehicles = lazy(() => import('./sections/personal/index').then(m => ({ default: m.VehiclesSection })))
const LazyPersonalWorkouts = lazy(() => import('./sections/personal/index').then(m => ({ default: m.WorkoutsSection })))
const LazyUtilitiesReminders = lazy(() => import('./sections/utilities/index').then(m => ({ default: m.RemindersSection })))
const LazyUtilitiesCalendar = lazy(() => import('./sections/utilities/index').then(m => ({ default: m.CalendarSection })))
const LazyUtilitiesBackups = lazy(() => import('./sections/utilities/index').then(m => ({ default: m.BackupsSection })))

const sectionComponents = {
  'profile:settings': LazyProfileSettings,
  'health:vaccines': LazyHealthVaccines,
  'health:consultations': LazyHealthConsultations,
  'health:medications': LazyHealthMedications,
  'health:hydration': LazyHealthHydration,
  'health:history': LazyHealthHistory,
  'health:emergency': LazyHealthEmergency,
  'diary:notes': LazyDiaryNotes,
  'diary:mood': LazyDiaryMood,
  'diary:search': LazyDiarySearch,
  'security:passwords': LazySecurityPasswords,
  'security:documents': LazySecurityDocuments,
  'security:private-notes': LazySecurityPrivateNotes,
  'personal:finances': LazyPersonalFinances,
  'personal:projects': LazyPersonalProjects,
  'personal:vehicles': LazyPersonalVehicles,
  'personal:workouts': LazyPersonalWorkouts,
  'utilities:reminders': LazyUtilitiesReminders,
  'utilities:calendar': LazyUtilitiesCalendar,
  'utilities:backups': LazyUtilitiesBackups,
} satisfies Record<string, ComponentType>

type SectionComponentKey = keyof typeof sectionComponents

import { DashboardSection } from './sections'

const DefaultSection = () => <DashboardSection />

const VaultApp = () => {
  const { data, lock } = useAppData()
  const { preferences } = usePreferences()
  const [activeSection, setActiveSection] = useState<MainSectionKey | null>(null)
  const [activeSubSection, setActiveSubSection] = useState<SubSectionKey>('settings')
  const initialStartSection = useRef(preferences.startSection)

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

  // Retomar en la última sección visitada (si está configurado)
  useEffect(() => {
    if (window.location.hash || initialStartSection.current !== 'last') {
      return
    }
    const stored = localStorage.getItem('lifekeeper:last-route')
    if (stored) {
      window.location.hash = stored
    }
  }, [])

  useEffect(() => {
    const route = activeSection ? `#${activeSection}:${activeSubSection}` : ''
    localStorage.setItem('lifekeeper:last-route', route)
  }, [activeSection, activeSubSection])

  const handleLock = () => {
    wipeSensitiveSessionData()
    lock()
  }

  // Auto-bloqueo por inactividad
  useEffect(() => {
    const minutes = preferences.autoLockMinutes
    if (!minutes) {
      return
    }
    let timer: number | undefined
    const reset = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => handleLock(), minutes * 60_000)
    }
    const activityEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
    activityEvents.forEach((eventName) => window.addEventListener(eventName, reset, { passive: true }))
    reset()
    return () => {
      if (timer) window.clearTimeout(timer)
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, reset))
    }
  }, [preferences.autoLockMinutes, lock])

  const componentKey = activeSection ? `${activeSection}:${activeSubSection}` as SectionComponentKey : null
  const Component = useMemo(() => (componentKey ? sectionComponents[componentKey] : null) ?? DefaultSection, [componentKey])

  const userName =
    data.profile.fullName || data.profile.nickName || data.health.emergencyProfile.fullName || 'Sin nombre'

  return (
    <div className="app-shell">
      <PrivacyCurtain enabled={preferences.privacyCurtain} />
      <Header
        sections={navigation}
        activeSection={activeSection}
        activeSubSection={activeSubSection}
        onHome={() => navigateTo(null)}
        onNavigate={(section, subSection) =>
          navigateTo(section as MainSectionKey, subSection as SubSectionKey)
        }
        onLock={handleLock}
        userName={userName}
        userEmail={data.profile.auth.email}
        avatarSrc={data.profile.avatar}
      />
      <div className="app-main">
        <main className="app-content">
          <div className="page-container">
            <Suspense fallback={<Loading message="Cargando sección..." />}>
              <Component />
            </Suspense>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}

function App() {
  useScrollActivity()

  return (
    <PreferencesProvider>
      <BackgroundFX />
      <PageScrollbar />
      <AuthGate>
        <VaultApp />
      </AuthGate>
    </PreferencesProvider>
  )
}

export default App
