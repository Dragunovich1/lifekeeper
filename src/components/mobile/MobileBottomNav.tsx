import { BookOpen, Grid2x2, HeartPulse, Home, ShieldCheck } from 'lucide-react'
import { triggerHapticSelection } from '../../services/platform'

interface MobileBottomNavProps {
  activeSection: string | null
  onHome: () => void
  onNavigate: (section: string) => void
  onOpenMenu: () => void
  isMenuOpen: boolean
}

export const MobileBottomNav = ({
  activeSection,
  onHome,
  onNavigate,
  onOpenMenu,
  isMenuOpen,
}: MobileBottomNavProps) => {
  const handleTabClick = (action: () => void) => {
    triggerHapticSelection()
    action()
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="Navegación principal móvil">
      <div className="mobile-bottom-nav-inner">
        {/* 1. Inicio */}
        <button
          className={`mobile-nav-tab ${activeSection === null && !isMenuOpen ? 'active' : ''}`}
          onClick={() => handleTabClick(onHome)}
        >
          <div className="mobile-tab-icon-wrapper">
            <Home size={20} />
            {activeSection === null && !isMenuOpen && <div className="mobile-tab-glow-dot" />}
          </div>
          <span>Inicio</span>
        </button>

        {/* 2. Salud */}
        <button
          className={`mobile-nav-tab ${activeSection === 'health' && !isMenuOpen ? 'active' : ''}`}
          onClick={() => handleTabClick(() => onNavigate('health'))}
        >
          <div className="mobile-tab-icon-wrapper">
            <HeartPulse size={20} />
            {activeSection === 'health' && !isMenuOpen && <div className="mobile-tab-glow-dot" />}
          </div>
          <span>Salud</span>
        </button>

        {/* 3. Seguridad */}
        <button
          className={`mobile-nav-tab ${activeSection === 'security' && !isMenuOpen ? 'active' : ''}`}
          onClick={() => handleTabClick(() => onNavigate('security'))}
        >
          <div className="mobile-tab-icon-wrapper">
            <ShieldCheck size={20} />
            {activeSection === 'security' && !isMenuOpen && <div className="mobile-tab-glow-dot" />}
          </div>
          <span>Seguridad</span>
        </button>

        {/* 4. Diario */}
        <button
          className={`mobile-nav-tab ${activeSection === 'diary' && !isMenuOpen ? 'active' : ''}`}
          onClick={() => handleTabClick(() => onNavigate('diary'))}
        >
          <div className="mobile-tab-icon-wrapper">
            <BookOpen size={20} />
            {activeSection === 'diary' && !isMenuOpen && <div className="mobile-tab-glow-dot" />}
          </div>
          <span>Diario</span>
        </button>

        {/* 5. Más / Secciones y Ajustes */}
        <button
          className={`mobile-nav-tab ${isMenuOpen || ['personal', 'utilities', 'profile'].includes(activeSection ?? '') ? 'active' : ''}`}
          onClick={() => handleTabClick(onOpenMenu)}
        >
          <div className="mobile-tab-icon-wrapper">
            <Grid2x2 size={20} />
            {(isMenuOpen || ['personal', 'utilities', 'profile'].includes(activeSection ?? '')) && (
              <div className="mobile-tab-glow-dot" />
            )}
          </div>
          <span>Más</span>
        </button>
      </div>
    </nav>
  )
}
