import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Sparkles,
} from 'lucide-react'
import { ScrollbarOverlay } from '../scrollbar/ScrollbarOverlay'
import type { InsightItem, InsightSeverity } from '../utils/insights'

export interface AlertsPopoverProps {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  insights: InsightItem[]
  criticalCount: number
  warningCount: number
  infoCount: number
  onClose: () => void
}

const POPOVER_WIDTH = 380
const POPOVER_GAP = 10

const renderSeverityIcon = (severity: InsightSeverity) => {
  switch (severity) {
    case 'critical':
      return <AlertCircle size={16} aria-hidden />
    case 'warning':
      return <AlertTriangle size={16} aria-hidden />
    case 'info':
      return <Info size={16} aria-hidden />
    case 'success':
      return <CheckCircle2 size={16} aria-hidden />
  }
}

export const AlertsPopover = ({
  open,
  anchorRef,
  insights,
  criticalCount,
  warningCount,
  infoCount,
  onClose,
}: AlertsPopoverProps) => {
  const popoverRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const computePosition = () => {
    const trigger = anchorRef.current
    if (!trigger) return null
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - 24)
    const idealLeft = rect.right - width
    const maxLeft = Math.max(12, window.innerWidth - width - 12)
    return {
      top: Math.round(rect.bottom + POPOVER_GAP),
      left: Math.round(Math.min(Math.max(12, idealLeft), maxLeft)),
    }
  }

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const update = () => setPosition(computePosition())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return
      }
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose, anchorRef])

  if (!open || !position || typeof document === 'undefined') return null

  const handleSelectInsight = (item: InsightItem) => {
    window.location.hash = item.targetHash
    onClose()
  }

  return createPortal(
    <div
      ref={popoverRef}
      className="app-alerts-popover is-portal"
      role="dialog"
      aria-label="Centro de alertas inteligentes"
      style={{ top: position.top, left: position.left }}
    >
      <header className="app-alerts-header">
        <div className="app-alerts-heading">
          <span className="app-alerts-title">
            <Sparkles size={15} aria-hidden />
            Centro de alertas
          </span>
          <span className="app-alerts-subtitle">
            {insights.length === 0
              ? 'Tu bóveda está al día'
              : `${insights.length} ${insights.length === 1 ? 'aviso activo' : 'avisos activos'}`}
          </span>
        </div>

        {insights.length > 0 ? (
          <div className="app-alerts-counters" aria-label="Resumen por prioridad">
            {criticalCount > 0 ? (
              <span className="app-alerts-pill is-critical" title="Críticas">
                {criticalCount}
              </span>
            ) : null}
            {warningCount > 0 ? (
              <span className="app-alerts-pill is-warning" title="Atención">
                {warningCount}
              </span>
            ) : null}
            {infoCount > 0 ? (
              <span className="app-alerts-pill is-info" title="Informativas">
                {infoCount}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <div ref={listRef} className="app-alerts-list">
        {insights.length === 0 ? (
          <div className="app-alerts-empty">
            <span className="app-alerts-empty-icon" aria-hidden>
              <CheckCircle2 size={24} />
            </span>
            <p className="app-alerts-empty-title">Todo al día. No hay alertas pendientes</p>
            <p className="app-alerts-empty-sub">
              Tus recordatorios, vacunas, medicaciones y controles de seguridad están en orden.
            </p>
          </div>
        ) : (
          insights.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`app-alert-item is-${item.severity}`}
              onClick={() => handleSelectInsight(item)}
            >
              <span className={`app-alert-icon is-${item.severity}`}>
                {renderSeverityIcon(item.severity)}
              </span>

              <span className="app-alert-body">
                <span className="app-alert-top">
                  <span className="app-alert-title">{item.title}</span>
                  {item.meta ? <span className="app-alert-meta">{item.meta}</span> : null}
                </span>
                <span className="app-alert-desc">{item.description}</span>
                <span className="app-alert-action">
                  {item.actionLabel}
                  <ArrowUpRight size={13} aria-hidden />
                </span>
              </span>
            </button>
          ))
        )}
      </div>

      <ScrollbarOverlay targetRef={listRef} zIndex={1105} minThumb={24} />
    </div>,
    document.body,
  )
}
