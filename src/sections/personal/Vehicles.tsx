import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { VehicleService } from '../../types'
import { formatDate } from '../../utils/dates'

const initialFormState: Omit<VehicleService, 'id'> = {
  vehicleName: '',
  serviceType: '',
  date: new Date().toISOString(),
  cost: 0,
  mileage: undefined,
  notes: '',
}

export const VehiclesSection = () => {
  const { data, updateData } = useAppData()
  const services = data.personal.vehicles
  const [formState, setFormState] = useState(initialFormState)
  const [selectedVehicle, setSelectedVehicle] = useState('')

  const vehicles = useMemo(() => {
    const names = new Set<string>()
    services.forEach((service) => names.add(service.vehicleName))
    return Array.from(names)
  }, [services])

  const filteredServices = useMemo(() => {
    if (!selectedVehicle) {
      return services
    }
    return services.filter((service) => service.vehicleName === selectedVehicle)
  }, [services, selectedVehicle])

  const totals = useMemo(() => buildTotalsByVehicle(services), [services])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.vehicleName || !formState.serviceType) {
      return
    }

    const entry: VehicleService = {
      ...formState,
      id: uuid(),
      date: new Date(formState.date).toISOString(),
      cost: Number(formState.cost),
      mileage: formState.mileage ? Number(formState.mileage) : undefined,
    }

    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        vehicles: [entry, ...previous.personal.vehicles],
      },
    }))

    setFormState(initialFormState)
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      personal: {
        ...previous.personal,
        vehicles: previous.personal.vehicles.filter((record) => record.id !== id),
      },
    }))
  }

  return (
    <div>
      <SectionHeader
        title="Vehiculos"
        subtitle="Lleva control de servicios, mantenimientos y costos"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Registrar servicio</h3>
          </div>
          <form className="form-grid three-columns" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="veh-name">Vehiculo</label>
              <input
                id="veh-name"
                value={formState.vehicleName}
                onChange={(event) => setFormState({ ...formState, vehicleName: event.target.value })}
                placeholder="Ej. Taunus GT"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="veh-type">Servicio</label>
              <input
                id="veh-type"
                value={formState.serviceType}
                onChange={(event) => setFormState({ ...formState, serviceType: event.target.value })}
                placeholder="Cambio de aceite, seguro, patente"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="veh-date">Fecha</label>
              <input
                id="veh-date"
                type="date"
                value={formState.date.slice(0, 10)}
                onChange={(event) =>
                  setFormState({ ...formState, date: new Date(event.target.value).toISOString() })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="veh-cost">Costo</label>
              <input
                id="veh-cost"
                type="number"
                step="0.01"
                value={formState.cost}
                onChange={(event) => setFormState({ ...formState, cost: Number(event.target.value) })}
              />
            </div>
            <div className="field">
              <label htmlFor="veh-mileage">Kilometraje</label>
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
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="veh-notes">Notas</label>
              <textarea
                id="veh-notes"
                value={formState.notes ?? ''}
                onChange={(event) => setFormState({ ...formState, notes: event.target.value })}
                placeholder="Observaciones, proximo servicio"
              />
            </div>
            <button className="primary-button" type="submit">
              Guardar servicio
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Totales por vehiculo</h3>
          </div>
          {vehicles.length === 0 ? (
            <div className="empty-state">Aun no registraste vehiculos.</div>
          ) : (
            <div className="stats-grid">
              {vehicles.map((vehicle) => (
                <div key={vehicle} className="stat-card">
                  <span className="stat-title">{vehicle}</span>
                  <span className="stat-value">${(totals[vehicle] ?? 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Historial de servicios</h3>
            <select value={selectedVehicle} onChange={(event) => setSelectedVehicle(event.target.value)}>
              <option value="">Todos los vehiculos</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle} value={vehicle}>
                  {vehicle}
                </option>
              ))}
            </select>
          </div>
          {filteredServices.length === 0 ? (
            <div className="empty-state">Sin registros para los filtros aplicados.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Vehiculo</th>
                  <th>Servicio</th>
                  <th>Km</th>
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
                    <td>{service.mileage ?? '—'}</td>
                    <td>${service.cost.toFixed(2)}</td>
                    <td>{service.notes || '—'}</td>
                    <td>
                      <button className="secondary-button" type="button" onClick={() => handleRemove(service.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const buildTotalsByVehicle = (services: VehicleService[]) => {
  return services.reduce<Record<string, number>>((acc, service) => {
    acc[service.vehicleName] = (acc[service.vehicleName] ?? 0) + service.cost
    return acc
  }, {})
}
