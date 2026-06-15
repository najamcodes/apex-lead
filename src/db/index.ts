import 'reflect-metadata'
import { DataSource } from 'typeorm'
import path from 'path'
import { app } from 'electron'

import { OrganizationEntity } from './entities/OrganizationEntity'
import { LeadEntity } from './entities/LeadEntity'
import { UserEntity } from './entities/UserEntity'
import { SettingsEntity } from './entities/SettingsEntity'
import { OutreachEntity } from './entities/OutreachEntity'
import { NoteEntity } from './entities/NoteEntity'
import { ActivityEntity } from './entities/ActivityEntity'
import { ScrapeJobEntity } from './entities/ScrapeJobEntity'
import { EmailTemplateEntity } from './entities/EmailTemplateEntity'
import { QueryProfileEntity } from './entities/QueryProfileEntity'
import { ScrapeTargetEntity } from './entities/ScrapeTargetEntity'
import { DigestRunEntity } from './entities/DigestRunEntity'
import { EmailAccountEntity } from './entities/EmailAccountEntity'

let _dataSource: DataSource | null = null

export async function initDb(): Promise<DataSource> {
  if (_dataSource?.isInitialized) return _dataSource

  const dbPath = path.join(app.getPath('userData'), 'leadhunter.db')
  
  _dataSource = new DataSource({
    type: 'better-sqlite3',
    database: dbPath,
    synchronize: true, // Auto-create schema for local development
    entities: [
      OrganizationEntity,
      UserEntity,
      LeadEntity,
      SettingsEntity,
      OutreachEntity,
      NoteEntity,
      ActivityEntity,
      ScrapeJobEntity,
      EmailTemplateEntity,
      QueryProfileEntity,
      ScrapeTargetEntity,
      DigestRunEntity,
      EmailAccountEntity
    ],
  })

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
      org_id: defaultOrg.id,
      role: 'admin',
      permissions: JSON.stringify(['view_leads', 'run_scraper', 'manage_settings', 'send_outreach'])
    })
    await userRepo.save(adminUser)
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

  // Apply pragmas
  await _dataSource.query('PRAGMA journal_mode = WAL;')
  await _dataSource.query('PRAGMA foreign_keys = ON;')

  return _dataSource
}

export function getDataSource(): DataSource {
  if (!_dataSource || !_dataSource.isInitialized) {
    throw new Error('Database not initialized! Call initDb() first.')
  }
  return _dataSource
}
