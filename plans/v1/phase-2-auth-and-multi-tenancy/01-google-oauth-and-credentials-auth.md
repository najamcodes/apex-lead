# Phase 2 — Prompt 01: Dual Authentication (Google OAuth 2.0 & Native Credentials)

> **Objective:** Implement a robust dual-authentication system supporting both Google Workspace OAuth 2.0 and native Argon2id email/password credentials, with automatic organization provisioning upon signup.

---

## 1. Authentication Architecture

```
User visits /login or /register
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼
[Google One-Tap / OAuth]      [Email & Password Signup]        [Email & Password Login]
       │                                 │                                 │
GET /api/auth/google             POST /api/auth/signup            POST /api/auth/login
       │                                 │                                 │
Google Consent Screen            Argon2id Hash Password           Verify Argon2id Hash
       │                                 │                                 │
Callback with ?code=...                  ▼                                 ▼
       │                       Create UserEntity                 Generate JWT Access Token
       ▼                       Create Default Org               (Set HTTP-Only Refresh Cookie)
Exchange for Google Profile    Assign 'owner' Role                         │
Match email in database                  │                                 ▼
       │                                 └─────────────────────────► Return { user, token }
       ▼
If New: Provision Org & User
If Existing: Issue JWT Session
```

---

## 2. Updated User Database Entity

### `server/src/models/UserEntity.ts`

```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'user' | 'viewer'

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  password_hash!: string | null

  @Column({ type: 'varchar', length: 128, nullable: true })
  google_id!: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null

  @Column({ type: 'text', nullable: true })
  avatar_url!: string | null

  @Column({ type: 'boolean', default: false })
  email_verified!: boolean

  @Column({ type: 'int', nullable: true })
  default_org_id!: number | null

  @Column({ type: 'varchar', length: 64, default: 'user' })
  role!: UserRole

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
```

---

## 3. Google OAuth 2.0 Implementation Service

### `server/src/services/GoogleAuthService.ts`

```ts
export interface GoogleUserProfile {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name?: string
  family_name?: string
  picture?: string
}

export class GoogleAuthService {
  private clientId = process.env.GOOGLE_CLIENT_ID || ''
  private clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
  private redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback'

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  async exchangeCodeForProfile(code: string): Promise<GoogleUserProfile> {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      throw new Error(`Google token exchange failed: ${await tokenRes.text()}`)
    }

    const tokenData = await tokenRes.json()

    // 2. Fetch user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!profileRes.ok) {
      throw new Error('Failed to fetch Google profile')
    }

    return (await profileRes.json()) as GoogleUserProfile
  }
}
```

---

## 4. Katal `AuthController.ts` Implementation

### `server/src/controllers/AuthController.ts`

```ts
import { Controller, Get, Post, Body, Query, Context, Inject } from 'katal'
import { AuthService } from '../services/AuthService'
import { GoogleAuthService } from '../services/GoogleAuthService'
import { SignupSchema, LoginSchema } from '../views/auth.dto'

export class AuthController extends Controller {
  constructor(
    @Inject() private authService: AuthService,
    @Inject() private googleAuthService: GoogleAuthService
  ) {
    super()
  }

  @Post('/api/auth/signup')
  async signup(@Body(SignupSchema) body: any, c: Context) {
    const result = await this.authService.signupWithPassword(body.email, body.password, body.name)
    c.cookie('apex_refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/api/auth',
    })
    return c.json({ success: true, token: result.accessToken, user: result.user }, 201)
  }

  @Post('/api/auth/login')
  async login(@Body(LoginSchema) body: any, c: Context) {
    const result = await this.authService.loginWithPassword(body.email, body.password)
    c.cookie('apex_refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/api/auth',
    })
    return c.json({ success: true, token: result.accessToken, user: result.user })
  }

  @Get('/api/auth/google')
  async googleRedirect(c: Context) {
    const state = crypto.randomUUID()
    c.cookie('oauth_state', state, { httpOnly: true, maxAge: 600, path: '/' })
    const url = this.googleAuthService.getAuthorizationUrl(state)
    return c.redirect(url)
  }

  @Get('/api/auth/google/callback')
  async googleCallback(@Query() query: any, c: Context) {
    const code = query.code
    const state = query.state
    const storedState = c.cookie('oauth_state')

    if (!code || state !== storedState) {
      return c.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=invalid_state`)
    }

    const profile = await this.googleAuthService.exchangeCodeForProfile(code)
    const result = await this.authService.loginOrRegisterGoogleUser(profile)

    c.cookie('apex_refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/api/auth',
    })

    return c.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${result.accessToken}`)
  }

  @Get('/api/auth/me')
  async me(c: Context) {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)
    const profile = await this.authService.getUserProfile(userId)
    return c.json({ success: true, user: profile })
  }

  @Post('/api/auth/logout')
  async logout(c: Context) {
    c.clearCookie('apex_refresh_token', { path: '/api/auth' })
    return c.json({ success: true, message: 'Logged out successfully' })
  }
}
```

---

## 5. Next.js Frontend Integration (`web/app/login/page.tsx`)

In the Next.js frontend, provide a sleek B2B login screen with:
1. **"Continue with Google" Button:**
   ```tsx
   <a 
     href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`}
     className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition font-medium"
   >
     <GoogleLogoIcon className="w-5 h-5" />
     Continue with Google Workspace
   </a>
   ```
2. **Standard Email & Password Form:** With live inline validation and password visibility toggle.

---

## 6. Verification Steps
- [ ] Sign up new user with `test@example.com` + password -> Verify Argon2id hash is saved and default organization is created with role `owner`.
- [ ] Attempt login with wrong password -> Assert HTTP 401 with descriptive error.
- [ ] Call `GET /api/auth/google` -> Assert redirect to `accounts.google.com`.
- [ ] Mock Google OAuth callback -> Assert user is created, JWT is issued, and redirect back to Next.js dashboard succeeds.
