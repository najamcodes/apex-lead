import { getDataSource } from '../db'
import { UserEntity } from '../db/entities/UserEntity'
import { OrganizationEntity } from '../db/entities/OrganizationEntity'
import { UserOrganizationEntity } from '../db/entities/UserOrganizationEntity'
import { hashPassword, verifyPassword } from '@sdk/core/utils/crypto'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../auth/jwt'
import type { GoogleUserProfile } from './GoogleAuthService'

export interface AuthSessionResult {
  user: {
    id: number
    email: string
    name: string | null
    avatar_url: string | null
    role: string
    default_org_id: number | null
  }
  accessToken: string
  refreshToken: string
}

export class AuthService {
  async signupWithPassword(email: string, password: string, name?: string): Promise<AuthSessionResult> {
    const ds = getDataSource()
    const userRepo = ds.getRepository(UserEntity)
    const orgRepo = ds.getRepository(OrganizationEntity)
    const userOrgRepo = ds.getRepository(UserOrganizationEntity)

    const normalizedEmail = email.toLowerCase().trim()
    const existing = await userRepo.findOneBy({ email: normalizedEmail })
    if (existing) {
      throw new Error('An account with this email address already exists.')
    }

    const passwordHash = hashPassword(password)

    // 1. Create User
    const user = userRepo.create({
      email: normalizedEmail,
      password_hash: passwordHash,
      name: name?.trim() || null,
      email_verified: false,
      role: 'user',
      permissions: JSON.stringify(['view_leads', 'run_scraper']),
    })
    const savedUser = await userRepo.save(user)

    // 2. Provision Default Organization
    const orgName = name ? `${name.trim()}'s Organization` : 'My Organization'
    const org = orgRepo.create({
      name: orgName,
      tier: 'free',
      settings: JSON.stringify({}),
    })
    const savedOrg = await orgRepo.save(org)

    // 3. Link User to Org as Owner
    savedUser.default_org_id = savedOrg.id
    await userRepo.save(savedUser)

    const userOrg = userOrgRepo.create({
      user_id: savedUser.id,
      org_id: savedOrg.id,
      role: 'owner',
      permissions: JSON.stringify(['all']),
      is_default: true,
    })
    await userOrgRepo.save(userOrg)

    // 4. Generate Tokens
    const accessToken = generateAccessToken({
      userId: savedUser.id,
      email: savedUser.email,
      orgId: savedOrg.id,
      role: 'owner',
      systemRole: savedUser.role,
    })
    const refreshToken = generateRefreshToken({
      userId: savedUser.id,
    })

    return {
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        avatar_url: savedUser.avatar_url,
        role: savedUser.role,
        default_org_id: savedOrg.id,
      },
      accessToken,
      refreshToken,
    }
  }

  async loginWithPassword(email: string, password: string): Promise<AuthSessionResult> {
    const ds = getDataSource()
    const userRepo = ds.getRepository(UserEntity)
    const userOrgRepo = ds.getRepository(UserOrganizationEntity)

    const normalizedEmail = email.toLowerCase().trim()
    const user = await userRepo.findOneBy({ email: normalizedEmail })
    if (!user || !user.password_hash) {
      throw new Error('Invalid email or password.')
    }

    const isValid = verifyPassword(password, user.password_hash)
    if (!isValid) {
      throw new Error('Invalid email or password.')
    }

    // Resolve Org and Role
    let activeOrgId = user.default_org_id
    let activeRole = 'user'

    if (activeOrgId) {
      const link = await userOrgRepo.findOneBy({ user_id: user.id, org_id: activeOrgId })
      if (link) {
        activeRole = link.role
      }
    } else {
      const firstLink = await userOrgRepo.findOne({
        where: { user_id: user.id },
        order: { is_default: 'DESC', created_at: 'ASC' },
      })
      if (firstLink) {
        activeOrgId = firstLink.org_id
        activeRole = firstLink.role
        user.default_org_id = activeOrgId
        await userRepo.save(user)
      }
    }

    const orgId = activeOrgId || 1

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      orgId,
      role: activeRole,
      systemRole: user.role,
    })
    const refreshToken = generateRefreshToken({
      userId: user.id,
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
        default_org_id: orgId,
      },
      accessToken,
      refreshToken,
    }
  }

  async loginOrRegisterGoogleUser(profile: GoogleUserProfile): Promise<AuthSessionResult> {
    const ds = getDataSource()
    const userRepo = ds.getRepository(UserEntity)
    const orgRepo = ds.getRepository(OrganizationEntity)
    const userOrgRepo = ds.getRepository(UserOrganizationEntity)

    const normalizedEmail = profile.email.toLowerCase().trim()

    // Find by google_id or email
    let user = await userRepo.findOne({
      where: [{ google_id: profile.id }, { email: normalizedEmail }],
    })

    let activeOrgId: number | null = null
    let activeRole = 'owner'

    if (!user) {
      // 1. Create New User
      user = userRepo.create({
        email: normalizedEmail,
        google_id: profile.id,
        name: profile.name || null,
        avatar_url: profile.picture || null,
        email_verified: profile.verified_email ?? true,
        role: 'user',
        permissions: JSON.stringify(['view_leads', 'run_scraper']),
      })
      user = await userRepo.save(user)

      // 2. Provision Default Organization
      const orgName = profile.name ? `${profile.name}'s Organization` : 'My Organization'
      const org = orgRepo.create({
        name: orgName,
        tier: 'free',
        settings: JSON.stringify({}),
      })
      const savedOrg = await orgRepo.save(org)

      user.default_org_id = savedOrg.id
      await userRepo.save(user)

      const userOrg = userOrgRepo.create({
        user_id: user.id,
        org_id: savedOrg.id,
        role: 'owner',
        permissions: JSON.stringify(['all']),
        is_default: true,
      })
      await userOrgRepo.save(userOrg)

      activeOrgId = savedOrg.id
      activeRole = 'owner'
    } else {
      // Existing user: link google_id and update avatar/name if missing
      let modified = false
      if (!user.google_id) {
        user.google_id = profile.id
        user.email_verified = true
        modified = true
      }
      if (!user.avatar_url && profile.picture) {
        user.avatar_url = profile.picture
        modified = true
      }
      if (!user.name && profile.name) {
        user.name = profile.name
        modified = true
      }
      if (modified) {
        await userRepo.save(user)
      }

      activeOrgId = user.default_org_id
      if (activeOrgId) {
        const link = await userOrgRepo.findOneBy({ user_id: user.id, org_id: activeOrgId })
        if (link) activeRole = link.role
      } else {
        const firstLink = await userOrgRepo.findOne({
          where: { user_id: user.id },
          order: { is_default: 'DESC', created_at: 'ASC' },
        })
        if (firstLink) {
          activeOrgId = firstLink.org_id
          activeRole = firstLink.role
          user.default_org_id = activeOrgId
          await userRepo.save(user)
        }
      }
    }

    const orgId = activeOrgId || 1

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      orgId,
      role: activeRole,
      systemRole: user.role,
    })
    const refreshToken = generateRefreshToken({
      userId: user.id,
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
        default_org_id: orgId,
      },
      accessToken,
      refreshToken,
    }
  }

  async refreshSession(refreshToken: string): Promise<AuthSessionResult> {
    const payload = verifyRefreshToken(refreshToken)
    const ds = getDataSource()
    const userRepo = ds.getRepository(UserEntity)
    const userOrgRepo = ds.getRepository(UserOrganizationEntity)

    const user = await userRepo.findOneBy({ id: payload.userId })
    if (!user) {
      throw new Error('User account not found or deactivated.')
    }

    let activeOrgId = user.default_org_id
    let activeRole = 'user'

    if (activeOrgId) {
      const link = await userOrgRepo.findOneBy({ user_id: user.id, org_id: activeOrgId })
      if (link) activeRole = link.role
    } else {
      const firstLink = await userOrgRepo.findOne({
        where: { user_id: user.id },
        order: { is_default: 'DESC', created_at: 'ASC' },
      })
      if (firstLink) {
        activeOrgId = firstLink.org_id
        activeRole = firstLink.role
      }
    }

    const orgId = activeOrgId || 1

    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      orgId,
      role: activeRole,
      systemRole: user.role,
    })
    const newRefreshToken = generateRefreshToken({
      userId: user.id,
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
        default_org_id: orgId,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }
  }

  async getUserProfile(userId: number) {
    const ds = getDataSource()
    const userRepo = ds.getRepository(UserEntity)
    const userOrgRepo = ds.getRepository(UserOrganizationEntity)

    const user = await userRepo.findOneBy({ id: userId })
    if (!user) throw new Error('User not found')

    const userOrgs = await userOrgRepo.find({
      where: { user_id: userId },
      relations: { org: true },
    })

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      role: user.role,
      default_org_id: user.default_org_id,
      organizations: userOrgs.map(uo => ({
        id: uo.org_id,
        name: uo.org?.name || `Organization ${uo.org_id}`,
        tier: uo.org?.tier || 'free',
        role: uo.role,
        is_default: uo.is_default,
      })),
    }
  }
}
