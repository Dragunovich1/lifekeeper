/**
 * Servicio de Sanitización de Memoria RAM.
 * Sobrescribe buffers criptográficos y limpia residuos en memoria al bloquear o cerrar sesión.
 */

export function wipeBuffer(target: Uint8Array | ArrayBuffer | null | undefined): void {
  if (!target) return
  try {
    if (target instanceof Uint8Array) {
      target.fill(0)
    } else if (target instanceof ArrayBuffer) {
      new Uint8Array(target).fill(0)
    }
  } catch {
    // Si el buffer es de solo lectura o detached, ignorar
  }
}

export function wipeSensitiveSessionData(): void {
  try {
    sessionStorage.clear()
  } catch {
    // Ignore
  }
}
