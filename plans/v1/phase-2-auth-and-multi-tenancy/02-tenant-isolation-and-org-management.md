# Phase 2 — Prompt 02: Multi-Tenant Organization Management & Invitations

> **Objective:** Implement organization switching, cryptographic team invitation links, and fine-grained Role-Based Access Control (RBAC) across organizations.

---

## 1. Multi-Tenant Architecture & Data Model

Every user belongs to one or more organizations via the `user_organizations` join table:

```
┌──────────────────┐          ┌──────────────────────┐          ┌───────────────────┐
│   UserEntity     │ 1      * │ UserOrganization    │ *      1 │ OrganizationEntity│
│  (id, email)     ├──────────► (user_id, org_id,    ◄──────────┤ (id, name, tier)  │
│                  │          │  role, created_at)   │          │                   │
└──────────────────┘          └──────────────────────┘          └───────────────────┘
```

---

## 2. Team Invitation Database Entity

### `server/src/models/OrganizationInvitationEntity.ts`

```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm'
import { OrganizationEntity } from './OrganizationEntity'

export type OrgRole = 'admin' | 'manager' | 'user' | 'viewer'

@Entity('organization_invitations')
export class OrganizationInvitationEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number

  @Column({ type: 'int' })
  @Index()
  org_id!: number

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization?: OrganizationEntity

  @Column({ type: 'varchar', length: 255 })
  @Index()
  email!: string

  @Column({ type: 'varchar', length: 32, default: 'user' })
  role!: OrgRole

  @Column({ type: 'varchar', length: 128, unique: true })
  token!: string

  @Column({ type: 'timestamp with time zone' })
  expires_at!: Date

  @Column({ type: 'boolean', default: false })
  accepted!: boolean

  @Column({ type: 'int', nullable: true })
  invited_by_user_id!: number | null

  @CreateDateColumn()
  created_at!: Date
}
```

---

## 3. RBAC Hierarchy & Permissions Matrix

```ts
// server/src/context/permissions.ts

export const ROLE_LEVELS = {
  owner: 5,
  admin: 4,
  manager: 3,
  user: 2,
  viewer: 1,
} as const

export type RoleName = keyof typeof ROLE_LEVELS

export function hasPermission(userRole: RoleName, requiredRole: RoleName): boolean {
  return (ROLE_LEVELS[userRole] ?? 0) >= (ROLE_LEVELS[requiredRole] ?? 99)
}
```

### Permission Guard Middleware in Katal:
```ts
// server/src/middleware/RequireRole.ts
import { Middleware, Context } from 'katal'
import { hasPermission, RoleName } from '../context/permissions'

export function requireRole(minimumRole: RoleName): Middleware {
  return async (c: Context, next: () => Promise<void>) => {
    const userRole = (c.get('userOrgRole') || 'viewer') as RoleName
    if (!hasPermission(userRole, minimumRole)) {
      return c.json({ error: `Forbidden: Requires minimum role '${minimumRole}'` }, 403)
    }
    await next()
  }
}
```

---

## 4. Organization Controller (`OrganizationController.ts`)

```ts
import { Controller, Get, Post, Put, Delete, Body, Param, Context, Inject } from 'katal'
import { OrganizationService } from '../services/OrganizationService'
import { requireRole } from '../middleware/RequireRole'
import { InviteMemberSchema, UpdateOrgSchema } from '../views/org.dto'

export class OrganizationController extends Controller {
  constructor(@Inject() private orgService: OrganizationService) {
    super()
  }

  // List all orgs the user belongs to
  @Get('/api/orgs')
  async listUserOrgs(c: Context) {
    const userId = c.get('userId')
    const orgs = await this.orgService.getUserOrganizations(userId)
    return c.json({ success: true, organizations: orgs })
  }

  // Switch active organization context
  @Post('/api/orgs/:id/switch')
  async switchOrg(@Param('id') id: string, c: Context) {
    const userId = c.get('userId')
    const orgId = Number(id)
    const token = await this.orgService.switchActiveOrganization(userId, orgId)
    return c.json({ success: true, token, activeOrgId: orgId })
  }

  // Invite team member (Admin/Owner only)
  @Post('/api/orgs/:id/invites', [requireRole('admin')])
  async inviteMember(@Param('id') id: string, @Body(InviteMemberSchema) body: any, c: Context) {
    const orgId = Number(id)
    const userId = c.get('userId')
    const invite = await this.orgService.createInvitation(orgId, userId, body.email, body.role)
    return c.json({ success: true, inviteLink: invite.link, expiresAt: invite.expiresAt }, 201)
  }

  // Accept invitation token
  @Post('/api/invitations/accept')
  async acceptInvite(@Body() body: { token: string }, c: Context) {
    const userId = c.get('userId')
    const org = await this.orgService.acceptInvitation(body.token, userId)
    return c.json({ success: true, message: `Joined ${org.name}`, orgId: org.id })
  }
}
```

---

## 5. Verification Protocol
- [ ] Create user A -> User A creates Organization "Acme Corp".
- [ ] User A invites `colleague@example.com` with role `manager` -> Assert invitation record is saved with unique 64-char crypto token.
- [ ] User B accepts invitation -> Assert User B is added to `user_organizations` with role `manager`.
- [ ] User B attempts to access `POST /api/orgs/:id/invites` (Admin required) -> Assert HTTP 403 Forbidden.
- [ ] Switch active organization -> Verify subsequent requests operate strictly within the selected `org_id`.
