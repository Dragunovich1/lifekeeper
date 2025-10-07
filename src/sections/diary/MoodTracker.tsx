import type { DiaryEntry, MoodLevel } from '../../types'
import { useMemo } from 'react'
import { v4 as uuid } from 'uuid'
import { SectionHeader } from '../../components/SectionHeader'
import { useAppData } from '../../hooks/useAppData'
import { formatDate, isSameDayString } from '../../utils/dates'

const moodPalette: Record<MoodLevel, string> = {
  Excelente: '#22c55e',
  Bien: '#38bdf8',
  Neutral: '#94a3b8',
  Regular: '#f59e0b',
  Mal: '#ef4444',
}

export const MoodTrackerSection = () => {
  const { data, updateData } = useAppData()
  const entries = data.diary.entries

  const today = new Date().toISOString()
  const todayEntry = useMemo(() => entries.find((entry) => isSameDayString(entry.date, today)), [entries, today])

  const moodStats = useMemo(() => {
    return entries.reduce<Record<MoodLevel, number>>(
      (acc, entry) => {
        acc[entry.mood] = (acc[entry.mood] ?? 0) + 1
        return acc
      },
      {
        Excelente: 0,
        Bien: 0,
        Neutral: 0,
        Regular: 0,
        Mal: 0,
      },
    )
  }, [entries])

  const totalEntries = entries.length || 1

  const handleQuickMood = (mood: MoodLevel) => {
    const todayIso = new Date().toISOString()
    updateData((previous) => {
      const existingIndex = previous.diary.entries.findIndex((entry) => isSameDayString(entry.date, todayIso))

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
        date: todayIso,
        title: 'Seguimiento rapido',
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

  const latestEntries = useMemo(() => entries.slice(0, 14), [entries])

  return (
    <div>
      <SectionHeader
        title="Estado de animo"
        subtitle="Visualiza tendencias y carga el humor del dia con un toque"
      />

      <div className="section-body">
        <div className="panel">
          <h3 className="panel-title">Estado actual</h3>
          <p className="panel-subtitle">
            Hoy estas marcado como: {todayEntry ? todayEntry.mood : 'Sin registrar'}
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
          <h3 className="panel-title">Resumen</h3>
          <div className="section-body">
            {(Object.keys(moodPalette) as MoodLevel[]).map((mood) => {
              const count = moodStats[mood]
              const percent = Math.round((count / totalEntries) * 100)
              return (
                <div key={mood} className="panel">
                  <div className="panel-header">
                    <h4 className="panel-title">{mood}</h4>
                    <span className="panel-subtitle">{count} dias ({percent}%)</span>
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
          <h3 className="panel-title">Ultimos dias</h3>
          {latestEntries.length === 0 ? (
            <div className="empty-state">Todavia no hay entradas en el diario.</div>
          ) : (
            <ul className="mood-history">
              {latestEntries.map((entry) => (
                <li key={entry.id}>
                  <span>{formatDate(entry.date)}</span>
                  <span style={{ color: moodPalette[entry.mood] }}>{entry.mood}</span>
                  <span>{entry.title || 'Sin titulo'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
