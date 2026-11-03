import { useEffect, useRef } from 'react'

export type QuickActionKind = 'expense' | 'income' | 'measurement' | 'reminder'

let pending: QuickActionKind | null = null
const EVENT = 'lk:quick-action'

/** Pide que la sección correspondiente abra su formulario (aunque todavía no esté montada). */
export const requestQuickAction = (kind: QuickActionKind) => {
  pending = kind
  window.dispatchEvent(new Event(EVENT))
}

const take = (kinds: QuickActionKind[]): QuickActionKind | null => {
  if (pending && kinds.includes(pending)) {
    const k = pending
    pending = null
    return k
  }
  return null
}

/** Ejecuta `handler` cuando se pide una de las acciones, al montar o mientras está abierta. */
export const useQuickAction = (kinds: QuickActionKind[], handler: (kind: QuickActionKind) => void) => {
  const ref = useRef(handler)
  ref.current = handler
  const key = kinds.join(',')
  useEffect(() => {
    const list = key.split(',') as QuickActionKind[]
    const run = () => {
      const k = take(list)
      if (k) ref.current(k)
    }
    const t = window.setTimeout(run, 150) // deja montar el formulario
    window.addEventListener(EVENT, run)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener(EVENT, run)
    }
  }, [key])
}
