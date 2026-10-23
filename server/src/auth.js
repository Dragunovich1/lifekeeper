import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'lifekeeper_super_secure_jwt_secret_2026_xyz_default'
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
