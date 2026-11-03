import { useEffect, useState } from 'react'
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'
import { formatAgo, useCloudStatus } from '../hooks/useCloudStatus'
import { useAppData } from '../hooks/useAppData'

/** Muestra si los datos están respaldados en la nube; si no, permite respaldar con un toque. */
export const SyncStatusChip = () => {
  const { state, session, linked } = useCloudStatus()
  const { syncNow } = useAppData()
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const run = async () => {
    if (!syncNow || busy) return
    setBusy(true)
    try {
      await syncNow()
    } finally {
      setBusy(false)
    }
  }

  let tone = 'ok'
  let label = ''
  let Icon = Cloud
  if (busy || state === 'syncing') {
    tone = 'busy'
    label = 'Sincronizando…'
    Icon = RefreshCw
  } else if (!linked) {
    tone = 'warn'
    label = 'Solo en este dispositivo · Respaldar'
    Icon = TriangleAlert
  } else if (state === 'offline') {
    tone = 'warn'
    label = 'Sin conexión · cambios pendientes'
    Icon = CloudOff
  } else if (state === 'error') {
    tone = 'warn'
    label = 'Error al sincronizar · Reintentar'
    Icon = TriangleAlert
  } else {
    const ago = formatAgo(session?.lastSync)
    label = ago ? `Sincronizado · ${ago}` : 'Sincronizado'
  }

  return (
    <button type="button" className={`sync-chip is-${tone}`} onClick={run} disabled={busy} title="Estado de respaldo en la nube">
      <Icon size={13} aria-hidden className={tone === 'busy' ? 'spin' : undefined} />
      <span>{label}</span>
    </button>
  )
}
