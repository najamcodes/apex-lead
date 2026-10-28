import crypto from 'crypto'
import { getDataSource } from '../db'
import { OrganizationEntity } from '../db/entities/OrganizationEntity'
import { UserEntity } from '../db/entities/UserEntity'
import { UserOrganizationEntity } from '../db/entities/UserOrganizationEntity'
import { OrganizationInvitationEntity } from '../db/entities/OrganizationInvitationEntity'
import { generateAccessToken } from '../auth/jwt'
import { hasPermission } from '../context/permissions'

export class OrganizationService {
  async getUserOrganizations(userId: number) {
    const ds = getDataSource()
    const userOrgRepo = ds.getRepository(UserOrganizationEntity)

    const memberships = await userOrgRepo.find({
      where: { user_id: userId },
      relations: { org: true },
      order: { created_at: 'ASC' },
    })

    return memberships.map(m => ({
      id: m.org_id,
      name: m.org?.name || `Organization ${m.org_id}`,
      tier: m.org?.tier || 'free',
      role: m.role,
      is_default: m.is_default,
      created_at: m.created_at,
    }))
  }

  async switchActiveOrganization(userId: number, targetOrgId: number): Promise<string> {
    const ds = getDataSource()
    const userRepo = ds.getRepository(UserEntity)
    const userOrgRepo = ds.getRepository(UserOrganizationEntity)

    const membership = await userOrgRepo.findOneBy({ user_id: userId, org_id: targetOrgId })
    if (!membership) {
      throw new Error(`User does not have access to organization ${targetOrgId}.`)
    }

    const user = await userRepo.findOneBy({ id: userId })
    if (!user) throw new Error('User not found.')

    user.default_org_id = targetOrgId
    await userRepo.save(user)

    // Set default in user_organizations
    await userOrgRepo.update({ user_id: userId }, { is_default: false })
    await userOrgRepo.update({ user_id: userId, org_id: targetOrgId }, { is_default: true })

    return generateAccessToken({
      userId: user.id,
      email: user.email,
      orgId: targetOrgId,
      role: membership.role,
      systemRole: user.role,
    })
  }

  async createOrganization(userId: number, name: string, tier = 'free') {
    const ds = getDataSource()
    const userRepo = ds.getRepository(UserEntity)
    const orgRepo = ds.getRepository(OrganizationEntity)
    const userOrgRepo = ds.getRepository(UserOrganizationEntity)

    const user = await userRepo.findOneBy({ id: userId })
    if (!user) throw new Error('User not found.')

    const org = orgRepo.create({
      name: name.trim(),
      tier,
      settings: JSON.stringify({}),
    })
    const savedOrg = await orgRepo.save(org)

    const userOrg = userOrgRepo.create({
      user_id: user.id,
      org_id: savedOrg.id,
      role: 'owner',
      permissions: JSON.stringify(['all']),
      is_default: !user.default_org_id,
    })
    await userOrgRepo.save(userOrg)

    if (!user.default_org_id) {
      user.default_org_id = savedOrg.id
      await userRepo.save(user)
    }

    return savedOrg
  }

  async createInvitation(orgId: number, invitedByUserId: number, email: string, role: string) {
    const ds = getDataSource()
    const userOrgRepo = ds.getRepository(UserOrganizationEntity)
    const inviteRepo = ds.getRepository(OrganizationInvitationEntity)

    // Verify inviter has admin/owner rights in this org
    const inviterMembership = await userOrgRepo.findOneBy({ user_id: invitedByUserId, org_id: orgId })
    if (!inviterMembership || !hasPermission(inviterMembership.role, 'admin')) {
      throw new Error('Forbidden: Only organization admins or owners can invite members.')
    }

    const normalizedEmail = email.toLowerCase().trim()
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invite = inviteRepo.create({
      org_id: orgId,
      email: normalizedEmail,
      role: role as import('../db/entities/OrganizationInvitationEntity').OrgRole,
      token,
      expires_at: expiresAt,
      accepted: false,
      invited_by_user_id: invitedByUserId,
    })
    await inviteRepo.save(invite)

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    const inviteLink = `${baseUrl}/invitations/accept?token=${token}`

    return {
      token,
      link: inviteLink,
      expiresAt,
    }
  }

  async acceptInvitation(token: string, userId: number) {
    const ds = getDataSource()
    const inviteRepo = ds.getRepository(OrganizationInvitationEntity)
    const userRepo = ds.getRepository(UserEntity)
    const orgRepo = ds.getRepository(OrganizationEntity)
    const userOrgRepo = ds.getRepository(UserOrganizationEntity)

    const invite = await inviteRepo.findOneBy({ token })
    if (!invite) {
      throw new Error('Invalid or non-existent invitation token.')
    }
    if (invite.accepted) {
      throw new Error('This invitation has already been accepted.')
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new Error('This invitation token has expired.')
    }

    const user = await userRepo.findOneBy({ id: userId })
    if (!user) throw new Error('User not found.')

    const org = await orgRepo.findOneBy({ id: invite.org_id })
    if (!org) throw new Error('Organization not found.')

    // Check if membership already exists
    let membership = await userOrgRepo.findOneBy({ user_id: userId, org_id: org.id })
    if (membership) {
      // Upgrade role if invitation has higher privilege
      membership.role = invite.role
      await userOrgRepo.save(membership)
    } else {
      membership = userOrgRepo.create({
        user_id: userId,
        org_id: org.id,
        role: invite.role,
        permissions: JSON.stringify(['view_leads', 'run_scraper']),
        is_default: !user.default_org_id,
      })
      await userOrgRepo.save(membership)
    }

    invite.accepted = true
    await inviteRepo.save(invite)

    if (!user.default_org_id) {
      user.default_org_id = org.id
      await userRepo.save(user)
    }

    return org
  }
}
