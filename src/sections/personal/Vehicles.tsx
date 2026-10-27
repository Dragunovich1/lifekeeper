import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import {
  Car,
  Fuel,
  Wrench,
  PhoneCall,
  Plus,
  Trash2,
  Edit3,
  Shield,
} from 'lucide-react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type {
  FinanceTransaction,
  Reminder,
  VehicleFuelLog,
  VehicleProfile,
  VehicleService,
} from '../../types'
import {
  formatDate,
  fromLocalDateOrDateTime,
} from '../../utils/dates'

type VehicleTab = 'garage' | 'fuel' | 'services'

const initialVehicleForm: Omit<VehicleProfile, 'id'> = {
  name: '',
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  licensePlate: '',
  vehicleType: 'auto',
  currentMileage: 0,
  insuranceCompany: '',
  insurancePolicyNumber: '',
  insuranceExpiryDate: '',
  insurancePhoneEmergency: '',
  vtvExpiryDate: '',
  licenseExpiryDate: '',
  notes: '',
  fuelLogs: [],
}

const initialServiceForm: Omit<VehicleService, 'id'> = {
  vehicleName: '',
  serviceType: '',
  date: new Date().toISOString(),
  cost: 0,
  mileage: undefined,
  nextServiceDate: undefined,
  nextServiceMileage: undefined,
  notes: '',
}

const initialFuelForm: Omit<VehicleFuelLog, 'id'> = {
  date: new Date().toISOString().slice(0, 10),
  mileage: 0,
  liters: 0,
  cost: 0,
  fuelType: 'nafta',
  notes: '',
}

export const VehiclesSection = () => {
  const { data, updateData } = useAppData()

  const [activeTab, setActiveTab] = useState<VehicleTab>('garage')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')

  // Modales Garaje
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [vehicleForm, setVehicleForm] = useState<Omit<VehicleProfile, 'id'>>(initialVehicleForm)
  const [deletingVehicle, setDeletingVehicle] = useState<VehicleProfile | null>(null)

  // Modales Services
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [serviceForm, setServiceForm] = useState<Omit<VehicleService, 'id'>>(initialServiceForm)
  const [deletingService, setDeletingService] = useState<VehicleService | null>(null)

  // Modales Combustible
  const [fuelModalOpen, setFuelModalOpen] = useState(false)
  const [fuelForm, setFuelForm] = useState<Omit<VehicleFuelLog, 'id'>>(initialFuelForm)
  const [syncFinanceGasto, setSyncFinanceGasto] = useState(true)

  const rawProfiles = data.personal.vehicleProfiles ?? []
  const services = data.personal.vehicles ?? []

  // Si no hay perfiles creados pero sí nombres en services, proveer perfiles virtuales
  const vehicleProfiles: VehicleProfile[] = useMemo(() => {
    if (rawProfiles.length > 0) return rawProfiles
    const names = Array.from(new Set(services.map((s) => s.vehicleName).filter(Boolean)))
    if (names.length === 0) return []
    return names.map((name) => ({
      id: `v-legacy-${name}`,
      name,
      brand: name.split(' ')[0] || name,
      model: name.split(' ').slice(1).join(' ') || 'Vehículo',
      vehicleType: 'auto',
      currentMileage: Math.max(...services.filter((s) => s.vehicleName === name).map((s) => s.mileage || 0), 0) || undefined,
      fuelLogs: [],
    }))
  }, [rawProfiles, services])

  // Vehículo actualmente seleccionado
  const currentVehicle: VehicleProfile | null = useMemo(() => {
    if (!vehicleProfiles.length) return null
    return vehicleProfiles.find((v) => v.id === selectedVehicleId) || vehicleProfiles[0]
  }, [vehicleProfiles, selectedVehicleId])

  // Services del vehículo seleccionado
  const vehicleServices = useMemo(() => {
    if (!currentVehicle) return []
    return services
      .filter((s) => s.vehicleName.toLowerCase() === currentVehicle.name.toLowerCase())
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [services, currentVehicle])

  // Cargas de combustible del vehículo seleccionado ordenadas por fecha/km
  const fuelLogs = useMemo(() => {
    if (!currentVehicle?.fuelLogs) return []
    return [...currentVehicle.fuelLogs].sort((a, b) => b.date.localeCompare(a.date))
  }, [currentVehicle])

  // Métricas de combustible y rendimiento
  const fuelMetrics = useMemo(() => {
    if (fuelLogs.length === 0) return { totalCost: 0, totalLiters: 0, avgKmPerLiter: 0, avgCostPerKm: 0 }
    const totalCost = fuelLogs.reduce((s, f) => s + f.cost, 0)
    const totalLiters = fuelLogs.reduce((s, f) => s + f.liters, 0)

    // Rendimiento entre primera y última carga
    let avgKmPerLiter = 0
    let avgCostPerKm = 0
    if (fuelLogs.length >= 2) {
      const sortedAsc = [...fuelLogs].sort((a, b) => a.mileage - b.mileage)
      const kmDelta = sortedAsc[sortedAsc.length - 1].mileage - sortedAsc[0].mileage
      const intermediateLiters = sortedAsc.slice(1).reduce((s, f) => s + f.liters, 0)
      if (kmDelta > 0 && intermediateLiters > 0) {
        avgKmPerLiter = kmDelta / intermediateLiters
        const intermediateCost = sortedAsc.slice(1).reduce((s, f) => s + f.cost, 0)
        avgCostPerKm = intermediateCost / kmDelta
      }
    }

    return { totalCost, totalLiters, avgKmPerLiter, avgCostPerKm }
  }, [fuelLogs])

  // Cálculo de estado de vencimiento (al día / por vencer en <30 días / vencido)
  const getExpiryStatus = (dateStr?: string) => {
    if (!dateStr) return { status: 'none', label: 'Sin registrar', color: 'var(--color-text-muted)' }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(dateStr + 'T00:00:00')
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { status: 'expired', label: `Vencido hace ${Math.abs(diffDays)} días`, color: '#ef4444' }
    }
    if (diffDays <= 30) {
      return { status: 'warning', label: `Vence en ${diffDays} días`, color: '#f59e0b' }
    }
    return { status: 'valid', label: `Al día (vence ${formatDate(dateStr)})`, color: '#10b981' }
  }

  // Guardar Vehículo (Crear o Editar)
  const handleSaveVehicle = (e: FormEvent) => {
    e.preventDefault()
    if (!vehicleForm.name.trim()) return

    if (editingVehicleId) {
      updateData((prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          vehicleProfiles: (prev.personal.vehicleProfiles ?? []).map((v) =>
            v.id === editingVehicleId ? { ...vehicleForm, id: editingVehicleId, fuelLogs: v.fuelLogs ?? [] } : v,
          ),
        },
      }))
    } else {
      const newV: VehicleProfile = {
        ...vehicleForm,
        id: `veh-${Date.now()}`,
        fuelLogs: [],
      }
      updateData((prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          vehicleProfiles: [newV, ...(prev.personal.vehicleProfiles ?? [])],
        },
      }))
      setSelectedVehicleId(newV.id)
    }

    setVehicleModalOpen(false)
    setEditingVehicleId(null)
    setVehicleForm(initialVehicleForm)
  }

  // Eliminar Vehículo
  const handleConfirmDeleteVehicle = () => {
    if (!deletingVehicle) return
    updateData((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        vehicleProfiles: (prev.personal.vehicleProfiles ?? []).filter((v) => v.id !== deletingVehicle.id),
      },
    }))
    setDeletingVehicle(null)
    setSelectedVehicleId('')
  }

  // Guardar Carga de Combustible
  const handleSaveFuel = (e: FormEvent) => {
    e.preventDefault()
    if (!currentVehicle || fuelForm.liters <= 0 || fuelForm.cost <= 0) return

    const newLog: VehicleFuelLog = {
      ...fuelForm,
      id: `fuel-${Date.now()}`,
    }

    // Actualizar odómetro del vehículo si el kilometraje cargado es mayor
    const updatedMileage = Math.max(currentVehicle.currentMileage || 0, fuelForm.mileage)

    updateData((prev) => {
      const profiles = (prev.personal.vehicleProfiles ?? []).map((v) => {
        if (v.id !== currentVehicle.id) return v
        return {
          ...v,
          currentMileage: updatedMileage,
          fuelLogs: [newLog, ...(v.fuelLogs ?? [])],
        }
      })

      // Sincronización opcional con Finanzas
      let finances = prev.personal.finances ?? []
      if (syncFinanceGasto) {
        const newTx: FinanceTransaction = {
          id: `tx-fuel-${Date.now()}`,
          type: 'expense',
          amount: fuelForm.cost,
          category: 'Transporte',
          description: `Combustible (${fuelForm.liters}L ${fuelForm.fuelType || 'nafta'}) - ${currentVehicle.name}`,
          date: fuelForm.date,
        }
        finances = [newTx, ...finances]
      }

      return {
        ...prev,
        personal: {
          ...prev.personal,
          vehicleProfiles: profiles,
          finances,
        },
      }
    })

    setFuelModalOpen(false)
    setFuelForm({
      date: new Date().toISOString().slice(0, 10),
      mileage: updatedMileage,
      liters: 0,
      cost: 0,
      fuelType: 'nafta',
      notes: '',
    })
  }

  // Eliminar Carga de Combustible
  const handleDeleteFuel = (logId: string) => {
    if (!currentVehicle) return
    updateData((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        vehicleProfiles: (prev.personal.vehicleProfiles ?? []).map((v) => {
          if (v.id !== currentVehicle.id) return v
          return {
            ...v,
            fuelLogs: (v.fuelLogs ?? []).filter((l) => l.id !== logId),
          }
        }),
      },
    }))
  }

  // Guardar Service
  const handleSaveService = (e: FormEvent) => {
    e.preventDefault()
    if (!serviceForm.serviceType.trim() || !currentVehicle) return

    const normalizedDate = fromLocalDateOrDateTime(serviceForm.date, true)
    const normalizedNextDate = serviceForm.nextServiceDate
      ? fromLocalDateOrDateTime(serviceForm.nextServiceDate, false) || undefined
      : undefined

    const entry: VehicleService = {
      ...serviceForm,
      id: editingServiceId || `srv-${Date.now()}`,
      vehicleName: currentVehicle.name,
      date: normalizedDate,
      cost: Number(serviceForm.cost),
      mileage: serviceForm.mileage ? Number(serviceForm.mileage) : undefined,
      nextServiceDate: normalizedNextDate,
      nextServiceMileage: serviceForm.nextServiceMileage ? Number(serviceForm.nextServiceMileage) : undefined,
    }

    updateData((prev) => {
      let currentServices = prev.personal.vehicles ?? []
      if (editingServiceId) {
        currentServices = currentServices.map((s) => (s.id === editingServiceId ? entry : s))
      } else {
        currentServices = [entry, ...currentServices]
      }

      // Sincronizar recordatorio
      const reminders = prev.utilities.reminders ?? []
      const withoutCurrent = reminders.filter(
        (rem) => !(rem.sourceType === 'vehicle' && rem.sourceId === entry.id),
      )
      let updatedReminders = withoutCurrent
      if (entry.nextServiceDate) {
        const reminderEntry: Reminder = {
          id: uuid(),
          title: `Próximo service: ${entry.vehicleName} (${entry.serviceType})`,
          details: [
            entry.nextServiceMileage ? `A los ${entry.nextServiceMileage.toLocaleString('es-AR')} km` : '',
            entry.notes ?? '',
          ]
            .filter(Boolean)
            .join(' · '),
          dateTime: entry.nextServiceDate,
          category: 'personal',
          done: false,
          sourceId: entry.id,
          sourceType: 'vehicle',
        }
        updatedReminders = [reminderEntry, ...withoutCurrent]
      }

      return {
        ...prev,
        personal: {
          ...prev.personal,
          vehicles: currentServices,
        },
        utilities: {
          ...prev.utilities,
          reminders: updatedReminders,
        },
      }
    })

    setServiceModalOpen(false)
    setEditingServiceId(null)
    setServiceForm(initialServiceForm)
  }

  // Eliminar Service
  const handleConfirmDeleteService = () => {
    if (!deletingService) return
    updateData((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        vehicles: (prev.personal.vehicles ?? []).filter((s) => s.id !== deletingService.id),
      },
      utilities: {
        ...prev.utilities,
        reminders: (prev.utilities.reminders ?? []).filter(
          (rem) => !(rem.sourceType === 'vehicle' && rem.sourceId === deletingService.id),
        ),
      },
    }))
    setDeletingService(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      <SectionHeader
        title="Garaje & Mantenimiento Vehicular"
        subtitle="Ficha técnica, seguro, VTV, calculadora de combustible y registro de services mecánicos."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {vehicleProfiles.length > 0 && (
              <select
                value={currentVehicle?.id || ''}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '10px',
                  background: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {vehicleProfiles.map((v) => (
                  <option key={v.id} value={v.id}>
                    🚗 {v.name} {v.licensePlate ? `(${v.licensePlate})` : ''}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setEditingVehicleId(null)
                setVehicleForm(initialVehicleForm)
                setVehicleModalOpen(true)
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
            >
              <Plus size={15} />
              <span>Nuevo Vehículo</span>
            </button>
          </div>
        }
      />

      {/* Selector de Pestañas */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('garage')}
          className={activeTab === 'garage' ? 'primary-button' : 'secondary-button'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
        >
          <Car size={15} />
          <span>Ficha & Vencimientos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fuel')}
          className={activeTab === 'fuel' ? 'primary-button' : 'secondary-button'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
        >
          <Fuel size={15} />
          <span>Combustible & Rendimiento</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('services')}
          className={activeTab === 'services' ? 'primary-button' : 'secondary-button'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
        >
          <Wrench size={15} />
          <span>Historial de Services ({vehicleServices.length})</span>
        </button>
      </div>

      {/* Si no hay vehículos registrados */}
      {vehicleProfiles.length === 0 ? (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            borderRadius: '16px',
            background: 'var(--color-surface-sunken)',
            border: '1.5px dashed var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <Car size={48} color="var(--color-accent-blue)" style={{ opacity: 0.8 }} />
          <div>
            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem' }}>Tu Garaje está vacío</h3>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem', maxWidth: '420px' }}>
              Cargá tu auto, moto o camioneta para hacer seguimiento del seguro, vencimiento de VTV, consumos de nafta y services de taller.
            </p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setEditingVehicleId(null)
              setVehicleForm(initialVehicleForm)
              setVehicleModalOpen(true)
            }}
          >
            <Plus size={16} />
            <span>Agregar mi primer vehículo</span>
          </button>
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* PESTAÑA 1: GARAGE, FICHA TÉCNICA & VENCIMIENTOS LEGALES */}
          {/* ============================================================== */}
          {activeTab === 'garage' && currentVehicle && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Tarjeta de Auxilio SOS y Grúa */}
              {currentVehicle.insurancePhoneEmergency && (
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(249, 115, 22, 0.12))',
                    border: '1.5px solid rgba(239, 68, 68, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ef4444',
                        flexShrink: 0,
                      }}
                    >
                      <PhoneCall size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ef4444' }}>
                        Auxilio Mecánico & Grúa 24hs
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        {currentVehicle.insuranceCompany ? `${currentVehicle.insuranceCompany} · ` : ''}
                        Póliza: <strong>{currentVehicle.insurancePolicyNumber || 'Sin número'}</strong>
                      </div>
                    </div>
                  </div>

                  <a
                    href={`tel:${currentVehicle.insurancePhoneEmergency}`}
                    className="primary-button"
                    style={{
                      background: '#ef4444',
                      borderColor: '#ef4444',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontWeight: 600,
                    }}
                  >
                    <PhoneCall size={16} />
                    <span>Llamar {currentVehicle.insurancePhoneEmergency}</span>
                  </a>
                </div>
              )}

              {/* Ficha Principal con Datos Técnicos */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem',
                }}
              >
                {/* Caja Datos Técnicos */}
                <div
                  style={{
                    padding: '1.25rem',
                    borderRadius: '14px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Car size={18} color="var(--color-accent-cyan)" />
                      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{currentVehicle.name}</h4>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVehicleId(currentVehicle.id)
                          setVehicleForm(currentVehicle)
                          setVehicleModalOpen(true)
                        }}
                        className="pref-modal-action-btn"
                        title="Editar vehículo"
                        style={{ width: '30px', height: '30px' }}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingVehicle(currentVehicle)}
                        className="pref-modal-action-btn"
                        title="Eliminar vehículo"
                        style={{ width: '30px', height: '30px', color: '#ef4444' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Marca / Modelo:</span>
                      <div style={{ fontWeight: 600 }}>{currentVehicle.brand} {currentVehicle.model}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Año:</span>
                      <div style={{ fontWeight: 600 }}>{currentVehicle.year || 'N/A'}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Patente / Dominio:</span>
                      <div style={{ fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-accent-cyan)' }}>
                        {currentVehicle.licensePlate || 'Sin registrar'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Odómetro actual:</span>
                      <div style={{ fontWeight: 700 }}>
                        {currentVehicle.currentMileage ? `${currentVehicle.currentMileage.toLocaleString('es-AR')} km` : 'Sin registrar'}
                      </div>
                    </div>
                  </div>

                  {currentVehicle.notes && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', background: 'var(--color-surface-sunken)', padding: '0.6rem', borderRadius: '8px' }}>
                      {currentVehicle.notes}
                    </div>
                  )}
                </div>

                {/* Caja Semáforo de Vencimientos Legales */}
                <div
                  style={{
                    padding: '1.25rem',
                    borderRadius: '14px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={18} color="var(--color-accent-blue)" />
                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Vencimientos & Documentación</h4>
                  </div>

                  {/* Vencimiento Seguro */}
                  {(() => {
                    const status = getExpiryStatus(currentVehicle.insuranceExpiryDate)
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                        <div>
                          <strong>🛡️ Póliza de Seguro</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            {currentVehicle.insuranceCompany || 'Compañía sin asignar'}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: status.color }}>
                          {status.label}
                        </span>
                      </div>
                    )
                  })()}

                  {/* Vencimiento VTV / RTO */}
                  {(() => {
                    const status = getExpiryStatus(currentVehicle.vtvExpiryDate)
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                        <div>
                          <strong>🔍 VTV / RTO / ITV</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Inspección técnica</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: status.color }}>
                          {status.label}
                        </span>
                      </div>
                    )
                  })()}

                  {/* Vencimiento Registro de Conducir */}
                  {(() => {
                    const status = getExpiryStatus(currentVehicle.licenseExpiryDate)
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '0.5rem 0' }}>
                        <div>
                          <strong>📄 Licencia de Conducir</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Habilitación municipal</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: status.color }}>
                          {status.label}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 2: COMBUSTIBLE & RENDIMIENTO (KM/L) */}
          {/* ============================================================== */}
          {activeTab === 'fuel' && currentVehicle && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Tarjetas de Métricas de Combustible */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Rendimiento Promedio</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-accent-cyan)', marginTop: '0.25rem' }}>
                    {fuelMetrics.avgKmPerLiter > 0 ? `${fuelMetrics.avgKmPerLiter.toFixed(1)} km/L` : '---'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {fuelMetrics.avgKmPerLiter > 0 ? `~(${(100 / fuelMetrics.avgKmPerLiter).toFixed(1)} L/100km)` : 'Requiere al menos 2 cargas'}
                  </span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Costo por Kilómetro</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>
                    {fuelMetrics.avgCostPerKm > 0 ? `$ ${fuelMetrics.avgCostPerKm.toFixed(0)}/km` : '---'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    Según consumo promedio
                  </span>
                </div>

                <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Gasto Total en Combustible</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-accent-blue)', marginTop: '0.25rem' }}>
                    $ {fuelMetrics.totalCost.toLocaleString('es-AR')}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {fuelMetrics.totalLiters.toFixed(0)} Litros cargados
                  </span>
                </div>
              </div>

              {/* Botón para Registrar Carga */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Historial de Cargas de Nafta / Combustible</h4>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setFuelForm({
                      date: new Date().toISOString().slice(0, 10),
                      mileage: currentVehicle.currentMileage || 0,
                      liters: 0,
                      cost: 0,
                      fuelType: 'nafta',
                      notes: '',
                    })
                    setFuelModalOpen(true)
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                >
                  <Plus size={15} />
                  <span>Anotar Carga</span>
                </button>
              </div>

              {/* Lista de Cargas */}
              {fuelLogs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', background: 'var(--color-surface-sunken)', borderRadius: '12px' }}>
                  No tenés cargas de combustible anotadas para este vehículo.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {fuelLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '0.85rem 1.15rem',
                        borderRadius: '10px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(14, 165, 233, 0.15)',
                            color: 'var(--color-accent-cyan)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Fuel size={17} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                            {log.liters} Litros ({log.fuelType?.toUpperCase() || 'NAFTA'})
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {formatDate(log.date)} · Odómetro: {log.mileage.toLocaleString('es-AR')} km
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            $ {log.cost.toLocaleString('es-AR')}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            $ {(log.cost / (log.liters || 1)).toFixed(0)}/L
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteFuel(log.id)}
                          className="pref-modal-action-btn"
                          title="Eliminar carga"
                          style={{ width: '28px', height: '28px', color: '#ef4444' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 3: SERVICES & HISTORIAL DE TALLER */}
          {/* ============================================================== */}
          {activeTab === 'services' && currentVehicle && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Mantenimientos de {currentVehicle.name}</h4>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setEditingServiceId(null)
                    setServiceForm({
                      ...initialServiceForm,
                      vehicleName: currentVehicle.name,
                      mileage: currentVehicle.currentMileage,
                    })
                    setServiceModalOpen(true)
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                >
                  <Plus size={15} />
                  <span>Registrar Service</span>
                </button>
              </div>

              {vehicleServices.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', background: 'var(--color-surface-sunken)', borderRadius: '12px' }}>
                  Aún no registraste mantenimientos ni services para este vehículo.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {vehicleServices.map((service) => (
                    <div
                      key={service.id}
                      style={{
                        padding: '1rem 1.25rem',
                        borderRadius: '12px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: 'var(--color-accent-blue)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Wrench size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{service.serviceType}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {formatDate(service.date)} · {service.mileage ? `${service.mileage.toLocaleString('es-AR')} km` : 'Sin km'}
                          </div>
                          {service.nextServiceDate && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-accent-cyan)', marginTop: '0.2rem' }}>
                              Próximo: {formatDate(service.nextServiceDate)}
                              {service.nextServiceMileage ? ` o a los ${service.nextServiceMileage.toLocaleString('es-AR')} km` : ''}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                          $ {service.cost.toLocaleString('es-AR')}
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingServiceId(service.id)
                              setServiceForm({
                                vehicleName: service.vehicleName,
                                serviceType: service.serviceType,
                                date: service.date,
                                cost: service.cost,
                                mileage: service.mileage,
                                nextServiceDate: service.nextServiceDate,
                                nextServiceMileage: service.nextServiceMileage,
                                notes: service.notes ?? '',
                              })
                              setServiceModalOpen(true)
                            }}
                            className="pref-modal-action-btn"
                            title="Editar service"
                            style={{ width: '30px', height: '30px' }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingService(service)}
                            className="pref-modal-action-btn"
                            title="Eliminar service"
                            style={{ width: '30px', height: '30px', color: '#ef4444' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL: REGISTRAR / EDITAR VEHÍCULO */}
      <Modal
        open={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        title={editingVehicleId ? 'Editar Vehículo' : 'Nuevo Vehículo'}
        subtitle="Datos técnicos, seguro y vencimientos legales."
      >
        <form onSubmit={handleSaveVehicle} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              <span>Nombre Identificador *</span>
              <input
                type="text"
                className="form-input"
                required
                placeholder="Ej. Toyota Corolla de Papá"
                value={vehicleForm.name}
                onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
              />
            </label>

            <label className="form-label">
              <span>Tipo de Vehículo</span>
              <select
                className="form-input"
                value={vehicleForm.vehicleType}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleType: e.target.value as any })}
              >
                <option value="auto">🚗 Automóvil</option>
                <option value="moto">🏍️ Motocicleta</option>
                <option value="camioneta">🚙 Camioneta / Pickup</option>
                <option value="otro">🚐 Otro</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              <span>Marca</span>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Ford"
                value={vehicleForm.brand}
                onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
              />
            </label>
            <label className="form-label">
              <span>Modelo</span>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Focus"
                value={vehicleForm.model}
                onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
              />
            </label>
            <label className="form-label">
              <span>Año</span>
              <input
                type="number"
                className="form-input"
                value={vehicleForm.year || ''}
                onChange={(e) => setVehicleForm({ ...vehicleForm, year: parseInt(e.target.value) || undefined })}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              <span>Patente / Dominio</span>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. AB 123 CD"
                value={vehicleForm.licensePlate || ''}
                onChange={(e) => setVehicleForm({ ...vehicleForm, licensePlate: e.target.value.toUpperCase() })}
              />
            </label>

            <label className="form-label">
              <span>Kilometraje Actual</span>
              <input
                type="number"
                className="form-input"
                placeholder="Ej. 85000"
                value={vehicleForm.currentMileage || ''}
                onChange={(e) => setVehicleForm({ ...vehicleForm, currentMileage: parseInt(e.target.value) || 0 })}
              />
            </label>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.85rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-accent-cyan)' }}>
              🛡️ Seguro & Auxilio Mecánico
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              <span>Compañía de Seguro</span>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. La Caja, San Cristóbal"
                value={vehicleForm.insuranceCompany || ''}
                onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceCompany: e.target.value })}
              />
            </label>

            <label className="form-label">
              <span>N° de Póliza</span>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. 12345678"
                value={vehicleForm.insurancePolicyNumber || ''}
                onChange={(e) => setVehicleForm({ ...vehicleForm, insurancePolicyNumber: e.target.value })}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              <span>Teléfono Grúa / Auxilio 24hs</span>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. 0800-555-1234"
                value={vehicleForm.insurancePhoneEmergency || ''}
                onChange={(e) => setVehicleForm({ ...vehicleForm, insurancePhoneEmergency: e.target.value })}
              />
            </label>

            <label className="form-label">
              <span>Vencimiento del Seguro</span>
              <input
                type="date"
                className="form-input"
                value={vehicleForm.insuranceExpiryDate || ''}
                onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceExpiryDate: e.target.value })}
              />
            </label>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.85rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-accent-blue)' }}>
              🔍 Inspección Técnica & Licencia
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              <span>Vencimiento VTV / RTO</span>
              <input
                type="date"
                className="form-input"
                value={vehicleForm.vtvExpiryDate || ''}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vtvExpiryDate: e.target.value })}
              />
            </label>

            <label className="form-label">
              <span>Vencimiento Licencia de Conducir</span>
              <input
                type="date"
                className="form-input"
                value={vehicleForm.licenseExpiryDate || ''}
                onChange={(e) => setVehicleForm({ ...vehicleForm, licenseExpiryDate: e.target.value })}
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="secondary-button" onClick={() => setVehicleModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              {editingVehicleId ? 'Guardar Cambios' : 'Crear Vehículo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: REGISTRAR CARGA DE COMBUSTIBLE */}
      <Modal
        open={fuelModalOpen}
        onClose={() => setFuelModalOpen(false)}
        title="Registrar Carga de Combustible"
        subtitle={currentVehicle ? `Carga para ${currentVehicle.name}` : ''}
      >
        <form onSubmit={handleSaveFuel} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              <span>Fecha</span>
              <input
                type="date"
                className="form-input"
                required
                value={fuelForm.date}
                onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })}
              />
            </label>

            <label className="form-label">
              <span>Odómetro / Km actual *</span>
              <input
                type="number"
                className="form-input"
                required
                placeholder="Ej. 85400"
                value={fuelForm.mileage || ''}
                onChange={(e) => setFuelForm({ ...fuelForm, mileage: parseInt(e.target.value) || 0 })}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              <span>Litros Cargados *</span>
              <input
                type="number"
                step="0.01"
                className="form-input"
                required
                placeholder="Ej. 42.5"
                value={fuelForm.liters || ''}
                onChange={(e) => setFuelForm({ ...fuelForm, liters: parseFloat(e.target.value) || 0 })}
              />
            </label>

            <label className="form-label">
              <span>Importe Total ($)*</span>
              <input
                type="number"
                step="0.01"
                className="form-input"
                required
                placeholder="Ej. 45000"
                value={fuelForm.cost || ''}
                onChange={(e) => setFuelForm({ ...fuelForm, cost: parseFloat(e.target.value) || 0 })}
              />
            </label>
          </div>

          <label className="form-label">
            <span>Tipo de Combustible</span>
            <select
              className="form-input"
              value={fuelForm.fuelType}
              onChange={(e) => setFuelForm({ ...fuelForm, fuelType: e.target.value as any })}
            >
              <option value="nafta">⛽ Nafta (Súper / Premium)</option>
              <option value="gasoil">🛢️ Gasoil / Diesel</option>
              <option value="gnc">💨 GNC</option>
              <option value="electrico">⚡ Carga Eléctrica</option>
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={syncFinanceGasto}
              onChange={(e) => setSyncFinanceGasto(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--color-accent-blue)' }}
            />
            <span>Sincronizar gasto automáticamente en Finanzas (Transporte)</span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="secondary-button" onClick={() => setFuelModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Guardar Carga
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: REGISTRAR / EDITAR SERVICE */}
      <Modal
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        title={editingServiceId ? 'Editar Mantenimiento' : 'Registrar Mantenimiento'}
        subtitle={currentVehicle ? `Service para ${currentVehicle.name}` : ''}
      >
        <form onSubmit={handleSaveService} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label className="form-label">
            <span>Tipo de Servicio / Trabajo Realizado *</span>
            <input
              type="text"
              className="form-input"
              required
              placeholder="Ej. Cambio de Aceite y Filtro, Pastillas de Freno, Alineación"
              value={serviceForm.serviceType}
              onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value })}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              <span>Fecha del Servicio *</span>
              <input
                type="date"
                className="form-input"
                required
                value={serviceForm.date.slice(0, 10)}
                onChange={(e) => setServiceForm({ ...serviceForm, date: e.target.value })}
              />
            </label>

            <label className="form-label">
              <span>Costo Total ($)</span>
              <input
                type="number"
                className="form-input"
                placeholder="Ej. 65000"
                value={serviceForm.cost || ''}
                onChange={(e) => setServiceForm({ ...serviceForm, cost: parseFloat(e.target.value) || 0 })}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              <span>Kilometraje del Servicio</span>
              <input
                type="number"
                className="form-input"
                placeholder="Ej. 85000"
                value={serviceForm.mileage || ''}
                onChange={(e) => setServiceForm({ ...serviceForm, mileage: parseInt(e.target.value) || undefined })}
              />
            </label>

            <label className="form-label">
              <span>Próximo Service (Km)</span>
              <input
                type="number"
                className="form-input"
                placeholder="Ej. 95000"
                value={serviceForm.nextServiceMileage || ''}
                onChange={(e) => setServiceForm({ ...serviceForm, nextServiceMileage: parseInt(e.target.value) || undefined })}
              />
            </label>
          </div>

          <label className="form-label">
            <span>Próximo Service (Fecha estimada)</span>
            <input
              type="date"
              className="form-input"
              value={serviceForm.nextServiceDate ? serviceForm.nextServiceDate.slice(0, 10) : ''}
              onChange={(e) => setServiceForm({ ...serviceForm, nextServiceDate: e.target.value || undefined })}
            />
          </label>

          <label className="form-label">
            <span>Notas / Taller mecánico</span>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Ej. Aceite 5W30 sintético Elaion, Taller San Martín"
              value={serviceForm.notes || ''}
              onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="secondary-button" onClick={() => setServiceModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              {editingServiceId ? 'Actualizar' : 'Guardar Service'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmación Eliminar Vehículo */}
      <ConfirmModal
        open={Boolean(deletingVehicle)}
        title="Eliminar Vehículo"
        message={`¿Seguro que querés eliminar "${deletingVehicle?.name}" de tu Garaje? Se perderán sus cargas de combustible y datos técnicos asociados.`}
        onConfirm={handleConfirmDeleteVehicle}
        onClose={() => setDeletingVehicle(null)}
      />

      {/* Confirmación Eliminar Service */}
      <ConfirmModal
        open={Boolean(deletingService)}
        title="Eliminar Service"
        message={`¿Seguro que querés eliminar el registro de "${deletingService?.serviceType}"?`}
        onConfirm={handleConfirmDeleteService}
        onClose={() => setDeletingService(null)}
      />
    </div>
  )
}
