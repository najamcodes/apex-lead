import { z } from 'zod'

export const OrgRoleEnum = z.enum(['owner', 'admin', 'manager', 'user', 'viewer'])

export const CreateOrgSchema = z.object({
  name: z.string().min(2, { message: 'Organization name must be at least 2 characters' }).trim(),
  tier: z.enum(['free', 'starter', 'pro', 'enterprise']).default('free'),
})

export const UpdateOrgSchema = z.object({
  name: z.string().min(2).optional(),
  tier: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
  billing_email: z.string().email().optional(),
})

export const InviteMemberSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }).transform(v => v.toLowerCase().trim()),
  role: OrgRoleEnum.default('user'),
})

export const AcceptInviteSchema = z.object({
  token: z.string().min(10, { message: 'Invalid invitation token' }),
})

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>
export type UpdateOrgInput = z.infer<typeof UpdateOrgSchema>
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>
