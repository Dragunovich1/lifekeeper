/**
 * Servicio de Sincronización y Persistencia de LifeKeeper.
 * Soporta modo Offline-First con sincronización en la nube (PostgreSQL Zero-Knowledge).
 */

import type { AppData } from '../../types'
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
  token: string
  salt: string
  lastSync?: string
  vaultVersion?: number
}

const STORAGE_KEY_SESSION = 'lifekeeper_cloud_session_v1'
const STORAGE_KEY_PENDING_SYNC = 'lifekeeper_pending_cloud_sync_v1'

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
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session))
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
      const pending = localStorage.getItem(STORAGE_KEY_PENDING_SYNC)
      if (pending) {
        this.triggerPendingSync()
      }
    }
  }

  private async triggerPendingSync() {
    this.setState('syncing')
    setTimeout(() => {
      localStorage.removeItem(STORAGE_KEY_PENDING_SYNC)
      this.setState('synced')
    }, 800)
  }

  /**
   * Registra una cuenta en el servidor backend y almacena el primer snapshot en PostgreSQL.
   */
  public async registerCloudAccount(
    email: string,
    masterPassword: string,
    initialData: AppData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.setState('syncing')
      const { encryptionKey, authHash, salt } = await deriveMasterKeys(masterPassword)
      const encrypted = await encryptVaultData(initialData, encryptionKey, 1)

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
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
        this.setState('error')
        return { success: false, error: resData.error || 'Error al registrar en la nube' }
      }

      this.saveSession({
        userId: resData.user.id,
        email: resData.user.email,
        token: resData.token,
        salt,
        lastSync: new Date().toISOString(),
        vaultVersion: 1,
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
   * Inicia sesión contra la nube (Zero-Knowledge) y descarga el snapshot más reciente.
   */
  public async loginCloudAccount(
    email: string,
    masterPassword: string,
  ): Promise<{ success: boolean; data?: AppData; error?: string }> {
    try {
      this.setState('syncing')

      // 1. Obtener el salt de forma segura
      const saltRes = await fetch(`/api/auth/salt?email=${encodeURIComponent(email)}`)
      const saltData = await saltRes.json()
      if (!saltRes.ok || !saltData.exists || !saltData.salt) {
        this.setState('error')
        return { success: false, error: 'Usuario no encontrado en la nube' }
      }

      const salt = saltData.salt
      const { encryptionKey, authHash } = await deriveMasterKeys(masterPassword, salt)

      // 2. Autenticar con el hash derivado (el server nunca ve la contraseña maestra)
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
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

      this.saveSession({
        userId: loginData.user.id,
        email: loginData.user.email,
        token: loginData.token,
        salt,
        lastSync: loginData.vault?.updated_at || new Date().toISOString(),
        vaultVersion: loginData.vault?.version || 1,
      })

      this.setState('synced')
      return { success: true, data: decryptedData }
    } catch (err) {
      console.warn('[SYNC LOGIN WARN]:', err)
      this.setState('error')
      return { success: false, error: err instanceof Error ? err.message : 'Error al conectar con la nube' }
    }
  }

  /**
   * Sube los cambios más recientes de la bóveda a PostgreSQL cifrados con AES-256-GCM.
   */
  public async pushVault(data: AppData, masterPassword: string): Promise<boolean> {
    const session = this.getSession()
    if (!session || !this.isOnline()) {
      return false
    }

    try {
      this.setState('syncing')
      const { encryptionKey } = await deriveMasterKeys(masterPassword, session.salt)
      const nextVersion = (session.vaultVersion || 1) + 1
      const encrypted = await encryptVaultData(data, encryptionKey, nextVersion)

      const response = await fetch('/api/vault/sync', {
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
      this.saveSession(session)

      this.setState('synced')
      return true
    } catch (err) {
      console.warn('[SYNC PUSH ERROR]:', err)
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
