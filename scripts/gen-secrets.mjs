#!/usr/bin/env node
/**
 * Genera una clave JWT propia y la guarda en tu archivo .env (sin mostrarla).
 *
 *   node scripts/gen-secrets.mjs            # solo si falta o es la clave pública de ejemplo
 *   node scripts/gen-secrets.mjs --force    # la reemplaza igual (cierra todas las sesiones en la nube)
 *
 * Cambiar JWT_SECRET NO afecta tu bóveda: solo cierra las sesiones en la nube, que se vuelven a abrir
 * iniciando sesión. Después reiniciá la API: docker compose up -d api
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const COMPROMISED = new Set(['lifekeeper_super_secure_jwt_secret_2026_xyz', 'lifekeeper_super_secure_jwt_secret_2026_xyz_default', 'change_me', 'changeme', 'secret'])
const envPath = path.resolve(process.cwd(), '.env')
const force = process.argv.includes('--force')

const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const lines = current.split('\n')
const idx = lines.findIndex((l) => /^\s*JWT_SECRET\s*=/.test(l))
const existing = idx >= 0 ? lines[idx].split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : ''
const isGood = existing.length >= 32 && !COMPROMISED.has(existing)

if (isGood && !force) {
  console.log('✅ Tu .env ya tiene un JWT_SECRET propio y seguro. No se cambió nada (usá --force para reemplazarlo).')
  process.exit(0)
}

const secret = crypto.randomBytes(48).toString('hex')
if (idx >= 0) lines[idx] = `JWT_SECRET=${secret}`
else lines.push(`JWT_SECRET=${secret}`)
fs.writeFileSync(envPath, lines.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 })
fs.chmodSync(envPath, 0o600)

console.log(`🔐 JWT_SECRET ${existing ? (isGood ? 'reemplazado' : 'era el valor público de ejemplo: reemplazado') : 'creado'} en ${envPath}`)
console.log('   Reiniciá la API para aplicarlo:  docker compose up -d api')
console.log('   Las sesiones en la nube se cierran una vez; tu bóveda no se toca.')
