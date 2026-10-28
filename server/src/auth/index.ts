import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET ?? (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required. Generate a secure secret with: openssl rand -hex 32')
  }
  return 'dev_secret_leadhunter_2026'
})()

export async function createToken(payload: string | Buffer | Record<string, unknown>) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}
