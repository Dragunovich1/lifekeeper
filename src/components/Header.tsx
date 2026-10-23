import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  Palette,
  Settings,
  Sun,
  UserRound,
  X,
} from 'lucide-react'
import { useInsights } from '../hooks/useInsights'
import type { NavSection } from '../navigation'
import { usePreferences } from '../preferences/context'
import { ScrollbarOverlay } from '../scrollbar/ScrollbarOverlay'
import { AlertsPopover } from './AlertsPopover'
import { AppearanceModal } from './AppearanceModal'
import { SettingsModal } from './SettingsModal'

interface HeaderProps {
  sections: NavSection[]
  activeSection: string | null
  activeSubSection: string
  onHome: () => void
  onNavigate: (section: string, subSection: string) => void
  onLock: () => void
  userName?: string
  userEmail?: string
  avatarSrc?: string
}

type PreferencesModal = 'settings' | 'appearance' | null

const DROPDOWN_WIDTH = 240
const DROPDOWN_GAP = 8

const getInitials = (value?: string) => {
  if (!value) {
    return 'LK'
  }
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join('')
}

export const Header = ({
  sections,
  activeSection,
  activeSubSection,
  onHome,
  onNavigate,
  onLock,
  userName,
  userEmail,
  avatarSrc,
}: HeaderProps) => {
  const headerRef = useRef<HTMLElement | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const mobilePanelRef = useRef<HTMLDivElement | null>(null)
  const alertsBtnRef = useRef<HTMLButtonElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userMenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const [navScroll, setNavScroll] = useState({ left: false, right: false })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [preferencesModal, setPreferencesModal] = useState<PreferencesModal>(null)
  const { preferences, toggleMode } = usePreferences()
  const { insights, criticalCount, warningCount, infoCount } = useInsights()
  const alertBadgeTone =
    criticalCount > 0 ? 'is-critical' : warningCount > 0 ? 'is-warning' : 'is-info'
  const initials = getInitials(userName)
  const isLightMode = preferences.mode === 'light'
  const markSrc = isLightMode ? '/brand/isotipo-light.png?v=2' : '/brand/isotipo.png?v=2'
  const wordmarkSrc = isLightMode ? '/brand/wordmark-light.png?v=2' : '/brand/wordmark.png?v=2'
  const nextThemeLabel = preferences.mode === 'dark' ? 'claro' : 'oscuro'
  const profileSection = sections.find((section) => section.key === 'profile')
  const navSections = sections.filter((section) => section.key !== 'profile')
  const openNavSection = navSections.find((section) => section.key === openSection)

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const clearUserMenuTimer = () => {
    if (userMenuCloseTimer.current) {
      clearTimeout(userMenuCloseTimer.current)
      userMenuCloseTimer.current = null
    }
  }

  const openNav = (key: string) => {
    clearCloseTimer()
    clearUserMenuTimer()
    setUserMenuOpen(false)
    setAlertsOpen(false)
    setOpenSection(key)
  }

  // Pequeño retardo: permite cruzar el hueco/entrar al desplegable sin que se cierre
  const scheduleCloseNav = (key: string) => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => {
      setOpenSection((current) => (current === key ? null : current))
    }, 200)
  }

  const openUserMenu = () => {
    clearUserMenuTimer()
    clearCloseTimer()
    setOpenSection(null)
    setAlertsOpen(false)
    setUserMenuOpen(true)
  }

  const scheduleCloseUserMenu = () => {
    clearUserMenuTimer()
    userMenuCloseTimer.current = setTimeout(() => {
      setUserMenuOpen(false)
    }, 200)
  }

  const computeDropdownPosition = (key: string) => {
    const trigger = navRef.current?.querySelector<HTMLElement>(`[data-nav-key="${key}"]`)
    if (!trigger) return null
    const rect = trigger.getBoundingClientRect()
    const maxLeft = Math.max(12, window.innerWidth - DROPDOWN_WIDTH - 12)
    return {
      top: Math.round(rect.bottom + DROPDOWN_GAP),
      left: Math.round(Math.min(Math.max(12, rect.left), maxLeft)),
    }
  }

  useEffect(
    () => () => {
      clearCloseTimer()
      clearUserMenuTimer()
    },
    [],
  )

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest('.app-nav-dropdown.is-portal')) {
        return
      }
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        clearCloseTimer()
        clearUserMenuTimer()
        setOpenSection(null)
        setMobileOpen(false)
        setUserMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearCloseTimer()
        clearUserMenuTimer()
        setOpenSection(null)
        setMobileOpen(false)
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!mobileOpen) {
      return
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileOpen])

  useEffect(() => {
    setOpenSection(null)
    setMobileOpen(false)
  }, [activeSection, activeSubSection])

  // Detecta si el nav necesita flechas de carrusel
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const update = () => {
      const maxScroll = nav.scrollWidth - nav.clientWidth
      setNavScroll({
        left: nav.scrollLeft > 4,
        right: maxScroll > 4 && nav.scrollLeft < maxScroll - 4,
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(nav)
    nav.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      nav.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [navSections.length])

  // Posiciona el desplegable fuera del contenedor del nav (no lo recorta el carrusel)
  useLayoutEffect(() => {
    if (!openSection) {
      setDropdownPosition(null)
      return
    }
    const update = () => setDropdownPosition(computeDropdownPosition(openSection))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [openSection])

  const scrollNav = (direction: -1 | 1) => {
    const nav = navRef.current
    if (!nav) return
    setOpenSection(null)
    nav.scrollBy({
      left: direction * Math.max(200, nav.clientWidth * 0.65),
      behavior: 'smooth',
    })
  }

  const goHome = () => {
    clearCloseTimer()
    setOpenSection(null)
    setMobileOpen(false)
    setUserMenuOpen(false)
    onHome()
  }

  const goTo = (section: string, subSection: string) => {
    clearCloseTimer()
    setOpenSection(null)
    setMobileOpen(false)
    setUserMenuOpen(false)
    onNavigate(section, subSection)
  }

  const openPreferences = (modal: Exclude<PreferencesModal, null>) => {
    setOpenSection(null)
    setUserMenuOpen(false)
    setPreferencesModal(modal)
  }

  const renderAvatar = (extraClass = '') => (
    <>
      {avatarSrc ? (
        <img
          className={`app-header-avatar${extraClass}`}
          src={avatarSrc}
          alt={`Avatar de ${userName ?? 'usuario'}`}
        />
      ) : (
        <span className={`app-header-avatar placeholder${extraClass}`} aria-hidden>
          {initials}
        </span>
      )}
    </>
  )

  return (
    <header className="app-header" ref={headerRef}>
      <div className="app-header-inner">
        <button
          type="button"
          className={`app-header-brand logo-${preferences.logo}`}
          onClick={goHome}
          aria-label="Ir al dashboard"
        >
          {preferences.logo === 'full' ? (
            <>
              <img
                className="app-header-brand-mark"
                src={markSrc}
                alt=""
                aria-hidden="true"
                width={62}
                height={62}
                decoding="async"
              />
              <img
                className="app-header-brand-wordmark"
                src={wordmarkSrc}
                alt="LifeKeeper"
                width={150}
                height={42}
                decoding="async"
              />
            </>
          ) : null}
          {preferences.logo === 'mark' ? (
            <img
              className="app-header-brand-mark"
              src={markSrc}
              alt="LifeKeeper"
              width={66}
              height={66}
              decoding="async"
            />
          ) : null}
          {preferences.logo === 'wordmark' ? (
            <img
              className="app-header-brand-wordmark"
              src={wordmarkSrc}
              alt="LifeKeeper"
              width={160}
              height={48}
              decoding="async"
            />
          ) : null}
        </button>

        <div
          className={`app-nav-shell${navScroll.left ? ' has-left' : ''}${navScroll.right ? ' has-right' : ''}`}
        >
          {navScroll.left ? (
            <button
              type="button"
              className="app-nav-arrow app-nav-arrow-left"
              onClick={() => scrollNav(-1)}
              aria-label="Desplazar navegación a la izquierda"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
          ) : null}

          <nav className="app-nav" aria-label="Navegación principal" ref={navRef}>
            <button
              type="button"
              className={`app-nav-item${activeSection ? '' : ' active'}`}
              onClick={goHome}
              aria-current={activeSection ? undefined : 'page'}
            >
              Dashboard
            </button>

            {navSections.map((section) => {
              const isOpen = openSection === section.key
              const isActive = activeSection === section.key
              return (
                <div
                  key={section.key}
                  className={`app-nav-group${isOpen ? ' open' : ''}`}
                  onMouseEnter={() => openNav(section.key)}
                  onMouseLeave={() => scheduleCloseNav(section.key)}
                >
                  <button
                    type="button"
                    className={`app-nav-item${isActive ? ' active' : ''}`}
                    onClick={() => setOpenSection(section.key)}
                    data-nav-key={section.key}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                  >
                    {section.label}
                    <ChevronDown className="app-nav-chevron" size={14} aria-hidden />
                  </button>
                </div>
              )
            })}
          </nav>

          {navScroll.right ? (
            <button
              type="button"
              className="app-nav-arrow app-nav-arrow-right"
              onClick={() => scrollNav(1)}
              aria-label="Desplazar navegación a la derecha"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="app-header-actions">
          <button
            ref={alertsBtnRef}
            type="button"
            className={`app-header-icon app-header-alerts-btn${alertsOpen ? ' is-open' : ''}`}
            onClick={() => {
              setOpenSection(null)
              setUserMenuOpen(false)
              setAlertsOpen((prev) => !prev)
            }}
            aria-label={
              insights.length > 0
                ? `Centro de alertas (${insights.length} activas)`
                : 'Centro de alertas (sin alertas pendientes)'
            }
            aria-haspopup="dialog"
            aria-expanded={alertsOpen}
            title="Centro de alertas"
          >
            <Bell size={19} aria-hidden />
            {insights.length > 0 ? (
              <span className={`app-header-alert-badge ${alertBadgeTone}`}>
                {insights.length > 9 ? '9+' : insights.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            className="app-header-icon"
            onClick={toggleMode}
            aria-label={`Cambiar a modo ${nextThemeLabel}`}
            title={`Cambiar a modo ${nextThemeLabel}`}
          >
            {preferences.mode === 'dark' ? <Sun size={19} aria-hidden /> : <Moon size={19} aria-hidden />}
          </button>

          {userName ? (
            <div
              className={`app-header-user-wrap${userMenuOpen ? ' open' : ''}`}
              onMouseEnter={openUserMenu}
              onMouseLeave={scheduleCloseUserMenu}
            >
              <button
                type="button"
                className="app-header-user"
                onClick={() => {
                  clearUserMenuTimer()
                  setOpenSection(null)
                  setAlertsOpen(false)
                  setUserMenuOpen((open) => !open)
                }}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label="Abrir menú de usuario"
                title={userName}
              >
                {renderAvatar()}
                <span className="app-header-user-name">{userName}</span>
                <ChevronDown className="app-header-user-chevron" size={15} aria-hidden />
              </button>

              {userMenuOpen ? (
                <div
                  className="app-user-menu"
                  role="menu"
                  aria-label="Opciones de usuario"
                  onMouseEnter={clearUserMenuTimer}
                  onMouseLeave={scheduleCloseUserMenu}
                >
                  <div className="app-user-menu-header">
                    {renderAvatar()}
                    <div className="app-user-menu-info">
                      <span className="app-user-menu-name">{userName}</span>
                      {userEmail ? <span className="app-user-menu-email">{userEmail}</span> : null}
                    </div>
                  </div>
                  {profileSection ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="app-user-menu-item"
                      onClick={() => goTo(profileSection.key, profileSection.subSections[0].key)}
                    >
                      <UserRound size={16} aria-hidden />
                      Mi perfil
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    className="app-user-menu-item"
                    onClick={() => openPreferences('settings')}
                  >
                    <Settings size={16} aria-hidden />
                    Configuración
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="app-user-menu-item"
                    onClick={() => openPreferences('appearance')}
                  >
                    <Palette size={16} aria-hidden />
                    Apariencia
                  </button>
                  <div className="app-user-menu-divider" />
                  <button
                    type="button"
                    role="menuitem"
                    className="app-user-menu-item danger"
                    onClick={() => {
                      setUserMenuOpen(false)
                      onLock()
                    }}
                  >
                    <LogOut size={16} aria-hidden />
                    Bloquear ahora
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className="app-header-menu"
            onClick={() => {
              setOpenSection(null)
              setMobileOpen((open) => !open)
            }}
            aria-label={mobileOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
            aria-expanded={mobileOpen}
            aria-controls="app-mobile-menu"
          >
            {mobileOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <>
          <div className="app-mobile-backdrop" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="app-mobile-menu" id="app-mobile-menu" ref={mobilePanelRef}>
            <button
              type="button"
              className={`app-mobile-link${activeSection ? '' : ' active'}`}
              onClick={goHome}
            >
              Dashboard
            </button>
            {navSections.map((section) => (
              <div className="app-mobile-group" key={section.key}>
                <span className="app-mobile-section">{section.label}</span>
                {section.subSections.map((subSection) => {
                  const isCurrent =
                    activeSection === section.key && activeSubSection === subSection.key
                  return (
                    <button
                      key={subSection.key}
                      type="button"
                      className={`app-mobile-link${isCurrent ? ' active' : ''}`}
                      onClick={() => goTo(section.key, subSection.key)}
                    >
                      {subSection.label}
                    </button>
                  )
                })}
              </div>
            ))}
            <ScrollbarOverlay targetRef={mobilePanelRef} zIndex={1021} minThumb={28} />
          </div>
        </>
      ) : null}

      {openNavSection && dropdownPosition
        ? createPortal(
            <div
              className="app-nav-dropdown is-portal"
              role="menu"
              aria-label={`Secciones de ${openNavSection.label}`}
              style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
              onMouseEnter={clearCloseTimer}
              onMouseLeave={() => scheduleCloseNav(openNavSection.key)}
            >
              {openNavSection.subSections.map((subSection) => {
                const isCurrent =
                  activeSection === openNavSection.key && activeSubSection === subSection.key
                return (
                  <button
                    key={subSection.key}
                    type="button"
                    role="menuitem"
                    className={`app-nav-link${isCurrent ? ' active' : ''}`}
                    onClick={() => goTo(openNavSection.key, subSection.key)}
                    aria-current={isCurrent ? 'page' : undefined}
                  >
                    <span>{subSection.label}</span>
                    {isCurrent ? <Check size={14} aria-hidden /> : null}
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}

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
        userEmail={userEmail}
        avatarSrc={avatarSrc}
      />
      <AppearanceModal
        open={preferencesModal === 'appearance'}
        onClose={() => setPreferencesModal(null)}
      />
    </header>
  )
}
