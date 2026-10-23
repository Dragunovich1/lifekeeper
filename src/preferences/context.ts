import { createContext, useContext } from 'react'
import type { Preferences } from './types'

export interface PreferencesContextValue {
  preferences: Preferences
  updatePreferences: (patch: Partial<Preferences>) => void
  toggleMode: () => void
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export const usePreferences = () => {
  const context = useContext(PreferencesContext)
  if (!context) {
    throw new Error('usePreferences debe usarse dentro de un PreferencesProvider')
  }
  return context
}
