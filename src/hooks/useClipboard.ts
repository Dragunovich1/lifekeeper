import { useCallback, useRef, useState } from 'react'

type ClipboardStatus = 'idle' | 'copied' | 'error'

export const useClipboard = () => {
  const [status, setStatus] = useState<ClipboardStatus>('idle')
  const timeoutRef = useRef<number | null>(null)

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setStatus('idle')
  }, [])

  const copy = useCallback(async (value: string, clearDelayMs = 60000) => {
    try {
      await navigator.clipboard.writeText(value)
      setStatus('copied')

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }

      if (clearDelayMs > 0) {
        timeoutRef.current = window.setTimeout(async () => {
          try {
            await navigator.clipboard.writeText('')
          } finally {
            reset()
          }
        }, clearDelayMs)
      }
    } catch (error) {
      console.error('No se pudo copiar al portapapeles', error)
      setStatus('error')
    }
  }, [reset])

  return { status, copy, reset }
}
