import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePreferences } from '../preferences/context'
import { getBackgroundSettings } from '../preferences/backgroundConfig'

/**
 * Fondo animado del pack Motion FX (WebGL + canvas).
 * Se embebe en un iframe aislado y se controla por postMessage.
 */
export const BackgroundFX = () => {
  const { preferences } = usePreferences()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 1000 : window.innerHeight,
  )
  const enabled = preferences.background !== 'none'

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Los efectos de puntos se vuelven más densos en pantallas grandes/fullscreen
  // y un poco más suaves en viewports bajos (mobile)
  const resolutionScale = Math.min(2, Math.max(0.9, viewportHeight / 1000))

  const sendEffect = useCallback(() => {
    if (!enabled) return
    const base = getBackgroundSettings(preferences.background, preferences.backgroundSettings)
    const settings =
      'density' in base
        ? {
            ...base,
            density: base.density * preferences.dotDensity * resolutionScale,
          }
        : base
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'lifeKeeper:fx', effect: preferences.background, settings },
      '*',
    )
  }, [
    enabled,
    preferences.background,
    preferences.backgroundSettings,
    preferences.dotDensity,
    resolutionScale,
  ])

  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(sendEffect, 350)
    return () => window.clearTimeout(timer)
  }, [enabled, sendEffect])

  if (!enabled) {
    return null
  }

  return (
    <div
      className="bg-fx"
      style={{ '--fx-opacity': preferences.backgroundOpacity } as CSSProperties}
      aria-hidden="true"
    >
      <iframe
        ref={iframeRef}
        title=""
        tabIndex={-1}
        src="/backgrounds/motion-fx.html?embed=1"
        onLoad={sendEffect}
      />
    </div>
  )
}
