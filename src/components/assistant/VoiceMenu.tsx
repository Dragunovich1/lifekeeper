import { Select } from '../Select'
import { Volume2, X } from 'lucide-react'
import type { AssistantVoice, VoiceChoice } from './useAssistantVoice'

export function VoiceMenu({
  voice,
  onClose,
}: {
  voice: AssistantVoice
  onClose: () => void
}) {
  const spanishVoices = voice.availableVoices.filter((v) => v.lang.toLowerCase().startsWith('es'))

  return (
    <div className="asst-popover" role="dialog" aria-label="Configuración de voz">
      <div className="asst-popover-head">
        <div className="asst-popover-title">
          <Volume2 size={16} />
          <span>Configuración de voz</span>
        </div>
        <button type="button" className="pref-modal-action-btn" onClick={onClose} aria-label="Cerrar ajustes de voz">
          <X size={15} />
        </button>
      </div>

      <div className="asst-field">
        <label htmlFor="asst-voice-type">Tipo de voz</label>
        <Select
          id="asst-voice-type"
          value={voice.voiceChoice}
          onChange={(v) => {
            voice.setVoiceChoice(v as VoiceChoice)
            if (v.startsWith('piper-')) voice.setSelectedVoiceURI('')
          }}
          options={[
            { value: 'piper-female', label: '👩 Piper · Mujer (acento argentino)' },
            { value: 'piper-male', label: '👨 Piper · Hombre (acento latino, México)' },
            { value: 'female', label: '👩 Voz Femenina (navegador / sistema)' },
            { value: 'male', label: '👨 Voz Masculina (navegador / sistema)' },
            { value: 'system', label: '🤖 Voz del Sistema / Neutra' },
          ]}
          ariaLabel="Tipo de voz"
        />
        {voice.usePiper && (
          <span className={`asst-hint ${voice.piperOnline === false ? 'is-error' : ''}`}>
            {voice.piperOnline === null && 'Verificando servicio Piper…'}
            {voice.piperOnline === true && '● Piper en línea'}
            {voice.piperOnline === false && '● Piper no disponible: se usa la voz del navegador'}
          </span>
        )}
      </div>

      {!voice.usePiper && spanishVoices.length > 1 && (
        <div className="asst-field">
          <label htmlFor="asst-voice-variant">Variante de voz instalada</label>
          <Select
            id="asst-voice-variant"
            value={voice.selectedVoiceURI}
            onChange={voice.setSelectedVoiceURI}
            options={[{ value: '', label: '(Automática según género)' }, ...spanishVoices.map((v) => ({ value: v.voiceURI, label: `${v.name} (${v.lang})` }))]}
            ariaLabel="Variante de voz"
          />
        </div>
      )}

      <label className="asst-check">
        <input
          type="checkbox"
          checked={voice.autoSpeak}
          onChange={(e) => voice.setAutoSpeak(e.target.checked)}
        />
        <span>Leer respuestas en voz alta automáticamente</span>
      </label>

      <button
        type="button"
        className="secondary-button"
        onClick={() => voice.speakText('¡Qué hacés, che! Así se escucha mi voz porteña en LifeKeeper.')}
      >
        <Volume2 size={14} />
        <span>Probar cómo suena esta voz</span>
      </button>
    </div>
  )
}
