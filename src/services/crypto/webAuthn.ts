/**
 * Servicio de Autenticación Biométrica local (WebAuthn / Windows Hello / Touch ID / Face ID).
 * Permite desbloqueo rápido por hardware biométrico en navegadores compatibles.
 */

const STORAGE_KEY_BIOMETRIC_CREDENTIAL = 'lifekeeper_biometric_credential_v1'

export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function isBiometricsEnrolled(): boolean {
  return Boolean(localStorage.getItem(STORAGE_KEY_BIOMETRIC_CREDENTIAL))
}

/**
 * Registra una credencial biométrica para el usuario en este dispositivo.
 */
export async function enrollBiometrics(userId: string, email: string): Promise<boolean> {
  if (!window.PublicKeyCredential) return false

  try {
    const challenge = new Uint8Array(32)
    window.crypto.getRandomValues(challenge)

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'LifeKeeper Vault',
          id: window.location.hostname || 'localhost',
        },
        user: {
          id: new TextEncoder().encode(userId || 'lifekeeper_user'),
          name: email || 'usuario@lifekeeper',
          displayName: email || 'Titular de Bóveda',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null

    if (credential) {
      localStorage.setItem(
        STORAGE_KEY_BIOMETRIC_CREDENTIAL,
        JSON.stringify({
          id: credential.id,
          rawId: credential.id,
          enrolledAt: new Date().toISOString(),
        }),
      )
      return true
    }
    return false
  } catch (err) {
    console.warn('[WebAuthn] Error al registrar biometría:', err)
    return false
  }
}

/**
 * Autentica al usuario mediante biometría del dispositivo.
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false

  try {
    const challenge = new Uint8Array(32)
    window.crypto.getRandomValues(challenge)

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname || 'localhost',
        userVerification: 'required',
        timeout: 60000,
      },
    })

    return Boolean(assertion)
  } catch (err) {
    console.warn('[WebAuthn] Error al verificar biometría:', err)
    return false
  }
}

export function unenrollBiometrics(): void {
  localStorage.removeItem(STORAGE_KEY_BIOMETRIC_CREDENTIAL)
}
