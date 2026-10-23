import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Modal } from '../../components/Modal'
import { SectionHeader } from '../../components/SectionHeader'
import { Select } from '../../components/Select'
import { useAppData } from '../../hooks/useAppData'
import type { Reminder, SensitiveDocument } from '../../types'
import {
  formatDate,
  formatDateTime,
  fromLocalDateOrDateTime,
  isPast,
  isUpcoming,
  toLocalDateKey,
} from '../../utils/dates'

const DOCUMENT_CATEGORIES = ['Identidad', 'Salud', 'Vehículo', 'Finanzas', 'Legal', 'Otro']

const initialFormState = {
  name: '',
  category: 'Identidad',
  expiresAt: '' as string,
  description: '',
  file: null as File | null,
}

export const SensitiveDocumentsSection = () => {
  const { data, updateData } = useAppData()
  const documents = data.security.documents
  const [formState, setFormState] = useState(initialFormState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState(initialFormState)
  const [deletingDoc, setDeletingDoc] = useState<SensitiveDocument | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setFormState((prev) => ({ ...prev, file }))
  }

  const handleEditFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setEditFormState((prev) => ({ ...prev, file }))
  }

  const syncDocumentReminder = (reminders: Reminder[], doc: SensitiveDocument): Reminder[] => {
    const withoutCurrent = reminders.filter(
      (rem) => !(rem.sourceType === 'document' && rem.sourceId === doc.id),
    )
    if (!doc.expiresAt) {
      return withoutCurrent
    }
    const existing = reminders.find(
      (rem) => rem.sourceType === 'document' && rem.sourceId === doc.id,
    )
    const reminderEntry: Reminder = {
      id: existing?.id ?? uuid(),
      title: `Vencimiento documento: ${doc.name}`,
      details: [doc.category ? `Categoría: ${doc.category}` : '', doc.description ?? '']
        .filter(Boolean)
        .join(' · '),
      dateTime: doc.expiresAt,
      category: 'seguridad',
      done: existing?.done ?? false,
      sourceId: doc.id,
      sourceType: 'document',
    }
    return [reminderEntry, ...withoutCurrent]
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.name.trim() || !formState.file) return

    const normalizedExpiresAt = formState.expiresAt
      ? fromLocalDateOrDateTime(formState.expiresAt, false) || undefined
      : undefined

    setUploading(true)
    try {
      const dataUrl = await fileToDataUrl(formState.file)
      const entry: SensitiveDocument = {
        id: uuid(),
        name: formState.name.trim(),
        category: formState.category,
        expiresAt: normalizedExpiresAt,
        description: formState.description.trim() || undefined,
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
        utilities: {
          ...previous.utilities,
          reminders: syncDocumentReminder(previous.utilities.reminders, entry),
        },
      }))

      setFormState(initialFormState)
    } finally {
      setUploading(false)
    }
  }

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId || !editFormState.name.trim()) return

    const normalizedExpiresAt = editFormState.expiresAt
      ? fromLocalDateOrDateTime(editFormState.expiresAt, false) || undefined
      : undefined

    setUploading(true)
    try {
      const replacementDataUrl = editFormState.file
        ? await fileToDataUrl(editFormState.file)
        : undefined

      updateData((previous) => {
        let updatedDoc: SensitiveDocument | null = null
        const updatedDocuments = previous.security.documents.map((doc) => {
          if (doc.id !== editingId) return doc
          updatedDoc = {
            ...doc,
            name: editFormState.name.trim(),
            category: editFormState.category,
            expiresAt: normalizedExpiresAt,
            description: editFormState.description.trim() || undefined,
            ...(editFormState.file && replacementDataUrl
              ? {
                  fileName: editFormState.file.name,
                  mimeType: editFormState.file.type || 'application/octet-stream',
                  dataUrl: replacementDataUrl,
                }
              : {}),
          }
          return updatedDoc
        })

        return {
          ...previous,
          security: {
            ...previous.security,
            documents: updatedDocuments,
          },
          utilities: {
            ...previous.utilities,
            reminders: updatedDoc
              ? syncDocumentReminder(previous.utilities.reminders, updatedDoc)
              : previous.utilities.reminders,
          },
        }
      })
      setEditingId(null)
    } finally {
      setUploading(false)
    }
  }

  const startEdit = (doc: SensitiveDocument) => {
    setEditingId(doc.id)
    setEditFormState({
      name: doc.name,
      category: doc.category || 'Identidad',
      expiresAt: doc.expiresAt ?? '',
      description: doc.description ?? '',
      file: null,
    })
  }

  const handleRemove = (id: string) => {
    updateData((previous) => ({
      ...previous,
      security: {
        ...previous.security,
        documents: previous.security.documents.filter((doc) => doc.id !== id),
      },
      utilities: {
        ...previous.utilities,
        reminders: previous.utilities.reminders.filter(
          (rem) => !(rem.sourceType === 'document' && rem.sourceId === id),
        ),
      },
    }))
    if (editingId === id) {
      setEditingId(null)
    }
  }

  const renderValidityBadge = (expiresAt?: string) => {
    if (!expiresAt) {
      return <span className="panel-subtitle">Sin vencimiento</span>
    }
    if (isPast(expiresAt)) {
      return <span className="badge badge-error">Vencido ({formatDate(expiresAt)})</span>
    }
    if (isUpcoming(expiresAt, 30)) {
      return <span className="badge badge-warning">Vence pronto ({formatDate(expiresAt)})</span>
    }
    return <span className="badge badge-success">Vigente ({formatDate(expiresAt)})</span>
  }

  return (
    <div>
      <SectionHeader
        title="Documentos sensibles"
        subtitle="Respaldá documentos importantes de forma cifrada y recibí alertas antes de su vencimiento"
      />

      <div className="section-body compact">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Subir documento</h3>
            <p className="panel-subtitle">
              Acepta imágenes y PDF, quedan cifrados con tu clave maestra
            </p>
          </div>
          <form className="form-grid two-columns" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="doc-name">Nombre</label>
              <input
                id="doc-name"
                value={formState.name}
                onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                placeholder="Ej. DNI, pasaporte, VTV"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="doc-category">Categoría</label>
              <Select
                id="doc-category"
                value={formState.category}
                onChange={(value) => setFormState({ ...formState, category: value })}
                options={DOCUMENT_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                ariaLabel="Categoría del documento"
              />
            </div>
            <div className="field">
              <label htmlFor="doc-expires">Fecha de vencimiento (opcional)</label>
              <DatePicker
                id="doc-expires"
                value={toLocalDateKey(formState.expiresAt)}
                onChange={(value) => setFormState({ ...formState, expiresAt: value })}
                allowClear
                placeholder="Sin fecha de vencimiento"
                ariaLabel="Fecha de vencimiento del documento"
              />
            </div>
            <div className="field">
              <label htmlFor="doc-file">Archivo</label>
              <input
                id="doc-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                required
              />
            </div>
            <div className="field field-full">
              <label htmlFor="doc-description">Descripción</label>
              <textarea
                id="doc-description"
                value={formState.description}
                onChange={(event) =>
                  setFormState({ ...formState, description: event.target.value })
                }
                placeholder="Observaciones o ubicación física original"
              />
            </div>
            <div className="form-actions field-full">
              <button className="primary-button" type="submit" disabled={uploading}>
                {uploading ? 'Procesando...' : 'Guardar documento'}
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <h3 className="panel-title">Repositorio</h3>
          {documents.length === 0 ? (
            <div className="empty-state">Todavía no cargaste documentos.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Vigencia</th>
                  <th>Archivo</th>
                  <th>Descripción</th>
                  <th>Subido</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.name}</td>
                    <td>{doc.category || 'Otro'}</td>
                    <td>{renderValidityBadge(doc.expiresAt)}</td>
                    <td>{doc.fileName}</td>
                    <td>{doc.description || '—'}</td>
                    <td>{formatDateTime(doc.addedAt)}</td>
                    <td>
                      <div className="section-actions">
                        <a
                          className="secondary-button"
                          href={doc.dataUrl}
                          download={doc.fileName}
                        >
                          Descargar
                        </a>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => startEdit(doc)}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setDeletingDoc(doc)}
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
        title="Editar documento sensible"
        subtitle="Actualizá los metadatos o reemplazá el archivo"
        maxWidth="640px"
      >
        <form className="form-grid two-columns" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="edit-doc-name">Nombre</label>
            <input
              id="edit-doc-name"
              value={editFormState.name}
              onChange={(event) =>
                setEditFormState({ ...editFormState, name: event.target.value })
              }
              placeholder="Ej. DNI, pasaporte, VTV"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="edit-doc-category">Categoría</label>
            <Select
              id="edit-doc-category"
              value={editFormState.category}
              onChange={(value) =>
                setEditFormState({ ...editFormState, category: value })
              }
              options={DOCUMENT_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
              ariaLabel="Categoría del documento"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-doc-expires">Fecha de vencimiento (opcional)</label>
            <DatePicker
              id="edit-doc-expires"
              value={toLocalDateKey(editFormState.expiresAt)}
              onChange={(value) =>
                setEditFormState({ ...editFormState, expiresAt: value })
              }
              allowClear
              placeholder="Sin fecha de vencimiento"
              ariaLabel="Fecha de vencimiento del documento"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-doc-file">Reemplazar archivo (opcional)</label>
            <input
              id="edit-doc-file"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleEditFileChange}
            />
          </div>
          <div className="field field-full">
            <label htmlFor="edit-doc-description">Descripción</label>
            <textarea
              id="edit-doc-description"
              value={editFormState.description}
              onChange={(event) =>
                setEditFormState({ ...editFormState, description: event.target.value })
              }
              placeholder="Observaciones o ubicación física original"
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
              disabled={uploading}
            >
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={uploading}>
              {uploading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deletingDoc)}
        title="Eliminar documento sensible"
        message={
          deletingDoc
            ? `¿Querés eliminar el documento "${deletingDoc.name}" (${deletingDoc.fileName})? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deletingDoc) {
            handleRemove(deletingDoc.id)
          }
        }}
        onClose={() => setDeletingDoc(null)}
      />
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
