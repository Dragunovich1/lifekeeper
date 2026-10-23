import { useState } from 'react'
import { Copyright } from 'lucide-react'
import { siteConfig } from '../config'
import type { LegalDocKey } from '../content/legal'
import { LegalModal } from './LegalModal'

interface FooterProps {
  /** Año de copyright. Por defecto, el año actual. */
  year?: number
  /** Nombre del autor. Por defecto, el de `siteConfig`. */
  author?: string
  /** URL opcional para el nombre del autor. Por defecto, la de `siteConfig`. */
  link?: string
  /** Versión visible en el footer. Por defecto, la de `siteConfig`. */
  version?: string
  /** Clase extra para variantes (por ejemplo, dentro del login). */
  className?: string
}

export const Footer = ({
  year = new Date().getFullYear(),
  author = siteConfig.author,
  link = siteConfig.authorUrl || undefined,
  version = siteConfig.version,
  className,
}: FooterProps) => {
  const [legalDocument, setLegalDocument] = useState<LegalDocKey | null>(null)

  return (
    <>
      <footer className={className ? `site-footer ${className}` : 'site-footer'} role="contentinfo">
        <div className="site-footer-inner">
          <nav className="site-footer-links" aria-label="Enlaces legales">
            <button type="button" className="site-footer-link" onClick={() => setLegalDocument('privacy')}>
              Privacidad
            </button>
            <span className="site-footer-divider" aria-hidden>
              ·
            </span>
            <button type="button" className="site-footer-link" onClick={() => setLegalDocument('terms')}>
              Términos y condiciones
            </button>
          </nav>

          <div className="site-footer-meta">
            <span className="site-footer-copy">
              <Copyright aria-hidden />
              {year}{' '}
              {link ? (
                <a className="site-footer-link" href={link} target="_blank" rel="noreferrer noopener">
                  {author}
                </a>
              ) : (
                author
              )}
            </span>
            <span className="site-footer-sep" aria-hidden>
              |
            </span>
            <span className="site-footer-brand">LifeKeeper</span>
            <span className="site-footer-sep" aria-hidden>
              |
            </span>
            <span className="site-footer-version">v{version}</span>
          </div>
        </div>
      </footer>

      <LegalModal documentKey={legalDocument} onClose={() => setLegalDocument(null)} />
    </>
  )
}
