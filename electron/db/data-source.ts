// electron/db/data-source.ts
// Lightweight, desktop-specific SQLite DataSource for Electron.

import 'reflect-metadata'
import { DataSource } from 'typeorm'
import path from 'path'
import fs from 'fs'

import { SettingsEntity } from './entities/SettingsEntity'
import { LeadEntity } from './entities/LeadEntity'
import { OutreachEntity } from './entities/OutreachEntity'
import { EmailAccountEntity } from './entities/EmailAccountEntity'
import { EmailTemplateEntity } from './entities/EmailTemplateEntity'
import { ScrapeJobEntity } from './entities/ScrapeJobEntity'
import { SuppressionEntity } from './entities/SuppressionEntity'
import { ActivityEntity } from './entities/ActivityEntity'
import { PipelineDefinitionEntity } from './entities/PipelineDefinitionEntity'
import { PipelineRunEntity } from './entities/PipelineRunEntity'
import { UserEntity } from './entities/UserEntity'
import { OrganizationEntity } from './entities/OrganizationEntity'
import { UserOrganizationEntity } from './entities/UserOrganizationEntity'
import { NoteEntity } from './entities/NoteEntity'
import { ApprovalEntity } from './entities/ApprovalEntity'
import { CollectionRecordEntity } from './entities/CollectionRecordEntity'
import { AIConnectionEntity } from './entities/AIConnectionEntity'
import { ProxyConfigEntity } from './entities/ProxyConfigEntity'

export const electronEntities = [
  SettingsEntity,
  LeadEntity,
  OutreachEntity,
  EmailAccountEntity,
  EmailTemplateEntity,
  ScrapeJobEntity,
  SuppressionEntity,
  ActivityEntity,
  PipelineDefinitionEntity,
  PipelineRunEntity,
  UserEntity,
  OrganizationEntity,
  UserOrganizationEntity,
  NoteEntity,
  ApprovalEntity,
  CollectionRecordEntity,
  AIConnectionEntity,
  ProxyConfigEntity,
]

function getElectronDbPath(): string {
  if (process.env.TEST_DB === 'true' || process.env.NODE_ENV === 'test') {
    return ':memory:'
  }
  try {
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      const userData = app.getPath('userData')
      if (!fs.existsSync(userData)) {
        fs.mkdirSync(userData, { recursive: true })
      }
      return path.join(userData, 'leadgen.db')
    }
  } catch {
    // Non-electron environment fallback
  }

  const dataDir = path.resolve('data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  return path.join(dataDir, 'leadgen.db')
}

export const electronDataSource = new DataSource({
  type: 'better-sqlite3',
  database: getElectronDbPath(),
  synchronize: true, // Auto-syncs desktop SQLite schema without heavy multi-version migrations
  logging: false,
  entities: electronEntities,
})
