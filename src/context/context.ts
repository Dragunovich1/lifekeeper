import { createContext } from 'react'
import type { AppData } from '../types'

export interface AppDataContextValue {
  data: AppData | null
  masterPassword: string | null
  hasVault: boolean
  error?: string
  unlock: (password: string, identifier?: string) => Promise<void>
  createVault: (
    password: string,
    initialProfile?: { firstName?: string; lastName?: string; fullName?: string; username?: string; email?: string },
  ) => Promise<void>
  lock: () => void
  resetVault: () => void
  updateData: (updater: (previous: AppData) => AppData) => void
  replaceData: (next: AppData) => void
  restoreFromCloud?: (identifier: string, password: string) => Promise<boolean>
  syncNow?: () => Promise<{ success: boolean; message: string }>
}

export const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)
