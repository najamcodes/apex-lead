import jwt from 'jsonwebtoken'

export interface AccessTokenPayload {
  userId: number
  email: string
  orgId: number
  role: string
  systemRole: string
}

export interface RefreshTokenPayload {
  userId: number
  tokenVersion?: number
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'apexlead_production_jwt_secret_replace'
}

function getRefreshSecret(): string {
  return process.env.REFRESH_SECRET || 'apexlead_production_refresh_secret_replace'
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '15m' })
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: '30d' })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getJwtSecret()) as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, getRefreshSecret()) as RefreshTokenPayload
}
