import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import {
  Calendar,
  CalendarHeart,
  CheckCircle2,
  Droplets,
  Plus,
  Trash2,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import type { MenstrualCycleEntry, MenstrualFlow } from '../../types'
import { formatDate, fromLocalDateOrDateTime, toLocalDateKey } from '../../utils/dates'

const FLOW_OPTIONS: Array<{ value: MenstrualFlow; label: string; badgeColor: string }> = [
  { value: 'ligero', label: 'Ligero / Leve', badgeColor: '#f472b6' },
  { value: 'moderado', label: 'Moderado', badgeColor: '#ec4899' },
  { value: 'abundante', label: 'Abundante / Intenso', badgeColor: '#be185d' },
  { value: 'manchado', label: 'Manchado / Spotting', badgeColor: '#fb7185' },
]

const COMMON_SYMPTOMS = [
  'Cólicos',
  'Dolor de cabeza',
  'Fatiga / Cansancio',
  'Cambios de humor',
  'Hinchazón',
  'Sensibilidad mamaria',
  'Antojos dulces',
  'Dolor lumbar',
  'Insomnio',
  'Acné',
  'Dolor articular',
  'Flujo blanco',
]

export const MenstrualCycleSection = () => {
  const { data, updateData } = useAppData()

  const cycleData = useMemo(() => {
    return (
      data.health.menstrualCycle ?? {
        enabled: true,
        averageCycleDays: 28,
        averagePeriodDays: 5,
        entries: [],
      }
    )
  }, [data.health.menstrualCycle])

  const entries = useMemo(() => {
    return (cycleData.entries ?? []).slice().sort((a, b) => b.startDate.localeCompare(a.startDate))
  }, [cycleData.entries])

  // Formulario para registrar un período o síntoma
  const [startDate, setStartDate] = useState(() => toLocalDateKey(new Date()))
  const [endDate, setEndDate] = useState('')
  const [flow, setFlow] = useState<MenstrualFlow>('moderado')
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [deletingEntry, setDeletingEntry] = useState<MenstrualCycleEntry | null>(null)

  // Configuración de promedios
  const [averageCycleDays, setAverageCycleDays] = useState(cycleData.averageCycleDays || 28)
  const [averagePeriodDays, setAveragePeriodDays] = useState(cycleData.averagePeriodDays || 5)
  const [configSuccess, setConfigSuccess] = useState(false)

  // Calcular la fase actual y predicciones
  const cycleInsights = useMemo(() => {
    if (entries.length === 0) {
      return null
    }

    const last = entries[0]
    const lastDate = new Date(last.startDate + 'T00:00:00')
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const diffMs = now.getTime() - lastDate.getTime()
    const cycleDay = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1

    const avgCycle = cycleData.averageCycleDays || 28
    const avgPeriod = cycleData.averagePeriodDays || 5

    // Próximo inicio estimado
    const nextPeriodDate = new Date(lastDate.getTime() + avgCycle * 24 * 60 * 60 * 1000)
    const nextPeriodKey = toLocalDateKey(nextPeriodDate)

    // Ovulación estimada: ~14 días antes del próximo período
    const ovulationDate = new Date(lastDate.getTime() + (avgCycle - 14) * 24 * 60 * 60 * 1000)
    const fertileStart = new Date(ovulationDate.getTime() - 4 * 24 * 60 * 60 * 1000)
    const fertileEnd = new Date(ovulationDate.getTime() + 1 * 24 * 60 * 60 * 1000)

    let phaseName = ''
    let phaseDescription = ''
    let phaseColor = ''
    let phaseEmoji = '🌸'

    if (cycleDay <= avgPeriod) {
      phaseName = 'Menstruación'
      phaseDescription = `Día ${cycleDay} de tu período. Priorizá el descanso, la hidratación y alimentos ricos en hierro.`
      phaseColor = '#f43f5e'
      phaseEmoji = '🌸'
    } else if (cycleDay < avgCycle - 16) {
      phaseName = 'Fase Folicular'
      phaseDescription = 'Aumento gradual de energía y estrógenos. Momento ideal para proyectos creativos y fuerza física.'
      phaseColor = '#10b981'
      phaseEmoji = '🌱'
    } else if (cycleDay >= avgCycle - 16 && cycleDay <= avgCycle - 12) {
      phaseName = 'Ventana de Ovulación (Fértil)'
      phaseDescription = `Pico de estrógenos y fertilidad. Ovulación estimada el ${formatDate(toLocalDateKey(ovulationDate))}.`
      phaseColor = '#f59e0b'
      phaseEmoji = '🌺'
    } else if (cycleDay <= avgCycle) {
      phaseName = 'Fase Lútea'
      phaseDescription = 'Sube la progesterona. Podés notar antojos o cambios de ánimo leves. Excelente para tareas de foco.'
      phaseColor = '#818cf8'
      phaseEmoji = '🌙'
    } else {
      const lateDays = cycleDay - avgCycle
      phaseName = 'Ciclo extendido'
      phaseDescription = `Llevás ${lateDays} día(s) posterior(es) a la fecha estimada de tu ciclo habitual.`
      phaseColor = '#a855f7'
      phaseEmoji = '⏳'
    }

    const daysRemaining = avgCycle - cycleDay

    return {
      cycleDay,
      phaseName,
      phaseDescription,
      phaseColor,
      phaseEmoji,
      nextPeriodKey,
      nextPeriodDate,
      daysRemaining,
      ovulationDateKey: toLocalDateKey(ovulationDate),
      fertileStartKey: toLocalDateKey(fertileStart),
      fertileEndKey: toLocalDateKey(fertileEnd),
    }
  }, [entries, cycleData.averageCycleDays, cycleData.averagePeriodDays])

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym],
    )
  }

  const handleSaveEntry = (e: FormEvent) => {
    e.preventDefault()
    if (!startDate) return

    const newEntry: MenstrualCycleEntry = {
      id: uuid(),
      startDate: fromLocalDateOrDateTime(startDate),
      endDate: endDate ? fromLocalDateOrDateTime(endDate) : undefined,
      flow,
      symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
      notes: notes.trim() || undefined,
    }

    updateData((previous) => {
      const prevData = previous.health.menstrualCycle ?? {
        enabled: true,
        averageCycleDays: 28,
        averagePeriodDays: 5,
        entries: [],
      }
      return {
        ...previous,
        health: {
          ...previous.health,
          menstrualCycle: {
            ...prevData,
            enabled: true,
            lastPeriodStart: newEntry.startDate,
            entries: [newEntry, ...(prevData.entries ?? []).filter((item) => item.id !== newEntry.id)],
          },
        },
      }
    })

    // Resetear formulario
    setEndDate('')
    setSelectedSymptoms([])
    setNotes('')
  }

  const handleSaveConfig = (e: FormEvent) => {
    e.preventDefault()
    updateData((previous) => {
      const prevData = previous.health.menstrualCycle ?? {
        enabled: true,
        averageCycleDays: 28,
        averagePeriodDays: 5,
        entries: [],
      }
      return {
        ...previous,
        health: {
          ...previous.health,
          menstrualCycle: {
            ...prevData,
            averageCycleDays: Number(averageCycleDays) || 28,
            averagePeriodDays: Number(averagePeriodDays) || 5,
          },
        },
      }
    })
    setConfigSuccess(true)
    setTimeout(() => setConfigSuccess(false), 2500)
  }

  const handleDeleteEntry = (id: string) => {
    updateData((previous) => {
      const prevData = previous.health.menstrualCycle
      if (!prevData) return previous
      return {
        ...previous,
        health: {
          ...previous.health,
          menstrualCycle: {
            ...prevData,
            entries: (prevData.entries ?? []).filter((item) => item.id !== id),
          },
        },
      }
    })
    setDeletingEntry(null)
  }

  return (
    <div>
      <SectionHeader
        title="Ciclo Menstrual & Bienestar Femenino"
        subtitle="Monitoreá tus fases hormonales, síntomas, ventana de fertilidad y predicciones sincronizadas con el calendario"
      />

      <div className="section-body">
        {/* Panel de Estado y Fase Actual */}
        {cycleInsights ? (
          <div
            className="subpanel"
            style={{
              background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(129, 140, 248, 0.08) 100%)',
              border: `1.5px solid ${cycleInsights.phaseColor}40`,
              marginBottom: '1rem',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: `${cycleInsights.phaseColor}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                  }}
                >
                  {cycleInsights.phaseEmoji}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: cycleInsights.phaseColor,
                      }}
                    >
                      Día {cycleInsights.cycleDay} del ciclo
                    </span>
                    <span
                      className="badge"
                      style={{
                        background: `${cycleInsights.phaseColor}25`,
                        color: cycleInsights.phaseColor,
                        borderColor: `${cycleInsights.phaseColor}50`,
                      }}
                    >
                      {cycleInsights.phaseName}
                    </span>
                  </div>
                  <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.2rem', fontWeight: 700 }}>
                    {cycleInsights.phaseName}
                  </h3>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    textAlign: 'right',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>
                    Próximo período estimado
                  </span>
                  <strong style={{ fontSize: '0.95rem' }}>
                    {formatDate(cycleInsights.nextPeriodKey)}
                  </strong>
                  <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--color-accent-cyan)' }}>
                    {cycleInsights.daysRemaining > 0
                      ? `En ${cycleInsights.daysRemaining} días`
                      : cycleInsights.daysRemaining === 0
                      ? 'Previsto para hoy'
                      : `Hace ${Math.abs(cycleInsights.daysRemaining)} días`}
                  </span>
                </div>

                <a
                  className="secondary-button"
                  href="#utilities:calendar"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                >
                  <Calendar size={15} />
                  Ver en Calendario
                </a>
              </div>
            </div>

            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {cycleInsights.phaseDescription}
            </p>

            {/* Métricas clave en miniatura */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '0.75rem',
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>🌺 Pico de Ovulación</span>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '2px' }}>
                  {formatDate(cycleInsights.ovulationDateKey)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>🌿 Ventana Fértil</span>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '2px' }}>
                  {formatDate(cycleInsights.fertileStartKey)} al {formatDate(cycleInsights.fertileEndKey)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>⚙️ Ciclo habitual configurado</span>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '2px' }}>
                  {cycleData.averageCycleDays || 28} días (sangrado {cycleData.averagePeriodDays || 5} d)
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="subpanel"
            style={{
              marginBottom: '1rem',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.05) 0%, rgba(56, 189, 248, 0.05) 100%)',
            }}
          >
            <CalendarHeart size={32} style={{ color: '#f43f5e', flexShrink: 0 }} />
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem' }}>Comenzá a registrar tu ciclo</h4>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Anotá la fecha de tu último período en el formulario de abajo para calcular tu fase actual, ovulación y predicciones automáticas en el calendario.
              </p>
            </div>
          </div>
        )}

        {/* Formulario de Registro Rápido */}
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Droplets size={18} style={{ color: '#f43f5e' }} />
              <h3 className="panel-title">Registrar período o síntomas</h3>
            </div>
          </div>

          <form onSubmit={handleSaveEntry} className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="field">
              <label htmlFor="period-start">Fecha de inicio</label>
              <DatePicker
                id="period-start"
                value={startDate}
                onChange={setStartDate}
                ariaLabel="Fecha de inicio del período"
              />
            </div>

            <div className="field">
              <label htmlFor="period-end">Fecha de fin (opcional)</label>
              <DatePicker
                id="period-end"
                value={endDate}
                onChange={setEndDate}
                ariaLabel="Fecha de fin del período"
              />
            </div>

            <div className="field">
              <label htmlFor="period-flow">Intensidad del flujo</label>
              <Select
                id="period-flow"
                value={flow}
                onChange={(val) => setFlow(val as MenstrualFlow)}
                options={FLOW_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
                ariaLabel="Intensidad de flujo"
              />
            </div>

            <div className="field-full" style={{ marginTop: '0.25rem' }}>
              <label>Síntomas y sensaciones físicas (opcional)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                {COMMON_SYMPTOMS.map((sym) => {
                  const isSelected = selectedSymptoms.includes(sym)
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => toggleSymptom(sym)}
                      className="tag-suggestion-chip"
                      style={{
                        borderRadius: '20px',
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: isSelected ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        borderColor: isSelected ? '#f43f5e' : 'rgba(255, 255, 255, 0.1)',
                        color: isSelected ? '#fda4af' : 'var(--color-text-secondary)',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {sym}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="field field-full">
              <label htmlFor="period-notes">Observaciones privadas / notas</label>
              <input
                id="period-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Cólicos suaves el 2do día, descanso reparador..."
              />
            </div>

            <div className="form-actions field-full" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" className="primary-button">
                <Plus size={16} />
                Guardar registro
              </button>
            </div>
          </form>
        </div>

        {/* Historial de Períodos Registrados */}
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-header">
            <h3 className="panel-title">Historial de ciclos y registros</h3>
            <span className="panel-subtitle">{entries.length} registro(s)</span>
          </div>

          {entries.length === 0 ? (
            <div className="empty-state">
              Aún no cargaste registros de períodos. Registrá tu fecha más reciente para activar el historial.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {entries.map((entry) => {
                const flowObj = FLOW_OPTIONS.find((f) => f.value === entry.flow)
                return (
                  <div key={entry.id} className="subpanel">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 600 }}>
                            {formatDate(entry.startDate)}
                            {entry.endDate ? ` al ${formatDate(entry.endDate)}` : ''}
                          </span>
                          {flowObj && (
                            <span
                              className="badge"
                              style={{
                                background: `${flowObj.badgeColor}20`,
                                color: flowObj.badgeColor,
                                borderColor: `${flowObj.badgeColor}40`,
                              }}
                            >
                              Flujo {flowObj.label}
                            </span>
                          )}
                        </div>

                        {entry.symptoms && entry.symptoms.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
                            {entry.symptoms.map((s) => (
                              <span
                                key={s}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '1px 7px',
                                  borderRadius: '10px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: 'var(--color-text-secondary)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                }}
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}

                        {entry.notes && (
                          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            💬 {entry.notes}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        className="secondary-button"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => setDeletingEntry(entry)}
                      >
                        <Trash2 size={13} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Ajustes de Ciclo Promedio */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Ajustes de duración media</h3>
            <p className="panel-subtitle">Personalizá la duración habitual para calibrar las predicciones</p>
          </div>

          <form onSubmit={handleSaveConfig} className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <label htmlFor="cfg-avg-cycle">Duración del ciclo completo (días)</label>
              <input
                id="cfg-avg-cycle"
                type="number"
                min="20"
                max="45"
                value={averageCycleDays}
                onChange={(e) => setAverageCycleDays(Number(e.target.value) || 28)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Estándar habitual: 28 días (rango normal 21 a 35 días)
              </span>
            </div>

            <div className="field">
              <label htmlFor="cfg-avg-period">Duración del período / sangrado (días)</label>
              <input
                id="cfg-avg-period"
                type="number"
                min="2"
                max="10"
                value={averagePeriodDays}
                onChange={(e) => setAveragePeriodDays(Number(e.target.value) || 5)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Estándar habitual: 5 días (rango normal 3 a 7 días)
              </span>
            </div>

            <div className="form-actions field-full" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              {configSuccess && (
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={16} /> Ajustes guardados
                </span>
              )}
              <button type="submit" className="secondary-button">
                Guardar ajustes
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deletingEntry)}
        title="Eliminar registro"
        message={
          deletingEntry
            ? `¿Deseás eliminar el registro del ${formatDate(deletingEntry.startDate)}?`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deletingEntry) handleDeleteEntry(deletingEntry.id)
        }}
        onClose={() => setDeletingEntry(null)}
      />
    </div>
  )
}
