import type { DiaryEntry, MoodLevel } from '../../types'
import { subDays } from 'date-fns'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import { formatDate, toLocalDateKey } from '../../utils/dates'

const moodPalette: Record<MoodLevel, string> = {
  Excelente: 'var(--color-success)',
  Bien: 'var(--color-info)',
  Neutral: 'var(--color-text-muted)',
  Regular: 'var(--color-warning)',
  Mal: 'var(--color-error)',
}

const WELLNESS_TIPS: Array<{ title: string; detail: string }> = [
  {
    title: 'Pausa de 10 minutos al aire libre',
    detail:
      'Salí al balcón, patio o vereda a recibir luz natural y cambiar el foco visual sin llevar el teléfono.',
  },
  {
    title: 'Respiración 4-7-8 para bajar revoluciones',
    detail:
      'Inhalá por nariz durante 4 segundos, retené el aire 7 segundos y exhalá suave por boca durante 8 segundos (repetí 4 ciclos).',
  },
  {
    title: 'Reducí la lista de hoy a 1 sola tarea clave',
    detail:
      'Cuando la energía está baja, elegí una única prioridad pequeña y posponé sin culpa todo lo secundario.',
  },
  {
    title: 'Descargá lo que te preocupa en el diario',
    detail:
      'Poner en palabras una molestia o preocupación en un lugar privado reduce la carga mental inmediatamente.',
  },
  {
    title: 'Hidratación y chequeo corporal básico',
    detail:
      'Tomá un vaso grande de agua, comé algo nutritivo y revisá si dormiste lo suficiente anoche.',
  },
  {
    title: 'Contactá a un amigo o ser querido',
    detail:
      'Mandar un mensaje breve a alguien de confianza o compartir un audio corto ayuda a cortar el aislamiento.',
  },
  {
    title: 'Poné tu lista de música favorita',
    detail:
      'Escuchar 2 o 3 canciones que te gusten mucho ayuda a regular el estado emocional y destrabar la tensión.',
  },
  {
    title: 'Estiramiento suave de cuello y hombros',
    detail:
      'Hacé movimientos circulares lentos con los hombros y aflojá la mandíbula durante 2 minutos.',
  },
  {
    title: 'Desconexión de pantallas por 30 minutos',
    detail:
      'Silenciá notificaciones un rato para evitar la sobrecarga de noticias o comparaciones en redes.',
  },
  {
    title: 'Ordená un rincón pequeño de tu espacio',
    detail:
      'Despejar el escritorio o tender la cama da una sensación rápida y tangible de control y calma.',
  },
]

const getTopTags = (entries: DiaryEntry[], moods: MoodLevel[], limit = 6) => {
  const counts = new Map<string, number>()
  entries.forEach((entry) => {
    if (!moods.includes(entry.mood)) return
    entry.tags.forEach((rawTag) => {
      const tag = rawTag.trim()
      if (!tag) return
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    })
  })
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }))
}

const computeCurrentStreak = (entries: DiaryEntry[]): number => {
  const daySet = new Set<string>()
  entries.forEach((entry) => {
    const key = toLocalDateKey(entry.date)
    if (key) daySet.add(key)
  })
  if (daySet.size === 0) return 0

  let cursor = new Date()
  if (!daySet.has(toLocalDateKey(cursor))) {
    const yesterday = subDays(cursor, 1)
    if (!daySet.has(toLocalDateKey(yesterday))) {
      return 0
    }
    cursor = yesterday
  }

  let streak = 0
  while (daySet.has(toLocalDateKey(cursor))) {
    streak += 1
    cursor = subDays(cursor, 1)
  }
  return streak
}

export const MoodTrackerSection = () => {
  const { data, updateData } = useAppData()
  const entries = data.diary.entries
  const [tipIndex, setTipIndex] = useState(0)

  const todayKey = toLocalDateKey(new Date())

  const todayEntry = useMemo(
    () => entries.find((entry) => toLocalDateKey(entry.date) === todayKey),
    [entries, todayKey],
  )

  const {
    moodStats,
    totalDays,
    consecutiveLowDays,
    consecutiveMalDays,
    recentLowCount,
  } = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.date > b.date ? -1 : 1))
    const byDay = new Map<string, MoodLevel>()
    sorted.forEach((entry) => {
      const dayKey = toLocalDateKey(entry.date)
      if (dayKey && !byDay.has(dayKey)) {
        byDay.set(dayKey, entry.mood)
      }
    })

    const stats: Record<MoodLevel, number> = {
      Excelente: 0,
      Bien: 0,
      Neutral: 0,
      Regular: 0,
      Mal: 0,
    }

    byDay.forEach((mood) => {
      stats[mood] = (stats[mood] ?? 0) + 1
    })

    // Días únicos ordenados del más reciente al más antiguo
    const uniqueDaysDesc = Array.from(byDay.entries()).sort(([a], [b]) =>
      a > b ? -1 : 1,
    )

    let lowStreak = 0
    for (const [, mood] of uniqueDaysDesc) {
      if (mood === 'Regular' || mood === 'Mal') {
        lowStreak += 1
      } else {
        break
      }
    }

    let malStreak = 0
    for (const [, mood] of uniqueDaysDesc) {
      if (mood === 'Mal') {
        malStreak += 1
      } else {
        break
      }
    }

    const lastFive = uniqueDaysDesc.slice(0, 5)
    const lowInLastFive = lastFive.filter(
      ([, mood]) => mood === 'Regular' || mood === 'Mal',
    ).length

    return {
      moodStats: stats,
      totalDays: byDay.size || 1,
      consecutiveLowDays: lowStreak,
      consecutiveMalDays: malStreak,
      recentLowCount: lowInLastFive,
    }
  }, [entries])

  const showMajorAlert = consecutiveLowDays >= 4 || consecutiveMalDays >= 3
  const showWellnessTip =
    showMajorAlert ||
    consecutiveLowDays === 2 ||
    consecutiveLowDays === 3 ||
    todayEntry?.mood === 'Regular' ||
    todayEntry?.mood === 'Mal' ||
    recentLowCount >= 2

  const currentTip = WELLNESS_TIPS[tipIndex % WELLNESS_TIPS.length]

  const currentStreak = useMemo(() => computeCurrentStreak(entries), [entries])
  const positiveTags = useMemo(
    () => getTopTags(entries, ['Excelente', 'Bien']),
    [entries],
  )
  const challengingTags = useMemo(
    () => getTopTags(entries, ['Regular', 'Mal']),
    [entries],
  )

  const handleQuickMood = (mood: MoodLevel) => {
    const nowIso = new Date().toISOString()
    const currentDayKey = toLocalDateKey(nowIso)

    updateData((previous) => {
      const existingIndex = previous.diary.entries.findIndex(
        (entry) => toLocalDateKey(entry.date) === currentDayKey,
      )

      if (existingIndex >= 0) {
        const updatedEntries = [...previous.diary.entries]
        updatedEntries[existingIndex] = { ...updatedEntries[existingIndex], mood }
        return {
          ...previous,
          diary: {
            ...previous.diary,
            entries: updatedEntries,
          },
        }
      }

      const entry: DiaryEntry = {
        id: uuid(),
        date: nowIso,
        title: 'Seguimiento rápido',
        content: '',
        mood,
        tags: ['mood'],
      }

      return {
        ...previous,
        diary: {
          ...previous.diary,
          entries: [entry, ...previous.diary.entries],
        },
      }
    })
  }

  const latestEntries = useMemo(
    () => [...entries].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 14),
    [entries],
  )

  return (
    <div>
      <SectionHeader
        title="Estado de ánimo"
        subtitle="Visualizá tendencias, correlaciones y cargá el humor del día con un toque"
      />

      <div className="section-body">
        {showMajorAlert ? (
          <div className="alert alert-error" role="alert">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', width: '100%' }}>
              <strong>
                Alerta de bienestar: registramos varios días seguidos con ánimo bajo (
                {consecutiveLowDays} {consecutiveLowDays === 1 ? 'día' : 'días'})
              </strong>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                Notamos que el malestar viene persistiendo en tus últimos registros. No tenés por
                qué atravesarlo en soledad: apoyarte en alguien de confianza o conversar con un
                profesional de la salud puede marcar una gran diferencia hoy.
              </p>
              <div className="section-actions">
                <a className="primary-button" href="#health:emergency">
                  Ver contactos de emergencia / SOS
                </a>
                <a className="secondary-button" href="#health:consultations">
                  Agendar consulta médica
                </a>
                <a className="secondary-button" href="#diary:notes">
                  Descargar en el diario
                </a>
              </div>
            </div>
          </div>
        ) : null}

        {showWellnessTip ? (
          <div className="panel" style={{ borderColor: 'color-mix(in srgb, var(--color-warning) 45%, transparent)' }}>
            <div className="panel-header">
              <div>
                <span className="badge badge-warning">Acompañamiento de bienestar</span>
                <h3 className="panel-title" style={{ marginTop: '0.5rem' }}>
                  Acompañamiento y Consejos para Mejorar tu Ánimo
                </h3>
                <p className="panel-subtitle">
                  Detectamos días recientes exigentes ({recentLowCount} de los últimos 5 días
                  registrados). Probá una acción pequeña y concreta ahora:
                </p>
              </div>
              <div className="section-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setTipIndex((prev) => (prev + 1) % WELLNESS_TIPS.length)}
                >
                  Siguiente consejo ({tipIndex + 1}/{WELLNESS_TIPS.length})
                </button>
                <a className="primary-button" href="#diary:notes">
                  Escribir en mi diario
                </a>
              </div>
            </div>
            <div className="subpanel">
              <strong>{currentTip.title}</strong>
              <p className="panel-subtitle" style={{ margin: 0 }}>
                {currentTip.detail}
              </p>
            </div>
          </div>
        ) : null}

        <div className="panel">
          <h3 className="panel-title">Estado actual</h3>
          <p className="panel-subtitle">
            Hoy estás marcado como: {todayEntry ? todayEntry.mood : 'Sin registrar'}
          </p>
          <div className="chip-list">
            {(Object.keys(moodPalette) as MoodLevel[]).map((mood) => (
              <button
                key={mood}
                className="secondary-button"
                type="button"
                style={{ borderColor: moodPalette[mood], color: moodPalette[mood] }}
                onClick={() => handleQuickMood(mood)}
              >
                {mood}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Análisis de patrones y correlaciones</h3>
              <p className="panel-subtitle">
                Hábitos de registro y etiquetas que más coinciden con tus estados de ánimo
              </p>
            </div>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-title">Racha actual de registro</span>
              <span className="stat-value">
                {currentStreak} {currentStreak === 1 ? 'día' : 'días'}
              </span>
              <span className="panel-subtitle">Días consecutivos con entradas</span>
            </div>
            <div className="stat-card">
              <span className="stat-title">Etiquetas asociadas a buen ánimo</span>
              {positiveTags.length === 0 ? (
                <span className="panel-subtitle">Sin etiquetas registradas aún</span>
              ) : (
                <div className="chip-list">
                  {positiveTags.map(({ tag, count }) => (
                    <span key={tag} className="badge badge-success">
                      #{tag} ({count})
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="stat-card">
              <span className="stat-title">Etiquetas asociadas a días exigentes</span>
              {challengingTags.length === 0 ? (
                <span className="panel-subtitle">Sin etiquetas registradas aún</span>
              ) : (
                <div className="chip-list">
                  {challengingTags.map(({ tag, count }) => (
                    <span key={tag} className="badge badge-warning">
                      #{tag} ({count})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 className="panel-title">Resumen</h3>
          <div className="section-body">
            {(Object.keys(moodPalette) as MoodLevel[]).map((mood) => {
              const count = moodStats[mood]
              const percent = Math.round((count / totalDays) * 100)
              return (
                <div key={mood} className="subpanel">
                  <div className="panel-header">
                    <h4 className="panel-title">{mood}</h4>
                    <span className="panel-subtitle">
                      {count} {count === 1 ? 'día' : 'días'} ({percent}%)
                    </span>
                  </div>
                  <div className="mood-bar">
                    <span
                      className="mood-bar-fill"
                      style={{ width: `${percent}%`, background: moodPalette[mood] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="panel">
          <h3 className="panel-title">Últimos días</h3>
          {latestEntries.length === 0 ? (
            <div className="empty-state">Todavía no hay entradas en el diario.</div>
          ) : (
            <ul className="mood-history">
              {latestEntries.map((entry) => (
                <li key={entry.id}>
                  <span>{formatDate(entry.date)}</span>
                  <span style={{ color: moodPalette[entry.mood] }}>{entry.mood}</span>
                  <span>{entry.title || 'Sin título'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
