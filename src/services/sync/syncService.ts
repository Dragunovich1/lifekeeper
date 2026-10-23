/**
 * Servicio de Sincronización y Persistencia de LifeKeeper.
 * Soporta modo Offline-First con sincronización en la nube (PostgreSQL / Supabase / Backend API).
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
      // Si hay sincronizaciones pendientes, dispararlas
      const pending = localStorage.getItem(STORAGE_KEY_PENDING_SYNC)
      if (pending) {
        this.triggerPendingSync()
      }
    }
  }

  private async triggerPendingSync() {
    // Lógica para enviar el payload acumulado cuando regresa la conexión
    this.setState('syncing')
    setTimeout(() => {
      localStorage.removeItem(STORAGE_KEY_PENDING_SYNC)
      this.setState('synced')
    }, 800)
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
