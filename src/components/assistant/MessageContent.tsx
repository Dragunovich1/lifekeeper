/**
 * Renderiza texto enriquecido del asistente: viñetas, negritas y saltos de línea.
 */
export function MessageContent({ content }: { content: string }) {
  return (
    <div className="asst-content">
      {content.split('\n').map((line, lineIdx) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={lineIdx} className="asst-content-gap" />

        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)
        const cleanLine = isBullet ? trimmed.replace(/^[•\-]\s*|^\d+\.\s*/, '') : line

        const rendered = cleanLine.split(/(\*\*.*?\*\*)/g).map((part, partIdx) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={partIdx}>{part.slice(2, -2)}</strong>
          ) : (
            part
          ),
        )

        if (isBullet) {
          return (
            <div key={lineIdx} className="asst-content-bullet">
              <span className="asst-content-dot">•</span>
              <div className="asst-content-text">{rendered}</div>
            </div>
          )
        }
        return (
          <div key={lineIdx} className="asst-content-line">
            {rendered}
          </div>
        )
      })}
    </div>
  )
}
