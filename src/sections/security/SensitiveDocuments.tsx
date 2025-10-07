import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import type { SensitiveDocument } from '../../types'
import { formatDateTime } from '../../utils/dates'

const initialFormState = {
  name: '',
  description: '',
  file: null as File | null,
}

export const SensitiveDocumentsSection = () => {
  const { data, updateData } = useAppData()
  const documents = data.security.documents
  const [formState, setFormState] = useState(initialFormState)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setFormState((prev) => ({ ...prev, file }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.file || !formState.name) {
      return
    }

    setUploading(true)
    try {
      const dataUrl = await fileToDataUrl(formState.file)
      const entry: SensitiveDocument = {
        id: uuid(),
        name: formState.name,
        description: formState.description || undefined,
        fileName: formState.file.name,
        mimeType: formState.file.type || 'application/octet-stream',
        dataUrl,
        addedAt: new Date().toISOString(),
      }

      updateData((previous) => ({
        ...previous,
        security: {
          ...previous.security,
          documents: [entry, ...previous.security.documents],
        },
      }))

      setFormState(initialFormState)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        documents: previous.security.documents.filter((doc) => doc.id !== id),
      },
    }))
  }

  return (
    <div>
      <SectionHeader
        title="Documentos sensibles"
        subtitle="Respalda documentos importantes de forma cifrada dentro de la app"
      />

      <div className="section-body">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Subir documento</h3>
            <p className="panel-subtitle">Acepta imagenes y PDF, quedan cifrados con tu clave maestra</p>
          </div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="doc-name">Nombre</label>
              <input
                id="doc-name"
                value={formState.name}
                onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                placeholder="Ej. DNI, pasaporte"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="doc-description">Descripcion</label>
              <textarea
                id="doc-description"
                value={formState.description}
                onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                placeholder="Observaciones o ubicacion original"
              />
            </div>
            <div className="field">
              <label htmlFor="doc-file">Archivo</label>
              <input id="doc-file" type="file" onChange={handleFileChange} />
            </div>
            <button className="primary-button" type="submit" disabled={uploading}>
              {uploading ? 'Procesando...' : 'Guardar documento'}
            </button>
          </form>
        </div>

        <div className="panel">
          <h3 className="panel-title">Repositorio</h3>
          {documents.length === 0 ? (
            <div className="empty-state">Aun no cargaste documentos.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Archivo</th>
                  <th>Descripcion</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.name}</td>
                    <td>{doc.fileName}</td>
                    <td>{doc.description || '—'}</td>
                    <td>{formatDateTime(doc.addedAt)}</td>
                    <td>
                      <div className="section-actions">
                        <a className="secondary-button" href={doc.dataUrl} download={doc.fileName}>
                          Descargar
                        </a>
                        <button className="secondary-button" type="button" onClick={() => handleRemove(doc.id)}>
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
    </div>
  )
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
