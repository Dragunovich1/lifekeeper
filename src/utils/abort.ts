/**
 * Señal que se cancela sola a los `ms` milisegundos.
 * `AbortSignal.timeout` no existe en WebViews de Android viejos y lanza TypeError (rompía la voz y el asistente en silencio).
 */
export const timeoutSignal = (ms: number): AbortSignal => {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms)
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}
