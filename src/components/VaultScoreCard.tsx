import { useState } from 'react'
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { computeVaultHealthScore, type VaultHealthScoreResult } from '../utils/vaultScore'
import { useAppData } from '../hooks/useAppData'

interface VaultScoreCardProps {
  onOpenAssistant?: () => void
}

export const VaultScoreCard = ({ onOpenAssistant: _onOpenAssistant }: VaultScoreCardProps) => {
  const { data } = useAppData()
  const [expanded, setExpanded] = useState(false)
  const result: VaultHealthScoreResult = computeVaultHealthScore(data)

  const { totalScore, levelLabel, levelBadgeClass, pillars, topRecommendations } = result

  return (
    <section className="panel" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="panel-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(29, 99, 220, 0.25)',
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 className="panel-title" style={{ margin: 0 }}>
                Vault Health Score
              </h3>
              <span className={levelBadgeClass} style={{ fontSize: '0.75rem' }}>
                {levelLabel}
              </span>
            </div>
            <p className="panel-subtitle" style={{ margin: '0.15rem 0 0' }}>
              Índice integral de salud, seguridad y estabilidad de tu bóveda
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="secondary-button"
            style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Barra de progreso de puntuación */}
      <div style={{ margin: '0.75rem 0 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Puntuación global:</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
            <strong style={{ fontSize: '1.75rem', color: 'var(--color-accent-blue)', lineHeight: 1 }}>
              {totalScore}
            </strong>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>/ 100 pts</span>
          </div>
        </div>

        <div
          style={{
            height: '10px',
            background: 'var(--color-surface-sunken)',
            borderRadius: '999px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${totalScore}%`,
              background: 'linear-gradient(90deg, var(--color-accent-cyan), var(--color-accent-blue), var(--color-accent-purple))',
              borderRadius: '999px',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      </div>

      {/* Grilla de los 4 pilares */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div className="subpanel" style={{ padding: '0.625rem 0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Seguridad</span>
            <span className={pillars.security.badgeClass} style={{ fontSize: '0.7rem' }}>
              {pillars.security.score}/25
            </span>
          </div>
          <div style={{ height: '4px', background: 'var(--color-bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pillars.security.percent}%`, background: 'var(--color-accent-blue)' }} />
          </div>
        </div>

        <div className="subpanel" style={{ padding: '0.625rem 0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Salud</span>
            <span className={pillars.health.badgeClass} style={{ fontSize: '0.7rem' }}>
              {pillars.health.score}/25
            </span>
          </div>
          <div style={{ height: '4px', background: 'var(--color-bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pillars.health.percent}%`, background: 'var(--color-accent-cyan)' }} />
          </div>
        </div>

        <div className="subpanel" style={{ padding: '0.625rem 0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Finanzas</span>
            <span className={pillars.finances.badgeClass} style={{ fontSize: '0.7rem' }}>
              {pillars.finances.score}/25
            </span>
          </div>
          <div style={{ height: '4px', background: 'var(--color-bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pillars.finances.percent}%`, background: 'var(--color-accent-purple)' }} />
          </div>
        </div>

        <div className="subpanel" style={{ padding: '0.625rem 0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Bienestar</span>
            <span className={pillars.wellness.badgeClass} style={{ fontSize: '0.7rem' }}>
              {pillars.wellness.score}/25
            </span>
          </div>
          <div style={{ height: '4px', background: 'var(--color-bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pillars.wellness.percent}%`, background: 'var(--color-warning)' }} />
          </div>
        </div>
      </div>

      {/* Desglose expandible con recomendaciones para subir puntaje */}
      {expanded && (
        <div className="subpanel field-full" style={{ marginTop: '1rem', background: 'var(--color-surface-sunken)' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            Recomendaciones para alcanzar el 100/100
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--color-text-primary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {topRecommendations.map((tip, idx) => (
              <li key={idx}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
