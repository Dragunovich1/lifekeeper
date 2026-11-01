import { useEffect, useState } from 'react'
import { checkOllamaStatus, getPreferredModel, pickModel, setPreferredModel } from '../services/assistant/ollamaClient'
import { Select } from './Select'

/** Selector del modelo de IA local (Ollama) que usa el asistente. */
export const AssistantModelSetting = () => {
  const [models, setModels] = useState<string[] | null>(null)
  const [online, setOnline] = useState(true)
  const [value, setValue] = useState(getPreferredModel())

  useEffect(() => {
    let alive = true
    checkOllamaStatus().then((s) => {
      if (!alive) return
      setOnline(s.online)
      setModels(s.models)
    })
    return () => {
      alive = false
    }
  }, [])

  const auto = models && models.length ? pickModel(models, '') : null
  return (
    <div className="pref-field">
      <label htmlFor="settings-model">Modelo de IA del asistente</label>
      <Select
        id="settings-model"
        value={value}
        onChange={(v) => {
          setValue(v)
          setPreferredModel(v)
        }}
        options={[
          { value: '', label: auto ? `Automático (${auto})` : 'Automático' },
          ...(models ?? []).map((m) => ({ value: m, label: m })),
        ]}
        ariaLabel="Modelo de IA del asistente"
      />
      <p className="pref-help">
        {!models
          ? 'Buscando modelos…'
          : !online
            ? 'No se pudo conectar con el servidor de IA (Ollama). El asistente usa reglas locales.'
            : models.length === 0
              ? 'El servidor de IA no tiene modelos descargados.'
              : 'Los modelos más grandes entienden mejor pero responden más lento. Se aplica al abrir el asistente.'}
      </p>
    </div>
  )
}
