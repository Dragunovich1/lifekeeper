import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import {
  Building2,
  User,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Percent,
  Coins,
} from 'lucide-react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import { usePreferences } from '../../preferences/context'
import type { DebtDebtorType, DebtDirection, DebtEntry, DebtPayment, DebtStatus } from '../../types'
import {
  formatCurrencyNoCents,
  formatDate,
  fromLocalDateOrDateTime,
  toLocalDateKey,
} from '../../utils/dates'

interface DebtFormState {
  title: string
  counterparty: string
  debtorType: DebtDebtorType
  direction: DebtDirection
  totalAmount: number
  currency: string
  installments?: number
  paidInstallments?: number
  dueDate?: string
  notes?: string
}

const createInitialDebtForm = (defaultCurrency = 'ARS'): DebtFormState => ({
  title: '',
  counterparty: '',
  debtorType: 'entidad',
  direction: 'por_pagar',
  totalAmount: 0,
  currency: defaultCurrency,
  installments: undefined,
  paidInstallments: 0,
  dueDate: '',
  notes: '',
})

export const DebtsSection = () => {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const baseCurrency = preferences.currency || 'ARS'

  const debts = useMemo(() => data.personal.debts ?? [], [data.personal.debts])

  const [filterType, setFilterType] = useState<
    'all' | 'entidad' | 'persona' | 'por_pagar' | 'por_cobrar' | 'cancelada'
  >('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<DebtFormState>(() => createInitialDebtForm(baseCurrency))

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [payingDebt, setPayingDebt] = useState<DebtEntry | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [paymentDate, setPaymentDate] = useState<string>(() => toLocalDateKey(new Date()))
  const [paymentNotes, setPaymentNotes] = useState<string>('')

  const [deletingDebt, setDeletingDebt] = useState<DebtEntry | null>(null)
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null)

  // Cálculos consolidados
  const {
    totalOwed,
    totalReceivable,
    totalPaidOverall,
    globalProgressPercent,
    entityCount,
    personCount,
  } = useMemo(() => {
    let owed = 0
    let receivable = 0
    let paid = 0
    let entities = 0
    let persons = 0

    debts.forEach((d) => {
      const paidInDebt = d.payments.reduce((acc, p) => acc + p.amount, 0)
      const remaining = Math.max(0, d.totalAmount - paidInDebt)

      if (d.debtorType === 'entidad') entities++
      else persons++

      paid += paidInDebt

      if (d.status !== 'cancelada') {
        if (d.direction === 'por_pagar') {
          owed += remaining
        } else {
          receivable += remaining
        }
      }
    })

    const totalVolume = owed + paid
    const progress = totalVolume > 0 ? Math.round((paid / totalVolume) * 100) : 100

    return {
      totalOwed: owed,
      totalReceivable: receivable,
      totalPaidOverall: paid,
      globalProgressPercent: progress,
      entityCount: entities,
      personCount: persons,
    }
  }, [debts])

  // Filtrado de deudas
  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      if (filterType === 'all') return true
      if (filterType === 'cancelada') return d.status === 'cancelada'
      if (d.status === 'cancelada') return false
      if (filterType === 'entidad') return d.debtorType === 'entidad'
      if (filterType === 'persona') return d.debtorType === 'persona'
      if (filterType === 'por_pagar') return d.direction === 'por_pagar'
      if (filterType === 'por_cobrar') return d.direction === 'por_cobrar'
      return true
    })
  }, [debts, filterType])

  const openCreateModal = () => {
    setEditingId(null)
    setFormState(createInitialDebtForm(baseCurrency))
    setModalOpen(true)
  }

  const openEditModal = (debt: DebtEntry) => {
    setEditingId(debt.id)
    setFormState({
      title: debt.title,
      counterparty: debt.counterparty,
      debtorType: debt.debtorType,
      direction: debt.direction,
      totalAmount: debt.totalAmount,
      currency: debt.currency,
      installments: debt.installments,
      paidInstallments: debt.paidInstallments ?? 0,
      dueDate: debt.dueDate ?? '',
      notes: debt.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSaveDebt = (e: FormEvent) => {
    e.preventDefault()
    if (!formState.title.trim() || !formState.counterparty.trim() || formState.totalAmount <= 0) {
      return
    }

    if (editingId) {
      updateData((prev) => {
        const list: DebtEntry[] = (prev.personal.debts ?? []).map((d) => {
          if (d.id !== editingId) return d
          const paidTotal = d.payments.reduce((acc, p) => acc + p.amount, 0)
          const newStatus: DebtStatus =
            paidTotal >= formState.totalAmount
              ? 'cancelada'
              : paidTotal > 0
              ? 'parcial'
              : 'pendiente'

          const updated: DebtEntry = {
            ...d,
            title: formState.title.trim(),
            counterparty: formState.counterparty.trim(),
            debtorType: formState.debtorType,
            direction: formState.direction,
            totalAmount: Number(formState.totalAmount),
            currency: formState.currency || baseCurrency,
            installments: formState.installments ? Number(formState.installments) : undefined,
            paidInstallments: formState.paidInstallments ? Number(formState.paidInstallments) : 0,
            dueDate: formState.dueDate ? fromLocalDateOrDateTime(formState.dueDate) : undefined,
            notes: formState.notes?.trim() || undefined,
            status: newStatus,
          }
          return updated
        })
        return {
          ...prev,
          personal: {
            ...prev.personal,
            debts: list,
          },
        }
      })
    } else {
      const newDebt: DebtEntry = {
        id: uuid(),
        title: formState.title.trim(),
        counterparty: formState.counterparty.trim(),
        debtorType: formState.debtorType,
        direction: formState.direction,
        totalAmount: Number(formState.totalAmount),
        currency: formState.currency || baseCurrency,
        installments: formState.installments ? Number(formState.installments) : undefined,
        paidInstallments: formState.paidInstallments ? Number(formState.paidInstallments) : 0,
        dueDate: formState.dueDate ? fromLocalDateOrDateTime(formState.dueDate) : undefined,
        status: 'pendiente',
        payments: [],
        notes: formState.notes?.trim() || undefined,
        createdAt: new Date().toISOString(),
      }

      updateData((prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          debts: [newDebt, ...(prev.personal.debts ?? [])],
        },
      }))
    }

    setModalOpen(false)
  }

  const handleDeleteDebt = (id: string) => {
    updateData((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        debts: (prev.personal.debts ?? []).filter((d) => d.id !== id),
      },
    }))
    setDeletingDebt(null)
  }

  const openPaymentModal = (debt: DebtEntry) => {
    const paid = debt.payments.reduce((acc, p) => acc + p.amount, 0)
    const remaining = Math.max(0, debt.totalAmount - paid)
    setPayingDebt(debt)
    setPaymentAmount(remaining > 0 ? remaining : debt.totalAmount)
    setPaymentDate(toLocalDateKey(new Date()))
    setPaymentNotes('')
    setPaymentModalOpen(true)
  }

  const handleRegisterPayment = (e: FormEvent) => {
    e.preventDefault()
    if (!payingDebt || paymentAmount <= 0) return

    const newPayment: DebtPayment = {
      id: uuid(),
      date: paymentDate,
      amount: Number(paymentAmount),
      notes: paymentNotes.trim() || undefined,
    }

    updateData((prev) => {
      const list: DebtEntry[] = (prev.personal.debts ?? []).map((d) => {
        if (d.id !== payingDebt.id) return d

        const nextPayments = [newPayment, ...d.payments]
        const nextPaidTotal = nextPayments.reduce((acc, p) => acc + p.amount, 0)
        const isSettled = nextPaidTotal >= d.totalAmount

        const nextPaidInstallments =
          d.installments && d.paidInstallments !== undefined
            ? Math.min(d.installments, d.paidInstallments + 1)
            : d.paidInstallments

        const nextStatus: DebtStatus = isSettled ? 'cancelada' : 'parcial'

        const updated: DebtEntry = {
          ...d,
          payments: nextPayments,
          paidInstallments: nextPaidInstallments,
          status: nextStatus,
        }
        return updated
      })

      return {
        ...prev,
        personal: {
          ...prev.personal,
          debts: list,
        },
      }
    })

    setPaymentModalOpen(false)
    setPayingDebt(null)
  }

  const handleMarkSettled = (debt: DebtEntry) => {
    const paid = debt.payments.reduce((acc, p) => acc + p.amount, 0)
    const remaining = Math.max(0, debt.totalAmount - paid)

    updateData((prev) => {
      const list = (prev.personal.debts ?? []).map((d) => {
        if (d.id !== debt.id) return d

        let nextPayments = [...d.payments]
        if (remaining > 0) {
          nextPayments.unshift({
            id: uuid(),
            date: toLocalDateKey(new Date()),
            amount: remaining,
            notes: 'Cancelación total anticipada',
          })
        }

        return {
          ...d,
          payments: nextPayments,
          paidInstallments: d.installments ?? d.paidInstallments,
          status: 'cancelada' as const,
        }
      })

      return {
        ...prev,
        personal: {
          ...prev.personal,
          debts: list,
        },
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Tarjetas de Resumen Global */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-error)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-title">Total adeudado (Pasivos)</span>
            <ArrowDownLeft size={18} style={{ color: 'var(--color-error)' }} />
          </div>
          <span className="stat-value" style={{ color: 'var(--color-error)' }}>
            {formatCurrencyNoCents(totalOwed, baseCurrency)}
          </span>
          <span className="panel-subtitle">Lo que tenés pendiente por pagar</span>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-title">Total por cobrar (Activos)</span>
            <ArrowUpRight size={18} style={{ color: 'var(--color-success)' }} />
          </div>
          <span className="stat-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrencyNoCents(totalReceivable, baseCurrency)}
          </span>
          <span className="panel-subtitle">Dinero que te adeudan terceros</span>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-accent-blue)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-title">Total amortizado / cancelado</span>
            <Coins size={18} style={{ color: 'var(--color-accent-blue)' }} />
          </div>
          <span className="stat-value">
            {formatCurrencyNoCents(totalPaidOverall, baseCurrency)}
          </span>
          <span className="panel-subtitle">Pagos y cancelaciones acumuladas</span>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-accent-cyan)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-title">Amortización global</span>
            <Percent size={18} style={{ color: 'var(--color-accent-cyan)' }} />
          </div>
          <span className="stat-value">{globalProgressPercent}%</span>
          <div
            style={{
              width: '100%',
              height: '6px',
              background: 'var(--color-bg-secondary)',
              borderRadius: '999px',
              overflow: 'hidden',
              marginTop: '0.4rem',
            }}
          >
            <div
              style={{
                width: `${globalProgressPercent}%`,
                height: '100%',
                background: 'var(--color-accent-cyan)',
                borderRadius: '999px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Acción Nueva Deuda */}
      <div
        className="panel"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.875rem 1.25rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className={filterType === 'all' ? 'primary-button' : 'secondary-button'}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setFilterType('all')}
          >
            Todas ({debts.length})
          </button>
          <button
            type="button"
            className={filterType === 'entidad' ? 'primary-button' : 'secondary-button'}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setFilterType('entidad')}
          >
            <Building2 size={14} style={{ marginRight: '0.35rem', verticalAlign: 'text-bottom' }} />
            Entidades ({entityCount})
          </button>
          <button
            type="button"
            className={filterType === 'persona' ? 'primary-button' : 'secondary-button'}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setFilterType('persona')}
          >
            <User size={14} style={{ marginRight: '0.35rem', verticalAlign: 'text-bottom' }} />
            Personas físicas ({personCount})
          </button>
          <button
            type="button"
            className={filterType === 'por_pagar' ? 'primary-button' : 'secondary-button'}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setFilterType('por_pagar')}
          >
            🔴 Por pagar
          </button>
          <button
            type="button"
            className={filterType === 'por_cobrar' ? 'primary-button' : 'secondary-button'}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setFilterType('por_cobrar')}
          >
            🟢 Por cobrar
          </button>
          <button
            type="button"
            className={filterType === 'cancelada' ? 'primary-button' : 'secondary-button'}
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setFilterType('cancelada')}
          >
            ✅ Canceladas
          </button>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={openCreateModal}
          style={{ whiteSpace: 'nowrap' }}
        >
          <Plus size={16} style={{ marginRight: '0.35rem' }} />
          Nueva Deuda / Préstamo
        </button>
      </div>

      {/* Listado de Deudas */}
      {filteredDebts.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <Coins size={44} style={{ color: 'var(--color-text-muted)', margin: '0 auto 1rem' }} />
          <h3 className="panel-title">No hay deudas ni préstamos en esta categoría</h3>
          <p className="panel-subtitle" style={{ maxWidth: '420px', margin: '0.5rem auto 1.5rem' }}>
            Registrá tus compromisos bancarios, tarjetas o préstamos con personas físicas para
            mantener el control exacto de tus finanzas.
          </p>
          <button type="button" className="primary-button" onClick={openCreateModal}>
            <Plus size={16} style={{ marginRight: '0.35rem' }} />
            Registrar mi primera deuda
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filteredDebts.map((debt) => {
            const paid = debt.payments.reduce((acc, p) => acc + p.amount, 0)
            const remaining = Math.max(0, debt.totalAmount - paid)
            const progress = Math.min(100, Math.round((paid / debt.totalAmount) * 100))
            const isSettled = debt.status === 'cancelada' || remaining <= 0
            const isExpanded = expandedDebtId === debt.id

            return (
              <div
                key={debt.id}
                className="panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.875rem',
                  borderTop: `4px solid ${
                    isSettled
                      ? 'var(--color-success)'
                      : debt.direction === 'por_pagar'
                      ? 'var(--color-error)'
                      : 'var(--color-accent-cyan)'
                  }`,
                  position: 'relative',
                }}
              >
                {/* Cabecera de la tarjeta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span
                        className="badge"
                        style={{
                          background: debt.debtorType === 'entidad' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                          color: debt.debtorType === 'entidad' ? 'var(--color-accent-blue)' : 'var(--color-accent-purple)',
                          fontSize: '0.725rem',
                          fontWeight: 600,
                        }}
                      >
                        {debt.debtorType === 'entidad' ? (
                          <>
                            <Building2 size={12} style={{ marginRight: '0.25rem', verticalAlign: 'text-bottom' }} />
                            Entidad
                          </>
                        ) : (
                          <>
                            <User size={12} style={{ marginRight: '0.25rem', verticalAlign: 'text-bottom' }} />
                            Persona física
                          </>
                        )}
                      </span>

                      <span
                        className="badge"
                        style={{
                          background: debt.direction === 'por_pagar' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: debt.direction === 'por_pagar' ? 'var(--color-error)' : 'var(--color-success)',
                          fontSize: '0.725rem',
                          fontWeight: 600,
                        }}
                      >
                        {debt.direction === 'por_pagar' ? '🔴 Por pagar (Debo)' : '🟢 Por cobrar'}
                      </span>

                      {isSettled ? (
                        <span className="badge badge-success" style={{ fontSize: '0.725rem' }}>
                          ✓ Cancelada
                        </span>
                      ) : progress > 0 ? (
                        <span className="badge badge-warning" style={{ fontSize: '0.725rem' }}>
                          En curso ({progress}%)
                        </span>
                      ) : (
                        <span className="badge" style={{ fontSize: '0.725rem' }}>
                          Pendiente
                        </span>
                      )}
                    </div>

                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {debt.title}
                    </h4>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                      {debt.debtorType === 'entidad' ? 'Institución:' : 'Acreedor/Deudor:'} <strong>{debt.counterparty}</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => openEditModal(debt)}
                      title="Editar"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setDeletingDebt(debt)}
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Métricas: Monto total, pagado y restante */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.5rem',
                    background: 'var(--color-bg-primary)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block' }}>Monto total</span>
                    <strong style={{ fontSize: '0.95rem' }}>
                      {formatCurrencyNoCents(debt.totalAmount, debt.currency)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block' }}>Cancelado</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--color-success)' }}>
                      {formatCurrencyNoCents(paid, debt.currency)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block' }}>Restante</span>
                    <strong
                      style={{
                        fontSize: '0.95rem',
                        color: isSettled ? 'var(--color-text-muted)' : debt.direction === 'por_pagar' ? 'var(--color-error)' : 'var(--color-accent-cyan)',
                      }}
                    >
                      {formatCurrencyNoCents(remaining, debt.currency)}
                    </strong>
                  </div>
                </div>

                {/* Barra de progreso de pago */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Progreso de cancelación</span>
                    <strong style={{ color: progress >= 100 ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                      {progress}%
                    </strong>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      background: 'var(--color-bg-secondary)',
                      borderRadius: '999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: isSettled
                          ? 'var(--color-success)'
                          : progress > 50
                          ? 'var(--color-accent-cyan)'
                          : 'var(--color-warning)',
                        borderRadius: '999px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Cuotas y Vencimiento */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {debt.installments ? (
                    <span>
                      📋 Cuotas: <strong>{debt.paidInstallments ?? 0} de {debt.installments}</strong>
                    </span>
                  ) : <span />}

                  {debt.dueDate ? (
                    <span>
                      ⏰ Vence: <strong>{formatDate(debt.dueDate)}</strong>
                    </span>
                  ) : null}
                </div>

                {debt.notes ? (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    "{debt.notes}"
                  </p>
                ) : null}

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '0.5rem' }}>
                  {!isSettled ? (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        style={{ flex: 1, fontSize: '0.8125rem', padding: '0.4rem 0.75rem' }}
                        onClick={() => openPaymentModal(debt)}
                      >
                        💰 Registrar Pago / Abono
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ fontSize: '0.8125rem', padding: '0.4rem 0.65rem' }}
                        onClick={() => handleMarkSettled(debt)}
                        title="Liquidar deuda al 100%"
                      >
                        ✓ Liquidar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                      disabled
                    >
                      <CheckCircle2 size={14} style={{ marginRight: '0.35rem', verticalAlign: 'text-bottom' }} />
                      Totalmente cancelada
                    </button>
                  )}

                  {debt.payments.length > 0 ? (
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.5rem' }}
                      onClick={() => setExpandedDebtId(isExpanded ? null : debt.id)}
                    >
                      {isExpanded ? 'Ocultar pagos' : `Ver pagos (${debt.payments.length})`}
                    </button>
                  ) : null}
                </div>

                {/* Historial desplegable de abonos */}
                {isExpanded && debt.payments.length > 0 ? (
                  <div
                    style={{
                      background: 'var(--color-bg-primary)',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      fontSize: '0.8rem',
                      marginTop: '0.35rem',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                      Historial de abonos registrados:
                    </span>
                    {debt.payments.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px dashed var(--color-border)',
                          paddingBottom: '0.25rem',
                        }}
                      >
                        <div>
                          <span>{formatDate(p.date)}</span>
                          {p.notes ? <span style={{ color: 'var(--color-text-muted)' }}> — {p.notes}</span> : null}
                        </div>
                        <strong style={{ color: 'var(--color-success)' }}>
                          +{formatCurrencyNoCents(p.amount, debt.currency)}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Crear / Editar Deuda */}
      {modalOpen ? (
        <Modal
          open={modalOpen}
          title={editingId ? 'Editar Deuda / Préstamo' : 'Nueva Deuda o Préstamo'}
          onClose={() => setModalOpen(false)}
        >
          <form className="form-grid" onSubmit={handleSaveDebt}>
            <div className="field">
              <label htmlFor="debt-title">Concepto / Título *</label>
              <input
                id="debt-title"
                value={formState.title}
                onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                placeholder="Ej. Tarjeta de Crédito, Préstamo coche"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="debt-counterparty">Entidad o Persona *</label>
              <input
                id="debt-counterparty"
                value={formState.counterparty}
                onChange={(e) => setFormState({ ...formState, counterparty: e.target.value })}
                placeholder="Ej. Banco Santander, Juan Pérez"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="debt-debtor-type">Tipo de contraparte</label>
              <Select
                id="debt-debtor-type"
                value={formState.debtorType}
                onChange={(val) => setFormState({ ...formState, debtorType: val as DebtDebtorType })}
                options={[
                  { value: 'entidad', label: '🏛️ Entidad (Banco, Tarjeta, Financiera)' },
                  { value: 'persona', label: '👤 Persona física (Amigo, Familiar, Tercero)' },
                ]}
              />
            </div>

            <div className="field">
              <label htmlFor="debt-direction">Dirección</label>
              <Select
                id="debt-direction"
                value={formState.direction}
                onChange={(val) => setFormState({ ...formState, direction: val as DebtDirection })}
                options={[
                  { value: 'por_pagar', label: '🔴 Por pagar (Yo debo dinero - Pasivo)' },
                  { value: 'por_cobrar', label: '🟢 Por cobrar (Me deben dinero - Activo)' },
                ]}
              />
            </div>

            <div className="field">
              <label htmlFor="debt-amount">Monto total *</label>
              <input
                id="debt-amount"
                type="number"
                step="any"
                min="1"
                value={formState.totalAmount || ''}
                onChange={(e) => setFormState({ ...formState, totalAmount: Number(e.target.value) })}
                placeholder="100000"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="debt-currency">Moneda</label>
              <Select
                id="debt-currency"
                value={formState.currency}
                onChange={(val) => setFormState({ ...formState, currency: val })}
                options={[
                  { value: 'ARS', label: 'ARS ($ Pesos)' },
                  { value: 'USD', label: 'USD (US$ Dólares)' },
                  { value: 'EUR', label: 'EUR (€ Euros)' },
                  { value: 'USDT', label: 'USDT (₮ Tether)' },
                  { value: 'BRL', label: 'BRL (R$ Reales)' },
                  { value: 'CLP', label: 'CLP ($ Pesos Chilenos)' },
                ]}
              />
            </div>

            <div className="field">
              <label htmlFor="debt-installments">Cuotas totales (opcional)</label>
              <input
                id="debt-installments"
                type="number"
                min="1"
                value={formState.installments || ''}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    installments: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="Ej. 12"
              />
            </div>

            <div className="field">
              <label htmlFor="debt-paid-installments">Cuotas ya pagadas</label>
              <input
                id="debt-paid-installments"
                type="number"
                min="0"
                value={formState.paidInstallments ?? 0}
                onChange={(e) => setFormState({ ...formState, paidInstallments: Number(e.target.value) })}
                placeholder="0"
              />
            </div>

            <div className="field">
              <label htmlFor="debt-due-date">Fecha de vencimiento (opcional)</label>
              <DatePicker
                id="debt-due-date"
                value={formState.dueDate || ''}
                onChange={(val) => setFormState({ ...formState, dueDate: val })}
              />
            </div>

            <div className="field field-full">
              <label htmlFor="debt-notes">Notas o comentarios</label>
              <textarea
                id="debt-notes"
                value={formState.notes || ''}
                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                placeholder="Detalles sobre tasas, plazos o contacto..."
                rows={2}
              />
            </div>

            <div className="form-actions field-full">
              <button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button" type="submit">
                {editingId ? 'Guardar Cambios' : 'Registrar Deuda'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Modal Registrar Pago / Abono */}
      {paymentModalOpen && payingDebt ? (
        <Modal
          open={paymentModalOpen}
          title={`Registrar Pago / Abono a "${payingDebt.title}"`}
          onClose={() => setPaymentModalOpen(false)}
        >
          <form className="form-grid" onSubmit={handleRegisterPayment}>
            <div className="field field-full">
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Contraparte: <strong>{payingDebt.counterparty}</strong> ({payingDebt.debtorType === 'entidad' ? 'Entidad' : 'Persona'})
              </span>
            </div>

            <div className="field">
              <label htmlFor="payment-amount">Monto del pago ({payingDebt.currency}) *</label>
              <input
                id="payment-amount"
                type="number"
                step="any"
                min="1"
                value={paymentAmount || ''}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="payment-date">Fecha del pago *</label>
              <DatePicker
                id="payment-date"
                value={paymentDate}
                onChange={(val) => setPaymentDate(val)}
              />
            </div>

            <div className="field field-full">
              <label htmlFor="payment-notes">Comentario o número de comprobante</label>
              <input
                id="payment-notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Ej. Transferencia bancaria #4819"
              />
            </div>

            <div className="form-actions field-full">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setPaymentModalOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary-button" type="submit">
                Confirmar Pago
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Modal Confirmar Eliminación */}
      {deletingDebt ? (
        <ConfirmModal
          open={Boolean(deletingDebt)}
          title="Eliminar Deuda / Préstamo"
          message={`¿Estás seguro de que querés eliminar el registro de "${deletingDebt.title}" con ${deletingDebt.counterparty}? Se borrará también su historial de pagos.`}
          confirmLabel="Eliminar"
          onConfirm={() => handleDeleteDebt(deletingDebt.id)}
          onClose={() => setDeletingDebt(null)}
        />
      ) : null}
    </div>
  )
}
