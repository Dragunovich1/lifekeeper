/**
 * Servicio para verificar si una contraseña fue vulnerada en brechas públicas de datos.
 * Utiliza la API de HaveIBeenPwned mediante el modelo k-anonymity (100% privado y seguro).
 *
 * La contraseña NUNCA se envía: se genera el hash SHA-1 localmente en el navegador,
 * se envían únicamente los primeros 5 caracteres hexadecimales del hash (prefijo),
 * y la comparación del resto del hash (sufijo) se realiza 100% en local.
 */

async function sha1Hex(text: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(text)
  const hashBuffer = await window.crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export interface PwnedCheckResult {
  pwned: boolean
  count: number
  sha1Prefix: string
}

export async function checkPasswordPwned(password: string): Promise<PwnedCheckResult> {
  if (!password || password.length === 0) {
    return { pwned: false, count: 0, sha1Prefix: '' }
  }

  try {
    const fullHash = await sha1Hex(password)
    const prefix = fullHash.slice(0, 5)
    const suffix = fullHash.slice(5)

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true', // Previene ataques de canal lateral de longitud de respuesta
      },
    })

    if (!response.ok) {
      throw new Error(`Error en el servicio HaveIBeenPwned (${response.status})`)
    }

    const text = await response.text()
    const lines = text.split('\n')

    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(':')
      if (hashSuffix && hashSuffix.toUpperCase() === suffix) {
        const count = parseInt(countStr, 10) || 0
        return {
          pwned: true,
          count,
          sha1Prefix: prefix,
        }
      }
    }

    return {
      pwned: false,
      count: 0,
      sha1Prefix: prefix,
    }
  } catch (err) {
    console.warn('[HIBP] No se pudo comprobar la brecha de contraseñas:', err)
    return {
      pwned: false,
      count: 0,
      sha1Prefix: '',
    }
  }
}
