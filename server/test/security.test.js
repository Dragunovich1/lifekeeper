import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveJwtSecret, COMPROMISED_JWT_SECRETS, createRateLimiter, buildCorsOptions, isEmail } from '../src/security.js'

const silent = { warn: () => {} }

test('JWT: una clave propia y larga se respeta', () => {
  const own = 'a'.repeat(64)
  assert.equal(resolveJwtSecret({ JWT_SECRET: own }, silent), own)
})

test('JWT: la clave de ejemplo del repositorio se rechaza y se reemplaza por una aleatoria', () => {
  for (const known of COMPROMISED_JWT_SECRETS) {
    const warnings = []
    const secret = resolveJwtSecret({ JWT_SECRET: known }, { warn: (m) => warnings.push(m) })
    assert.notEqual(secret, known)
    assert.equal(secret.length, 96)
    assert.equal(warnings.length, 1)
  }
})

test('JWT: sin clave o demasiado corta también genera una aleatoria (y distinta cada vez)', () => {
  const a = resolveJwtSecret({}, silent)
  const b = resolveJwtSecret({ JWT_SECRET: 'corta' }, silent)
  assert.equal(a.length, 96)
  assert.notEqual(a, b)
})

test('limitador: permite hasta el máximo, bloquea el siguiente y se libera al pasar la ventana', () => {
  let t = 1_000
  const limiter = createRateLimiter({ windowMs: 60_000, max: 3, now: () => t })
  assert.ok(limiter.hit('ip').allowed)
  assert.ok(limiter.hit('ip').allowed)
  assert.ok(limiter.hit('ip').allowed)
  const blocked = limiter.hit('ip')
  assert.equal(blocked.allowed, false)
  assert.ok(blocked.retryAfterSec > 0 && blocked.retryAfterSec <= 60)
  assert.ok(limiter.hit('otra-ip').allowed, 'cada clave tiene su propio contador')
  t += 61_000
  assert.ok(limiter.hit('ip').allowed, 'tras la ventana vuelve a permitir')
})

test('limitador: limpia los contadores vencidos', () => {
  let t = 0
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => t })
  for (let i = 0; i < 50; i++) limiter.hit(`k${i}`)
  t += 5000
  limiter.hit('nuevo')
  assert.equal(limiter.size(), 1)
})

test('CORS: permite orígenes conocidos y la APK, bloquea los demás', async () => {
  const { origin } = buildCorsOptions({ CORS_ORIGINS: 'https://extra.example.com/' })
  const check = (o) => new Promise((resolve) => origin(o, (_e, ok) => resolve(ok)))
  assert.equal(await check(undefined), true, 'sin Origin (mismo origen / no navegador)')
  assert.equal(await check('https://app.lifekeeper.lat'), true)
  assert.equal(await check('https://localhost'), true, 'Android (Capacitor)')
  assert.equal(await check('capacitor://localhost'), true, 'iOS (Capacitor)')
  assert.equal(await check('http://localhost:5199'), true, 'desarrollo')
  assert.equal(await check('https://extra.example.com'), true, 'agregado por CORS_ORIGINS')
  assert.equal(await check('https://evil.example.com'), false)
  assert.equal(await check('https://app.lifekeeper.lat.evil.com'), false)
})

test('isEmail valida lo básico y rechaza inyecciones de cabeceras', () => {
  assert.ok(isEmail('persona@dominio.com'))
  assert.equal(isEmail('a@b'), false)
  assert.equal(isEmail('a@b.com\nBcc: x@y.com'), false)
  assert.equal(isEmail('a b@c.com'), false)
  assert.equal(isEmail(null), false)
})
