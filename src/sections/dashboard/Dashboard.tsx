import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'

export const DashboardSection = () => {
  const { data } = useAppData()

  const upcomingReminders = data.utilities.reminders.filter(r => !r.done)
  const activeMeds = data.health.medications.filter(m => m.active)
  const diaryCount = data.diary.entries.length
  const passwords = data.security.passwordEntries.length

  const projectsCount = data.personal.projects.length
  const vehiclesCount = data.personal.vehicles.length

  return (
    <div className="section-body">
      <SectionHeader
        title="Dashboard"
        subtitle="Resumen de tu vida digital y accesos rápidos"
      />

      <div className="dashboard-grid">
        <div className="card kpi">
          <div>
            <h3 className="kpi-title">Recordatorios activos</h3>
            <p className="kpi-value">{upcomingReminders.length}</p>
          </div>
          <a className="kpi-link" href="#utilities:reminders">Ver recordatorios</a>
        </div>

        <div className="card kpi">
          <div>
            <h3 className="kpi-title">Medicaciones activas</h3>
            <p className="kpi-value">{activeMeds.length}</p>
          </div>
          <a className="kpi-link" href="#health:medications">Ir a medicaciones</a>
        </div>

        <div className="card kpi">
          <div>
            <h3 className="kpi-title">Notas del diario</h3>
            <p className="kpi-value">{diaryCount}</p>
          </div>
          <a className="kpi-link" href="#diary:notes">Abrir diario</a>
        </div>

        <div className="card kpi">
          <div>
            <h3 className="kpi-title">Contraseñas guardadas</h3>
            <p className="kpi-value">{passwords}</p>
          </div>
          <a className="kpi-link" href="#security:passwords">Gestor de contraseñas</a>
        </div>
      </div>

      <div className="dashboard-grid wide">
        <div className="card quick">
          <h3 className="panel-title">Datos personales</h3>
          <p className="panel-subtitle">Perfil, proyectos y vehículos</p>
          <div className="quick-actions">
            <a className="primary-button" href="#profile:settings">Editar perfil</a>
            <a className="secondary-button" href="#personal:projects">Proyectos ({projectsCount})</a>
            <a className="secondary-button" href="#personal:vehicles">Vehículos ({vehiclesCount})</a>
          </div>
        </div>

        <div className="card quick">
          <h3 className="panel-title">Salud</h3>
          <p className="panel-subtitle">Consultas, vacunas y clínico</p>
          <div className="quick-actions">
            <a className="secondary-button" href="#health:consultations">Consultas</a>
            <a className="secondary-button" href="#health:vaccines">Vacunas</a>
            <a className="secondary-button" href="#health:history">Historial</a>
          </div>
        </div>
      </div>
    </div>
  )
}

