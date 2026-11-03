import { useEffect } from 'react'

/**
 * En el celular las tablas se muestran como tarjetas apiladas (ver mobile.css).
 * Para eso cada celda necesita saber el nombre de su columna: se copia del encabezado a `data-label`.
 * Un observador lo mantiene al día cuando la tabla cambia (filtros, altas, bajas).
 */
export const labelTables = (root: ParentNode) => {
  root.querySelectorAll('table.table').forEach((table) => {
    const labels = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent ?? '').trim())
    if (labels.length === 0) return
    table.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((cell, i) => {
        const label = labels[i] ?? ''
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label)
      })
    })
  })
}

export const useStackedTables = (targetRef: React.RefObject<HTMLElement | null>, enabled: boolean) => {
  useEffect(() => {
    const el = targetRef.current
    if (!el || !enabled) return
    let raf = 0
    const run = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => labelTables(el))
    }
    run()
    const observer = new MutationObserver(run)
    observer.observe(el, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [targetRef, enabled])
}
