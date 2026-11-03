import { useEffect, useRef } from 'react'
import { App as CapApp } from '@capacitor/app'
import { isNativePlatform } from '../services/platform'

interface BackHandlers {
  /** Cierra la capa superior abierta (menú, asistente, avisos…). Devuelve true si cerró algo. */
  closeTopLayer: () => boolean
  /** Vuelve al inicio si está dentro de una sección. Devuelve true si navegó. */
  goHome: () => boolean
  onExitHint: () => void
}

/**
 * Botón/gesto "Atrás" de Android: cierra lo que esté abierto, después vuelve al inicio,
 * y en el inicio pide tocar dos veces para salir.
 */
export const useAndroidBackButton = (handlers: BackHandlers) => {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!isNativePlatform()) return
    let lastBack = 0
    let remove: (() => void) | undefined
    let cancelled = false

    void CapApp.addListener('backButton', () => {
      const h = ref.current
      if (h.closeTopLayer()) return
      // Cualquier modal con aria-modal responde a Escape
      if (document.querySelector('[aria-modal="true"]')) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        return
      }
      if (h.goHome()) return
      const now = Date.now()
      if (now - lastBack < 2000) {
        void CapApp.exitApp()
        return
      }
      lastBack = now
      h.onExitHint()
    }).then((handle) => {
      if (cancelled) void handle.remove()
      else remove = () => void handle.remove()
    })

    return () => {
      cancelled = true
      remove?.()
    }
  }, [])
}
