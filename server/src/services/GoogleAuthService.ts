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
  private clientId = process.env.GOOGLE_CLIENT_ID || 'dummy-google-client-id'
  private clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'dummy-google-client-secret'
  private redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/v1/auth/google/callback'

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

    const tokenData = (await tokenRes.json()) as { access_token: string }

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
