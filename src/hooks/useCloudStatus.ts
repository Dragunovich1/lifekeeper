import { useEffect, useRef, useState } from 'react'
import { syncService, type CloudSession, type SyncState } from '../services/sync/syncService'

export interface CloudStatus {
  state: SyncState
  session: CloudSession | null
  /** Hay cuenta en la nube vinculada a este dispositivo. */
  linked: boolean
}

/** Estado en vivo de la sincronización con la nube. */
export const useCloudStatus = (): CloudStatus => {
  const [state, setState] = useState<SyncState>(() => syncService.getState())
  const [session, setSession] = useState<CloudSession | null>(() => syncService.getSession())

  useEffect(
    () =>
      syncService.subscribe((next) => {
        setState(next)
        setSession(syncService.getSession())
      }),
    [],
  )

  return { state, session, linked: Boolean(session) }
}

export const formatAgo = (iso?: string, now = Date.now()): string => {
  if (!iso) return ''
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

/**
 * Si la bóveda todavía no está vinculada a la nube (p. ej. el registro falló por falta de conexión
 * al crearla), reintenta al volver la conexión, al volver a la app y cada 2 minutos (máx. 6 veces).
 */
export const useCloudAutoRetry = (
  syncNow: (() => Promise<{ success: boolean; message: string }>) | undefined,
  enabled: boolean,
) => {
  const { linked } = useCloudStatus()
  const attemptsRef = useRef(0)
  const syncRef = useRef(syncNow)
  syncRef.current = syncNow
  const hasSync = Boolean(syncNow)
  useEffect(() => {
    if (!enabled || linked || !hasSync) return
    let running = false
    const attempt = async () => {
      if (running || attemptsRef.current >= 6) return
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      running = true
      attemptsRef.current += 1
      try {
        await syncRef.current?.()
      } catch {
        /* se reintenta más tarde */
      } finally {
        running = false
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && void attempt()
    const first = window.setTimeout(() => void attempt(), 4000)
    const timer = window.setInterval(() => void attempt(), 120_000)
    window.addEventListener('online', attempt)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      window.removeEventListener('online', attempt)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, linked, hasSync])
}
