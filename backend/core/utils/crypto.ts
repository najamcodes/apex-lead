import crypto from 'crypto'

// Use a deterministic key derived from an env variable, or a fallback for local development.
// In a real production SaaS, this MUST be set in the environment and NEVER changed.
const APP_SECRET = process.env.ENCRYPTION_KEY || 'lead-gen-desk-fallback-secret-key-32'
const ALGORITHM = 'aes-256-gcm'

// Ensure key is exactly 32 bytes
const ENCRYPTION_KEY = crypto.scryptSync(APP_SECRET, 'salt', 32)

export function encrypt(text: string): string {
  if (!text) return text
  
  // 12 bytes is standard for GCM
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag().toString('hex')
  
  return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(hash: string): string {
  if (!hash) return hash
  
  // Legacy support for plaintext passwords saved before this feature
  if (!hash.startsWith('enc:')) {
    return hash
  }

  try {
    const parts = hash.split(':')
    if (parts.length !== 4) return hash // Invalid format, return as is (fallback)

    const [, ivHex, authTagHex, encryptedHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
    
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (err) {
    console.error('Failed to decrypt data', err)
    return '' // Return empty if decryption fails to prevent crash, but this will fail authentication
  }
}

/**
 * Standard password hashing with PBKDF2 (SHA-512).
 * Output format: `<saltHex>:<hashHex>`
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

/**
 * Securely verify a password against stored `<saltHex>:<hashHex>`.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const derived = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'))
}
