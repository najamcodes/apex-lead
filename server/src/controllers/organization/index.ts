import type { Application, Router } from 'katal'
import { ListUserOrgsController } from './ListUserOrgsController'
import { CreateOrgController } from './CreateOrgController'
import { SwitchOrgController } from './SwitchOrgController'
import { InviteMemberController } from './InviteMemberController'
import { AcceptInviteController } from './AcceptInviteController'
import { OrganizationController } from './OrganizationController'
import { ProxyConfigController } from './ProxyConfigController'

export * from './ListUserOrgsController'
export * from './CreateOrgController'
export * from './SwitchOrgController'
export * from './InviteMemberController'
export * from './AcceptInviteController'
export * from './OrganizationController'
export * from './ProxyConfigController'

export function registerOrganizationRoutes(app: Application | Router) {
  // V1 endpoints
  app.get('/api/v1/orgs', ListUserOrgsController)
  app.post('/api/v1/orgs', CreateOrgController)
  app.post('/api/v1/orgs/:id/switch', SwitchOrgController)
  app.post('/api/v1/orgs/:id/invites', InviteMemberController)
  app.post('/api/v1/invitations/accept', AcceptInviteController)

  // /api/orgs/*
  app.get('/api/orgs', OrganizationController.list)
  app.get('/api/orgs/current', OrganizationController.getCurrent)
  app.post('/api/orgs/switch', OrganizationController.switchOrg)
  app.get('/api/orgs/:id', OrganizationController.getById)
  app.post('/api/orgs', OrganizationController.create)
  app.put('/api/orgs/:id', OrganizationController.update)
  app.delete('/api/orgs/:id', OrganizationController.delete)
  app.get('/api/orgs/:id/members', OrganizationController.getMembers)
  app.post('/api/orgs/:id/members', OrganizationController.addMember)
  app.put('/api/orgs/:id/members/:userId', OrganizationController.updateMember)
  app.delete('/api/orgs/:id/members/:userId', OrganizationController.removeMember)

  // /api/proxy-configs/*
  app.get('/api/proxy-configs', ProxyConfigController.list)
  app.post('/api/proxy-configs', ProxyConfigController.create)
  app.get('/api/proxy-configs/:id', ProxyConfigController.getById)
  app.put('/api/proxy-configs/:id', ProxyConfigController.update)
  app.delete('/api/proxy-configs/:id', ProxyConfigController.delete)
}
