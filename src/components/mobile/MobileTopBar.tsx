import { useEffect, useRef } from 'react'
import { Bell, ChevronLeft, Moon, Sun, UserRound } from 'lucide-react'
import type { NavSection, NavSubSection } from '../../navigation'
import { usePreferences } from '../../preferences/context'
import { triggerHaptic } from '../../services/platform'

interface MobileTopBarProps {
  sections: NavSection[]
  activeSection: string | null
  activeSubSection: string
  onHome: () => void
  onNavigate: (section: string, subSection: string) => void
  onOpenAlerts: () => void
  onOpenProfile: () => void
  onOpenAssistant: () => void
  criticalCount: number
  warningCount: number
  userName?: string
  avatarSrc?: string
}

export const MobileTopBar = ({
  sections,
  activeSection,
  activeSubSection,
  onHome,
  onNavigate,
  onOpenAlerts,
  onOpenProfile,
  onOpenAssistant,
  criticalCount,
  warningCount,
  avatarSrc,
}: MobileTopBarProps) => {
  const { preferences, toggleMode } = usePreferences()
  const isLight = preferences.mode === 'light'
  const subnavRef = useRef<HTMLDivElement | null>(null)
  const activePillRef = useRef<HTMLButtonElement | null>(null)

  const currentSectionData = sections.find((s) => s.key === activeSection)
  const subSections: NavSubSection[] = currentSectionData?.subSections ?? []

  // Auto-scroll active pill into view
  useEffect(() => {
    if (activePillRef.current && subnavRef.current) {
      activePillRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    }
  }, [activeSubSection, activeSection])

  const totalAlerts = criticalCount + warningCount

  const handleBack = () => {
    triggerHaptic('light')
    onHome()
  }

  const handlePillClick = (subKey: string) => {
    if (!activeSection) return
    triggerHaptic('light')
    onNavigate(activeSection, subKey)
  }

  const handleToggleTheme = () => {
    triggerHaptic('light')
    toggleMode()
  }

  return (
    <header className="mobile-top-bar">
      <div className="mobile-top-bar-inner">
        {/* Left side: Brand or Back button */}
        <div className="mobile-top-left">
          {activeSection ? (
            <button className="mobile-back-btn" onClick={handleBack} aria-label="Volver al inicio">
              <ChevronLeft size={18} />
              <span>Inicio</span>
            </button>
          ) : (
            <button className="mobile-brand-btn" onClick={onHome}>
              <img
                src="/brand/isotipo.png"
                alt="LifeKeeper"
                className="mobile-brand-icon"
              />
              <span className="mobile-brand-title">LifeKeeper</span>
            </button>
          )}

          {activeSection && currentSectionData && (
            <span className="mobile-section-heading">{currentSectionData.label}</span>
          )}
        </div>

        {/* Right side: Quick actions */}
        <div className="mobile-top-actions">
          <button
            className="mobile-icon-btn mobile-assistant-top-btn"
            onClick={() => {
              triggerHaptic('light')
              onOpenAssistant()
            }}
            aria-label="Abrir Asistente LifeKeeper"
            title="Asistente LifeKeeper"
          >
            <div className="mobile-assistant-avatar-wrapper">
              <img
                src="/brand/assistant.png?v=2"
                alt="Asistente LifeKeeper"
                className="mobile-assistant-avatar-img"
              />
              <span className="mobile-assistant-status-dot" aria-hidden />
            </div>
          </button>

          <button
            className="mobile-icon-btn"
            onClick={handleToggleTheme}
            aria-label="Cambiar tema"
          >
            {isLight ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button
            className="mobile-icon-btn"
            onClick={onOpenAlerts}
            aria-label="Notificaciones"
          >
            <Bell size={18} />
            {totalAlerts > 0 && <span className="mobile-badge">{totalAlerts}</span>}
          </button>

          <button
            className="mobile-icon-btn"
            onClick={onOpenProfile}
            aria-label="Perfil de usuario"
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Avatar"
                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <UserRound size={18} />
            )}
          </button>
        </div>
      </div>

      {/* Horizontal SubNav pills (Only when inside a section with multiple subsections) */}
      {activeSection && subSections.length > 1 && (
        <div className="mobile-subnav mobile-subnav-scroll" ref={subnavRef}>
          <div className="mobile-subnav-list">
            {subSections.map((sub) => {
              const isActive = sub.key === activeSubSection
              return (
                <button
                  key={sub.key}
                  ref={isActive ? activePillRef : null}
                  className={`mobile-subnav-pill ${isActive ? 'active' : ''}`}
                  onClick={() => handlePillClick(sub.key)}
                >
                  <span>{sub.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </header>
  )
}
