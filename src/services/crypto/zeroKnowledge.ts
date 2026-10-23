/**
 * Motor Criptográfico de Conocimiento Cero (Zero-Knowledge E2EE) de LifeKeeper.
 * Implementa la Web Crypto API nativa del navegador con estándares de grado militar:
 * - PBKDF2-HMAC-SHA256 con 600.000 iteraciones (OWASP 2024+)
 * - AES-GCM de 256 bits con vector de inicialización (IV) único de 96 bits por operación
 * - Separación criptográfica estricta: la clave de cifrado NUNCA sale del navegador
 */

import type { AppData } from '../../types'

export interface DerivedKeys {
  encryptionKey: CryptoKey
  authHash: string
  salt: string
}

export interface EncryptedVaultPayload {
  version: number
  ciphertext: string // Base64
  iv: string // Hexadecimal
  authTag?: string // Incluido en el ciphertext GCM
  checksum: string // SHA-256 hexadecimal
  timestamp: string
}

// Convierte ArrayBuffer a Hex
export function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Convierte Hex a Uint8Array
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

// Convierte ArrayBuffer a Base64
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

// Convierte Base64 a Uint8Array
export function base64ToBytes(base64: string): Uint8Array {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Genera un salt criptográficamente seguro de 32 bytes (256 bits).
 */
export function generateSalt(): string {
  const array = new Uint8Array(32)
  window.crypto.getRandomValues(array)
  return bufferToHex(array.buffer)
}

/**
 * Deriva las llaves duales a partir de la contraseña maestra y el salt:
 * 1. EncryptionKey (AES-256-GCM): permanece únicamente en la RAM local para descifrar la bóveda.
 * 2. AuthHash: hash que se envía al servidor para autenticar el login (sin exponer la contraseña maestra).
 */
export async function deriveMasterKeys(
  masterPassword: string,
  existingSalt?: string,
): Promise<DerivedKeys> {
  const salt = existingSalt || generateSalt()
  const saltBytes = hexToBytes(salt)
  const encoder = new TextEncoder()
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  // 600.000 iteraciones PBKDF2 (estándar OWASP para contraseñas maestras)
  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 600000,
      hash: 'SHA-256',
    },
    passwordKey,
    512, // 512 bits: 256 bits para cifrado + 256 bits para auth
  )

  const encryptionKeyBits = derivedBits.slice(0, 32) // Primeros 256 bits
  const authKeyBits = derivedBits.slice(32, 64) // Siguientes 256 bits

  const encryptionKey = await window.crypto.subtle.importKey(
    'raw',
    encryptionKeyBits,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )

  // AuthHash en formato hexadecimal para enviar de forma segura al backend de PostgreSQL
  const authHash = bufferToHex(authKeyBits)

  return {
    encryptionKey,
    authHash,
    salt,
  }
}

/**
 * Cifra la bóveda completa del usuario usando AES-256-GCM.
 * Genera un IV aleatorio de 12 bytes por cada guardado.
 */
export async function encryptVaultData(
  data: AppData,
  encryptionKey: CryptoKey,
  version = 1,
): Promise<EncryptedVaultPayload> {
  const encoder = new TextEncoder()
  const serialized = JSON.stringify(data)
  const encodedData = encoder.encode(serialized)

  // Vector de Inicialización único de 12 bytes (96 bits) recomendado para AES-GCM
  const iv = new Uint8Array(12)
  window.crypto.getRandomValues(iv)

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128, // 128 bits de etiqueta de autenticación para garantizar integridad
    },
    encryptionKey,
    encodedData,
  )

  const ciphertext = bufferToBase64(encryptedBuffer)
  const ivHex = bufferToHex(iv.buffer)

  // Checksum SHA-256 para verificación rápida de integridad
  const checksumBuffer = await window.crypto.subtle.digest('SHA-256', encryptedBuffer)
  const checksum = bufferToHex(checksumBuffer)

  return {
    version,
    ciphertext,
    iv: ivHex,
    checksum,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Descifra el paquete de la bóveda usando la clave AES-256-GCM.
 * Si el ciphertext o el IV fueron alterados, lanza un error criptográfico.
 */
export async function decryptVaultData(
  payload: EncryptedVaultPayload,
  encryptionKey: CryptoKey,
): Promise<AppData> {
  const ciphertextBytes = base64ToBytes(payload.ciphertext)
  const iv = hexToBytes(payload.iv)

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    encryptionKey,
    ciphertextBytes,
  )

  const decoder = new TextDecoder()
  const jsonString = decoder.decode(decryptedBuffer)
  return JSON.parse(jsonString) as AppData
}

/**
 * Genera un Kit de Emergencia de 24 palabras mnemónicas para recuperación de bóveda.
 */
const RECOVERY_DICTIONARY = [
  'alfa', 'bravo', 'cielo', 'delta', 'eco', 'foco', 'guardia', 'halcon', 'isla', 'jardin',
  'karma', 'luna', 'marfil', 'nube', 'oasis', 'puerto', 'quimica', 'roble', 'sol', 'trueno',
  'union', 'valle', 'viento', 'zenit', 'aurora', 'bosque', 'cristal', 'diamante', 'espejo', 'faro',
  'glaciar', 'hierro', 'iguana', 'jungla', 'koala', 'linterna', 'marea', 'niebla', 'orquidea', 'prisma',
]

export async function generateRecoveryKit(): Promise<{ phrase: string; recoveryHash: string }> {
  const words: string[] = []
  const randomIndices = new Uint16Array(24)
  window.crypto.getRandomValues(randomIndices)

  for (let i = 0; i < 24; i += 1) {
    const word = RECOVERY_DICTIONARY[randomIndices[i] % RECOVERY_DICTIONARY.length]
    words.push(word)
  }

  const phrase = words.join(' ')
  const phraseBytes = new TextEncoder().encode(phrase)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', phraseBytes)
  const recoveryHash = bufferToHex(hashBuffer)

  return {
    phrase,
    recoveryHash,
  }
}
