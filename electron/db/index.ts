// electron/db/index.ts
// Entry point for Electron's local database runtime.

import { electronDataSource } from './data-source'
import { registerStorageProvider } from '@sdk/core/storage'
import { UserEntity } from './entities/UserEntity'
import { OrganizationEntity } from './entities/OrganizationEntity'
import { UserOrganizationEntity } from './entities/UserOrganizationEntity'
import { SettingsEntity } from './entities/SettingsEntity'
import { LeadEntity } from './entities/LeadEntity'
import * as leadsQueries from './queries/leads.queries'
import * as outreachQueries from './queries/outreach.queries'
import * as emailAccountsQueries from './queries/email-accounts.queries'
import * as scrapeJobsQueries from './queries/scrape-jobs.queries'
import * as settingsQueries from './queries/settings.queries'
import * as activityQueries from './queries/activity.queries'

export * from './data-source'

export function getDataSource() {
  return electronDataSource
}

export function isDbInitialized(): boolean {
  return electronDataSource.isInitialized
}

export async function closeDb(): Promise<void> {
  if (electronDataSource.isInitialized) {
    await electronDataSource.destroy()
  }
}

/**
 * Initialize Electron's local SQLite database and seed default desktop data.
 */
export async function initDb(): Promise<void> {
  if (!electronDataSource.isInitialized) {
    await electronDataSource.initialize()
  }

  // Register Electron local database as active storage provider for @sdk/core
  registerStorageProvider({
    getDataSource: () => electronDataSource,
    leads: {
      async insertLead(lead: any): Promise<any> {
        return leadsQueries.insertLead(lead)
      },
      async getAllLeads(options?: any): Promise<any[]> {
        const res = await leadsQueries.getAllLeads(options)
        return (res as any)?.items || (Array.isArray(res) ? res : [])
      },
      async getLeadById(id: number): Promise<any> {
        return leadsQueries.getLeadById(id)
      },
      async updateLead(id: number, data: any): Promise<void> {
        if (data.status) {
          await leadsQueries.updateLeadStatus(id, data.status)
        } else {
          await electronDataSource.getRepository(LeadEntity).update(id, data)
        }
      },
    },
    outreach: {
      insertOutreach: (data: any) => outreachQueries.insertOutreach(data),
      getOutreachByLead: (leadId: number) => outreachQueries.getOutreachByLead(leadId),
      getDueOutreach: () => outreachQueries.getDueOutreach(),
      getOutreachById: (id: number) => outreachQueries.getOutreachById(id),
      updateOutreachStatus: (id: number, status: string, extra?: Record<string, unknown>) =>
        outreachQueries.updateOutreachStatus(id, status as any, extra),
    },
    emailAccounts: {
      getEmailAccounts: () => emailAccountsQueries.getEmailAccounts(),
      getRawEmailAccountById: (id: number) => emailAccountsQueries.getRawEmailAccountById(id),
      incrementSentToday: (id: number) => emailAccountsQueries.incrementSentToday(id),
      updateEmailAccount: (id: number, data: any) => emailAccountsQueries.updateEmailAccount(id, data),
    },
    scrapeJobs: {
      insertScrapeJob: (job: any) => scrapeJobsQueries.insertScrapeJob(job),
      updateScrapeJob: (id: string, data: any) => scrapeJobsQueries.updateScrapeJob(id, data),
    },
    settings: {
      getSettings: () => settingsQueries.getSettings(),
      updateSettings: (data: any) => settingsQueries.saveSettings(data),
    },
    activity: {
      logActivity: async (action: string, _entity_type: string, entity_id: number | null, details: string | null) => {
        await activityQueries.logActivity(entity_id || 0, action as any, details || undefined)
      },
    },
  })

  // Seed default desktop organization and user if none exists
  await seedDefaultDesktopData()
}

async function seedDefaultDesktopData(): Promise<void> {
  const orgRepo = electronDataSource.getRepository(OrganizationEntity)
  let defaultOrg = await orgRepo.findOneBy({ id: 1 })
  if (!defaultOrg) {
    defaultOrg = orgRepo.create({
      id: 1,
      name: 'Personal Workspace',
      tier: 'pro',
    })
    await orgRepo.save(defaultOrg)
  }

  const userRepo = electronDataSource.getRepository(UserEntity)
  let adminUser = await userRepo.findOneBy({ id: 1 })
  if (!adminUser) {
    adminUser = userRepo.create({
      id: 1,
      email: 'admin@local.host',
      name: 'Desktop Admin',
      role: 'owner',
      permissions: JSON.stringify(['*']),
      password_hash: 'local_admin_no_password_yet',
      default_org_id: 1,
    })
    await userRepo.save(adminUser)
  }

  const userOrgRepo = electronDataSource.getRepository(UserOrganizationEntity)
  const existingLink = await userOrgRepo.findOneBy({ user_id: 1, org_id: 1 })
  if (!existingLink) {
    await userOrgRepo.save(userOrgRepo.create({
      user_id: 1,
      org_id: 1,
      role: 'owner',
    }))
  }

  const settingsRepo = electronDataSource.getRepository(SettingsEntity)
  const existingSetting = await settingsRepo.findOneBy({ org_id: 1, key: 'backend_server_url' })
  if (!existingSetting) {
    await settingsRepo.save([
      settingsRepo.create({ org_id: 1, key: 'backend_server_url', value: 'http://localhost:4000' }),
      settingsRepo.create({ org_id: 1, key: 'auto_start_local_server', value: 'true' }),
      settingsRepo.create({ org_id: 1, key: 'active_org_id', value: '1' }),
    ])
  }
}
