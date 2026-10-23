import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, X } from 'lucide-react'
import { usePreferences } from '../preferences/context'
import { BACKGROUND_PRESETS, LOGO_PRESETS } from '../preferences/types'
import {
  BACKGROUND_DEFAULTS,
  BACKGROUND_RANGES,
  formatBackgroundSettingValue,
  getBackgroundKeys,
  getBackgroundSettingLabel,
  getBackgroundSettings,
  type BackgroundSettingKey,
} from '../preferences/backgroundConfig'
import { THEME_PRESETS } from '../preferences/themes'
import { ScrollbarOverlay } from '../scrollbar/ScrollbarOverlay'

interface AppearanceModalProps {
  open: boolean
  onClose: () => void
}

export const AppearanceModal = ({ open, onClose }: AppearanceModalProps) => {
  const { preferences, updatePreferences } = usePreferences()
  const closeRef = useRef<HTMLButtonElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<Element | null>(null)
  const backgroundEnabled = preferences.background !== 'none'
  const backgroundKeys = backgroundEnabled ? getBackgroundKeys(preferences.background) : []
  const backgroundValues = backgroundEnabled
    ? getBackgroundSettings(preferences.background, preferences.backgroundSettings)
    : {}

  const updateBackgroundSetting = (key: BackgroundSettingKey, value: number) => {
    updatePreferences({
      backgroundSettings: {
        ...preferences.backgroundSettings,
        [preferences.background]: {
          ...(preferences.backgroundSettings[preferences.background] ?? {}),
          [key]: value,
        },
      },
    })
  }

  const resetBackgroundSettings = () => {
    if (!backgroundEnabled) return
    const next = { ...preferences.backgroundSettings }
    delete next[preferences.background]
    updatePreferences({ backgroundSettings: next, dotDensity: 1 })
  }

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pref-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="pref-modal" role="dialog" aria-modal="true" aria-labelledby="appearance-title">
        <header className="pref-modal-header">
          <div className="pref-modal-heading">
            <span className="page-eyebrow">Personalización</span>
            <h2 id="appearance-title">Apariencia</h2>
            <p className="pref-modal-subtitle">Temas, fondos animados y logo de la aplicación</p>
          </div>
          <button ref={closeRef} type="button" className="pref-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="pref-modal-body" ref={bodyRef}>
          <section aria-labelledby="appearance-theme">
            <h3 className="pref-section-title" id="appearance-theme">
              Tema de color
            </h3>
            <div className="appearance-themes">
              {THEME_PRESETS.map((theme) => {
                const active = preferences.theme === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`appearance-theme${active ? ' active' : ''}`}
                    onClick={() => updatePreferences({ theme: theme.id })}
                    aria-pressed={active}
                  >
                    <span className="appearance-theme-swatches" aria-hidden>
                      {theme.colors.map((color) => (
                        <span key={color} className="appearance-swatch" style={{ background: color }} />
                      ))}
                    </span>
                    <span className="appearance-theme-name">{theme.label}</span>
                    <span className="appearance-theme-description">{theme.description}</span>
                  </button>
                )
              })}
            </div>

            <div className="appearance-row" style={{ marginTop: '0.875rem' }}>
              <span className="pref-help">Modo de la interfaz</span>
              <div className="appearance-mode" role="group" aria-label="Modo de color">
                <button
                  type="button"
                  className={preferences.mode === 'dark' ? 'active' : ''}
                  onClick={() => updatePreferences({ mode: 'dark' })}
                  aria-pressed={preferences.mode === 'dark'}
                >
                  Oscuro
                </button>
                <button
                  type="button"
                  className={preferences.mode === 'light' ? 'active' : ''}
                  onClick={() => updatePreferences({ mode: 'light' })}
                  aria-pressed={preferences.mode === 'light'}
                >
                  Claro
                </button>
              </div>
            </div>
          </section>

          <section aria-labelledby="appearance-background">
            <h3 className="pref-section-title" id="appearance-background">
              Fondo animado
            </h3>
            <div className="appearance-backgrounds">
              {BACKGROUND_PRESETS.map((background) => {
                const active = preferences.background === background.id
                return (
                  <button
                    key={background.id}
                    type="button"
                    className={`appearance-background${active ? ' active' : ''}`}
                    onClick={() => updatePreferences({ background: background.id })}
                    aria-pressed={active}
                  >
                    <span className="appearance-background-name">{background.label}</span>
                    <span className="appearance-background-description">{background.description}</span>
                  </button>
                )
              })}
            </div>

            <div className="appearance-row" style={{ marginTop: '0.875rem' }}>
              <span className="pref-help">Opacidad de la capa de fondo</span>
              <div className="appearance-slider">
                <input
                  type="range"
                  min={0.1}
                  max={0.85}
                  step={0.05}
                  value={preferences.backgroundOpacity}
                  disabled={!backgroundEnabled}
                  aria-label="Opacidad del fondo animado"
                  onChange={(event) => updatePreferences({ backgroundOpacity: Number(event.target.value) })}
                />
                <span className="appearance-slider-value">
                  {Math.round(preferences.backgroundOpacity * 100)}%
                </span>
              </div>
            </div>

            {backgroundEnabled ? (
              <div className="appearance-row" style={{ marginTop: '0.875rem' }}>
                <span className="pref-help">
                  Cantidad de puntos <span className="appearance-inline-note">· multiplica la densidad</span>
                </span>
                <div className="appearance-slider">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.25}
                    value={preferences.dotDensity}
                    aria-label="Cantidad de puntos o partículas"
                    onChange={(event) =>
                      updatePreferences({ dotDensity: Number(event.target.value) })
                    }
                  />
                  <span className="appearance-slider-value">
                    {preferences.dotDensity.toFixed(2).replace(/\.00$/, '')}×
                  </span>
                </div>
              </div>
            ) : null}

            {backgroundEnabled && backgroundKeys.length > 0 ? (
              <div className="appearance-controls">
                <div className="appearance-controls-head">
                  <span className="pref-help">Ajustes del efecto</span>
                  <button type="button" className="appearance-reset" onClick={resetBackgroundSettings}>
                    <RotateCcw size={13} aria-hidden />
                    Restablecer
                  </button>
                </div>
                <div className="appearance-controls-grid">
                  {backgroundKeys.map((key) => {
                    const [min, max, step] = BACKGROUND_RANGES[key]
                    const value =
                      backgroundValues[key] ?? BACKGROUND_DEFAULTS[preferences.background]?.[key] ?? 0
                    const inputId = `background-${key}`
                    return (
                      <div key={key} className="appearance-control">
                        <span className="appearance-control-head">
                          <label htmlFor={inputId}>{getBackgroundSettingLabel(preferences.background, key)}</label>
                          <span className="appearance-control-value">
                            {formatBackgroundSettingValue(preferences.background, key, value)}
                          </span>
                        </span>
                        <input
                          id={inputId}
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={value}
                          onChange={(event) =>
                            updateBackgroundSetting(key, Number(event.target.value))
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="appearance-logo">
            <h3 className="pref-section-title" id="appearance-logo">
              Logo del header
            </h3>
            <div className="appearance-logos">
              {LOGO_PRESETS.map((logo) => {
                const active = preferences.logo === logo.id
                return (
                  <button
                    key={logo.id}
                    type="button"
                    className={`appearance-logo${active ? ' active' : ''}`}
                    onClick={() => updatePreferences({ logo: logo.id })}
                    aria-pressed={active}
                  >
                    <span className="appearance-logo-preview" aria-hidden>
                      {logo.id === 'full' ? (
                        <>
                          <img
                            src={preferences.mode === 'light' ? '/brand/isotipo-light.png' : '/brand/isotipo.png'}
                            alt=""
                            className="mark"
                          />
                          <img
                            src={preferences.mode === 'light' ? '/brand/wordmark-light.png' : '/brand/wordmark.png'}
                            alt=""
                            className="wordmark"
                          />
                        </>
                      ) : null}
                      {logo.id === 'mark' ? (
                        <img
                          src={preferences.mode === 'light' ? '/brand/isotipo-light.png' : '/brand/isotipo.png'}
                          alt=""
                          className="mark"
                        />
                      ) : null}
                      {logo.id === 'wordmark' ? (
                        <img
                          src={preferences.mode === 'light' ? '/brand/wordmark-light.png' : '/brand/wordmark.png'}
                          alt=""
                          className="wordmark"
                        />
                      ) : null}
                    </span>
                    <span className="appearance-logo-label">{logo.label}</span>
                    <span className="appearance-logo-description">{logo.description}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <ScrollbarOverlay targetRef={bodyRef} zIndex={1051} minThumb={28} />

        <footer className="pref-modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Listo
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
