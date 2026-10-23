import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PreferencesContext } from './context'
import {
  BACKGROUND_PRESETS,
  CURRENCY_OPTIONS,
  DEFAULT_PREFERENCES,
  LOGO_PRESETS,
  type BackgroundId,
  type ColorMode,
  type CurrencyCode,
  type LogoVariant,
  type Preferences,
  type ThemeId,
  type UnitSystem,
} from './types'
import { THEME_PRESETS } from './themes'

const STORAGE_KEY = 'lifekeeper:preferences'

const isThemeId = (value: unknown): value is ThemeId =>
  THEME_PRESETS.some((theme) => theme.id === value)

const isBackgroundId = (value: unknown): value is BackgroundId =>
  BACKGROUND_PRESETS.some((background) => background.id === value)

const isLogoVariant = (value: unknown): value is LogoVariant =>
  LOGO_PRESETS.some((logo) => logo.id === value)

const isMode = (value: unknown): value is ColorMode => value === 'dark' || value === 'light'

const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  CURRENCY_OPTIONS.some((curr) => curr.value === value)

const isUnitSystem = (value: unknown): value is UnitSystem =>
  value === 'metric' || value === 'imperial'

const loadPreferences = (): Preferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<Preferences>
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      theme: isThemeId(parsed.theme) ? parsed.theme : DEFAULT_PREFERENCES.theme,
      mode: isMode(parsed.mode) ? parsed.mode : DEFAULT_PREFERENCES.mode,
      background: isBackgroundId(parsed.background) ? parsed.background : DEFAULT_PREFERENCES.background,
      logo: isLogoVariant(parsed.logo) ? parsed.logo : DEFAULT_PREFERENCES.logo,
      backgroundOpacity: typeof parsed.backgroundOpacity === 'number'
        ? Math.min(0.85, Math.max(0.1, parsed.backgroundOpacity))
        : DEFAULT_PREFERENCES.backgroundOpacity,
      backgroundSettings:
        parsed.backgroundSettings && typeof parsed.backgroundSettings === 'object'
          ? parsed.backgroundSettings
          : DEFAULT_PREFERENCES.backgroundSettings,
      dotDensity:
        typeof parsed.dotDensity === 'number'
          ? Math.min(5, Math.max(1, parsed.dotDensity))
          : DEFAULT_PREFERENCES.dotDensity,
      autoLockMinutes: typeof parsed.autoLockMinutes === 'number' ? parsed.autoLockMinutes : 0,
      startSection: parsed.startSection === 'last' ? 'last' : 'dashboard',
      currency: isCurrencyCode(parsed.currency) ? parsed.currency : DEFAULT_PREFERENCES.currency,
      unitSystem: isUnitSystem(parsed.unitSystem) ? parsed.unitSystem : DEFAULT_PREFERENCES.unitSystem,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = preferences.theme
    root.classList.toggle('light-theme', preferences.mode === 'light')
    root.classList.toggle('dark-theme', preferences.mode === 'dark')
    root.classList.toggle('has-fx', preferences.background !== 'none')
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // sin persistencia (modo privado)
    }
  }, [preferences])

  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    setPreferences((current) => ({ ...current, ...patch }))
  }, [])

  const toggleMode = useCallback(() => {
    setPreferences((current) => ({ ...current, mode: current.mode === 'dark' ? 'light' : 'dark' }))
  }, [])

  const value = useMemo(
    () => ({ preferences, updatePreferences, toggleMode }),
    [preferences, updatePreferences, toggleMode],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
