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
    async (password: string) => {
      const existingHash = loadMasterHash()
      if (existingHash) {
        throw new Error('Ya existe una contrasena maestra configurada.')
      }

      const empty = createEmptyAppData()
      const hashed = hashPassword(password)
      storeMasterHash(hashed)
      setHasVault(true)
      persist(empty, password)
      setMasterPassword(password)
      setError(undefined)
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
    }),
    [createVault, data, error, hasVault, lock, replaceData, resetVault, unlock, updateData, masterPassword],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}