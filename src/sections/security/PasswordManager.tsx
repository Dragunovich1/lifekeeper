import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { TagInput } from '../../components/TagInput'
import { useAppData } from '../../hooks/useAppData'
import { useClipboard } from '../../hooks/useClipboard'
import type { PasswordEntry } from '../../types'
import { formatDateTime } from '../../utils/dates'

type PasswordFormState = {
  service: string
  username: string
  password: string
  notes?: string
  tags: string[]
}

const initialFormState: PasswordFormState = {
  service: '',
  username: '',
  password: '',
  notes: '',
  tags: [],
}

export const PasswordManagerSection = () => {
  const { data, updateData } = useAppData()
  const [formState, setFormState] = useState<PasswordFormState>(initialFormState)
  const [searchTerm, setSearchTerm] = useState('')
  const [revealed, setRevealed] = useState<string[]>([])
  const { status, copy } = useClipboard()

  const passwords = data.security.passwordEntries

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      return passwords
    }

    return passwords.filter((entry) =>
      [entry.service, entry.username, entry.notes ?? '', (entry.tags ?? []).join(' ')]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    )
  }, [passwords, searchTerm])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.service || !formState.password) {
      return
    }

    const entry: PasswordEntry = {
      ...formState,
      id: uuid(),
      updatedAt: new Date().toISOString(),
    }

    updateData((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        passwordEntries: [entry, ...previous.security.passwordEntries],
      },
    }))

    setFormState(initialFormState)
  }

  const toggleReveal = (id: string) => {
    setRevealed((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]))
  }

  const handleCopy = (value: string) => {
    copy(value, 30000)
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        passwordEntries: previous.security.passwordEntries.filter((entry) => entry.id !== id),
      },
    }))
  }

  return (
    <div>
      <SectionHeader
        title="Gestor de contrasenas"
        subtitle="Todos tus accesos cifrados con la clave maestra, listos para copiar con temporizador"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Nueva credencial</h3>
            <p className="panel-subtitle">El temporizador limpia el portapapeles en 30 segundos</p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="pwd-service">Servicio / sitio</label>
              <input
                id="pwd-service"
                value={formState.service}
                onChange={(event) => setFormState({ ...formState, service: event.target.value })}
                placeholder="Ej. correo, banco, redes"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pwd-user">Usuario</label>
              <input
                id="pwd-user"
                value={formState.username}
                onChange={(event) => setFormState({ ...formState, username: event.target.value })}
                placeholder="Correo o alias"
              />
            </div>
            <div className="field">
              <label htmlFor="pwd-pass">Contrasena</label>
              <input
                id="pwd-pass"
                type="password"
                value={formState.password}
                onChange={(event) => setFormState({ ...formState, password: event.target.value })}
                placeholder="Clave del servicio"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pwd-notes">Notas</label>
              <textarea
                id="pwd-notes"
                value={formState.notes ?? ''}
                onChange={(event) => setFormState({ ...formState, notes: event.target.value })}
                placeholder="Datos adicionales, preguntas de seguridad"
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Etiquetas</label>
              <TagInput
                values={formState.tags}
                onChange={(tags) => setFormState({ ...formState, tags })}
                placeholder="Enter para agregar"
              />
            </div>
            <button className="primary-button" type="submit">
              Guardar credencial
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Vault</h3>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por servicio o tag"
            />
          </div>
          {filteredEntries.length === 0 ? (
            <div className="empty-state">No hay contrasenas almacenadas.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Usuario</th>
                  <th>Contrasena</th>
                  <th>Notas</th>
                  <th>Actualizado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.service}</td>
                    <td>{entry.username || '—'}</td>
                    <td>
                      {revealed.includes(entry.id) ? entry.password : '••••••'}
                      <div className="section-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => toggleReveal(entry.id)}
                        >
                          {revealed.includes(entry.id) ? 'Ocultar' : 'Mostrar'}
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => handleCopy(entry.password)}
                        >
                          Copiar
                        </button>
                      </div>
                    </td>
                    <td>{entry.notes || '—'}</td>
                    <td>{formatDateTime(entry.updatedAt)}</td>
                    <td>
                      <button className="secondary-button" type="button" onClick={() => handleRemove(entry.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {status === 'copied' ? <p className="panel-subtitle">Copiada. Se limpia sola en 30 segundos.</p> : null}
        </div>
      </div>
    </div>
  )
}



