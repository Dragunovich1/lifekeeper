import { WELCOME_CARDS } from './constants'

export function WelcomeCards({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <div className="asst-welcome-grid" role="group" aria-label="Acciones sugeridas">
      {WELCOME_CARDS.map((c) => (
        <button key={c.title} type="button" className="asst-welcome-card" onClick={() => onSelect(c.query)}>
          <span className="asst-welcome-icon" aria-hidden="true">
            {c.icon}
          </span>
          <span className="asst-welcome-title">{c.title}</span>
          <span className="asst-welcome-hint">{c.hint}</span>
        </button>
      ))}
    </div>
  )
}
