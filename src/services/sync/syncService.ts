/**
 * Servicio de Sincronización y Persistencia de LifeKeeper.
 * Soporta modo Offline-First con sincronización bidireccional en la nube (PostgreSQL Zero-Knowledge)
 * tanto en Web (Desktop/Móvil) como en APK nativa Android (Capacitor).
 */

import type { AppData } from '../../types'
import { apiFetch } from '../api/apiConfig'
import {
  deriveMasterKeys,
  encryptVaultData,
  decryptVaultData,
  type EncryptedVaultPayload,
} from '../crypto/zeroKnowledge'

export type SyncState = 'synced' | 'syncing' | 'pending' | 'offline' | 'error'

export interface CloudSession {
  userId: string
  email: string
  username?: string
  token: string
  salt: string
  lastSync?: string
  vaultVersion?: number
}

const STORAGE_KEY_SESSION = 'lifekeeper_cloud_session_v1'
const STORAGE_KEY_PENDING_SYNC = 'lifekeeper_pending_cloud_sync_v1'

/**
 * Estima la cantidad de registros cargados en una bóveda para evitar pisar una bóveda
 * llena en Desktop con una bóveda recién inicializada o vacía.
 */
function countVaultRecords(data: AppData): number {
  try {
    return (
      (data.health?.vaccines?.length || 0) +
      (data.health?.consultations?.length || 0) +
      (data.health?.medications?.length || 0) +
      (data.health?.clinicalNotes?.length || 0) +
      (data.health?.hydrationLogs?.length || 0) +
      (data.diary?.entries?.length || 0) +
      (data.security?.passwordEntries?.length || 0) +
      (data.security?.documents?.length || 0) +
      (data.security?.privateNotes?.length || 0) +
      (data.personal?.finances?.length || 0) +
      (data.personal?.debts?.length || 0) +
      (data.personal?.savingsGoals?.length || 0) +
      (data.personal?.projects?.length || 0) +
      (data.personal?.vehicles?.length || 0) +
      (data.personal?.workouts?.length || 0) +
      (data.utilities?.reminders?.length || 0) +
      (data.profile?.fullName ? 1 : 0)
    )
  } catch {
    return 0
  }
}

export class SyncService {
  private static instance: SyncService
  private state: SyncState = 'synced'
  private listeners: Array<(state: SyncState) => void> = []

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true))
      window.addEventListener('offline', () => this.handleNetworkChange(false))
      this.state = navigator.onLine ? 'synced' : 'offline'
    }
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService()
    }
    return SyncService.instance
  }

  public subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener)
    listener(this.state)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private setState(next: SyncState) {
    this.state = next
    this.listeners.forEach((listener) => listener(next))
  }

  public getState(): SyncState {
    return this.state
  }

  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  }

  public getSession(): CloudSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSION)
      return raw ? (JSON.parse(raw) as CloudSession) : null
    } catch {
      return null
    }
  }

  public saveSession(session: CloudSession) {
    try {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session))
    } catch {
      // Ignore storage errors
    }
  }

  public clearSession() {
    localStorage.removeItem(STORAGE_KEY_SESSION)
    localStorage.removeItem(STORAGE_KEY_PENDING_SYNC)
    this.setState('synced')
  }

  private handleNetworkChange(online: boolean) {
    if (!online) {
      this.setState('offline')
    } else {
      this.setState('synced')
    }
  }

  /**
   * Registra una cuenta en el servidor backend y almacena el primer snapshot en PostgreSQL.
   */
  public async registerCloudAccount(
    email: string,
    masterPassword: string,
    initialData: AppData,
    username?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.setState('syncing')
      const cleanEmail = email.trim().toLowerCase()
      const cleanUser = (username || initialData.profile?.auth?.username || initialData.profile?.nickName || '').trim()
      const { encryptionKey, authHash, salt } = await deriveMasterKeys(masterPassword)
      const encrypted = await encryptVaultData(initialData, encryptionKey, 1)

      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          username: cleanUser || undefined,
          auth_hash: authHash,
          salt,
          encrypted_data: encrypted.ciphertext,
          iv: encrypted.iv,
          auth_tag: 'embedded',
          checksum: encrypted.checksum,
          device_id: typeof navigator !== 'undefined' ? navigator.userAgent : 'web-client',
        }),
      })

      const resData = await response.json()
      if (!response.ok) {
        // Si el usuario ya existía en la nube, intentamos iniciar sesión y sincronizar
        if (response.status === 409) {
          const loginRes = await this.loginCloudAccount(cleanEmail || cleanUser, masterPassword)
          if (loginRes.success) {
            await this.pushVault(initialData, masterPassword)
            return { success: true }
          }
        }
        this.setState('error')
        return { success: false, error: resData.error || 'Error al registrar en la nube' }
      }

      this.saveSession({
        userId: resData.user.id,
        email: resData.user.email,
        username: resData.user.username || cleanUser || undefined,
        token: resData.token,
        salt: resData.salt || salt,
        lastSync: new Date().toISOString(),
        vaultVersion: resData.vault?.version || 1,
      })

      this.setState('synced')
      return { success: true }
    } catch (err) {
      console.warn('[SYNC REGISTER WARN] Modo offline:', err)
      this.setState('offline')
      return { success: false, error: err instanceof Error ? err.message : 'Error de conexión' }
    }
  }

  /**
   * Inicia sesión contra la nube (Zero-Knowledge) por email o username y descarga el snapshot más reciente.
   */
  public async loginCloudAccount(
    identifier: string,
    masterPassword: string,
  ): Promise<{ success: boolean; data?: AppData; email?: string; username?: string; version?: number; updatedAt?: string; error?: string }> {
    try {
      this.setState('syncing')
      const cleanId = identifier.trim().toLowerCase()

      // 1. Obtener el salt de forma segura (soporta email o username)
      const saltRes = await apiFetch(`/api/auth/salt?email=${encodeURIComponent(cleanId)}`)
      const saltData = await saltRes.json()
      if (!saltRes.ok || !saltData.exists || !saltData.salt) {
        this.setState('error')
        return { success: false, error: 'No se encontró una bóveda en la nube para ese usuario o email' }
      }

      const salt: string = saltData.salt
      const resolvedEmail: string = saltData.email || cleanId
      const resolvedUsername: string | undefined = saltData.username || undefined
      const { encryptionKey, authHash } = await deriveMasterKeys(masterPassword, salt)

      // 2. Autenticar con el hash derivado (el server nunca ve la contraseña maestra)
      const loginRes = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resolvedEmail,
          username: resolvedUsername,
          auth_hash: authHash,
          device_id: typeof navigator !== 'undefined' ? navigator.userAgent : 'web-client',
        }),
      })

      const loginData = await loginRes.json()
      if (!loginRes.ok) {
        this.setState('error')
        return { success: false, error: loginData.error || 'Contraseña maestra incorrecta' }
      }

      // 3. Descifrar el snapshot en local
      let decryptedData: AppData | undefined = undefined
      if (loginData.vault && loginData.vault.encrypted_data) {
        const payload: EncryptedVaultPayload = {
          version: loginData.vault.version,
          ciphertext: loginData.vault.encrypted_data,
          iv: loginData.vault.iv,
          checksum: loginData.vault.checksum,
          timestamp: loginData.vault.updated_at,
        }
        decryptedData = await decryptVaultData(payload, encryptionKey)
      }

      const finalUsername = loginData.user?.username || resolvedUsername || decryptedData?.profile?.auth?.username || decryptedData?.profile?.nickName
      const finalEmail = loginData.user?.email || resolvedEmail || decryptedData?.profile?.auth?.email

      this.saveSession({
        userId: loginData.user.id,
        email: finalEmail,
        username: finalUsername,
        token: loginData.token,
        salt,
        lastSync: loginData.vault?.updated_at || new Date().toISOString(),
        vaultVersion: loginData.vault?.version || 1,
      })

      this.setState('synced')
      return {
        success: true,
        data: decryptedData,
        email: finalEmail,
        username: finalUsername,
        version: loginData.vault?.version || 1,
        updatedAt: loginData.vault?.updated_at,
      }
    } catch (err) {
      console.warn('[SYNC LOGIN WARN]:', err)
      this.setState('error')
      return { success: false, error: err instanceof Error ? err.message : 'Error al conectar con la nube' }
    }
  }

  /**
   * Descarga la última versión de la bóveda desde PostgreSQL (Pull Sync) y la descifra localmente.
   */
  public async pullVault(
    masterPassword: string,
  ): Promise<{ success: boolean; data?: AppData; version?: number; updatedAt?: string; error?: string }> {
    const session = this.getSession()
    if (!session || !this.isOnline()) {
      return { success: false, error: 'Sin sesión cloud activa o sin conexión' }
    }

    try {
      this.setState('syncing')
      const response = await apiFetch('/api/vault/sync', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      if (!response.ok) {
        this.setState('error')
        return { success: false, error: `Error HTTP ${response.status}` }
      }

      const resData = await response.json()
      const vault = resData.vault
      if (!vault || !vault.encrypted_data) {
        this.setState('synced')
        return { success: false, error: 'Bóveda vacía en el servidor' }
      }

      const { encryptionKey } = await deriveMasterKeys(masterPassword, session.salt)
      const payload: EncryptedVaultPayload = {
        version: vault.version,
        ciphertext: vault.encrypted_data,
        iv: vault.iv,
        checksum: vault.checksum,
        timestamp: vault.updated_at,
      }
      const decrypted = await decryptVaultData(payload, encryptionKey)

      session.vaultVersion = vault.version
      session.lastSync = vault.updated_at || new Date().toISOString()
      this.saveSession(session)
      this.setState('synced')

      return {
        success: true,
        data: decrypted,
        version: vault.version,
        updatedAt: vault.updated_at,
      }
    } catch (err) {
      console.warn('[SYNC PULL ERROR]:', err)
      this.setState('offline')
      return { success: false, error: err instanceof Error ? err.message : 'Error al descargar bóveda' }
    }
  }

  /**
   * Garantiza que una bóveda local existente (ej. en Desktop) quede vinculada y sincronizada
   * con PostgreSQL, y descarga cambios si en el servidor hay una versión más reciente.
   */
  public async syncBidirectional(
    localData: AppData,
    masterPassword: string,
    preferredIdentifier?: string,
  ): Promise<{ action: 'pushed' | 'pulled' | 'registered' | 'noop' | 'error'; data?: AppData; error?: string }> {
    if (!this.isOnline()) {
      this.setState('offline')
      return { action: 'noop' }
    }

    try {
      const profileEmail = localData.profile?.auth?.email?.trim() || ''
      const profileUsername = (
        localData.profile?.auth?.username ||
        localData.profile?.nickName ||
        preferredIdentifier ||
        ''
      ).trim()
      const effectiveEmail =
        profileEmail ||
        (profileUsername.includes('@')
          ? profileUsername
          : profileUsername
            ? `${profileUsername.toLowerCase()}@lifekeeper.local`
            : '')
      const lookupId = profileEmail || profileUsername || effectiveEmail

      if (!lookupId) {
        return { action: 'noop' }
      }

      const existingSession = this.getSession()

      // Si no hay sesión activa en este navegador/dispositivo, consultamos si la cuenta ya existe en PostgreSQL
      if (!existingSession || !existingSession.token || !existingSession.salt) {
        const saltRes = await apiFetch(`/api/auth/salt?email=${encodeURIComponent(lookupId.toLowerCase())}`)
        const saltData = await saltRes.json()

        if (!saltData.exists && profileUsername && lookupId.toLowerCase() !== profileUsername.toLowerCase()) {
          // Intentar también por username por si se registró con otro email
          const saltByUser = await apiFetch(
            `/api/auth/salt?email=${encodeURIComponent(profileUsername.toLowerCase())}`,
          )
          const saltUserData = await saltByUser.json()
          if (saltUserData.exists) {
            Object.assign(saltData, saltUserData)
          }
        }

        if (!saltData.exists) {
          // La bóveda de Desktop aún no estaba en PostgreSQL -> la registramos y subimos ahora mismo
          const regRes = await this.registerCloudAccount(
            effectiveEmail || `${lookupId.toLowerCase()}@lifekeeper.local`,
            masterPassword,
            localData,
            profileUsername || undefined,
          )
          return regRes.success
            ? { action: 'registered', data: localData }
            : { action: 'error', error: regRes.error }
        }

        // La cuenta ya existe en PostgreSQL -> iniciamos sesión y comparamos datos
        const loginRes = await this.loginCloudAccount(saltData.email || lookupId, masterPassword)
        if (!loginRes.success) {
          return { action: 'error', error: loginRes.error }
        }

        if (loginRes.data) {
          const cloudRecords = countVaultRecords(loginRes.data)
          const localRecords = countVaultRecords(localData)
          const cloudTime = new Date(
            loginRes.updatedAt || loginRes.data.utilities?.backups?.lastAutomaticBackup || 0,
          ).getTime()
          const localTime = new Date(localData.utilities?.backups?.lastAutomaticBackup || 0).getTime()

          // Si la nube tiene más datos o es más reciente, usamos la de la nube
          if (cloudRecords > localRecords || (cloudRecords === localRecords && cloudTime > localTime + 2000)) {
            return { action: 'pulled', data: loginRes.data }
          }
        }

        // Si local tiene más datos o cambios nuevos, actualizamos la nube
        await this.pushVault(localData, masterPassword)
        return { action: 'pushed', data: localData }
      }

      // Ya tenemos sesión activa: consultamos el servidor para ver si otro dispositivo subió una versión nueva
      const localVersion = existingSession.vaultVersion || 1
      const pullRes = await this.pullVault(masterPassword)

      if (pullRes.success && pullRes.data) {
        const remoteVersion = pullRes.version || 1
        const remoteRecords = countVaultRecords(pullRes.data)
        const localRecords = countVaultRecords(localData)

        if (remoteVersion > localVersion || (remoteRecords > localRecords && localRecords <= 1)) {
          return { action: 'pulled', data: pullRes.data }
        }
      }

      // Aseguramos que los datos locales estén subidos
      const pushed = await this.pushVault(localData, masterPassword)
      return pushed ? { action: 'pushed', data: localData } : { action: 'noop', data: localData }
    } catch (err) {
      console.warn('[SYNC BIDIRECTIONAL WARN]:', err)
      return { action: 'error', error: err instanceof Error ? err.message : 'Error de sincronización' }
    }
  }

  /**
   * Sube los cambios más recientes de la bóveda a PostgreSQL cifrados con AES-256-GCM.
   */
  public async pushVault(data: AppData, masterPassword: string): Promise<boolean> {
    if (!this.isOnline()) {
      localStorage.setItem(STORAGE_KEY_PENDING_SYNC, '1')
      this.setState('offline')
      return false
    }

    let session = this.getSession()
    if (!session || !session.token || !session.salt) {
      // Auto-vincular si aún no había sesión guardada
      const profileEmail = data.profile?.auth?.email?.trim() || ''
      const profileUsername = (data.profile?.auth?.username || data.profile?.nickName || '').trim()
      const effectiveEmail =
        profileEmail || (profileUsername ? `${profileUsername.toLowerCase()}@lifekeeper.local` : '')

      if (!effectiveEmail) {
        return false
      }

      const saltRes = await apiFetch(`/api/auth/salt?email=${encodeURIComponent(effectiveEmail.toLowerCase())}`).catch(
        () => null,
      )
      const saltData = saltRes ? await saltRes.json().catch(() => ({})) : {}

      if (saltData.exists) {
        await this.loginCloudAccount(saltData.email || effectiveEmail, masterPassword)
      } else {
        const reg = await this.registerCloudAccount(effectiveEmail, masterPassword, data, profileUsername)
        return reg.success
      }
      session = this.getSession()
      if (!session) return false
    }

    try {
      this.setState('syncing')
      const { encryptionKey } = await deriveMasterKeys(masterPassword, session.salt)
      const nextVersion = (session.vaultVersion || 1) + 1
      const encrypted = await encryptVaultData(data, encryptionKey, nextVersion)
      const username = (data.profile?.auth?.username || data.profile?.nickName || session.username || '').trim()

      const response = await apiFetch('/api/vault/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          version: nextVersion,
          encrypted_data: encrypted.ciphertext,
          iv: encrypted.iv,
          auth_tag: 'embedded',
          checksum: encrypted.checksum,
          username: username || undefined,
          device_id: typeof navigator !== 'undefined' ? navigator.userAgent : 'web-client',
        }),
      })

      if (!response.ok) {
        this.setState('error')
        return false
      }

      const resData = await response.json()
      session.vaultVersion = resData.version
      session.lastSync = resData.updated_at
      if (username) session.username = username
      this.saveSession(session)
      localStorage.removeItem(STORAGE_KEY_PENDING_SYNC)

      this.setState('synced')
      return true
    } catch (err) {
      console.warn('[SYNC PUSH ERROR]:', err)
      localStorage.setItem(STORAGE_KEY_PENDING_SYNC, '1')
      this.setState('offline')
      return false
    }
  }

  /**
   * Prepara y cifra la bóveda en local antes de enviarla a PostgreSQL.
   */
  public async prepareEncryptedSnapshot(
    data: AppData,
    masterPassword: string,
    existingSalt?: string,
  ): Promise<EncryptedVaultPayload> {
    const { encryptionKey } = await deriveMasterKeys(masterPassword, existingSalt)
    return encryptVaultData(data, encryptionKey)
  }

  /**
   * Descifra un snapshot obtenido desde PostgreSQL usando la contraseña maestra local.
   */
  public async unpackCloudSnapshot(
    payload: EncryptedVaultPayload,
    masterPassword: string,
    salt: string,
  ): Promise<AppData> {
    const { encryptionKey } = await deriveMasterKeys(masterPassword, salt)
    return decryptVaultData(payload, encryptionKey)
  }
}

export const syncService = SyncService.getInstance()
