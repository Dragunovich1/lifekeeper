import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import type { AppData } from '../types'
import { decryptObject, encryptObject, hashPassword } from '../utils/encryption'
import { createEmptyAppData, ensureAppDataShape } from '../utils/defaultData'
import {
  clearAllData,
  loadEncryptedPayload,
  loadMasterHash,
  storeEncryptedPayload,
  storeMasterHash,
} from '../utils/storage'
import { AppDataContext } from './context'
import { syncService } from '../services/sync/syncService'


const stampAutomaticBackup = (payload: AppData): AppData => ({
  ...payload,
  utilities: {
    ...payload.utilities,
    backups: {
      ...payload.utilities.backups,
      lastAutomaticBackup: new Date().toISOString(),
    },
  },
})

export const AppDataProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<AppData | null>(null)
  const [masterPassword, setMasterPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const [hasVault, setHasVault] = useState<boolean>(() => Boolean(loadMasterHash()))

  const persist = useCallback(
    (payload: AppData, password: string) => {
      const normalized = ensureAppDataShape(payload)
      const stamped = stampAutomaticBackup(normalized)
      storeEncryptedPayload(encryptObject(stamped, password))
      setData(stamped)
    },
    [],
  )

  const unlock = useCallback(
    async (password: string) => {
      try {
        const storedHash = loadMasterHash()
        if (!storedHash) {
          throw new Error('No hay una boveda creada. Crea una contrasena maestra nueva.')
        }

        const hashedInput = hashPassword(password)
        if (hashedInput !== storedHash) {
          throw new Error('Contrasena incorrecta.')
        }

        const encrypted = loadEncryptedPayload()
        if (encrypted) {
          const decrypted = decryptObject<AppData>(encrypted, password)
          persist(ensureAppDataShape(decrypted), password)
        } else {
          const empty = createEmptyAppData()
          persist(empty, password)
        }

        setMasterPassword(password)
        setError(undefined)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Ocurrio un error al desbloquear'
        setError(message)
        throw err
      }
    },
    [persist],
  )

  const createVault = useCallback(
    async (password: string, initialProfile?: { fullName?: string; username?: string; email?: string }) => {
      const existingHash = loadMasterHash()
      if (existingHash) {
        throw new Error('Ya existe una contraseña maestra configurada.')
      }

      const empty = createEmptyAppData()
      if (initialProfile) {
        empty.profile = {
          ...empty.profile,
          fullName: initialProfile.fullName || '',
          nickName: initialProfile.username || '',
          auth: {
            ...empty.profile.auth,
            username: initialProfile.username || '',
            email: initialProfile.email || '',
          },
          updatedAt: new Date().toISOString(),
        }
      }

      const hashed = hashPassword(password)
      storeMasterHash(hashed)
      setHasVault(true)
      persist(empty, password)
      setMasterPassword(password)
      setError(undefined)

      // Registrar y respaldar en la nube (PostgreSQL Zero-Knowledge) de forma asíncrona
      if (initialProfile?.email) {
        void syncService.registerCloudAccount(initialProfile.email, password, empty)
      }
    },
    [persist],
  )

  const restoreFromCloud = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await syncService.loginCloudAccount(email, password)
        if (!res.success || !res.data) {
          throw new Error(res.error || 'No pudimos recuperar la bóveda de la nube')
        }
        const hashed = hashPassword(password)
        storeMasterHash(hashed)
        setHasVault(true)
        persist(res.data, password)
        setMasterPassword(password)
        setError(undefined)
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al sincronizar con la nube'
        setError(message)
        throw err
      }
    },
    [persist],
  )

  const lock = useCallback(() => {
    setMasterPassword(null)
    setData(null)
  }, [])

  const resetVault = useCallback(() => {
    clearAllData()
    setMasterPassword(null)
    setData(null)
    setHasVault(false)
    setError(undefined)
  }, [])

  const updateData = useCallback(
    (updater: (previous: AppData) => AppData) => {
      if (!masterPassword) {
        return
      }

      setData((previous) => {
        const base = ensureAppDataShape(previous ?? createEmptyAppData())
        const updated = ensureAppDataShape(updater(base))
        const stamped = stampAutomaticBackup(updated)
        storeEncryptedPayload(encryptObject(stamped, masterPassword))
        // Sincronización continua en la nube (PostgreSQL)
        void syncService.pushVault(stamped, masterPassword)
        return stamped
      })
    },
    [masterPassword],
  )

  const replaceData = useCallback(
    (next: AppData) => {
      if (!masterPassword) {
        return
      }

      persist(ensureAppDataShape(next), masterPassword)
      void syncService.pushVault(next, masterPassword)
    },
    [masterPassword, persist],
  )

  const value = useMemo(
    () => ({
      data,
      masterPassword,
      hasVault,
      error,
      unlock,
      createVault,
      lock,
      resetVault,
      updateData,
      replaceData,
      restoreFromCloud,
    }),
    [createVault, data, error, hasVault, lock, replaceData, resetVault, unlock, updateData, restoreFromCloud, masterPassword],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}