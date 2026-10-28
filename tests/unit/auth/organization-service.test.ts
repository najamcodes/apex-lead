import '../../../server/polyfill'
import { describe, it, expect, beforeAll } from 'bun:test'
import { initDb, getDataSource } from '@sdk/core/db'
import { AuthService } from '../../../server/src/services/AuthService'
import { OrganizationService } from '../../../server/src/services/OrganizationService'
import { OrganizationInvitationEntity } from '@sdk/core/db/entities/OrganizationInvitationEntity'
import { verifyAccessToken } from '../../../server/src/auth/jwt'

describe('Multi-Tenant Organization Management & Invitations (Prompt 02)', () => {
  let authService: AuthService
  let orgService: OrganizationService

  beforeAll(async () => {
    process.env.DATABASE_URL = ''
    process.env.JWT_SECRET = 'test_jwt_secret_12345'
    process.env.REFRESH_SECRET = 'test_refresh_secret_12345'
    await initDb()
    authService = new AuthService()
    orgService = new OrganizationService()
  })

  it('should list user organizations with roles and default flags', async () => {
    const timestamp = Date.now()
    const session = await authService.signupWithPassword(
      `founder-${timestamp}@enterprise.io`,
      'Password#2026!',
      'Founder User'
    )

    const orgs = await orgService.getUserOrganizations(session.user.id)
    expect(orgs.length).toBeGreaterThanOrEqual(1)
    expect(orgs[0].role).toBe('owner')
    expect(orgs[0].is_default).toBe(true)
  })

  it('should switch active organization context and issue new scoped access token', async () => {
    const timestamp = Date.now()
    const session = await authService.signupWithPassword(
      `switcher-${timestamp}@multi-org.io`,
      'Password#2026!',
      'Switcher User'
    )

    // Create a second organization
    const org2 = await orgService.createOrganization(session.user.id, 'Secondary Ventures Corp', 'pro')
    expect(org2.id).toBeDefined()

    // Switch to org2
    const newToken = await orgService.switchActiveOrganization(session.user.id, org2.id)
    expect(newToken).toBeDefined()

    const payload = verifyAccessToken(newToken)
    expect(payload.orgId).toBe(org2.id)
    expect(payload.role).toBe('owner')

    // Verify error when attempting to switch to an unauthorized org
    await expect(orgService.switchActiveOrganization(session.user.id, 999999)).rejects.toThrow('does not have access')
  })

  it('should create a cryptographic invitation link and allow invited member to accept', async () => {
    const timestamp = Date.now()
    // 1. Inviter creates an account and organization
    const inviter = await authService.signupWithPassword(
      `boss-${timestamp}@acme.corp`,
      'BossPassword#123',
      'Boss Admin'
    )

    // 2. Invitee creates an account
    const invitee = await authService.signupWithPassword(
      `worker-${timestamp}@gmail.com`,
      'WorkerPassword#123',
      'Worker Joe'
    )

    // 3. Inviter creates invitation with role 'manager'
    const invite = await orgService.createInvitation(
      inviter.user.default_org_id!,
      inviter.user.id,
      invitee.user.email,
      'manager'
    )

    expect(invite.token).toHaveLength(64) // 32 bytes hex
    expect(invite.link).toContain('/invitations/accept?token=')
    expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now())

    // 4. Verify non-admin cannot invite
    await expect(
      orgService.createInvitation(
        inviter.user.default_org_id!,
        invitee.user.id, // regular user
        'someone@test.com',
        'user'
      )
    ).rejects.toThrow('Forbidden')

    // 5. Invitee accepts invitation
    const joinedOrg = await orgService.acceptInvitation(invite.token, invitee.user.id)
    expect(joinedOrg.id).toBe(inviter.user.default_org_id!)

    // 6. Verify invitee now belongs to inviter's organization with 'manager' role
    const inviteeOrgs = await orgService.getUserOrganizations(invitee.user.id)
    const membership = inviteeOrgs.find(o => o.id === inviter.user.default_org_id!)
    expect(membership).toBeDefined()
    expect(membership!.role).toBe('manager')

    // 7. Verify invitation cannot be reused
    await expect(orgService.acceptInvitation(invite.token, invitee.user.id)).rejects.toThrow('already been accepted')
  })
})
