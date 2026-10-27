import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import {
  PiggyBank,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import { usePreferences } from '../../preferences/context'
import type { FinanceTransaction, SavingsGoal } from '../../types'
import { differenceInCalendarDays } from 'date-fns'
import {
  formatCurrency,
  formatDate,
  fromLocalDateOrDateTime,
  safeParseDate,
} from '../../utils/dates'

const GOAL_CATEGORIES = [
  'Viajes y Vacaciones',
  'Fondo de Emergencia',
  'Vehículo / Movilidad',
  'Hogar y Muebles',
  'Tecnología y Gadgets',
  'Educación / Cursos',
  'Inversiones',
  'Salud',
  'Otro',
]

const initialGoalForm: Omit<SavingsGoal, 'id' | 'contributions'> = {
  title: '',
  targetAmount: 0,
  currentAmount: 0,
  currency: 'ARS',
  category: 'Fondo de Emergencia',
  targetDate: '',
  notes: '',
  createdAt: new Date().toISOString(),
  completed: false,
}

export const SavingsSection = () => {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const defaultCurrency = preferences.currency || 'ARS'

  const goals = useMemo(() => data.personal.savingsGoals ?? [], [data.personal.savingsGoals])

  // Modales
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [goalForm, setGoalForm] = useState<Omit<SavingsGoal, 'id' | 'contributions'>>({
    ...initialGoalForm,
    currency: defaultCurrency,
  })
  const [deletingGoal, setDeletingGoal] = useState<SavingsGoal | null>(null)

  // Modal Aporte
  const [contributionModalOpen, setContributionModalOpen] = useState(false)
  const [selectedGoalForContribution, setSelectedGoalForContribution] = useState<SavingsGoal | null>(null)
  const [contribAmount, setContribAmount] = useState<number>(0)
  const [contribDate, setContribDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [contribNote, setContribNote] = useState<string>('')
  const [syncToExpenses, setSyncToExpenses] = useState<boolean>(true)

  // Desplegables de historial
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({})

  const toggleHistory = (goalId: string) => {
    setExpandedHistories((prev) => ({ ...prev, [goalId]: !prev[goalId] }))
  }

  // Totales
  const stats = useMemo(() => {
    let totalTarget = 0
    let totalSaved = 0
    let completedGoals = 0

    goals.forEach((g) => {
      totalTarget += g.targetAmount
      totalSaved += g.currentAmount
      if (g.currentAmount >= g.targetAmount && g.targetAmount > 0) {
        completedGoals += 1
      }
    })

    const overallProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0

    return {
      totalGoals: goals.length,
      activeGoals: goals.length - completedGoals,
      completedGoals,
      totalSaved,
      totalTarget,
      overallProgress,
    }
  }, [goals])

  const openCreateGoal = () => {
    setEditingGoalId(null)
    setGoalForm({
      ...initialGoalForm,
      currency: defaultCurrency,
    })
    setGoalModalOpen(true)
  }

  const openEditGoal = (goal: SavingsGoal) => {
    setEditingGoalId(goal.id)
    setGoalForm({
      title: goal.title,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      currency: goal.currency || defaultCurrency,
      category: goal.category || 'Otro',
      targetDate: goal.targetDate || '',
      notes: goal.notes || '',
      createdAt: goal.createdAt,
      completed: goal.completed,
    })
    setGoalModalOpen(true)
  }

  const handleSaveGoal = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!goalForm.title.trim() || goalForm.targetAmount <= 0) return

    if (editingGoalId) {
      updateData((prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          savingsGoals: (prev.personal.savingsGoals ?? []).map((g) =>
            g.id === editingGoalId
              ? {
                  ...g,
                  ...goalForm,
                  title: goalForm.title.trim(),
                  notes: goalForm.notes?.trim() || undefined,
                  targetDate: goalForm.targetDate || undefined,
                }
              : g,
          ),
        },
      }))
    } else {
      const newGoal: SavingsGoal = {
        id: uuid(),
        ...goalForm,
        title: goalForm.title.trim(),
        notes: goalForm.notes?.trim() || undefined,
        targetDate: goalForm.targetDate || undefined,
        contributions:
          goalForm.currentAmount > 0
            ? [
                {
                  id: uuid(),
                  date: new Date().toISOString(),
                  amount: goalForm.currentAmount,
                  notes: 'Aporte inicial al crear meta',
                },
              ]
            : [],
      }

      updateData((prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          savingsGoals: [...(prev.personal.savingsGoals ?? []), newGoal],
        },
      }))
    }

    setGoalModalOpen(false)
  }

  const handleDeleteGoal = (goalId: string) => {
    updateData((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        savingsGoals: (prev.personal.savingsGoals ?? []).filter((g) => g.id !== goalId),
      },
    }))
    setDeletingGoal(null)
  }

  const openAddContribution = (goal: SavingsGoal) => {
    setSelectedGoalForContribution(goal)
    setContribAmount(0)
    setContribDate(new Date().toISOString().slice(0, 10))
    setContribNote('')
    setSyncToExpenses(true)
    setContributionModalOpen(true)
  }

  const handleSaveContribution = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedGoalForContribution || contribAmount <= 0) return

    const goalId = selectedGoalForContribution.id
    const contributionId = uuid()
    const isoDate = fromLocalDateOrDateTime(contribDate, true)

    updateData((prev) => {
      // 1. Actualizar meta de ahorro
      const nextGoals = (prev.personal.savingsGoals ?? []).map((g) => {
        if (g.id !== goalId) return g
        return {
          ...g,
          currentAmount: Number((g.currentAmount + contribAmount).toFixed(2)),
          contributions: [
            {
              id: contributionId,
              date: isoDate,
              amount: contribAmount,
              notes: contribNote.trim() || undefined,
            },
            ...g.contributions,
          ],
        }
      })

      // 2. Si se marcó sincronizar, crear egreso en finanzas
      let nextFinances = prev.personal.finances
      if (syncToExpenses) {
        const tx: FinanceTransaction = {
          id: uuid(),
          type: 'expense',
          amount: contribAmount,
          currency: selectedGoalForContribution.currency || defaultCurrency,
          category: 'Ahorro e Inversión',
          date: isoDate,
          description: `Aporte a meta: ${selectedGoalForContribution.title}${contribNote ? ` (${contribNote.trim()})` : ''}`,
          recurring: false,
        }
        nextFinances = [tx, ...nextFinances]
      }

      return {
        ...prev,
        personal: {
          ...prev.personal,
          savingsGoals: nextGoals,
          finances: nextFinances,
        },
      }
    })

    setContributionModalOpen(false)
  }

  const handleRemoveContribution = (goalId: string, contribId: string, amount: number) => {
    updateData((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        savingsGoals: (prev.personal.savingsGoals ?? []).map((g) => {
          if (g.id !== goalId) return g
          return {
            ...g,
            currentAmount: Math.max(0, Number((g.currentAmount - amount).toFixed(2))),
            contributions: g.contributions.filter((c) => c.id !== contribId),
          }
        }),
      },
    }))
  }

  return (
    <div className="section-body">
      {/* Resumen general */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-title">Metas activas</span>
          <span className="stat-value">{stats.activeGoals}</span>
          <span className="panel-subtitle">Cumplidas: {stats.completedGoals}</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Total Ahorrado</span>
          <span className="stat-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(stats.totalSaved, defaultCurrency)}
          </span>
          <span className="panel-subtitle">En todas las metas</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Objetivo Global</span>
          <span className="stat-value">
            {formatCurrency(stats.totalTarget, defaultCurrency)}
          </span>
          <span className="panel-subtitle">Progreso general: {stats.overallProgress}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <PiggyBank size={20} style={{ color: 'var(--color-accent-blue)' }} />
          Chanchito Digital — Metas de Ahorro
        </h3>
        <button
          type="button"
          className="primary-button"
          onClick={openCreateGoal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} />
          Nueva Meta de Ahorro
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="empty-state" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <PiggyBank size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <h4 style={{ margin: '0 0 0.5rem 0' }}>Todavía no tenés metas de ahorro creadas</h4>
          <p style={{ margin: '0 0 1rem 0', color: 'var(--color-text-secondary)', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            Definí tus objetivos financieros (un viaje, un fondo de emergencia, la compra de un auto) y registrá tus aportes progresivos.
          </p>
          <button type="button" className="primary-button" onClick={openCreateGoal}>
            Crear mi primera meta de ahorro
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {goals.map((goal) => {
            const progress = goal.targetAmount > 0
              ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
              : 0
            const isCompleted = goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0
            const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)

            let daysRemaining: number | null = null
            if (goal.targetDate) {
              const pDate = safeParseDate(goal.targetDate)
              if (pDate) {
                daysRemaining = differenceInCalendarDays(pDate, new Date())
              }
            }

            const isExpanded = Boolean(expandedHistories[goal.id])

            return (
              <div
                key={goal.id}
                className="panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderColor: isCompleted ? 'rgba(34, 197, 94, 0.4)' : undefined,
                  background: isCompleted
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.04) 0%, rgba(59, 130, 246, 0.04) 100%)'
                    : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                        {goal.category || 'Ahorro'}
                      </span>
                      {isCompleted && (
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          🏆 ¡Completada!
                        </span>
                      )}
                    </div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{goal.title}</h4>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ padding: '0.25rem 0.5rem' }}
                      onClick={() => openEditGoal(goal)}
                      title="Editar meta"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ padding: '0.25rem 0.5rem' }}
                      onClick={() => setDeletingGoal(goal)}
                      title="Eliminar meta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Importes y porcentaje */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-success)' }}>
                      {formatCurrency(goal.currentAmount, goal.currency || defaultCurrency)}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      de {formatCurrency(goal.targetAmount, goal.currency || defaultCurrency)} ({progress}%)
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  <div
                    style={{
                      height: '8px',
                      borderRadius: '999px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: isCompleted
                          ? 'var(--color-success)'
                          : 'linear-gradient(90deg, var(--color-accent-blue) 0%, var(--color-accent-cyan) 100%)',
                        borderRadius: '999px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Datos adicionales */}
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {!isCompleted && remaining > 0 && (
                    <div>
                      Faltan: <strong>{formatCurrency(remaining, goal.currency || defaultCurrency)}</strong>
                    </div>
                  )}
                  {goal.targetDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Calendar size={13} />
                      Objetivo: {formatDate(goal.targetDate)}
                      {daysRemaining !== null && (
                        <span style={{ color: daysRemaining < 0 ? 'var(--color-error)' : 'inherit' }}>
                          ({daysRemaining > 0 ? `${daysRemaining} días restantes` : daysRemaining === 0 ? '¡Hoy es la fecha!' : 'Vencida'})
                        </span>
                      )}
                    </div>
                  )}
                  {goal.notes && <div style={{ fontStyle: 'italic', marginTop: '0.2rem' }}>"{goal.notes}"</div>}
                </div>

                {/* Acciones de la meta */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => openAddContribution(goal)}
                    style={{ flex: 1, fontSize: '0.8125rem', padding: '0.35rem 0.6rem' }}
                  >
                    + Aportar ahorro
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => toggleHistory(goal.id)}
                    style={{ fontSize: '0.8125rem', padding: '0.35rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    Historial ({goal.contributions.length})
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Historial de aportes desplegable */}
                {isExpanded && (
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Aportes registrados
                    </span>
                    {goal.contributions.length === 0 ? (
                      <span style={{ color: 'var(--color-text-muted)' }}>Sin aportes aún.</span>
                    ) : (
                      goal.contributions.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            paddingBottom: '0.35rem',
                          }}
                        >
                          <div>
                            <strong>{formatCurrency(c.amount, goal.currency || defaultCurrency)}</strong>
                            <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.4rem' }}>
                              ({formatDate(c.date)})
                            </span>
                            {c.notes && <div style={{ color: 'var(--color-text-secondary)' }}>{c.notes}</div>}
                          </div>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                            onClick={() => handleRemoveContribution(goal.id, c.id, c.amount)}
                            title="Quitar aporte"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Crear / Editar Meta */}
      <Modal
        open={goalModalOpen}
        title={editingGoalId ? 'Editar Meta de Ahorro' : 'Nueva Meta de Ahorro'}
        onClose={() => setGoalModalOpen(false)}
      >
        <form className="form-grid" onSubmit={handleSaveGoal}>
          <div className="field">
            <label htmlFor="goal-title">Nombre de la meta</label>
            <input
              id="goal-title"
              value={goalForm.title}
              onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
              placeholder="Ej. Vacaciones Bariloche, Cambio de auto"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="goal-category">Categoría</label>
            <Select
              id="goal-category"
              value={goalForm.category || 'Otro'}
              onChange={(val) => setGoalForm({ ...goalForm, category: val })}
              options={GOAL_CATEGORIES.map((c) => ({ value: c, label: c }))}
              ariaLabel="Categoría de la meta"
            />
          </div>
          <div className="field">
            <label htmlFor="goal-target">Monto objetivo</label>
            <input
              id="goal-target"
              type="number"
              step="any"
              value={goalForm.targetAmount || ''}
              onChange={(e) => setGoalForm({ ...goalForm, targetAmount: Number(e.target.value) })}
              placeholder="0.00"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="goal-current">Monto actual ya ahorrado</label>
            <input
              id="goal-current"
              type="number"
              step="any"
              value={goalForm.currentAmount || ''}
              onChange={(e) => setGoalForm({ ...goalForm, currentAmount: Number(e.target.value) })}
              placeholder="0.00"
            />
          </div>
          <div className="field">
            <label htmlFor="goal-currency">Moneda</label>
            <Select
              id="goal-currency"
              value={goalForm.currency || defaultCurrency}
              onChange={(val) => setGoalForm({ ...goalForm, currency: val })}
              options={[
                { value: 'ARS', label: 'ARS ($ Pesos)' },
                { value: 'USD', label: 'USD (US$ Dólares)' },
                { value: 'EUR', label: 'EUR (€ Euros)' },
                { value: 'USDT', label: 'USDT (₮ Tether)' },
              ]}
              ariaLabel="Moneda de la meta"
            />
          </div>
          <div className="field">
            <label htmlFor="goal-date">Fecha límite estimada (opcional)</label>
            <DatePicker
              id="goal-date"
              value={goalForm.targetDate || ''}
              onChange={(val) => setGoalForm({ ...goalForm, targetDate: val })}
              ariaLabel="Fecha objetivo"
            />
          </div>
          <div className="field field-full">
            <label htmlFor="goal-notes">Notas o detalles</label>
            <textarea
              id="goal-notes"
              value={goalForm.notes || ''}
              onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })}
              placeholder="Estrategia de ahorro, plazos fijos, etc."
            />
          </div>
          <div className="form-actions field-full">
            <button type="button" className="secondary-button" onClick={() => setGoalModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              {editingGoalId ? 'Guardar Cambios' : 'Crear Meta'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Aporte */}
      <Modal
        open={contributionModalOpen}
        title={`Aportar a: ${selectedGoalForContribution?.title || 'Meta'}`}
        onClose={() => setContributionModalOpen(false)}
      >
        <form className="form-grid" onSubmit={handleSaveContribution}>
          <div className="field">
            <label htmlFor="contrib-amount">
              Monto a aportar ({selectedGoalForContribution?.currency || defaultCurrency})
            </label>
            <input
              id="contrib-amount"
              type="number"
              step="any"
              value={contribAmount || ''}
              onChange={(e) => setContribAmount(Number(e.target.value))}
              placeholder="0.00"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="contrib-date">Fecha del aporte</label>
            <DatePicker
              id="contrib-date"
              value={contribDate}
              onChange={(val) => setContribDate(val)}
              ariaLabel="Fecha del aporte"
            />
          </div>
          <div className="field field-full">
            <label htmlFor="contrib-note">Nota / Origen del dinero</label>
            <input
              id="contrib-note"
              value={contribNote}
              onChange={(e) => setContribNote(e.target.value)}
              placeholder="Ej. Sueldo, aguinaldo, venta de bicicleta"
            />
          </div>
          <div className="field field-full">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={syncToExpenses}
                onChange={(e) => setSyncToExpenses(e.target.checked)}
              />
              <span>
                💸 Registrar automáticamente como egreso en Movimientos (Categoría: <strong>Ahorro e Inversión</strong>)
              </span>
            </label>
          </div>
          <div className="form-actions field-full">
            <button type="button" className="secondary-button" onClick={() => setContributionModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Confirmar Aporte
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmar Eliminación */}
      <ConfirmModal
        open={Boolean(deletingGoal)}
        title="Eliminar Meta de Ahorro"
        message={
          deletingGoal
            ? `¿Seguro que querés eliminar la meta "${deletingGoal.title}" con un ahorro acumulado de ${formatCurrency(deletingGoal.currentAmount, deletingGoal.currency || defaultCurrency)}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar Meta"
        onConfirm={() => {
          if (deletingGoal) {
            handleDeleteGoal(deletingGoal.id)
          }
        }}
        onClose={() => setDeletingGoal(null)}
      />
    </div>
  )
}
