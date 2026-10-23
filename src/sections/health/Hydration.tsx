import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Droplets,
  GlassWater,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import { usePreferences } from '../../preferences/context'
import type { HydrationLogEntry } from '../../types'
import { formatDate, toLocalDateKey } from '../../utils/dates'

const QUICK_AMOUNTS_ML = [
  { label: '+250 ml', ml: 250, desc: '1 vaso' },
  { label: '+500 ml', ml: 500, desc: 'Botella chica' },
  { label: '+750 ml', ml: 750, desc: 'Botella deportiva' },
  { label: '+1000 ml', ml: 1000, desc: '1 Litro' },
]

export const HydrationSection = () => {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const isImperial = preferences.unitSystem === 'imperial'

  const userWeight = data.profile.weightKg
  const targetMl = data.health.hydrationTargetMl ?? 2500
  const hydrationLogs = useMemo(() => data.health.hydrationLogs ?? [], [data.health.hydrationLogs])

  const todayKey = toLocalDateKey(new Date())

  const todayEntry = useMemo(
    () => hydrationLogs.find((log) => log.date === todayKey),
    [hydrationLogs, todayKey],
  )

  const currentAmountMl = todayEntry?.amountMl ?? 0
  const percent = Math.min(100, Math.round((currentAmountMl / targetMl) * 100))

  const [customMl, setCustomMl] = useState('')
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState(String(targetMl))

  // Función para modificar la ingesta del día de hoy
  const modifyTodayWater = (deltaMl: number) => {
    updateData((previous) => {
      const logs = [...(previous.health.hydrationLogs ?? [])]
      const index = logs.findIndex((l) => l.date === todayKey)

      const prevAmount = index >= 0 ? logs[index].amountMl : 0
      const newAmount = Math.max(0, prevAmount + deltaMl)

      if (index >= 0) {
        logs[index] = { ...logs[index], amountMl: newAmount, targetMl }
      } else {
        logs.unshift({ date: todayKey, amountMl: newAmount, targetMl })
      }

      return {
        ...previous,
        health: {
          ...previous.health,
          hydrationLogs: logs,
        },
      }
    })
  }

  const setTodayWaterAbsolute = (amount: number) => {
    updateData((previous) => {
      const logs = [...(previous.health.hydrationLogs ?? [])]
      const index = logs.findIndex((l) => l.date === todayKey)
      const cleanAmount = Math.max(0, amount)

      if (index >= 0) {
        logs[index] = { ...logs[index], amountMl: cleanAmount, targetMl }
      } else {
        logs.unshift({ date: todayKey, amountMl: cleanAmount, targetMl })
      }

      return {
        ...previous,
        health: {
          ...previous.health,
          hydrationLogs: logs,
        },
      }
    })
  }

  const saveTarget = () => {
    const parsed = Number(targetInput)
    if (parsed >= 500 && parsed <= 10000) {
      updateData((previous) => ({
        ...previous,
        health: {
          ...previous.health,
          hydrationTargetMl: parsed,
        },
      }))
      setEditingTarget(false)
    }
  }

  const applyWeightBasedTarget = () => {
    if (userWeight && userWeight > 0) {
      const suggested = Math.round(userWeight * 35) // 35 ml por kg
      updateData((previous) => ({
        ...previous,
        health: {
          ...previous.health,
          hydrationTargetMl: suggested,
        },
      }))
      setTargetInput(String(suggested))
      setEditingTarget(false)
    }
  }

  // Historial últimos 14 días para gráfico
  const chartData = useMemo(() => {
    const list: Array<{ date: string; displayDate: string; amount: number; target: number }> = []
    const logMap = new Map<string, HydrationLogEntry>()
    hydrationLogs.forEach((l) => logMap.set(l.date, l))

    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = toLocalDateKey(d)
      const entry = logMap.get(key)
      const amt = entry?.amountMl ?? 0
      const tgt = entry?.targetMl ?? targetMl

      list.push({
        date: key,
        displayDate: i === 0 ? 'Hoy' : formatDate(key).slice(0, 5),
        amount: isImperial ? Number((amt * 0.033814).toFixed(0)) : amt,
        target: isImperial ? Number((tgt * 0.033814).toFixed(0)) : tgt,
      })
    }
    return list
  }, [hydrationLogs, targetMl, isImperial])

  // Métricas acumuladas
  const summary = useMemo(() => {
    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    let thisMonthTotal = 0
    let daysGoalAchieved = 0

    hydrationLogs.forEach((log) => {
      if (log.date.startsWith(currentMonthKey)) {
        thisMonthTotal += log.amountMl
        if (log.amountMl >= (log.targetMl ?? targetMl)) {
          daysGoalAchieved += 1
        }
      }
    })

    return {
      thisMonthLiters: (thisMonthTotal / 1000).toFixed(1),
      daysGoalAchieved,
      totalLoggedDays: hydrationLogs.length,
    }
  }, [hydrationLogs, targetMl])

  const volumeUnit = isImperial ? 'fl oz' : 'ml'
  const displayCurrent = isImperial
    ? `${(currentAmountMl * 0.033814).toFixed(0)} fl oz`
    : `${currentAmountMl} ml`
  const displayTarget = isImperial
    ? `${(targetMl * 0.033814).toFixed(0)} fl oz`
    : `${targetMl} ml`

  return (
    <div>
      <SectionHeader
        title="Hidratación diaria"
        subtitle="Monitoreá tu consumo de agua, ajustá tu meta y mantené el rendimiento diario"
      />

      <div className="section-body">
        {/* Tarjetas Estadísticas */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-title">Ingesta de hoy</span>
            <span className="stat-value">{displayCurrent}</span>
            <span className="panel-subtitle">Meta: {displayTarget}</span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Progreso diario</span>
            <span className="stat-value">{percent}%</span>
            <span className="panel-subtitle">
              {percent >= 100 ? '¡Meta alcanzada!' : `Faltan ${Math.max(0, targetMl - currentAmountMl)} ml`}
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Días con meta cumplida este mes</span>
            <span className="stat-value">{summary.daysGoalAchieved}</span>
            <span className="panel-subtitle">Constancia de hidratación</span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Total consumido este mes</span>
            <span className="stat-value">{summary.thisMonthLiters} L</span>
            <span className="panel-subtitle">Volumen acumulado</span>
          </div>
        </div>

        {/* Panel Principal de Registro de Hoy */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Ingesta del día ({todayKey})</h3>
              <p className="panel-subtitle">
                Registrá cada vaso o botella que tomes durante el día
              </p>
            </div>

            <div className="section-actions">
              {editingTarget ? (
                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    step="100"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    style={{ width: '90px', padding: '0.3rem 0.5rem' }}
                  />
                  <span style={{ fontSize: '0.8125rem' }}>ml</span>
                  <button className="primary-button" type="button" onClick={saveTarget}>
                    Guardar
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setEditingTarget(false)}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setTargetInput(String(targetMl))
                    setEditingTarget(true)
                  }}
                >
                  Meta: {displayTarget} ✏️
                </button>
              )}
            </div>
          </div>

          {/* Barra de progreso de hidratación */}
          <div style={{ margin: '1rem 0' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Droplets size={20} style={{ color: 'var(--color-accent-cyan)' }} />
                <strong style={{ fontSize: '1.25rem' }}>{displayCurrent}</strong>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                  de {displayTarget}
                </span>
              </div>
              <span
                className={`badge ${
                  percent >= 100 ? 'badge-success' : percent >= 60 ? 'badge-info' : 'badge-warning'
                }`}
              >
                {percent >= 100 ? 'Meta lograda 🎉' : `${percent}%`}
              </span>
            </div>

            <div className="progress-track" style={{ height: '14px', borderRadius: '999px' }}>
              <div
                className="progress-fill"
                style={{
                  width: `${percent}%`,
                  background:
                    percent >= 100
                      ? 'linear-gradient(90deg, #06b6d4 0%, #10b981 100%)'
                      : 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)',
                }}
              />
            </div>
          </div>

          {/* Botones de acción rápida */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.625rem',
              marginTop: '1rem',
            }}
          >
            {QUICK_AMOUNTS_ML.map((item) => (
              <button
                key={item.ml}
                type="button"
                className="secondary-button"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.75rem 0.5rem',
                  gap: '0.25rem',
                }}
                onClick={() => modifyTodayWater(item.ml)}
              >
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{item.label}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {item.desc}
                </span>
              </button>
            ))}
          </div>

          {/* Ingreso personalizado y corrección */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--color-surface-hover)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                min="10"
                step="50"
                value={customMl}
                onChange={(e) => setCustomMl(e.target.value)}
                placeholder="Cantidad manual (ml)"
                style={{ width: '170px' }}
              />
              <button
                type="button"
                className="primary-button"
                disabled={!customMl || Number(customMl) <= 0}
                onClick={() => {
                  modifyTodayWater(Number(customMl))
                  setCustomMl('')
                }}
              >
                <Plus size={16} aria-hidden /> Sumar
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="secondary-button"
                disabled={currentAmountMl === 0}
                onClick={() => modifyTodayWater(-250)}
                title="Descontar 250 ml en caso de error"
              >
                <Minus size={15} aria-hidden /> Restar 250 ml
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={currentAmountMl === 0}
                onClick={() => setTodayWaterAbsolute(0)}
                title="Reiniciar a cero hoy"
              >
                <RotateCcw size={15} aria-hidden /> Reiniciar
              </button>
            </div>
          </div>
        </div>

        {/* Recomendación personalizada según peso */}
        {userWeight && userWeight > 0 ? (
          <div
            className="subpanel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Trophy size={18} style={{ color: 'var(--color-accent-blue)', flexShrink: 0 }} />
              <div style={{ fontSize: '0.875rem' }}>
                <span>
                  Según tu peso corporal registrado ({userWeight} kg), tu meta hídrica recomendada es de{' '}
                  <strong>{Math.round(userWeight * 35)} ml</strong> (fórmula base de 35 ml por kg de peso).
                </span>
              </div>
            </div>
            {targetMl !== Math.round(userWeight * 35) ? (
              <button
                className="secondary-button"
                type="button"
                onClick={applyWeightBasedTarget}
                style={{ fontSize: '0.8125rem' }}
              >
                Fijar {Math.round(userWeight * 35)} ml como meta
              </button>
            ) : (
              <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                Meta adaptada
              </span>
            )}
          </div>
        ) : null}

        {/* Gráfico de Historial de los últimos 14 días */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Evolución de los últimos 14 días</h3>
              <p className="panel-subtitle">Consumo diario frente a tu meta hídrica ({volumeUnit})</p>
            </div>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-strong)" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  stroke="var(--color-border-strong)"
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--color-border-strong)"
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                  tickLine={false}
                  width={55}
                />
                <Tooltip
                  formatter={(val: unknown) => [`${val} ${volumeUnit}`, 'Ingesta']}
                  contentStyle={{
                    background: 'var(--color-bg-elevated)',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 12,
                    color: 'var(--color-text-primary)',
                  }}
                  labelStyle={{ color: 'var(--color-text-tertiary)' }}
                />
                <Bar dataKey="amount" fill="var(--color-accent-cyan)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subpanel de Buenas Prácticas */}
        <div className="smart-grid">
          <div className="smart-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Sparkles size={16} style={{ color: 'var(--color-accent-blue)' }} />
              <strong>Al despertar</strong>
            </div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              Tomar un vaso de 300 ml en ayunas reactiva la digestión y compensa la pérdida de líquidos nocturna.
            </span>
          </div>

          <div className="smart-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <GlassWater size={16} style={{ color: 'var(--color-accent-cyan)' }} />
              <strong>En tus entrenamientos</strong>
            </div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              Consumí entre 300 y 500 ml antes de comenzar y tomá sorbos regulares cada 15-20 minutos de ejercicio.
            </span>
          </div>

          <div className="smart-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
              <strong>Distribución constante</strong>
            </div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              Evitá tomar grandes volúmenes de golpe: beber pequeñas cantidades durante la jornada optimiza la absorción.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
