import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import { usePreferences } from '../../preferences/context'
import type { Reminder, VehicleService } from '../../types'
import {
  formatCurrency,
  formatDate,
  fromLocalDateOrDateTime,
  toLocalDateKey,
} from '../../utils/dates'

const createInitialFormState = (): Omit<VehicleService, 'id'> => ({
  vehicleName: '',
  serviceType: '',
  date: new Date().toISOString(),
  cost: 0,
  mileage: undefined,
  nextServiceDate: undefined,
  nextServiceMileage: undefined,
  notes: '',
})

export const VehiclesSection = () => {
  const { data, updateData } = useAppData()
  const { preferences } = usePreferences()
  const currency = preferences.currency
  const services = data.personal.vehicles
  const [formState, setFormState] = useState<Omit<VehicleService, 'id'>>(createInitialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<Omit<VehicleService, 'id'>>(createInitialFormState)
  const [deletingService, setDeletingService] = useState<VehicleService | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState('')

  const vehicles = useMemo(() => {
    const names = new Set<string>()
    services.forEach((service) => names.add(service.vehicleName))
    return Array.from(names)
  }, [services])

  const filteredServices = useMemo(() => {
    const base = !selectedVehicle
      ? services
      : services.filter((service) => service.vehicleName === selectedVehicle)
    return [...base].sort((a, b) => (a.date > b.date ? -1 : 1))
  }, [services, selectedVehicle])

  const vehicleSummaries = useMemo(() => buildSummariesByVehicle(services), [services])

  const syncVehicleReminder = (reminders: Reminder[], service: VehicleService): Reminder[] => {
    const withoutCurrent = reminders.filter(
      (rem) => !(rem.sourceType === 'vehicle' && rem.sourceId === service.id),
    )
    if (!service.nextServiceDate) {
      return withoutCurrent
    }
    const existing = reminders.find(
      (rem) => rem.sourceType === 'vehicle' && rem.sourceId === service.id,
    )
    const reminderEntry: Reminder = {
      id: existing?.id ?? uuid(),
      title: `Próximo service: ${service.vehicleName} (${service.serviceType})`,
      details: [
        service.nextServiceMileage
          ? `A los ${service.nextServiceMileage.toLocaleString('es-AR')} km`
          : '',
        service.notes ?? '',
      ]
        .filter(Boolean)
        .join(' · '),
      dateTime: service.nextServiceDate,
      category: 'personal',
      done: existing?.done ?? false,
      sourceId: service.id,
      sourceType: 'vehicle',
    }
    return [reminderEntry, ...withoutCurrent]
  }

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.vehicleName.trim() || !formState.serviceType.trim()) {
      return
    }

    const normalizedDate = fromLocalDateOrDateTime(formState.date, true)
    const normalizedNextDate = formState.nextServiceDate
      ? fromLocalDateOrDateTime(formState.nextServiceDate, false) || undefined
      : undefined

    const entry: VehicleService = {
      ...formState,
      id: uuid(),
      vehicleName: formState.vehicleName.trim(),
      serviceType: formState.serviceType.trim(),
      date: normalizedDate,
      cost: Number(formState.cost),
      mileage: formState.mileage ? Number(formState.mileage) : undefined,
      nextServiceDate: normalizedNextDate,
      nextServiceMileage: formState.nextServiceMileage
        ? Number(formState.nextServiceMileage)
        : undefined,
    }

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        vehicles: [entry, ...previous.personal.vehicles],
      },
      utilities: {
        ...previous.utilities,
        reminders: syncVehicleReminder(previous.utilities.reminders, entry),
      },
    }))

    setFormState(createInitialFormState())
  }

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.vehicleName.trim() || !editFormState.serviceType.trim()) {
      return
    }

    const normalizedDate = fromLocalDateOrDateTime(editFormState.date, true)
    const normalizedNextDate = editFormState.nextServiceDate
      ? fromLocalDateOrDateTime(editFormState.nextServiceDate, false) || undefined
      : undefined

    const entry: VehicleService = {
      ...editFormState,
      id: editingId,
      vehicleName: editFormState.vehicleName.trim(),
      serviceType: editFormState.serviceType.trim(),
      date: normalizedDate,
      cost: Number(editFormState.cost),
      mileage: editFormState.mileage ? Number(editFormState.mileage) : undefined,
      nextServiceDate: normalizedNextDate,
      nextServiceMileage: editFormState.nextServiceMileage
        ? Number(editFormState.nextServiceMileage)
        : undefined,
    }

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        vehicles: previous.personal.vehicles.map((service) =>
          service.id === editingId ? entry : service,
        ),
      },
      utilities: {
        ...previous.utilities,
        reminders: syncVehicleReminder(previous.utilities.reminders, entry),
      },
    }))

    setEditingId(null)
  }

  const startEdit = (service: VehicleService) => {
    setEditingId(service.id)
    setEditFormState({
      vehicleName: service.vehicleName,
      serviceType: service.serviceType,
      date: service.date,
      cost: service.cost,
      mileage: service.mileage,
      nextServiceDate: service.nextServiceDate,
      nextServiceMileage: service.nextServiceMileage,
      notes: service.notes ?? '',
    })
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        vehicles: previous.personal.vehicles.filter((record) => record.id !== id),
      },
      utilities: {
        ...previous.utilities,
        reminders: previous.utilities.reminders.filter(
          (rem) => !(rem.sourceType === 'vehicle' && rem.sourceId === id),
        ),
      },
    }))
    if (editingId === id) {
      setEditingId(null)
    }
  }

  return (
    <div>
      <SectionHeader
        title="Vehículos"
        subtitle="Llevá control de servicios, mantenimientos, kilometraje y próximos recordatorios"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Registrar servicio</h3>
          </div>
          <form className="form-grid three-columns" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="veh-name">Vehículo</label>
              <input
                id="veh-name"
                value={formState.vehicleName}
                onChange={(event) =>
                  setFormState({ ...formState, vehicleName: event.target.value })
                }
                placeholder="Ej. Taunus GT"
                required
              />
              {vehicles.length > 0 ? (
                <div className="tag-suggestions" aria-label="Vehículos registrados">
                  <span className="tag-suggestions-label">Mis vehículos:</span>
                  {vehicles.map((veh) => (
                    <button
                      key={veh}
                      type="button"
                      className="tag-suggestion-chip"
                      onClick={() => setFormState({ ...formState, vehicleName: veh })}
                    >
                      {veh}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="veh-type">Servicio</label>
              <input
                id="veh-type"
                value={formState.serviceType}
                onChange={(event) =>
                  setFormState({ ...formState, serviceType: event.target.value })
                }
                placeholder="Cambio de aceite, seguro, patente"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="veh-date">Fecha</label>
              <DatePicker
                id="veh-date"
                value={toLocalDateKey(formState.date)}
                onChange={(value) =>
                  setFormState({ ...formState, date: fromLocalDateOrDateTime(value, true) })
                }
                ariaLabel="Fecha del servicio"
              />
            </div>
            <div className="field">
              <label htmlFor="veh-cost">Costo</label>
              <input
                id="veh-cost"
                type="number"
                step="0.01"
                value={formState.cost}
                onChange={(event) =>
                  setFormState({ ...formState, cost: Number(event.target.value) })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="veh-mileage">Kilometraje actual</label>
              <input
                id="veh-mileage"
                type="number"
                value={formState.mileage ?? ''}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    mileage: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
                placeholder="Km al momento"
              />
            </div>
            <div className="field">
              <label htmlFor="veh-next-date">Próximo service (fecha)</label>
              <DatePicker
                id="veh-next-date"
                value={toLocalDateKey(formState.nextServiceDate)}
                onChange={(value) =>
                  setFormState({
                    ...formState,
                    nextServiceDate: value ? fromLocalDateOrDateTime(value, false) : undefined,
                  })
                }
                allowClear
                placeholder="Opcional (crea recordatorio)"
                ariaLabel="Fecha del próximo service"
              />
            </div>
            <div className="field">
              <label htmlFor="veh-next-mileage">Próximo service (km)</label>
              <input
                id="veh-next-mileage"
                type="number"
                value={formState.nextServiceMileage ?? ''}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    nextServiceMileage: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
                placeholder="Ej. 115000"
              />
            </div>
            <div className="field field-full">
              <label htmlFor="veh-notes">Notas</label>
              <textarea
                id="veh-notes"
                value={formState.notes ?? ''}
                onChange={(event) => setFormState({ ...formState, notes: event.target.value })}
                placeholder="Observaciones, repuestos utilizados, taller"
              />
            </div>
            <div className="form-actions field-full">
              <button className="primary-button" type="submit">
                Guardar servicio
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Resumen por vehículo</h3>
          </div>
          {vehicles.length === 0 ? (
            <div className="empty-state">Todavía no registraste vehículos.</div>
          ) : (
            <div className="stats-grid">
              {vehicles.map((vehicle) => {
                const summary = vehicleSummaries[vehicle]
                return (
                  <div key={vehicle} className="stat-card">
                    <span className="stat-title">{vehicle}</span>
                    <span className="stat-value">{formatCurrency(summary?.totalCost ?? 0, currency)}</span>
                    <span className="panel-subtitle">
                      Último km:{' '}
                      {summary?.latestMileage
                        ? `${summary.latestMileage.toLocaleString('es-AR')} km`
                        : 'Sin dato'}
                    </span>
                    {summary?.nextServiceDate || summary?.nextServiceMileage ? (
                      <span className="panel-subtitle">
                        Próximo service:{' '}
                        {[
                          summary.nextServiceDate ? formatDate(summary.nextServiceDate) : '',
                          summary.nextServiceMileage
                            ? `${summary.nextServiceMileage.toLocaleString('es-AR')} km`
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Historial de servicios</h3>
            <Select
              value={selectedVehicle}
              onChange={setSelectedVehicle}
              options={[
                { value: '', label: 'Todos los vehículos' },
                ...vehicles.map((vehicle) => ({ value: vehicle, label: vehicle })),
              ]}
              ariaLabel="Filtrar servicios por vehículo"
            />
          </div>
          {filteredServices.length === 0 ? (
            <div className="empty-state">Sin registros para los filtros aplicados.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Vehículo</th>
                  <th>Servicio</th>
                  <th>Km</th>
                  <th>Próximo service</th>
                  <th>Costo</th>
                  <th>Notas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service) => (
                  <tr key={service.id}>
                    <td>{formatDate(service.date)}</td>
                    <td>{service.vehicleName}</td>
                    <td>{service.serviceType}</td>
                    <td>
                      {service.mileage ? `${service.mileage.toLocaleString('es-AR')} km` : '—'}
                    </td>
                    <td>
                      {service.nextServiceDate || service.nextServiceMileage
                        ? [
                            service.nextServiceDate ? formatDate(service.nextServiceDate) : '',
                            service.nextServiceMileage
                              ? `${service.nextServiceMileage.toLocaleString('es-AR')} km`
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : '—'}
                    </td>
                    <td>{formatCurrency(service.cost, currency)}</td>
                    <td>{service.notes || '—'}</td>
                    <td>
                      <div className="section-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => startEdit(service)}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setDeletingService(service)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Editar servicio vehicular"
        subtitle="Actualizá los datos de mantenimiento del vehículo"
        maxWidth="680px"
      >
        <form className="form-grid three-columns" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-veh-name">Vehículo</label>
            <input
              id="edit-veh-name"
              value={editFormState.vehicleName}
              onChange={(event) =>
                setEditFormState({
                  ...editFormState,
                  vehicleName: event.target.value,
                })
              }
              placeholder="Ej. Taunus GT"
              required
              autoFocus
            />
            {vehicles.length > 0 ? (
              <div className="tag-suggestions" aria-label="Vehículos registrados">
                <span className="tag-suggestions-label">Mis vehículos:</span>
                {vehicles.map((veh) => (
                  <button
                    key={veh}
                    type="button"
                    className="tag-suggestion-chip"
                    onClick={() =>
                      setEditFormState({ ...editFormState, vehicleName: veh })
                    }
                  >
                    {veh}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="edit-veh-type">Servicio</label>
            <input
              id="edit-veh-type"
              value={editFormState.serviceType}
              onChange={(event) =>
                setEditFormState({
                  ...editFormState,
                  serviceType: event.target.value,
                })
              }
              placeholder="Cambio de aceite, seguro, patente"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="edit-veh-date">Fecha</label>
            <DatePicker
              id="edit-veh-date"
              value={toLocalDateKey(editFormState.date)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  date: fromLocalDateOrDateTime(value, true),
                })
              }
              ariaLabel="Fecha del servicio"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-veh-cost">Costo</label>
            <input
              id="edit-veh-cost"
              type="number"
              step="0.01"
              value={editFormState.cost}
              onChange={(event) =>
                setEditFormState({
                  ...editFormState,
                  cost: Number(event.target.value),
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="edit-veh-mileage">Kilometraje actual</label>
            <input
              id="edit-veh-mileage"
              type="number"
              value={editFormState.mileage ?? ''}
              onChange={(event) =>
                setEditFormState({
                  ...editFormState,
                  mileage: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
              placeholder="Km al momento"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-veh-next-date">Próximo service (fecha)</label>
            <DatePicker
              id="edit-veh-next-date"
              value={toLocalDateKey(editFormState.nextServiceDate)}
              onChange={(value) =>
                setEditFormState({
                  ...editFormState,
                  nextServiceDate: value
                    ? fromLocalDateOrDateTime(value, false)
                    : undefined,
                })
              }
              allowClear
              placeholder="Opcional (crea recordatorio)"
              ariaLabel="Fecha del próximo service"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-veh-next-mileage">Próximo service (km)</label>
            <input
              id="edit-veh-next-mileage"
              type="number"
              value={editFormState.nextServiceMileage ?? ''}
              onChange={(event) =>
                setEditFormState({
                  ...editFormState,
                  nextServiceMileage: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
              placeholder="Ej. 115000"
            />
          </div>
          <div className="field field-full">
            <label htmlFor="edit-veh-notes">Notas</label>
            <textarea
              id="edit-veh-notes"
              value={editFormState.notes ?? ''}
              onChange={(event) =>
                setEditFormState({ ...editFormState, notes: event.target.value })
              }
              placeholder="Observaciones, repuestos utilizados, taller"
            />
          </div>
          <div
            className="form-actions field-full"
            style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}
          >
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditingId(null)}
            >
              Cancelar
            </button>
            <button className="primary-button" type="submit">
              Guardar cambios
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deletingService)}
        title="Eliminar servicio"
        message={
          deletingService
            ? `¿Querés eliminar el servicio "${deletingService.serviceType}" de "${deletingService.vehicleName}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deletingService) {
            handleRemove(deletingService.id)
          }
        }}
        onClose={() => setDeletingService(null)}
      />
    </div>
  )
}

interface VehicleSummary {
  totalCost: number
  latestMileage?: number
  nextServiceDate?: string
  nextServiceMileage?: number
}

const buildSummariesByVehicle = (services: VehicleService[]) => {
  const sorted = [...services].sort((a, b) => (a.date > b.date ? -1 : 1))
  return sorted.reduce<Record<string, VehicleSummary>>((acc, service) => {
    const current = acc[service.vehicleName] ?? { totalCost: 0 }
    current.totalCost += service.cost
    if (service.mileage !== undefined) {
      current.latestMileage = Math.max(current.latestMileage ?? 0, service.mileage)
    }
    if (service.nextServiceDate && !current.nextServiceDate) {
      current.nextServiceDate = service.nextServiceDate
    }
    if (service.nextServiceMileage && !current.nextServiceMileage) {
      current.nextServiceMileage = service.nextServiceMileage
    }
    acc[service.vehicleName] = current
    return acc
  }, {})
}
