import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppData } from '../types'
import { decryptObject, encryptObject, hashPassword } from '../utils/encryption'
import { createEmptyAppData, ensureAppDataShape } from '../utils/defaultData'
import {
  clearAllData,
  loadEncryptedPayload,
  loadMasterHash,
  loadProfileMeta,
  storeEncryptedPayload,
  storeMasterHash,
  storeProfileMeta,
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
  const dataRef = useRef<AppData | null>(null)
  dataRef.current = data

  const persist = useCallback((payload: AppData, password: string) => {
    const normalized = ensureAppDataShape(payload)
    const stamped = stampAutomaticBackup(normalized)
    storeEncryptedPayload(encryptObject(stamped, password))
    setData(stamped)
    return stamped
  }, [])

  const restoreFromCloud = useCallback(
    async (identifier: string, password: string) => {
      try {
        const res = await syncService.loginCloudAccount(identifier, password)
        if (!res.success || !res.data) {
          throw new Error(res.error || 'No pudimos recuperar la bóveda de la nube')
        }
        const hashed = hashPassword(password)
        storeMasterHash(hashed)
        setHasVault(true)

        const normalized = ensureAppDataShape(res.data)
        const resolvedUsername =
          res.username || normalized.profile.auth.username || normalized.profile.nickName || identifier.trim()
        const resolvedEmail = res.email || normalized.profile.auth.email || ''

        storeProfileMeta({
          username: resolvedUsername,
          email: resolvedEmail,
        })

        persist(normalized, password)
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

  const unlock = useCallback(
    async (password: string, identifier?: string) => {
      try {
        const storedHash = loadMasterHash()

        // Si este dispositivo (ej. Smartphone nuevo o APK) no tiene bóveda local aún,
        // intentamos recuperar automáticamente la bóveda existente desde el servidor PostgreSQL.
        if (!storedHash) {
          const meta = loadProfileMeta()
          const lookupId = (identifier || meta?.email || meta?.username || '').trim()
          if (lookupId) {
            await restoreFromCloud(lookupId, password)
            return
          }
          throw new Error('No hay una bóveda local. Ingresá tu usuario o email para sincronizar desde el servidor.')
        }

        const hashedInput = hashPassword(password)
        if (hashedInput !== storedHash) {
          // Si cambió la contraseña en otro dispositivo o quiere entrar con otra cuenta de la nube
          const meta = loadProfileMeta()
          const lookupId = (identifier || meta?.email || meta?.username || '').trim()
          if (lookupId) {
            try {
              await restoreFromCloud(lookupId, password)
              return
            } catch {
              // Si también falla en la nube, reportar contraseña incorrecta
            }
          }
          throw new Error('Contraseña incorrecta.')
        }

        const encrypted = loadEncryptedPayload()
        let currentData: AppData
        if (encrypted) {
          const decrypted = decryptObject<AppData>(encrypted, password)
          currentData = ensureAppDataShape(decrypted)
        } else {
          currentData = createEmptyAppData()
        }

        // Asegurar metadatos de perfil si no estaban completos
        const meta = loadProfileMeta()
        const cleanId = identifier?.trim()
        if (cleanId && !currentData.profile.auth.username && !cleanId.includes('@')) {
          currentData.profile.auth.username = cleanId
        }
        if (meta?.email && !currentData.profile.auth.email) {
          currentData.profile.auth.email = meta.email
        }
        if (currentData.profile.auth.username || currentData.profile.auth.email) {
          storeProfileMeta({
            username: currentData.profile.auth.username || meta?.username || cleanId,
            email: currentData.profile.auth.email || meta?.email,
          })
        }

        const stamped = persist(currentData, password)
        setMasterPassword(password)
        setError(undefined)

        // Sincronización bidireccional en segundo plano al desbloquear:
        // 1) Si la bóveda de Desktop aún no estaba en PostgreSQL, la registra y sube.
        // 2) Si en el servidor hay una versión más reciente (editada en otro dispositivo), la descarga y actualiza.
        void syncService.syncBidirectional(stamped, password, cleanId || meta?.email || meta?.username).then((syncRes) => {
          if (syncRes.action === 'pulled' && syncRes.data) {
            persist(syncRes.data, password)
          }
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Ocurrió un error al desbloquear'
        setError(message)
        throw err
      }
    },
    [persist, restoreFromCloud],
  )

  const createVault = useCallback(
    async (
      password: string,
      initialProfile?: { firstName?: string; lastName?: string; fullName?: string; username?: string; email?: string },
    ) => {
      const existingHash = loadMasterHash()
      if (existingHash) {
        throw new Error('Ya existe una contraseña maestra configurada.')
      }

      const empty = createEmptyAppData()
      if (initialProfile) {
        const first = (initialProfile.firstName || '').trim()
        const last = (initialProfile.lastName || '').trim()
        const full = initialProfile.fullName || (first && last ? `${first} ${last}` : first || last || '')

        empty.profile = {
          ...empty.profile,
          firstName: first,
          lastName: last,
          fullName: full,
          nickName: initialProfile.username || first || '',
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
      const stamped = persist(empty, password)
      setMasterPassword(password)
      setError(undefined)

      // Registrar y respaldar en la nube (PostgreSQL Zero-Knowledge) de forma asíncrona
      const email = initialProfile?.email?.trim() || (initialProfile?.username ? `${initialProfile.username.trim().toLowerCase()}@lifekeeper.local` : '')
      if (email) {
        void syncService.registerCloudAccount(email, password, stamped, initialProfile?.username)
      }
    },
    [persist],
  )

  const syncNow = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!masterPassword || !dataRef.current) {
      return { success: false, message: 'Desbloqueá la bóveda primero para sincronizar.' }
    }
    const meta = loadProfileMeta()
    const res = await syncService.syncBidirectional(
      dataRef.current,
      masterPassword,
      meta?.email || meta?.username,
    )
    if (res.action === 'pulled' && res.data) {
      persist(res.data, masterPassword)
      return { success: true, message: 'Se descargó la versión más reciente desde el servidor.' }
    }
    if (res.action === 'registered' || res.action === 'pushed') {
      return { success: true, message: 'Bóveda sincronizada y respaldada en el servidor correctamente.' }
    }
    if (res.action === 'error') {
      return { success: false, message: res.error || 'No se pudo conectar con el servidor.' }
    }
    return { success: true, message: 'La bóveda ya está al día con el servidor.' }
  }, [masterPassword, persist])

  // Auto-pull cuando el usuario vuelve a la pestaña / app en Smartphone o Desktop
  useEffect(() => {
    if (!masterPassword) return
    const checkRemoteUpdates = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return
      const session = syncService.getSession()
      if (!session || !syncService.isOnline()) return
      const currentVersion = session.vaultVersion || 1
      void syncService.pullVault(masterPassword).then((res) => {
        if (res.success && res.data && (res.version || 1) > currentVersion) {
          persist(res.data, masterPassword)
        }
      })
    }
    window.addEventListener('focus', checkRemoteUpdates)
    document.addEventListener('visibilitychange', checkRemoteUpdates)
    return () => {
      window.removeEventListener('focus', checkRemoteUpdates)
      document.removeEventListener('visibilitychange', checkRemoteUpdates)
    }
  }, [masterPassword, persist])

  const lock = useCallback(() => {
    setMasterPassword(null)
    setData(null)
  }, [])

  const resetVault = useCallback(() => {
    clearAllData()
    syncService.clearSession()
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

      const stamped = persist(ensureAppDataShape(next), masterPassword)
      void syncService.pushVault(stamped, masterPassword)
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
      syncNow,
    }),
    [createVault, data, error, hasVault, lock, replaceData, resetVault, unlock, updateData, restoreFromCloud, syncNow, masterPassword],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
