import { createContext } from 'react'
import type { AppData } from '../types'

export interface AppDataContextValue {
  data: AppData | null
  masterPassword: string | null
  hasVault: boolean
  error?: string
  unlock: (password: string) => Promise<void>
  createVault: (password: string) => Promise<void>
  lock: () => void
  resetVault: () => void
  updateData: (updater: (previous: AppData) => AppData) => void
  replaceData: (next: AppData) => void
}

export const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)
