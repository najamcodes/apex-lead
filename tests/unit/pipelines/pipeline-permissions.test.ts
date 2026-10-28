import { describe, it, expect } from 'bun:test'
import { roleLevel, hasPermission, canEditPipelines, canRunPipelines, canViewPipelines } from '@sdk/core/db/queries/tenant'
import { roleLevel as graphRoleLevel } from '@sdk/core/engine/graph'

describe('Pipeline Permissions & Role Hierarchy', () => {
  it('should correctly rank all role aliases including admin and owner', () => {
    expect(roleLevel('super_admin')).toBe(5)
    expect(roleLevel('owner')).toBe(4)
    expect(roleLevel('admin')).toBe(4)
    expect(roleLevel('org_admin')).toBe(4)
    expect(roleLevel('manager')).toBe(3)
    expect(roleLevel('user')).toBe(2)
    expect(roleLevel('viewer')).toBe(1)
    expect(roleLevel('unknown_role')).toBe(1)

    expect(graphRoleLevel('admin')).toBe(4)
    expect(graphRoleLevel('owner')).toBe(4)
  })

  it('should grant pipeline editing and running to admin and owner roles', () => {
    expect(canEditPipelines('owner')).toBe(true)
    expect(canEditPipelines('admin')).toBe(true)
    expect(canEditPipelines('org_admin')).toBe(true)
    expect(canEditPipelines('super_admin')).toBe(true)
    expect(canEditPipelines('manager')).toBe(true)

    expect(canRunPipelines('owner')).toBe(true)
    expect(canRunPipelines('admin')).toBe(true)
    expect(canRunPipelines('user')).toBe(true)

    expect(canViewPipelines('user')).toBe(true)
    expect(canViewPipelines('viewer', ['view_pipelines'])).toBe(true)
    expect(canViewPipelines('viewer')).toBe(false)
  })

  it('should recognize wildcard "all" and "*" in permissions', () => {
    expect(hasPermission('edit_pipelines', 'user', ['all'])).toBe(true)
    expect(hasPermission('edit_pipelines', 'user', ['*'])).toBe(true)
    expect(hasPermission('edit_pipelines', 'user', ['edit_pipelines'])).toBe(true)
    expect(hasPermission('edit_pipelines', 'viewer', ['view_leads'])).toBe(false)
  })

  it('should allow pipeline editing in desktop mode for all standard users', () => {
    const prev = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'desktop'
      expect(canEditPipelines('user')).toBe(true)
      expect(canRunPipelines('user')).toBe(true)
      expect(canViewPipelines('user')).toBe(true)
    } finally {
      process.env.NODE_ENV = prev
    }
  })
})
