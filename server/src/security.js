/**
 * Piezas de seguridad del backend, sin dependencias externas:
 *  - Clave JWT segura por defecto (nunca la del repositorio)
 *  - Limitador de intentos en memoria
 *  - Lista de orígenes permitidos para CORS
 */

import crypto from 'node:crypto'

/** Valores de ejemplo que estuvieron publicados en el repositorio: se consideran comprometidos. */
export const COMPROMISED_JWT_SECRETS = new Set([
  'lifekeeper_super_secure_jwt_secret_2026_xyz',
  'lifekeeper_super_secure_jwt_secret_2026_xyz_default',
  'change_me',
  'changeme',
  'secret',
])

/**
 * Devuelve la clave con la que se firman las sesiones.
 * Si no hay una clave propia (o es la de ejemplo), genera una aleatoria: es seguro, pero las sesiones
 * en la nube se cierran al reiniciar el servidor. Con `JWT_SECRET` definido en `.env` no pasa eso.
 */
export function resolveJwtSecret(env = process.env, log = console) {
  const configured = (env.JWT_SECRET ?? '').trim()
  if (configured && !COMPROMISED_JWT_SECRETS.has(configured) && configured.length >= 32) return configured
  const reason = !configured ? 'no está definido' : configured.length < 32 ? 'es demasiado corto (mínimo 32 caracteres)' : 'es el valor de ejemplo público del repositorio'
  log.warn(
    `[SEGURIDAD] JWT_SECRET ${reason}. Se usa una clave aleatoria temporal: las sesiones en la nube se cerrarán al reiniciar. ` +
      'Generá una propia con: node scripts/gen-secrets.mjs',
  )
  return crypto.randomBytes(48).toString('hex')
}

/**
 * Limitador de ventana fija en memoria. `hit(key)` cuenta un intento y dice si se permite.
 * Sirve para un solo proceso (alcanza para esta instalación).
 */
export function createRateLimiter({ windowMs, max, now = () => Date.now() }) {
  const buckets = new Map()
  let lastSweep = now()

  const sweep = () => {
    const t = now()
    if (t - lastSweep < windowMs) return
    lastSweep = t
    for (const [key, b] of buckets) if (t - b.start >= windowMs) buckets.delete(key)
  }

  return {
    hit(key) {
      sweep()
      const t = now()
      const b = buckets.get(key)
      if (!b || t - b.start >= windowMs) {
        buckets.set(key, { start: t, count: 1 })
        return { allowed: true, remaining: max - 1, retryAfterSec: 0 }
      }
      b.count += 1
      if (b.count > max) return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((b.start + windowMs - t) / 1000) }
      return { allowed: true, remaining: max - b.count, retryAfterSec: 0 }
    },
    reset(key) {
      buckets.delete(key)
    },
    size: () => buckets.size,
  }
}

/** Middleware Express: limita por la clave que devuelva `keyFn(req)` y responde 429 al pasarse. */
export function limitBy(limiter, keyFn, message = 'Demasiados intentos. Probá de nuevo en unos minutos.') {
  return (req, res, next) => {
    const result = limiter.hit(String(keyFn(req)))
    if (result.allowed) return next()
    res.set('Retry-After', String(result.retryAfterSec))
    return res.status(429).json({ error: message, retryAfterSec: result.retryAfterSec })
  }
}

const DEFAULT_ORIGINS = [
  'https://app.lifekeeper.lat',
  'http://192.168.0.52',
  'http://localhost',
  'https://localhost', // Android (Capacitor, androidScheme: https)
  'capacitor://localhost', // iOS
  'http://localhost:5173',
  'http://localhost:4173',
]

/** Opciones de CORS: solo orígenes conocidos (se amplían con CORS_ORIGINS="https://a.com,https://b.com"). */
export function buildCorsOptions(env = process.env) {
  const extra = (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)
  const allowed = new Set([...DEFAULT_ORIGINS, ...extra])
  return {
    origin(origin, callback) {
      // Sin cabecera Origin = mismo origen o cliente que no es un navegador: CORS no aplica
      if (!origin) return callback(null, true)
      // Cualquier puerto de localhost/IP de red local para desarrollo
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true)
      callback(null, allowed.has(origin.replace(/\/+$/, '')))
    },
    credentials: false,
  }
}

export const isEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(value)
