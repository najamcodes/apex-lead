import '../../../server/polyfill'
import { describe, it, expect, beforeAll } from 'bun:test'
import { initDb, getDataSource } from '@sdk/core/db'
import { AuthService } from '../../../server/src/services/AuthService'
import { UserEntity } from '@sdk/core/db/entities/UserEntity'
import { OrganizationEntity } from '@sdk/core/db/entities/OrganizationEntity'
import { verifyAccessToken, verifyRefreshToken } from '../../../server/src/auth/jwt'

describe('Dual Authentication Engine (Prompt 01 & 03)', () => {
  let authService: AuthService

  beforeAll(async () => {
    process.env.DATABASE_URL = '' // use sqlite
    process.env.JWT_SECRET = 'test_jwt_secret_12345'
    process.env.REFRESH_SECRET = 'test_refresh_secret_12345'
    await initDb()
    authService = new AuthService()
  })

  it('should sign up a new user with password, hash credentials, and provision an organization', async () => {
    const timestamp = Date.now()
    const email = `test-user-${timestamp}@saascorp.io`
    const password = 'UltraSecurePassword!2026'
    const name = `Alice Tester ${timestamp}`

    const result = await authService.signupWithPassword(email, password, name)

    expect(result.user).toBeDefined()
    expect(result.user.email).toBe(email.toLowerCase())
    expect(result.user.name).toBe(name)
    expect(result.user.role).toBe('user')
    expect(result.user.default_org_id).toBeGreaterThan(0)
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()

    // Verify token validity
    const accessPayload = verifyAccessToken(result.accessToken)
    expect(accessPayload.userId).toBe(result.user.id)
    expect(accessPayload.email).toBe(email.toLowerCase())
    expect(accessPayload.orgId).toBe(result.user.default_org_id!)
    expect(accessPayload.role).toBe('owner')

    const refreshPayload = verifyRefreshToken(result.refreshToken)
    expect(refreshPayload.userId).toBe(result.user.id)

    // Verify DB state
    const ds = getDataSource()
    const user = await ds.getRepository(UserEntity).findOneBy({ id: result.user.id })
    expect(user).toBeDefined()
    expect(user!.password_hash).not.toBe(password)
    expect(user!.password_hash).toContain(':') // salt:hash format

    const org = await ds.getRepository(OrganizationEntity).findOneBy({ id: result.user.default_org_id! })
    expect(org).toBeDefined()
    expect(org!.name).toContain('Alice Tester')
  })

  it('should reject signup with an already registered email address', async () => {
    const email = `duplicate-signup-${Date.now()}@saascorp.io`
    await authService.signupWithPassword(email, 'Password123!', 'First User')

    await expect(authService.signupWithPassword(email, 'Password456!', 'Second User')).rejects.toThrow('already exists')
  })

  it('should successfully log in with correct password and reject wrong password', async () => {
    const email = `login-test-${Date.now()}@saascorp.io`
    const password = 'ValidPassword#999'
    await authService.signupWithPassword(email, password, 'Login User')

    // Valid login
    const loginResult = await authService.loginWithPassword(email, password)
    expect(loginResult.user.email).toBe(email)
    expect(loginResult.accessToken).toBeDefined()

    // Invalid password
    await expect(authService.loginWithPassword(email, 'WrongPassword#123')).rejects.toThrow('Invalid email or password')

    // Non-existent email
    await expect(authService.loginWithPassword('nonexistent-email@test.com', password)).rejects.toThrow('Invalid email or password')
  })

  it('should provision a new user and organization when logging in via Google OAuth 2.0', async () => {
    const googleId = `google_sub_${Date.now()}`
    const email = `google-user-${Date.now()}@gmail.com`
    const profile = {
      id: googleId,
      email,
      verified_email: true,
      name: 'Google Engineer',
      picture: 'https://lh3.googleusercontent.com/photo.jpg',
    }

    const result = await authService.loginOrRegisterGoogleUser(profile)

    expect(result.user.email).toBe(email)
    expect(result.user.name).toBe('Google Engineer')
    expect(result.user.avatar_url).toBe(profile.picture)
    expect(result.accessToken).toBeDefined()

    // Verify subsequent login with same Google ID reuses the account
    const secondResult = await authService.loginOrRegisterGoogleUser(profile)
    expect(secondResult.user.id).toBe(result.user.id)
  })

  it('should rotate tokens and refresh session via refreshSession', async () => {
    const email = `refresh-test-${Date.now()}@saascorp.io`
    const session = await authService.signupWithPassword(email, 'Password789!', 'Refresh User')

    const newSession = await authService.refreshSession(session.refreshToken)
    expect(newSession.user.id).toBe(session.user.id)
    expect(newSession.accessToken).toBeDefined()
    expect(newSession.refreshToken).toBeDefined()

    const accessPayload = verifyAccessToken(newSession.accessToken)
    expect(accessPayload.userId).toBe(session.user.id)
  })
})
