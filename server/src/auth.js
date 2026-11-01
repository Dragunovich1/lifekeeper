import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from './security.js'

const JWT_SECRET = resolveJwtSecret()
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d'

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Token no provisto.' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado.', details: err.message })
  }
}
