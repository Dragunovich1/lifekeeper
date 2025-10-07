const DATA_KEY = 'lifekeeper:data'
const MASTER_KEY = 'lifekeeper:master'
const BACKUP_KEY = 'lifekeeper:backup'
const PROFILE_KEY = 'lifekeeper:profile-meta'

export interface StoredProfileMeta {
  username?: string
  email?: string
}

export const storageKeys = {
  data: DATA_KEY,
  master: MASTER_KEY,
  backup: BACKUP_KEY,
  profile: PROFILE_KEY,
}

export const loadEncryptedPayload = () => localStorage.getItem(DATA_KEY)

export const storeEncryptedPayload = (ciphertext: string) => {
  localStorage.setItem(DATA_KEY, ciphertext)
  localStorage.setItem(BACKUP_KEY, JSON.stringify({ cipher: ciphertext, date: new Date().toISOString() }))
}

export const loadMasterHash = () => localStorage.getItem(MASTER_KEY)

export const storeMasterHash = (hash: string) => localStorage.setItem(MASTER_KEY, hash)

export const storeProfileMeta = (meta: StoredProfileMeta) => {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(meta))
}

export const loadProfileMeta = (): StoredProfileMeta | null => {
  const raw = localStorage.getItem(PROFILE_KEY)
  return raw ? (JSON.parse(raw) as StoredProfileMeta) : null
}

export const clearAllData = () => {
  localStorage.removeItem(DATA_KEY)
  localStorage.removeItem(MASTER_KEY)
  localStorage.removeItem(BACKUP_KEY)
  localStorage.removeItem(PROFILE_KEY)
}

export const loadBackupSnapshot = () => {
  const snapshot = localStorage.getItem(BACKUP_KEY)
  return snapshot ? JSON.parse(snapshot) : null
}
