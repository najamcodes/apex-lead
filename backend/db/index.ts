import 'reflect-metadata'
import { DataSource } from 'typeorm'
const path = require('path')

import { OrganizationEntity } from './entities/OrganizationEntity'
import { LeadEntity } from './entities/LeadEntity'
import { UserEntity } from './entities/UserEntity'
import { UserOrganizationEntity } from './entities/UserOrganizationEntity'
import { ProxyConfigEntity } from './entities/ProxyConfigEntity'
import { SettingsEntity } from './entities/SettingsEntity'
import { OutreachEntity } from './entities/OutreachEntity'
import { NoteEntity } from './entities/NoteEntity'
import { ActivityEntity } from './entities/ActivityEntity'
import { ScrapeJobEntity } from './entities/ScrapeJobEntity'
import { EmailTemplateEntity } from './entities/EmailTemplateEntity'
import { EmailAccountEntity } from './entities/EmailAccountEntity'
import { PluginSettingsEntity } from './entities/PluginSettingsEntity'
import { PipelineDefinitionEntity } from './entities/PipelineDefinitionEntity'
import { PipelineRunEntity } from './entities/PipelineRunEntity'
import { CollectionRecordEntity } from './entities/CollectionRecordEntity'
import { WorkerNodeEntity } from './entities/WorkerNodeEntity'
import { ApprovalEntity } from './entities/ApprovalEntity'
import { AIConnectionEntity } from './entities/AIConnectionEntity'
import { CustomNodeEntity } from './entities/CustomNodeEntity'
import { AuditLogEntity } from './entities/AuditLogEntity'
import { seedDefaultPipelines } from '../pipelines/seed'
import { registerStorageProvider } from '@sdk/core/storage'
import * as leadsQueries from './queries/leads.queries'
import * as outreachQueries from './queries/outreach.queries'
import * as emailAccountsQueries from './queries/email-accounts.queries'
import * as scrapeJobsQueries from './queries/scrape-jobs.queries'
import * as settingsQueries from './queries/settings.queries'
import * as activityQueries from './queries/activity.queries'

let _dataSource: DataSource | null = null

export async function initDb(): Promise<DataSource> {
  if (_dataSource?.isInitialized) return _dataSource

  const entities = [
    OrganizationEntity,
    UserEntity,
    UserOrganizationEntity,
    ProxyConfigEntity,
    LeadEntity,
    SettingsEntity,
    OutreachEntity,
    NoteEntity,
    ActivityEntity,
    ScrapeJobEntity,
    EmailTemplateEntity,
    EmailAccountEntity,
    PluginSettingsEntity,
    PipelineDefinitionEntity,
    PipelineRunEntity,
    CollectionRecordEntity,
    WorkerNodeEntity,
    ApprovalEntity,
    AIConnectionEntity,
    CustomNodeEntity,
    AuditLogEntity,
  ]

  const isPostgres = process.env.DB_TYPE === 'postgres'

  if (isPostgres) {
    _dataSource = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/leadhunter',
      synchronize: true,
      entities,
    })
  } else {
    let dbPath: string
    if (process.env.LEADHUNTER_DB_PATH) {
      dbPath = process.env.LEADHUNTER_DB_PATH
    } else if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
      const { app } = require('electron')
      if (app && app.isPackaged) {
        dbPath = path.join(app.getPath('userData'), 'leadhunter.db')
      } else {
        const fs = require('fs')
        const dataDir = path.join(process.cwd(), 'data')
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true })
        }
        dbPath = path.join(dataDir, 'leadhunter.db')
      }
    } else {
      // Default for server/bun if env var not set
      const fs = require('fs')
      const dataDir = path.join(process.cwd(), 'data')
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }
      dbPath = path.join(dataDir, 'leadhunter.db')
    }
    
    _dataSource = new DataSource({
      type: 'better-sqlite3',
      database: dbPath,
      synchronize: true, // Auto-create schema for local development
      entities,
    })
  }

  await _dataSource.initialize()
  
  // Create default organization if missing
  const orgRepo = _dataSource.getRepository(OrganizationEntity)
  let defaultOrg = await orgRepo.findOneBy({ id: 1 })
  if (!defaultOrg) {
    defaultOrg = orgRepo.create({
      name: 'Default Organization'
    })
    await orgRepo.save(defaultOrg)
  }

  // Create default admin user if missing
  const userRepo = _dataSource.getRepository(UserEntity)
  let adminUser = await userRepo.findOneBy({ id: 1 })
  if (!adminUser) {
    adminUser = userRepo.create({
      email: 'admin@leadhunter.local',
      password_hash: 'local_admin_no_password_yet',
      default_org_id: defaultOrg.id,
      role: 'super_admin',
      permissions: JSON.stringify(['view_leads', 'run_scraper', 'manage_settings', 'send_outreach', 'manage_users', 'manage_org'])
    })
    await userRepo.save(adminUser)
  }

  // Create user-organization link for admin
  const userOrgRepo = _dataSource.getRepository(UserOrganizationEntity)
  let userOrgLink = await userOrgRepo.findOneBy({ user_id: adminUser.id, org_id: defaultOrg.id })
  if (!userOrgLink) {
    userOrgLink = userOrgRepo.create({
      user_id: adminUser.id,
      org_id: defaultOrg.id,
      role: 'super_admin'
    })
    await userOrgRepo.save(userOrgLink)
  }

  // Update all existing tables where org_id IS NULL to use org_id = 1
  const tablesWithUser = [
    'leads', 'outreach', 'notes', 'activity', 'scrape_jobs',
    'email_templates', 'query_profiles', 'scrape_targets',
    'digest_runs', 'email_accounts', 'settings'
  ];

  for (const table of tablesWithUser) {
    try {
      await _dataSource.query(`UPDATE ${table} SET org_id = 1 WHERE org_id IS NULL;`)
    } catch (e) {
      // table might not exist yet or org_id column not added yet, ignore safely
    }
  }

  // Apply pragmas only for SQLite
  if (!isPostgres) {
    await _dataSource.query('PRAGMA journal_mode = WAL;')
    await _dataSource.query('PRAGMA foreign_keys = ON;')
  }

  // Seed default pipeline definitions if missing
  try {
    await seedDefaultPipelines(defaultOrg.id)
  } catch (err) {
    console.warn('[db] Failed to seed default pipelines:', err)
  }

  // Register concrete storage provider with @sdk/core/storage
  registerStorageProvider({
    getDataSource: () => getDataSource(),
    leads: leadsQueries as any,
    outreach: outreachQueries as any,
    emailAccounts: emailAccountsQueries as any,
    scrapeJobs: scrapeJobsQueries as any,
    settings: settingsQueries as any,
    activity: activityQueries as any,
    aiConnections: {
      getConnectionById: async (id: string) => {
        return getDataSource().getRepository(AIConnectionEntity).findOneBy({ id })
      },
      getDefaultConnection: async (orgId: number) => {
        return getDataSource().getRepository(AIConnectionEntity).findOneBy({ org_id: orgId, is_default: true })
      },
    },
  })

  return _dataSource
}

export function getDataSource(): DataSource {
  if (_dataSource && _dataSource.isInitialized) {
    return _dataSource
  }
  const { AppDataSource } = require('./data-source')
  if (AppDataSource && AppDataSource.isInitialized) {
    return AppDataSource
  }
  throw new Error('Database not initialized! Call initDb() first.')
}
