import { useContext } from 'react'
import type { AppData } from '../types'
import { AppDataContext, type AppDataContextValue } from '../context/context'

export type UnlockedAppDataContextValue = Omit<AppDataContextValue, 'data' | 'masterPassword'> & {
  data: AppData
  masterPassword: string
}

export const useAppData = (): UnlockedAppDataContextValue => {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error('useAppData debe utilizarse dentro de un AppDataProvider')
  }

  if (!context.masterPassword || !context.data) {
    throw new Error('La boveda aun no esta desbloqueada')
  }

  return {
    ...context,
    data: context.data,
    masterPassword: context.masterPassword,
  }
}

export const useAppDataUnsafe = () => {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error('useAppDataUnsafe debe utilizarse dentro de un AppDataProvider')
  }

  return context
}