import {
  Briefcase,
  Calendar,
  CalendarClock,
  Car,
  DollarSign,
  Dumbbell,
  HardDriveDownload,
  Lock,
  Palette,
  Settings,
  Share2,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { triggerHaptic } from '../../services/platform'

interface MobileMenuSheetProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (section: string, subSection?: string) => void
  onOpenSettings: () => void
  onOpenAppearance: () => void
  onOpenShare: () => void
  onOpenAssistant: () => void
  onLock: () => void
}

export const MobileMenuSheet = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenSettings,
  onOpenAppearance,
  onOpenShare,
  onOpenAssistant,
  onLock,
}: MobileMenuSheetProps) => {
  if (!isOpen) return null

  const handleItemClick = (action: () => void) => {
    triggerHaptic('light')
    onClose()
    action()
  }

  return (
    <>
      <div className="mobile-sheet-backdrop" onClick={onClose} />
      <div className="mobile-sheet-container" role="dialog" aria-modal="true">
        {/* Handle for drag / visual affordance */}
        <div className="mobile-sheet-handle" onClick={onClose} />

        <div className="mobile-sheet-header">
          <h2 className="mobile-sheet-title">Explorar Bóveda</h2>
          <button
            className="mobile-icon-btn"
            onClick={onClose}
            aria-label="Cerrar menú"
            style={{ width: 36, height: 36 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Asistente Rápido */}
        <button
          className="mobile-sheet-card"
          onClick={() => handleItemClick(onOpenAssistant)}
          style={{
            width: '100%',
            marginBottom: '12px',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(99, 102, 241, 0.15) 100%)',
            borderColor: 'rgba(56, 189, 248, 0.3)',
          }}
        >
          <div
            className="mobile-sheet-card-icon"
            style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}
          >
            <Sparkles size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="mobile-sheet-card-label" style={{ color: '#38bdf8' }}>
              Asistente LifeKeeper
            </div>
            <div className="mobile-sheet-card-sub">Consultas y sugerencias inteligentes</div>
          </div>
        </button>

        {/* 1. Vida Personal */}
        <div className="mobile-sheet-section-title">Vida Personal</div>
        <div className="mobile-sheet-grid">
          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(() => onNavigate('personal', 'finances'))}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <DollarSign size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label">Finanzas</div>
              <div className="mobile-sheet-card-sub">Gastos y balances</div>
            </div>
          </button>

          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(() => onNavigate('personal', 'projects'))}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
              <Briefcase size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label">Proyectos</div>
              <div className="mobile-sheet-card-sub">Ideas y metas</div>
            </div>
          </button>

          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(() => onNavigate('personal', 'vehicles'))}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <Car size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label">Vehículos</div>
              <div className="mobile-sheet-card-sub">Mantenimientos</div>
            </div>
          </button>

          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(() => onNavigate('personal', 'workouts'))}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
              <Dumbbell size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label">Entrenamiento</div>
              <div className="mobile-sheet-card-sub">Rutinas físicas</div>
            </div>
          </button>
        </div>

        {/* 2. Utilidades */}
        <div className="mobile-sheet-section-title">Utilidades</div>
        <div className="mobile-sheet-grid">
          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(() => onNavigate('utilities', 'reminders'))}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
              <CalendarClock size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label">Recordatorios</div>
              <div className="mobile-sheet-card-sub">Avisos y alertas</div>
            </div>
          </button>

          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(() => onNavigate('utilities', 'calendar'))}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              <Calendar size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label">Calendario</div>
              <div className="mobile-sheet-card-sub">Eventos del mes</div>
            </div>
          </button>

          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(() => onNavigate('utilities', 'backups'))}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6' }}>
              <HardDriveDownload size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label">Respaldos</div>
              <div className="mobile-sheet-card-sub">Backup cifrado</div>
            </div>
          </button>

          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(onOpenShare)}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
              <Share2 size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label">Compartir app</div>
              <div className="mobile-sheet-card-sub">Invitar contactos</div>
            </div>
          </button>
        </div>

        {/* 3. Cuenta & Ajustes */}
        <div className="mobile-sheet-section-title">Ajustes & Sistema</div>
        <div className="mobile-sheet-grid">
          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(() => onNavigate('profile', 'settings'))}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
              <UserRound size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label">Mi Perfil</div>
              <div className="mobile-sheet-card-sub">Datos de cuenta</div>
            </div>
          </button>

          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(onOpenAppearance)}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
              <Palette size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label">Apariencia</div>
              <div className="mobile-sheet-card-sub">Temas y colores</div>
            </div>
          </button>

          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(onOpenSettings)}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#64748b' }}>
              <Settings size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label">Configuración</div>
              <div className="mobile-sheet-card-sub">Seguridad y PIN</div>
            </div>
          </button>

          <button
            className="mobile-sheet-card"
            onClick={() => handleItemClick(onLock)}
            style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
          >
            <div className="mobile-sheet-card-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
              <Lock size={20} />
            </div>
            <div>
              <div className="mobile-sheet-card-label" style={{ color: '#ef4444' }}>Bloquear</div>
              <div className="mobile-sheet-card-sub">Cerrar bóveda</div>
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
