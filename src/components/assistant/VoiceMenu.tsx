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
        <select
          id="asst-voice-type"
          className="asst-select"
          value={voice.voiceChoice}
          onChange={(e) => {
            voice.setVoiceChoice(e.target.value as VoiceChoice)
            if (e.target.value.startsWith('piper-')) voice.setSelectedVoiceURI('')
          }}
        >
          <optgroup label="Piper (voz neural local)">
            <option value="piper-female">👩 Piper · Mujer (acento argentino)</option>
            <option value="piper-male">👨 Piper · Hombre (acento latino, México)</option>
          </optgroup>
          <optgroup label="Voces del navegador / sistema">
            <option value="female">👩 Voz Femenina (Mujer)</option>
            <option value="male">👨 Voz Masculina (Hombre)</option>
            <option value="system">🤖 Voz del Sistema / Neutra</option>
          </optgroup>
        </select>
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
          <select
            id="asst-voice-variant"
            className="asst-select"
            value={voice.selectedVoiceURI}
            onChange={(e) => voice.setSelectedVoiceURI(e.target.value)}
          >
            <option value="">(Automática según género)</option>
            {spanishVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
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
