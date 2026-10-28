import type { ComponentType } from 'react'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import './styles/app.css'
import './styles/themes.css'
import './styles/mobile.css'
import { AuthGate } from './components/AuthGate'
import { BackgroundFX } from './components/BackgroundFX'
import { Header } from './components/Header'
import { PrivacyCurtain } from './components/PrivacyCurtain'
import { wipeSensitiveSessionData } from './services/crypto/memorySanitizer'
import { useAppData } from './hooks/useAppData'
import { Loading } from './components/Loading'
import { Footer } from './components/Footer'
import { FloatingAssistant } from './components/FloatingAssistant'
import { AssistantModal } from './components/AssistantModal'
import { navigation, getNavigation } from './navigation'
import { PageScrollbar } from './scrollbar/PageScrollbar'
import { useScrollActivity } from './scrollbar/useScrollActivity'
import { usePreferences } from './preferences/context'
import { PreferencesProvider } from './preferences/PreferencesProvider'
import { useMobileLayout } from './hooks/useMobileLayout'
import { useSwipeGesture } from './hooks/useSwipeGesture'
import { MobileTopBar } from './components/mobile/MobileTopBar'
import { MobileBottomNav } from './components/mobile/MobileBottomNav'
import { MobileMenuSheet } from './components/mobile/MobileMenuSheet'
import { configureNativeStatusBar } from './services/platform'
import { ShareModal } from './components/ShareModal'
import { SettingsModal } from './components/SettingsModal'
import { AppearanceModal } from './components/AppearanceModal'
import { AlertsPopover } from './components/AlertsPopover'
import { useInsights } from './hooks/useInsights'

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
const LazyHealthMenstrual = lazy(() => import('./sections/health/index').then(m => ({ default: m.MenstrualCycleSection })))
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
const LazyPersonalNutrition = lazy(() => import('./sections/personal/index').then(m => ({ default: m.NutritionSection })))
const LazyUtilitiesReminders = lazy(() => import('./sections/utilities/index').then(m => ({ default: m.RemindersSection })))
const LazyUtilitiesCalendar = lazy(() => import('./sections/utilities/index').then(m => ({ default: m.CalendarSection })))
const LazyUtilitiesShopping = lazy(() => import('./sections/utilities/index').then(m => ({ default: m.ShoppingListSection })))
const LazyUtilitiesQuickNotes = lazy(() => import('./sections/utilities/index').then(m => ({ default: m.QuickNotesSection })))
const LazyUtilitiesCalculator = lazy(() => import('./sections/utilities/index').then(m => ({ default: m.CalculatorSection })))
const LazyUtilitiesBackups = lazy(() => import('./sections/utilities/index').then(m => ({ default: m.BackupsSection })))

const sectionComponents = {
  'profile:settings': LazyProfileSettings,
  'health:vaccines': LazyHealthVaccines,
  'health:consultations': LazyHealthConsultations,
  'health:medications': LazyHealthMedications,
  'health:hydration': LazyHealthHydration,
  'health:history': LazyHealthHistory,
  'health:emergency': LazyHealthEmergency,
  'health:menstrual': LazyHealthMenstrual,
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
  'personal:nutrition': LazyPersonalNutrition,
  'utilities:reminders': LazyUtilitiesReminders,
  'utilities:calendar': LazyUtilitiesCalendar,
  'utilities:shopping': LazyUtilitiesShopping,
  'utilities:quick-notes': LazyUtilitiesQuickNotes,
  'utilities:calculator': LazyUtilitiesCalculator,
  'utilities:backups': LazyUtilitiesBackups,
} satisfies Record<string, ComponentType>

type SectionComponentKey = keyof typeof sectionComponents

import { DashboardSection } from './sections'

const DefaultSection = () => <DashboardSection />

const VaultApp = () => {
  const { data, lock } = useAppData()
  const { preferences } = usePreferences()
  const { isMobile } = useMobileLayout()
  const { insights, criticalCount, warningCount, infoCount } = useInsights()

  const navSections = useMemo(() => getNavigation(data?.profile), [data?.profile])

  const [activeSection, setActiveSection] = useState<MainSectionKey | null>(null)
  const [activeSubSection, setActiveSubSection] = useState<SubSectionKey>('settings')
  const initialStartSection = useRef(preferences.startSection)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [preferencesModal, setPreferencesModal] = useState<'settings' | 'appearance' | null>(null)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const alertsBtnRef = useRef<HTMLButtonElement | null>(null)
  const contentRef = useRef<HTMLElement | null>(null)

  // Configure Native Android Status Bar according to theme
  useEffect(() => {
    void configureNativeStatusBar(preferences.mode === 'dark')
  }, [preferences.mode])

  const navigateTo = (section: MainSectionKey | null, sub?: SubSectionKey) => {
    setActiveSection(section)
    if (section && sub) {
      setActiveSubSection(sub)
      window.location.hash = `#${section}:${sub}`
    } else if (section) {
      const first = navSections.find(n => n.key === section)?.subSections[0].key as SubSectionKey
      setActiveSubSection(first)
      window.location.hash = `#${section}:${first}`
    } else {
      window.location.hash = ''
    }
  }

  // Swipe navigation between sub-sections on mobile
  const handleSwipeLeft = () => {
    if (!activeSection) return
    const currentNav = navSections.find(n => n.key === activeSection)
    if (!currentNav || currentNav.subSections.length <= 1) return
    const currentIndex = currentNav.subSections.findIndex(s => s.key === activeSubSection)
    if (currentIndex >= 0 && currentIndex < currentNav.subSections.length - 1) {
      const nextSub = currentNav.subSections[currentIndex + 1].key as SubSectionKey
      navigateTo(activeSection, nextSub)
    }
  }

  const handleSwipeRight = () => {
    if (!activeSection) return
    const currentNav = navSections.find(n => n.key === activeSection)
    if (!currentNav || currentNav.subSections.length <= 1) return
    const currentIndex = currentNav.subSections.findIndex(s => s.key === activeSubSection)
    if (currentIndex > 0) {
      const prevSub = currentNav.subSections[currentIndex - 1].key as SubSectionKey
      navigateTo(activeSection, prevSub)
    } else if (currentIndex === 0) {
      navigateTo(null)
    }
  }

  useSwipeGesture(
    contentRef,
    {
      onSwipeLeft: handleSwipeLeft,
      onSwipeRight: handleSwipeRight,
    },
    { enabled: isMobile && Boolean(activeSection) },
  )

  // Deep-link via hash: #section:sub
  useEffect(() => {
    const syncFromHash = () => {
      const raw = window.location.hash.replace(/^#/, '')
      if (!raw) {
        setActiveSection(null)
        return
      }
      const [sec, sub] = raw.split(':') as [MainSectionKey, SubSectionKey]
      const valid = navSections.find(n => n.key === sec)
      if (valid) {
        setActiveSection(sec)
        const hasSub = valid.subSections.some(s => s.key === sub)
        setActiveSubSection(hasSub ? sub : valid.subSections[0].key as SubSectionKey)
      }
    }
    window.addEventListener('hashchange', syncFromHash)
    syncFromHash()
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [navSections])

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

  const [assistantOpen, setAssistantOpen] = useState(false)

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setAssistantOpen((prev) => !prev)
      }
    }
    const onAssistantOpen = () => {
      setAssistantOpen(true)
    }

    window.addEventListener('keydown', onGlobalKeyDown)
    window.addEventListener('lifekeeper:open-assistant', onAssistantOpen)
    return () => {
      window.removeEventListener('keydown', onGlobalKeyDown)
      window.removeEventListener('lifekeeper:open-assistant', onAssistantOpen)
    }
  }, [])

  const componentKey = activeSection ? `${activeSection}:${activeSubSection}` as SectionComponentKey : null
  const Component = useMemo(() => (componentKey ? sectionComponents[componentKey] : null) ?? DefaultSection, [componentKey])

  const userName =
    data.profile.fullName || data.profile.nickName || data.health.emergencyProfile.fullName || 'Sin nombre'

  // Mobile Smartphone Layout (APK or Touch/Small Screen)
  if (isMobile) {
    return (
      <div className="mobile-app-shell">
        <PrivacyCurtain enabled={preferences.privacyCurtain} />
        <MobileTopBar
          sections={navSections}
          activeSection={activeSection}
          activeSubSection={activeSubSection}
          onHome={() => navigateTo(null)}
          onNavigate={(section, subSection) =>
            navigateTo(section as MainSectionKey, subSection as SubSectionKey)
          }
          onOpenAlerts={() => setAlertsOpen(true)}
          onOpenProfile={() => navigateTo('profile', 'settings')}
          onOpenAssistant={() => setAssistantOpen(true)}
          criticalCount={criticalCount}
          warningCount={warningCount}
          userName={userName}
          avatarSrc={data.profile.avatar}
        />

        <main className="mobile-main-content" ref={contentRef}>
          <div className="page-container">
            <Suspense fallback={<Loading message="Cargando sección..." />}>
              <Component />
            </Suspense>
          </div>
        </main>

        <MobileBottomNav
          activeSection={activeSection}
          onHome={() => navigateTo(null)}
          onNavigate={(section) => navigateTo(section as MainSectionKey)}
          onOpenMenu={() => setMobileMenuOpen(true)}
          isMenuOpen={mobileMenuOpen}
        />

        <MobileMenuSheet
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          onNavigate={(section, subSection) =>
            navigateTo(section as MainSectionKey, subSection as SubSectionKey)
          }
          onOpenSettings={() => setPreferencesModal('settings')}
          onOpenAppearance={() => setPreferencesModal('appearance')}
          onOpenShare={() => setShareOpen(true)}
          onOpenAssistant={() => setAssistantOpen(true)}
          onLock={handleLock}
        />

        <AlertsPopover
          open={alertsOpen}
          anchorRef={alertsBtnRef}
          insights={insights}
          criticalCount={criticalCount}
          warningCount={warningCount}
          infoCount={infoCount}
          onClose={() => setAlertsOpen(false)}
        />
        <SettingsModal
          open={preferencesModal === 'settings'}
          onClose={() => setPreferencesModal(null)}
          userName={userName}
          userEmail={data.profile.auth.email}
          avatarSrc={data.profile.avatar}
        />
        <AppearanceModal
          open={preferencesModal === 'appearance'}
          onClose={() => setPreferencesModal(null)}
        />
        <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />

        <AssistantModal open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      </div>
    )
  }

  // Desktop Web Layout (Unchanged)
  return (
    <div className="app-shell">
      <PrivacyCurtain enabled={preferences.privacyCurtain} />
      <Header
        sections={navSections}
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
      <FloatingAssistant onClick={() => setAssistantOpen(true)} />
      <AssistantModal open={assistantOpen} onClose={() => setAssistantOpen(false)} />
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
